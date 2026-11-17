// Equipe de IA do cliente (11/11/2026, pedido do dono: "preciso concluir o que já tem"). Até aqui o motor de IA só
// atendia o escritório interno da Nuvem; o cliente montava a equipe no lote e ela era só visual. Agora:
//  - cada conta com lote ativo tem uma empresa de verdade (tabela empresa, dona = usuario_id). A empresa é da CONTA, não
//    do lote: trocar de chão ou voltar depois de vencer mantém equipe, conversas e treino. (O admin, que pode ter vários
//    lotes, tem uma empresa por lote.)
//  - cada membro de "Montar escritório" vira um agente do motor (id ag_<empresa>_<membro>), com o treino que o dono
//    escreveu; quem veio do catálogo de especialistas ganha as habilidades (na versão em vigor) e os limites do cargo.
//  - o dono conversa com cada um, aprova ou corrige (a correção vira regra permanente) e pede o relatório da semana ao
//    CEO; a atendente responde os visitantes da loja e anota os contatos para o dono.
//  - teto de R$ 10 de IA por lote por mês (decisão do dono, 11/11/2026), somado em uso_ia. No teto, o visitante ainda
//    deixa recado (sem IA) e o dono vê na lista de visitantes.
import { sql, migrar, id } from "./db";
import type { Usuario } from "./usuarios";
import { ehAdmin, obterTerreno, terrenoDoUsuario, type Terreno } from "./terrenos";
import { avaliarMensagem, gravarMensagem, listarMensagens, salvarRegra, removerRegra, type RegraDB, type AgenteDB } from "./agentes";
import { conversar, destilarRegra, temIA } from "./motor";
import { versoesAtivas, skillEfetiva } from "./evolucao";
import { bloqueio, contar } from "./limite";
import { contextoAgendaIA, aplicarMarcacaoDaAtendente, temMarcacao } from "./agenda";
import { ESPECIALISTAS_IA, ESPECIALISTA_POR_ID, type EspecialistaIA } from "@/office/data/especialistas";
import { LOTES, LOTE_POR_CHAVE, nomeNicho } from "@/office/data/mundo";
import { CHAVE_SEDE } from "@/office/data/onestate";
import type { Membro, NivelMembro, Escritorio } from "@/office/data/escritorio";
import { pedirComEquipe, trabalhando, trocasInternas, atividadeInterna } from "./delegacao";
import type { AreaId, Nivel } from "@/office/data/org";
import { avisar, contatosNaFala } from "./conectores";

export const TETO_IA_MES = 10; // R$ de IA por lote por mês
export const AVISO_TETO = 0.8; // a partir de 80% o painel avisa
export const MODELO_CLIENTE = "gpt-4.1-mini";
const LIMITE_DONO_HORA = 60; // mensagens do dono por hora
const LIMITE_VISITANTE_LOJA_DIA = 30; // mensagens de um visitante numa loja por dia
const LIMITE_VISITANTE_DIA = 120; // mensagens de um visitante em todas as lojas por dia

export class ErroHttp extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const statusDe = (e: unknown) => (e instanceof ErroHttp ? e.status : 500);

// ---------- identidades ----------
const sanChave = (chave: string) => chave.replace(/-/g, "m").replace(/[^a-zA-Z0-9]/g, "_");
export function empresaIdDe(usuarioId: string, chave: string, admin: boolean) { return admin ? `emp_${usuarioId}_${sanChave(chave)}` : `emp_${usuarioId}`; }
export const agenteIdDe = (empresaId: string, membroId: string) => `ag_${empresaId.slice(4)}_${membroId}`;
export const fotoDoEspecialista = (e: EspecialistaIA | null | undefined) => (e ? `/workend/agentes/${e.id}.webp` : null);

// quem veio do catálogo: pelo id guardado na contratação ou, nos contratados antes disso, pelo mesmo nome e cargo
export function especialistaDe(m: Pick<Membro, "nome" | "cargo" | "catalogoId">): EspecialistaIA | null {
  if (m.catalogoId?.startsWith("esp-")) return ESPECIALISTA_POR_ID[m.catalogoId.slice(4)] ?? null;
  return ESPECIALISTAS_IA.find((e) => e.nome === m.nome && e.cargo === m.cargo) ?? null;
}
const AREA_POR_PALAVRA: [RegExp, AreaId][] = [
  [/vend|comercial|or[cç]amento/i, "vendas"], [/tr[aá]fego|an[uú]ncio|campanha/i, "trafego"], [/social|rede|instagram|market/i, "social"],
  [/financ|cobran|cont[aá]b|fiscal/i, "financeiro"], [/jur[ií]d|contrat|advog/i, "juridico"], [/\brh\b|pessoas|recrut|cultura/i, "rh"],
  [/site|web|landing/i, "webdesign"], [/dev|program|sistema|software/i, "desenvolvimento"], [/dado|an[aá]lis|\bbi\b|relat/i, "analise"],
  [/planej|projeto|estrat|opera/i, "planejamento"], [/design|arte|identidade|gr[aá]fic/i, "designgrafico"], [/cria|conte[uú]do|roteir|v[ií]deo|copy|reda/i, "criacao"],
  [/suporte|atend|recep|agend|sac\b/i, "atendimento"],
];
const areaPorNome = (t: string): AreaId => AREA_POR_PALAVRA.find(([r]) => r.test(t))?.[1] ?? "atendimento";

// ---------- empresa e sincronia da equipe ----------
interface Dono { id: string; email: string; papel: Usuario["papel"] }
async function donoDe(t: Terreno): Promise<Dono | null> {
  const [d] = await sql<Dono[]>`SELECT id, email, papel FROM usuario WHERE id = ${t.usuarioId}`;
  return d ?? null;
}

// Garante a empresa e os agentes do lote. Só refaz a equipe quando o escritório mudou desde a última sincronia.
export async function garantirEmpresaDoLote(t: Terreno, forcar = false): Promise<string> {
  await migrar();
  const dono = await donoDe(t);
  const empId = empresaIdDe(t.usuarioId, t.chave, ehAdmin(dono as Usuario | null));
  const [est] = await sql<{ loteEm: Date; empEm: Date | null }[]>`SELECT t.atualizado_em AS lote_em, (SELECT e.atualizado_em FROM empresa e WHERE e.id = ${empId}) AS emp_em FROM terreno t WHERE t.chave = ${t.chave}`;
  const precisa = forcar || !est?.empEm || (est.loteEm && new Date(est.loteEm) > new Date(est.empEm));
  if (!precisa) return empId;
  await sql`INSERT INTO empresa (id, slug, nome, usuario_id) VALUES (${empId}, ${empId}, ${t.empresaNome}, ${t.usuarioId})
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, usuario_id = EXCLUDED.usuario_id`;
  if (t.escritorio) await sincronizarEquipe(t, empId);
  await sql`UPDATE empresa SET atualizado_em = now() WHERE id = ${empId}`;
  return empId;
}

// Hierarquia (16/11/2026): nível do cargo e chefe direto vêm do escritório (Membro.nivel e Membro.chefeId). Sem isso, como
// sempre: CEO no topo e todos respondendo a ele.
export function nivelDoMembro(m: Pick<Membro, "papel" | "nivel">): NivelMembro {
  return m.nivel ?? (m.papel === "ceo" ? "ceo" : m.papel === "atendente" ? "assistente" : "analista");
}
const NIVEL_AGENTE: Record<NivelMembro, Nivel> = { ceo: "ceo", diretor: "diretor", gerente: "gerente", analista: "pleno", assistente: "junior" };
export function chefeDoMembro(m: Pick<Membro, "id" | "papel" | "chefeId">, e: Pick<Escritorio, "equipe">): string | null {
  if (m.papel === "ceo") return null;
  if (m.chefeId && m.chefeId !== m.id && e.equipe.some((x) => x.id === m.chefeId)) return m.chefeId;
  return e.equipe.find((x) => x.papel === "ceo")?.id ?? null;
}
// ordem de criação: o chefe antes de quem responde a ele (chefe_id aponta para um agente que já existe)
function ordemPorChefe(e: Escritorio): Membro[] {
  const feitos = new Set<string>(); const out: Membro[] = []; let resto = [...e.equipe];
  while (resto.length) {
    const prontos = resto.filter((m) => { const c = chefeDoMembro(m, e); return !c || feitos.has(c); });
    if (!prontos.length) { out.push(...resto); break; } // ciclo: o resto entra respondendo ao CEO (ver abaixo)
    for (const m of prontos) { feitos.add(m.id); out.push(m); }
    resto = resto.filter((m) => !feitos.has(m.id));
  }
  return out;
}

async function sincronizarEquipe(t: Terreno, empId: string) {
  const e = t.escritorio!;
  const mapa = await versoesAtivas().catch(() => new Map());
  const existentes = new Set((await sql<{ id: string }[]>`SELECT id FROM agente WHERE empresa_id = ${empId}`).map((a) => a.id));
  const ceoId = agenteIdDe(empId, e.equipe.find((m) => m.papel === "ceo")?.id ?? "ceo");
  const criados = new Set<string>();
  for (const m of ordemPorChefe(e)) {
    const esp = m.papel === "profissional" ? especialistaDe(m) : null;
    const setor = e.setores.find((s) => s.id === m.setorId);
    const area: AreaId = m.papel === "ceo" ? "diretoria" : m.papel === "atendente" ? "atendimento" : esp?.area ?? areaPorNome(`${setor?.nome ?? ""} ${m.cargo}`);
    const nivel: Nivel = m.papel === "ceo" ? "ceo" : m.nivel ? NIVEL_AGENTE[m.nivel] : esp?.nivel ?? "pleno";
    const aid = agenteIdDe(empId, m.id);
    const chefeMembro = chefeDoMembro(m, e);
    const chefeAg = chefeMembro ? agenteIdDe(empId, chefeMembro) : null;
    const chefe = chefeAg && (criados.has(chefeAg) || existentes.has(chefeAg)) ? chefeAg : m.papel === "ceo" ? null : ceoId;
    const config = { membroId: m.id, papel: m.papel, setorId: m.setorId ?? null, saudacao: m.treino?.saudacao || esp?.saudacao || "", especialista: esp?.id ?? null, atendeVisitantes: m.papel === "atendente" };
    await sql`INSERT INTO agente (id, empresa_id, nome, area, nivel, funcao, personalidade, tom_de_voz, descricao, modelo, boneco, chefe_id, teto_diario_brl, ativo, config)
      VALUES (${aid}, ${empId}, ${m.nome}, ${area}, ${nivel}, ${m.cargo}, ${esp?.personalidade ?? ""}, ${esp?.tomDeVoz ?? ""}, ${m.treino?.descricao || esp?.descricao || ""},
              ${MODELO_CLIENTE}, ${m.boneco}, ${chefe}, ${TETO_IA_MES}, true, ${sql.json(config)})
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, area = EXCLUDED.area, nivel = EXCLUDED.nivel, funcao = EXCLUDED.funcao,
        personalidade = EXCLUDED.personalidade, tom_de_voz = EXCLUDED.tom_de_voz, descricao = EXCLUDED.descricao, boneco = EXCLUDED.boneco,
        chefe_id = EXCLUDED.chefe_id, ativo = true, config = agente.config || EXCLUDED.config, atualizado_em = now()`;
    criados.add(aid);
    // especialista contratado agora: habilidades na versão em vigor (assim a evolução atualiza a cópia) e limites do cargo
    if (!existentes.has(aid) && esp) {
      for (const [i, s] of esp.skills.entries()) {
        const ef = skillEfetiva(esp, s, mapa);
        await sql`INSERT INTO skill (id, agente_id, nome, quando_usar, passos, ordem) VALUES (${id("sk")}, ${aid}, ${ef.nome}, ${ef.quandoUsar}, ${ef.passos}, ${i})`;
      }
      if (esp.limites.length) await sql`INSERT INTO conhecimento (id, agente_id, titulo, conteudo, origem) VALUES (${id("kn")}, ${aid}, 'Limites do cargo (obrigatórios)', ${esp.limites.map((l) => `- ${l}`).join("\n")}, 'limites')`;
    }
  }
  const ids = e.equipe.map((m) => agenteIdDe(empId, m.id));
  await sql`UPDATE agente SET ativo = false, atualizado_em = now() WHERE empresa_id = ${empId} AND ativo AND id <> ALL(${sql.array(ids)})`;
}

export async function gastoDoMes(empId: string) {
  const [r] = await sql<{ g: string }[]>`SELECT COALESCE(SUM(u.custo_brl), 0)::text AS g FROM uso_ia u JOIN agente a ON a.id = u.agente_id
    WHERE a.empresa_id = ${empId} AND u.criado_em >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')`;
  return Number(r?.g ?? 0);
}

// ---------- o dono ----------
async function loteDoDono(u: Usuario, chave?: string | null): Promise<Terreno> {
  const t = chave ? await obterTerreno(chave) : await terrenoDoUsuario(u.id);
  if (!t) throw new ErroHttp("Você ainda não tem um lote. Escolha o seu no mapa para montar a equipe.", 404);
  if (t.usuarioId !== u.id && !ehAdmin(u)) throw new ErroHttp("Esse lote não é seu.", 403);
  if (t.status !== "ativo") throw new ErroHttp("Pague o 1º mês do lote para ligar a equipe de IA.", 402);
  return t;
}
export async function agenteDoMembro(empId: string, membroId: string) {
  const aid = agenteIdDe(empId, String(membroId ?? "").replace(/[^a-zA-Z0-9_-]/g, ""));
  const [a] = await sql<{ id: string; nome: string; ativo: boolean }[]>`SELECT id, nome, ativo FROM agente WHERE id = ${aid} AND empresa_id = ${empId}`;
  if (!a || !a.ativo) throw new ErroHttp("Essa pessoa não está mais na equipe.", 404);
  return a;
}

// empresa do lote do dono (conectores e API v1, 17/11/2026)
export async function empresaDoDono(u: Usuario, chave?: string | null) { const t = await loteDoDono(u, chave); return { t, empId: await garantirEmpresaDoLote(t) }; }

export interface Contatos { whatsapp?: string; instagram?: string; site?: string; email?: string }
function limparContatos(x: unknown): Contatos {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const zap = s(o.whatsapp, 20).replace(/\D/g, "");
  const insta = s(o.instagram, 40).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  let site = s(o.site, 120); if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
  const email = s(o.email, 80).toLowerCase();
  const c: Contatos = {};
  if (zap.length >= 10 && zap.length <= 13) c.whatsapp = zap;
  if (/^[A-Za-z0-9._]{1,30}$/.test(insta)) c.instagram = insta;
  try { if (site) { const url = new URL(site); if (/^https?:$/.test(url.protocol) && url.hostname.includes(".")) c.site = url.toString(); } } catch { /* ignora site inválido */ }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) c.email = email;
  return c;
}

export async function painelEquipe(u: Usuario, chave?: string | null) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  const [emp] = await sql<{ sobre: string; contatos: Contatos }[]>`SELECT sobre, contatos FROM empresa WHERE id = ${empId}`;
  const ags = await sql<{ id: string; config: { membroId?: string; especialista?: string | null } }[]>`SELECT id, config FROM agente WHERE empresa_id = ${empId} AND ativo`;
  const ultimas = await sql<{ agenteId: string; conteudo: string; papel: string; criadoEm: Date }[]>`SELECT DISTINCT ON (m.agente_id) m.agente_id, m.conteudo, m.papel, m.criado_em
    FROM mensagem m JOIN agente a ON a.id = m.agente_id WHERE a.empresa_id = ${empId} AND m.visitante_id IS NULL AND m.papel IN ('user','assistant') ORDER BY m.agente_id, m.criado_em DESC`;
  const regras = await sql<(RegraDB & { agenteId: string })[]>`SELECT r.* FROM regra r JOIN agente a ON a.id = r.agente_id WHERE a.empresa_id = ${empId} AND r.ativo ORDER BY r.criado_em`;
  const [vis] = await sql<{ n: number; hoje: number }[]>`SELECT COUNT(DISTINCT m.visitante_id)::int AS n,
      COUNT(DISTINCT m.visitante_id) FILTER (WHERE m.criado_em >= now() - interval '24 hours')::int AS hoje
    FROM mensagem m JOIN agente a ON a.id = m.agente_id WHERE a.empresa_id = ${empId} AND m.visitante_id IS NOT NULL`;
  const gasto = await gastoDoMes(empId);
  const equipe = (t.escritorio?.equipe ?? []).map((m) => {
    const aid = agenteIdDe(empId, m.id);
    const ag = ags.find((a) => a.id === aid);
    const esp = ag?.config?.especialista ? ESPECIALISTA_POR_ID[ag.config.especialista] : null;
    const ult = ultimas.find((x) => x.agenteId === aid);
    const setor = t.escritorio?.setores.find((s) => s.id === m.setorId);
    const e = t.escritorio!;
    return {
      membroId: m.id, nome: m.nome, cargo: m.cargo, papel: m.papel, setor: setor?.nome ?? (m.papel === "ceo" ? "Diretoria" : "Recepção"),
      setorId: setor?.id ?? (m.papel === "ceo" ? "_diretoria" : "_recepcao"), setorCor: setor?.cor ?? (m.papel === "ceo" ? "#D4A63A" : "#9CA3AF"),
      nivel: nivelDoMembro(m), chefeId: chefeDoMembro(m, e), temEquipe: e.equipe.some((x) => x.id !== m.id && chefeDoMembro(x, e) === m.id),
      boneco: m.boneco, camisa: m.camisa, foto: fotoDoEspecialista(esp), especialista: esp ? { cargo: esp.cargo, habilidades: esp.skills.map((s) => s.nome) } : null,
      saudacao: m.treino?.saudacao ?? "", treino: m.treino?.descricao ?? "", atendeVisitantes: m.papel === "atendente",
      ultima: ult ? { texto: ult.conteudo.slice(0, 140), deQuem: ult.papel === "user" ? "voce" : "equipe", em: ult.criadoEm } : null,
      regras: regras.filter((r) => r.agenteId === aid).map((r) => ({ id: r.id, texto: r.texto })),
    };
  });
  // departamentos na ordem do escritório (a diretoria e a recepção sem setor entram no começo)
  const departamentos = [
    ...(equipe.some((m) => m.setorId === "_diretoria") ? [{ id: "_diretoria", nome: "Diretoria", cor: "#D4A63A" }] : []),
    ...(equipe.some((m) => m.setorId === "_recepcao") ? [{ id: "_recepcao", nome: "Recepção", cor: "#9CA3AF" }] : []),
    ...(t.escritorio?.setores ?? []).filter((s) => equipe.some((m) => m.setorId === s.id)).map((s) => ({ id: s.id, nome: s.nome, cor: s.cor })),
  ];
  return {
    lote: { chave: t.chave, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? null, empresaNome: t.empresaNome, cor: t.cor, nicho: nomeNicho(t.nicho), pagoAte: t.pagoAte },
    sobre: emp?.sobre ?? "", contatos: emp?.contatos ?? {}, equipe, departamentos,
    gasto: { mes: gasto, teto: TETO_IA_MES, aviso: gasto >= TETO_IA_MES * AVISO_TETO, esgotado: gasto >= TETO_IA_MES },
    visitantes: { total: vis?.n ?? 0, ultimas24h: vis?.hoje ?? 0 }, ia: temIA(),
  };
}

export async function salvarPerfilEmpresa(u: Usuario, chave: string | null, d: { sobre?: unknown; contatos?: unknown }) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  const sobre = typeof d.sobre === "string" ? d.sobre.trim().slice(0, 3000) : undefined;
  const contatos = d.contatos !== undefined ? limparContatos(d.contatos) : undefined;
  if (sobre !== undefined) await sql`UPDATE empresa SET sobre = ${sobre} WHERE id = ${empId}`;
  if (contatos !== undefined) await sql`UPDATE empresa SET contatos = ${sql.json(contatos as never)} WHERE id = ${empId}`;
  return { sobre: sobre ?? null, contatos: contatos ?? null };
}

export async function conversaDoDono(u: Usuario, chave: string | null, membroId: string) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  const a = await agenteDoMembro(empId, membroId);
  const msgs = await listarMensagens(a.id, 80, null);
  // quem escreveu cada mensagem: o dono, o chefe (pedido interno) ou o sistema juntando as respostas da equipe
  const chefes = new Map((await sql<{ id: string; nome: string; funcao: string }[]>`SELECT id, nome, funcao FROM agente WHERE empresa_id = ${empId}`).map((x) => [x.id, x]));
  const mensagens = msgs.map((m) => {
    const autor = m.autor.startsWith("chefe:") ? "chefe" : m.autor.startsWith("sistema:") ? "equipe" : m.papel === "assistant" ? "agente" : "dono";
    const c = autor === "chefe" ? chefes.get(m.autor.slice(6)) : null;
    return { id: m.id, papel: m.papel, autor, deNome: c ? `${c.nome} (${c.funcao})` : null, conteudo: m.conteudo, avaliacao: m.avaliacao, correcao: m.correcao, em: m.criadoEm };
  });
  const internas = await trocasInternas(empId, { agenteId: a.id, limite: 40 });
  return { mensagens, internas, trabalhando: trabalhando(a.id) || internas.some((x) => x.status === "pedido" && x.origemAgente === a.id) };
}
export async function internasDoDono(u: Usuario, chave: string | null) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  return { internas: await trocasInternas(empId, { limite: 60 }) };
}
export async function atividadeDoDono(u: Usuario, chave: string | null) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  return { trocas: await atividadeInterna(empId, 30) };
}

export async function falarComMembro(u: Usuario, chave: string | null, membroId: string, texto: string) {
  const t = await loteDoDono(u, chave);
  const pedido = String(texto ?? "").trim().slice(0, 4000);
  if (!pedido) throw new ErroHttp("Escreva o que você precisa.");
  if (!temIA()) throw new ErroHttp("A IA está desligada no servidor agora. Tente de novo mais tarde.", 503);
  const chaveLim = `equipe:${u.id}`;
  if (bloqueio(chaveLim, LIMITE_DONO_HORA)) throw new ErroHttp("Muitas mensagens em pouco tempo. Espere alguns minutos.", 429);
  contar(chaveLim, 60);
  const empId = await garantirEmpresaDoLote(t);
  const a = await agenteDoMembro(empId, membroId);
  const gasto = await gastoDoMes(empId);
  if (gasto >= TETO_IA_MES) throw new ErroHttp(`A equipe já usou os R$ ${TETO_IA_MES.toFixed(2).replace(".", ",")} de IA deste mês. Ela volta a responder no dia 1º.`, 402);
  try {
    const [ag] = await sql<AgenteDB[]>`SELECT * FROM agente WHERE id = ${a.id}`;
    const r = await pedirComEquipe({ empId, autorDono: `dono:${u.id}`, teto: async () => ({ gasto: await gastoDoMes(empId), teto: TETO_IA_MES }) }, ag, pedido);
    // conectores: tarefa que a equipe dividiu entre si → aviso tarefa.entregue quando a entrega final sair
    if (r.delegados.length) void r.fim.then((entrega) => { if (entrega) avisar(empId, "tarefa.entregue", { origem: "dono", tarefa: { para: { id: membroId, nome: ag.nome, cargo: ag.funcao }, texto: pedido, entrega } }); });
    return { mensagem: { id: r.mensagem.id, papel: "assistant", autor: "agente", deNome: null, conteudo: r.mensagem.conteudo, avaliacao: null, correcao: null, em: r.mensagem.criadoEm }, delegados: r.delegados, gasto: { mes: await gastoDoMes(empId), teto: TETO_IA_MES } };
  } catch (e) {
    throw new ErroHttp((e as Error).message, gasto >= TETO_IA_MES ? 402 : 502);
  }
}

// 👍 / 👎 com correção: a correção vira uma regra permanente da pessoa (o mesmo treino do escritório interno)
export async function treinarMembro(u: Usuario, chave: string | null, membroId: string, d: { mensagemId?: string; avaliacao?: 1 | -1 | null; correcao?: string; removerRegra?: string }) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  const a = await agenteDoMembro(empId, membroId);
  if (d.removerRegra) { await removerRegra(a.id, String(d.removerRegra)); return { regra: null }; }
  const [m] = await sql<{ id: string; conteudo: string }[]>`SELECT id, conteudo FROM mensagem WHERE id = ${String(d.mensagemId ?? "")} AND agente_id = ${a.id} AND visitante_id IS NULL AND papel = 'assistant'`;
  if (!m) throw new ErroHttp("Resposta não encontrada.", 404);
  const correcao = String(d.correcao ?? "").trim().slice(0, 600);
  const avaliacao = d.avaliacao === 1 || d.avaliacao === -1 ? d.avaliacao : null;
  await avaliarMensagem(a.id, m.id, avaliacao, correcao || undefined);
  if (!correcao) return { regra: null };
  const texto = temIA() ? await destilarRegra(a.id, correcao, m.conteudo).catch(() => correcao) : correcao;
  const regra = await salvarRegra(a.id, { texto: texto.slice(0, 300), origemMensagemId: m.id });
  return { regra: { id: regra.id, texto: regra.texto } };
}

// Relatório da semana: o CEO lê o que a equipe fez com o dono e o que os visitantes procuraram, e escreve para o dono
export async function pedirRelatorio(u: Usuario, chave: string | null) {
  const t = await loteDoDono(u, chave);
  if (!temIA()) throw new ErroHttp("A IA está desligada no servidor agora. Tente de novo mais tarde.", 503);
  const empId = await garantirEmpresaDoLote(t);
  const ceoMembro = t.escritorio?.equipe.find((m) => m.papel === "ceo");
  if (!ceoMembro) throw new ErroHttp("O escritório está sem CEO.", 404);
  const ceo = await agenteDoMembro(empId, ceoMembro.id);
  const conversa = await sql<{ nome: string; funcao: string; papel: string; autor: string; conteudo: string; criadoEm: Date }[]>`SELECT a.nome, a.funcao, m.papel, m.autor, m.conteudo, m.criado_em
    FROM mensagem m JOIN agente a ON a.id = m.agente_id
    WHERE a.empresa_id = ${empId} AND m.visitante_id IS NULL AND m.papel IN ('user','assistant') AND m.autor NOT LIKE 'sistema:%' AND m.criado_em > now() - interval '7 days' AND a.id <> ${ceo.id}
    ORDER BY m.criado_em DESC LIMIT 60`;
  const visitas = await sql<{ nome: string | null; conteudo: string; criadoEm: Date }[]>`SELECT COALESCE(p.nome, us.nome) AS nome, m.conteudo, m.criado_em
    FROM mensagem m JOIN agente a ON a.id = m.agente_id LEFT JOIN personagem p ON p.usuario_id = m.visitante_id LEFT JOIN usuario us ON us.id = m.visitante_id
    WHERE a.empresa_id = ${empId} AND m.visitante_id IS NOT NULL AND m.papel = 'user' AND m.criado_em > now() - interval '7 days'
    ORDER BY m.criado_em DESC LIMIT 40`;
  const linhas = conversa.reverse().map((m) => `- ${m.papel === "user" ? (m.autor.startsWith("chefe:") ? `Pedido interno da equipe para ${m.nome} (${m.funcao})` : `Dono pediu a ${m.nome} (${m.funcao})`) : `${m.nome} entregou`}: ${m.conteudo.replace(/\s+/g, " ").slice(0, m.papel === "user" ? 220 : 360)}`);
  const vis = visitas.reverse().map((v) => `- ${v.nome ?? "Visitante"}: ${v.conteudo.replace(/\s+/g, " ").slice(0, 200)}`);
  const contexto = [
    "Material para o relatório da semana (últimos 7 dias). Use só este material; não invente resultados.",
    linhas.length ? `Trabalho da equipe com o dono:\n${linhas.join("\n")}` : "Trabalho da equipe com o dono: nada nesta semana.",
    vis.length ? `Mensagens de visitantes da loja:\n${vis.join("\n")}` : "Mensagens de visitantes da loja: nenhuma nesta semana.",
    "Escreva para o dono, em até 25 linhas: 1) o que a equipe entregou; 2) o que está pendente ou precisa de decisão dele; 3) o que os visitantes procuraram e os contatos que deixaram; 4) três próximos passos sugeridos. Se a semana estiver vazia, diga isso em uma linha e proponha três tarefas úteis para a equipe, com quem faz cada uma.",
  ].join("\n\n");
  const gasto = await gastoDoMes(empId);
  try {
    const r = await conversar(ceo.id, "Me mande o relatório da semana.", `dono:${u.id}`, { modo: "dono", contexto, tetoMes: { gasto, teto: TETO_IA_MES }, maxTokens: 1500 });
    return { membroId: ceoMembro.id, mensagem: { id: r.mensagem.id, papel: "assistant", conteudo: r.mensagem.conteudo, avaliacao: null, correcao: null, em: r.mensagem.criadoEm } };
  } catch (e) {
    throw new ErroHttp((e as Error).message, gasto >= TETO_IA_MES ? 402 : 502);
  }
}

export async function conversasDeVisitantes(u: Usuario, chave: string | null) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  return sql<{ visitanteId: string; nome: string | null; n: number; ultimaEm: Date; ultimaFala: string | null }[]>`
    SELECT m.visitante_id, COALESCE(p.nome, us.nome) AS nome, COUNT(*)::int AS n, MAX(m.criado_em) AS ultima_em,
      (SELECT x.conteudo FROM mensagem x JOIN agente y ON y.id = x.agente_id WHERE y.empresa_id = ${empId} AND x.visitante_id = m.visitante_id AND x.papel = 'user' ORDER BY x.criado_em DESC LIMIT 1) AS ultima_fala
    FROM mensagem m JOIN agente a ON a.id = m.agente_id LEFT JOIN personagem p ON p.usuario_id = m.visitante_id LEFT JOIN usuario us ON us.id = m.visitante_id
    WHERE a.empresa_id = ${empId} AND m.visitante_id IS NOT NULL
    GROUP BY m.visitante_id, p.nome, us.nome ORDER BY MAX(m.criado_em) DESC LIMIT 100`;
}
export async function conversaDeVisitante(u: Usuario, chave: string | null, visitanteId: string) {
  const t = await loteDoDono(u, chave);
  const empId = await garantirEmpresaDoLote(t);
  return sql<{ id: string; papel: string; conteudo: string; quem: string; criadoEm: Date }[]>`SELECT m.id, m.papel, m.conteudo, a.nome AS quem, m.criado_em
    FROM mensagem m JOIN agente a ON a.id = m.agente_id WHERE a.empresa_id = ${empId} AND m.visitante_id = ${visitanteId} ORDER BY m.criado_em LIMIT 300`;
}

// ---------- a loja, vista por quem chega ----------
async function lojaPorNumero(numero: number) {
  // 0 = a sede da Social RP (não tem número de loja): a recepção dela atende os visitantes que entram no prédio (17/11/2026)
  const l = numero === 0 ? { chave: CHAVE_SEDE } : LOTES.find((x) => x.numero === numero);
  if (!l) throw new ErroHttp("Loja não encontrada.", 404);
  let t = await obterTerreno(l.chave);
  if (t?.anexoDe) t = await obterTerreno(t.anexoDe); // lote duplo: a ampliação mostra a loja principal
  if (!t || t.status !== "ativo") throw new ErroHttp("Esta loja não está aberta agora.", 404);
  const empId = await garantirEmpresaDoLote(t);
  return { t, empId, numero };
}

export async function lojaPublica(numero: number) {
  const { t, empId } = await lojaPorNumero(numero);
  const [emp] = await sql<{ sobre: string; contatos: Contatos }[]>`SELECT sobre, contatos FROM empresa WHERE id = ${empId}`;
  const [aval] = await sql<{ media: number | null; n: number }[]>`SELECT AVG(nota)::float AS media, COUNT(*)::int AS n FROM avaliacao WHERE para_id = ${t.usuarioId}`.catch(() => [{ media: null, n: 0 }]);
  const atendente = t.escritorio?.equipe.find((m) => m.papel === "atendente") ?? null;
  return {
    numero, chave: t.chave, nome: t.empresaNome, cor: t.cor, nicho: nomeNicho(t.nicho), temLogo: t.temLogo, donoId: t.usuarioId,
    logo: t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null,
    sobre: emp?.sobre ?? "", contatos: emp?.contatos ?? {},
    atendente: atendente ? { nome: atendente.nome, cargo: atendente.cargo, boneco: atendente.boneco, camisa: atendente.camisa, saudacao: atendente.treino?.saudacao || `Olá! Bem-vindo à ${t.empresaNome}. Em que posso ajudar?` } : null,
    equipe: (t.escritorio?.equipe ?? []).map((m) => ({ nome: m.nome, cargo: m.cargo, papel: m.papel, foto: fotoDoEspecialista(m.papel === "profissional" ? especialistaDe(m) : null) })),
    avaliacao: { media: aval?.media ?? null, n: aval?.n ?? 0 },
  };
}

export async function conversaNaLoja(u: Usuario, numero: number) {
  const { t, empId } = await lojaPorNumero(numero);
  const atendente = t.escritorio?.equipe.find((m) => m.papel === "atendente");
  if (!atendente) return [];
  const msgs = await listarMensagens(agenteIdDe(empId, atendente.id), 60, u.id);
  return msgs.map((m) => ({ id: m.id, papel: m.papel, conteudo: m.conteudo, em: m.criadoEm }));
}

const RECADO_SEM_IA = "Obrigado pela mensagem! A equipe não consegue responder agora, mas o seu recado ficou anotado para o dono. Se quiser retorno, deixe o seu nome e um WhatsApp ou e-mail.";

export async function falarNaLoja(u: Usuario, numero: number, texto: string) {
  const fala = String(texto ?? "").trim().slice(0, 800);
  if (!fala) throw new ErroHttp("Escreva a sua mensagem.");
  const kLoja = `loja:${numero}:${u.id}`, kTotal = `lojas:${u.id}`;
  if (bloqueio(kLoja, LIMITE_VISITANTE_LOJA_DIA) || bloqueio(kTotal, LIMITE_VISITANTE_DIA)) throw new ErroHttp("Você mandou muitas mensagens hoje. Volte amanhã ou fale direto com a loja pelos contatos dela.", 429);
  contar(kLoja, 24 * 60); contar(kTotal, 24 * 60);
  const { t, empId } = await lojaPorNumero(numero);
  // conectores: visitante escreveu e-mail ou telefone → aviso visitante.contato
  const contatos = contatosNaFala(fala);
  if (contatos) avisar(empId, "visitante.contato", { loja: { numero, nome: t.empresaNome }, visitante: { id: u.id, nome: u.nome }, mensagem: fala, contatos });
  const atendente = t.escritorio?.equipe.find((m) => m.papel === "atendente");
  if (!atendente) throw new ErroHttp("Esta loja ainda não tem atendente.", 404);
  const aid = agenteIdDe(empId, atendente.id);
  const gasto = await gastoDoMes(empId);
  // sem IA ou no teto do mês: o recado fica guardado para o dono, com uma resposta fixa (sem custo)
  if (!temIA() || gasto >= TETO_IA_MES) {
    await gravarMensagem({ agenteId: aid, papel: "user", autor: `visitante:${u.id}`, conteudo: fala, visitanteId: u.id });
    const m = await gravarMensagem({ agenteId: aid, papel: "assistant", autor: `agente:${aid}`, conteudo: RECADO_SEM_IA, visitanteId: u.id });
    return { id: m.id, papel: "assistant", conteudo: m.conteudo, em: m.criadoEm };
  }
  try {
    // agenda ligada (12/11/2026): a atendente recebe os serviços e as faixas livres e pode marcar pela conversa
    const ctxAgenda = await contextoAgendaIA(numero, u).catch((e) => { console.error("[loja] agenda:", (e as Error).message); return null; });
    const r = await conversar(aid, fala, `visitante:${u.id}`, { modo: "visitante", visitanteId: u.id, tetoMes: { gasto, teto: TETO_IA_MES }, contexto: ctxAgenda ?? undefined, maxTokens: ctxAgenda ? 500 : undefined });
    let conteudo = r.mensagem.conteudo;
    // a marcação [[AGENDAR ...]] nunca fica na conversa: o servidor valida, marca e escreve o resultado no lugar
    if (temMarcacao(conteudo)) {
      conteudo = await aplicarMarcacaoDaAtendente(conteudo, u, numero);
      await sql`UPDATE mensagem SET conteudo = ${conteudo} WHERE id = ${r.mensagem.id}`;
    }
    return { id: r.mensagem.id, papel: "assistant", conteudo, em: r.mensagem.criadoEm };
  } catch (e) {
    // a mensagem do visitante já ficou gravada; responde com o recado fixo para ele não ficar sem retorno
    console.error("[loja] atendente falhou:", (e as Error).message);
    const m = await gravarMensagem({ agenteId: aid, papel: "assistant", autor: `agente:${aid}`, conteudo: RECADO_SEM_IA, visitanteId: u.id });
    return { id: m.id, papel: "assistant", conteudo: m.conteudo, em: m.criadoEm };
  }
}

// ---------- busca de empresas (/encontrar) ----------
// Lojas abertas no mapa, com o "Sobre a empresa", os contatos públicos e a nota de quem já negociou com o dono.
export async function buscarEmpresas(f: { q?: string | null; nicho?: string | null }) {
  await migrar();
  const q = (f.q ?? "").trim().slice(0, 60).toLowerCase();
  const lotes = await sql<{ chave: string; usuarioId: string; empresaNome: string; cor: string; nicho: string; temLogo: boolean; email: string; papel: Usuario["papel"]; escritorio: Terreno["escritorio"] }[]>`
    SELECT t.chave, t.usuario_id, t.empresa_nome, t.cor, t.nicho, (t.logo IS NOT NULL) AS tem_logo, t.escritorio, u.email, u.papel
    FROM terreno t JOIN usuario u ON u.id = t.usuario_id
    WHERE t.status = 'ativo' AND t.anexo_de IS NULL AND u.banido_em IS NULL AND (${f.nicho ?? null}::text IS NULL OR t.nicho = ${f.nicho ?? null})`;
  if (!lotes.length) return [];
  const empIds = lotes.map((l) => empresaIdDe(l.usuarioId, l.chave, ehAdmin({ email: l.email, papel: l.papel } as Usuario)));
  const emps = await sql<{ id: string; sobre: string; contatos: Contatos }[]>`SELECT id, sobre, contatos FROM empresa WHERE id = ANY(${sql.array(empIds)})`;
  const notas = await sql<{ paraId: string; media: number; n: number }[]>`SELECT para_id, AVG(nota)::float AS media, COUNT(*)::int AS n FROM avaliacao WHERE para_id = ANY(${sql.array([...new Set(lotes.map((l) => l.usuarioId))])}) GROUP BY para_id`;
  return lotes.map((l, i) => {
    const e = emps.find((x) => x.id === empIds[i]);
    const nota = notas.find((n) => n.paraId === l.usuarioId);
    const atendente = l.escritorio?.equipe.find((m) => m.papel === "atendente");
    return {
      numero: LOTE_POR_CHAVE[l.chave]?.numero ?? 0, chave: l.chave, nome: l.empresaNome, cor: l.cor, nicho: l.nicho, nichoNome: nomeNicho(l.nicho),
      logo: l.temLogo ? `/api/terrenos/${encodeURIComponent(l.chave)}/logo` : null, sobre: (e?.sobre ?? "").slice(0, 400), contatos: e?.contatos ?? {},
      equipe: l.escritorio?.equipe.length ?? 0, atendente: atendente?.nome ?? null, reputacao: { media: nota?.media ?? null, n: nota?.n ?? 0 },
    };
  }).filter((l) => l.numero && (!q || `${l.nome} ${l.sobre} ${l.nichoNome}`.toLowerCase().includes(q)))
    .sort((a, b) => Number(!!b.sobre) - Number(!!a.sobre) || b.reputacao.n - a.reputacao.n || a.numero - b.numero);
}
