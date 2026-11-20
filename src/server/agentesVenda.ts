// Agentes à venda (20/11/2026, pedidos do dono: "Todos os terrenos por padrão após a compra já vêm com um CEO e uma
// recepcionista, o resto será adquirido. Cada agente tem um valor."; "cada agente tem uma personalidade diferente quando
// for adquirido"; "ele será treinado e identificado para não fazer as mesmas coisas dos outros").
//  - Lote novo nasce com o CEO e a atendente (escritorioPadrao), cada um com uma personalidade. Os outros cargos do
//    catálogo são comprados um a um, em créditos ou Pix (cobrança única de mercadopago.ts, tipo "agente").
//  - Compra única: fica enquanto o lote estiver ativo. Quem sai da equipe continua contratado e volta sem pagar, com a
//    mesma personalidade e o mesmo escopo (guardados no contrato).
//  - Na compra o dono escolhe uma de 3 personalidades sorteadas que a empresa ainda não usa. O nome não repete na empresa
//    e dois do mesmo cargo recebem focos diferentes (src/office/data/escopo.ts › especializar).
//  - As empresas que já existiam mantêm todos os agentes: só membro NOVO precisa de contrato (terrenos.ts › salvarEscritorio).
//  - Preço pela tabela por nível (PRECO_AGENTE, fácil de mudar). Se o admin pôr um preço no catálogo, vale o dele.
//  - Trocar a personalidade depois: PRECO_TROCA_PERSONALIDADE créditos (tipo "personalidade").
import { randomBytes } from "node:crypto";
import { sql, migrar, id } from "./db";
import type { Usuario } from "./usuarios";
import { catalogoAVenda, type AgenteCatalogo } from "./catalogo";
import { ehAdmin, obterTerreno, ehDonoOuSocio } from "./terrenos";
import { ESPECIALISTA_POR_ID } from "@/office/data/especialistas";
import { NIVEL, type Nivel } from "@/office/data/org";
import { ehSede } from "@/office/data/sedes";
import { ehQuiosque } from "@/office/data/quiosques";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { MAX_SETORES, MAX_MESAS_SETOR, CORES_SETOR, type Escritorio, type Membro } from "@/office/data/escritorio";
import { PERSONALIDADE_POR_ID, PRECO_TROCA_PERSONALIDADE, sortearPersonalidades, falaDe } from "@/office/data/personalidades";
import { especializar } from "@/office/data/escopo";

type Db = typeof sql;

export const PRECO_AGENTE: Record<Nivel, number> = { estagiario: 19, junior: 29, pleno: 49, senior: 79, gerente: 99, diretor: 149, ceo: 199 };
export const MAX_PROFISSIONAIS = MAX_SETORES * MAX_MESAS_SETOR;
// "Criar do zero": um profissional em branco que o dono nomeia e treina (preço de pleno)
export const SOB_MEDIDA = { id: "sob-medida", nome: "Novo", cargo: "Profissional sob medida", setor: "Atendimento", descricao: "Um profissional em branco: você dá o nome, o cargo e escreve o treino (o que sabe fazer e como cumprimenta).", saudacao: "", boneco: "classico", camisa: "#1D4ED8" };
// nomes para quando o nome do catálogo já existe na empresa
const NOMES_RESERVA = ["Alice", "Bruno", "Clara", "Davi", "Elisa", "Fábio", "Giovana", "Heitor", "Isadora", "João", "Kátia", "Leandro", "Melissa", "Nicolas", "Olívia", "Pedro", "Quésia", "Renato", "Sofia", "Tiago", "Úrsula", "Vítor", "Yasmin", "Zeca"];

export interface AgenteVitrine { id: string; nome: string; cargo: string; setor: string; nivel: Nivel; nomeNivel: string; descricao: string; skills: string[]; preco: number; boneco: string; camisa: string; naEquipe: number }
const nivelDe = (a: { id: string }, fichaNivel: string | null): Nivel => {
  if (a.id.startsWith("esp-")) { const e = ESPECIALISTA_POR_ID[a.id.slice(4)]; if (e) return e.nivel; }
  return fichaNivel && fichaNivel in NIVEL ? (fichaNivel as Nivel) : "pleno";
};
const precoDe = (a: AgenteCatalogo, nivel: Nivel) => (Number(a.preco) > 0 ? Number(a.preco) : PRECO_AGENTE[nivel]);
// a conta admin paga 1/100 (teste real sem gastar), como no lote
const precoPara = (u: Usuario, p: number) => (ehAdmin(u) ? Math.max(0.01, Math.round(p) / 100) : p);

async function catalogo(): Promise<AgenteVitrine[]> {
  const lista = await catalogoAVenda();
  const fichas = new Map((await sql<{ id: string; nivel: string | null }[]>`SELECT id, ficha->>'nivel' AS nivel FROM agente_catalogo`).map((f) => [f.id, f.nivel]));
  const itens = lista.map((a) => {
    const nivel = nivelDe(a, fichas.get(a.id) ?? null);
    return { id: a.id, nome: a.nome, cargo: a.cargo, setor: a.setor, nivel, nomeNivel: NIVEL[nivel].nome, descricao: a.descricao, skills: a.skills, preco: precoDe(a, nivel), boneco: a.boneco, camisa: a.camisa, naEquipe: 0 };
  });
  return [...itens, { ...SOB_MEDIDA, nivel: "pleno" as Nivel, nomeNivel: NIVEL.pleno.nome, skills: [], preco: PRECO_AGENTE.pleno, naEquipe: 0 }];
}

async function loteDoComprador(u: Usuario, chave: string) {
  const t = await obterTerreno(chave);
  if (!t || (!ehDonoOuSocio(t, u.id) && !ehAdmin(u))) throw new Error("Esse lote não é seu.");
  if (t.anexoDe) throw new Error("A equipe fica no lote principal.");
  if (t.status !== "ativo") throw new Error("Pague o 1º mês do lote para contratar agentes.");
  if (ehSede(chave)) throw new Error("A sede tem a equipe montada por departamento.");
  return t;
}
const profissionais = (e: Escritorio | null) => (e?.equipe ?? []).filter((m) => m.papel === "profissional").length;
const usadasNa = (e: Escritorio | null, exceto?: string) => new Set((e?.equipe ?? []).filter((m) => m.id !== exceto && m.personalidadeId).map((m) => m.personalidadeId!));

// Vitrine "Contratar agente": setor, cargo, nível, o que faz e preço; as personalidades já usadas na empresa (a tela sorteia
// 3 das outras) e os contratados que estão fora da equipe
export async function vitrineAgentes(u: Usuario, chave: string) {
  await migrar();
  const t = await loteDoComprador(u, chave);
  const lista = await catalogo();
  const equipe = t.escritorio?.equipe ?? [];
  for (const a of lista) a.naEquipe = equipe.filter((m) => m.catalogoId === a.id).length;
  const contratos = await sql<{ membroId: string; catalogoId: string; nome: string; cargo: string; personalidadeId: string | null; escopo: Membro["escopo"] | null }[]>`SELECT membro_id, catalogo_id, nome, cargo, personalidade_id, escopo FROM agente_contratado WHERE terreno_chave = ${chave} AND status = 'ativo' ORDER BY criado_em`;
  const fora = contratos.filter((c) => !equipe.some((m) => m.id === c.membroId)).map((c) => {
    const a = lista.find((x) => x.id === c.catalogoId);
    return { membroId: c.membroId, catalogoId: c.catalogoId, nome: c.nome, cargo: c.cargo, setor: a?.setor ?? "Atendimento", boneco: a?.boneco ?? "classico", camisa: a?.camisa ?? "#1D4ED8", descricao: a?.descricao ?? "", personalidadeId: c.personalidadeId, escopo: c.escopo };
  });
  return { agentes: lista.map((a) => ({ ...a, precoCobrado: precoPara(u, a.preco) })), foraDaEquipe: fora, vagas: Math.max(0, MAX_PROFISSIONAIS - profissionais(t.escritorio)), maximo: MAX_PROFISSIONAIS, admin: ehAdmin(u),
    personalidadesUsadas: [...usadasNa(t.escritorio), ...fora.map((f) => f.personalidadeId).filter((x): x is string => !!x)], precoTrocaPersonalidade: precoPara(u, PRECO_TROCA_PERSONALIDADE) };
}

// O que a cobrança precisa para vender um agente (validado antes de gerar o Pix ou gastar créditos)
export async function produtoAgente(u: Usuario, chave: string, catalogoId: string, personalidadeId?: string | null) {
  await migrar();
  const t = await loteDoComprador(u, chave);
  // o quiosque (20/11/2026, frente terreno) vem só com a atendente: equipe maior é no lote
  if (ehQuiosque(chave)) throw new Error("O quiosque tem só a atendente no balcão. Para contratar mais agentes, alugue um lote.");
  if (profissionais(t.escritorio) >= MAX_PROFISSIONAIS) throw new Error(`O escritório já tem ${MAX_PROFISSIONAIS} profissionais, o máximo deste lote.`);
  const a = (await catalogo()).find((x) => x.id === catalogoId);
  if (!a) throw new Error("Esse agente não está mais à venda.");
  const p = personalidadeId && PERSONALIDADE_POR_ID[personalidadeId] ? personalidadeId : "";
  if (p && usadasNa(t.escritorio).has(p)) throw new Error("Essa personalidade já é de alguém da equipe. Escolha outra.");
  return { tipo: "agente" as const, chave: `agente:${chave}:${a.id}:${p}`, valor: precoPara(u, a.preco), meses: 1, metadata: { terreno: chave, catalogo: a.id, nivel: a.nivel, personalidade: p || null },
    descricao: `WorkEnd · agente ${a.cargo} (${a.nomeNivel}) · Lote ${LOTE_POR_CHAVE[chave]?.numero ?? "?"} (${t.empresaNome})` };
}
// Trocar a personalidade de um agente (9 créditos): só para quem já está na equipe e para uma que ninguém usa
export async function produtoPersonalidade(u: Usuario, chave: string, membroId: string, personalidadeId: string) {
  await migrar();
  const t = await loteDoComprador(u, chave);
  const m = t.escritorio?.equipe.find((x) => x.id === membroId); if (!m) throw new Error("Essa pessoa não está na equipe.");
  const p = PERSONALIDADE_POR_ID[personalidadeId]; if (!p) throw new Error("Escolha uma das personalidades.");
  if (m.personalidadeId === p.id) throw new Error("Essa já é a personalidade de " + m.nome + ".");
  if (usadasNa(t.escritorio, m.id).has(p.id)) throw new Error("Essa personalidade já é de alguém da equipe. Escolha outra.");
  return { tipo: "personalidade" as const, chave: `personalidade:${chave}:${m.id}:${p.id}`, valor: precoPara(u, PRECO_TROCA_PERSONALIDADE), meses: 1, metadata: { terreno: chave, membro: m.id, personalidade: p.id },
    descricao: `WorkEnd · nova personalidade para ${m.nome}: ${p.nome}` };
}

// lugar na equipe: setor de mesmo nome com mesa livre; senão cresce esse setor; senão qualquer mesa livre; senão um setor novo
function alocar(e: Escritorio, nomeSetor: string): string | null {
  const ocupadas = (sid: string) => e.equipe.filter((m) => m.setorId === sid).length;
  const livre = (s: Escritorio["setores"][number]) => s.mesas > ocupadas(s.id);
  const igual = e.setores.find((s) => s.nome.toLowerCase() === nomeSetor.toLowerCase());
  if (igual && livre(igual)) return igual.id;
  if (igual && igual.mesas < MAX_MESAS_SETOR) { igual.mesas++; return igual.id; }
  const qualquer = e.setores.find(livre); if (qualquer) return qualquer.id;
  if (e.setores.length < MAX_SETORES) { const s = { id: `set_${randomBytes(3).toString("hex")}`, nome: nomeSetor.slice(0, 28), cor: CORES_SETOR[e.setores.length % CORES_SETOR.length], mesas: 1 }; e.setores.push(s); return s.id; }
  const cresce = e.setores.find((s) => s.mesas < MAX_MESAS_SETOR); if (cresce) { cresce.mesas++; return cresce.id; }
  return null;
}
const parteChave = (chave: string) => { const [, lote, cat, extra] = chave.split(":"); return { lote: lote ?? "", catalogoId: cat ?? "", extra: extra ?? "" }; };
const nomeLivre = (e: Escritorio, nome: string) => {
  const usados = new Set(e.equipe.map((m) => m.nome.trim().toLowerCase()));
  if (!usados.has(nome.trim().toLowerCase())) return nome;
  return NOMES_RESERVA.find((n) => !usados.has(n.toLowerCase())) ?? `${nome} ${e.equipe.length + 1}`;
};
const salvar = (db: Db, chave: string, e: Escritorio) => db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
// guarda no contrato a personalidade e o escopo atuais de quem é do mesmo cargo (para voltar igual depois)
async function guardarEscopos(db: Db, chave: string, e: Escritorio) {
  for (const m of e.equipe) if (m.papel === "profissional") await db`UPDATE agente_contratado SET escopo = ${m.escopo ? sql.json(m.escopo as never) : null}, personalidade_id = ${m.personalidadeId ?? null} WHERE terreno_chave = ${chave} AND membro_id = ${m.id}`;
}

// Pagamento aprovado (créditos ou Pix): o agente entra na equipe do lote e o contrato fica guardado. Falso se não deu.
export async function liberarAgente(db: Db, reg: { id: string; terrenoChave: string; usuarioId: string; valor: string | number; creditosCarteira?: string | number }) {
  const { lote, catalogoId, extra } = parteChave(reg.terrenoChave);
  const [t] = await db<{ usuarioId: string; socios: string[] | null; status: string; anexoDe: string | null; empresaNome: string; escritorio: Escritorio | null }[]>`SELECT usuario_id, socios, status, anexo_de, empresa_nome, escritorio FROM terreno WHERE chave = ${lote} FOR UPDATE`;
  if (!t || t.status !== "ativo" || t.anexoDe || !t.escritorio || ehQuiosque(lote) || !ehDonoOuSocio({ usuarioId: t.usuarioId, socios: t.socios ?? [] }, reg.usuarioId)) return false;
  const [ja] = await db`SELECT 1 FROM agente_contratado WHERE pagamento_id = ${reg.id}`; if (ja) return true;
  const a = (await catalogo()).find((x) => x.id === catalogoId); if (!a) return false;
  const e: Escritorio = JSON.parse(JSON.stringify(t.escritorio));
  if (profissionais(e) >= MAX_PROFISSIONAIS) return false;
  const setorId = alocar(e, a.setor); if (!setorId) return false;
  // personalidade: a escolhida, se ainda ninguém da empresa usa; senão uma sorteada entre as livres
  const usadas = usadasNa(e);
  const pers = extra && PERSONALIDADE_POR_ID[extra] && !usadas.has(extra) ? PERSONALIDADE_POR_ID[extra] : sortearPersonalidades(usadas, 1)[0];
  const nome = nomeLivre(e, a.nome).slice(0, 24);
  const [cat] = await db<{ saudacao: string }[]>`SELECT saudacao FROM agente_catalogo WHERE id = ${a.id}`;
  const saudacao = (pers ? falaDe(pers, "saudacao", { nome, empresa: t.empresaNome }) : cat?.saudacao ?? "").slice(0, 160);
  const m: Membro = { id: `mem_${randomBytes(4).toString("hex")}`, nome, cargo: a.cargo.slice(0, 40), papel: "profissional", setorId, boneco: a.boneco, camisa: a.camisa, treino: { descricao: a.descricao.slice(0, 600), saudacao }, ...(a.id === SOB_MEDIDA.id ? {} : { catalogoId: a.id }), ...(pers ? { personalidadeId: pers.id } : {}) };
  e.equipe.push(m);
  if (a.id !== SOB_MEDIDA.id) especializar(e, a.id, a.cargo); // dois do mesmo cargo: focos e skills sem sobrepor
  await salvar(db, lote, e);
  await db`INSERT INTO agente_contratado (id, terreno_chave, usuario_id, catalogo_id, membro_id, nome, cargo, preco, pagamento_id) VALUES (${id("ctr")}, ${lote}, ${reg.usuarioId}, ${a.id}, ${m.id}, ${m.nome}, ${m.cargo}, ${Number(reg.valor) + Number(reg.creditosCarteira ?? 0)}, ${reg.id})`;
  await guardarEscopos(db, lote, e);
  return true;
}
// Estorno do Pix: o agente sai da equipe e o contrato deixa de valer
export async function reverterAgente(db: Db, reg: { id: string }) {
  const [c] = await db<{ terrenoChave: string; membroId: string }[]>`UPDATE agente_contratado SET status = 'estornado' WHERE pagamento_id = ${reg.id} AND status = 'ativo' RETURNING terreno_chave, membro_id`;
  if (!c) return;
  const [t] = await db<{ escritorio: Escritorio | null }[]>`SELECT escritorio FROM terreno WHERE chave = ${c.terrenoChave} FOR UPDATE`;
  if (!t?.escritorio) return;
  await salvar(db, c.terrenoChave, { ...t.escritorio, equipe: t.escritorio.equipe.filter((m) => m.id !== c.membroId) });
}
// Troca de personalidade paga: muda a personalidade e a saudação (se ainda era a saudação padrão da personalidade antiga)
export async function liberarPersonalidade(db: Db, reg: { terrenoChave: string; usuarioId: string }) {
  const { lote, catalogoId: membroId, extra: pid } = parteChave(reg.terrenoChave);
  const nova = PERSONALIDADE_POR_ID[pid]; if (!nova) return false;
  const [t] = await db<{ usuarioId: string; socios: string[] | null; status: string; empresaNome: string; escritorio: Escritorio | null }[]>`SELECT usuario_id, socios, status, empresa_nome, escritorio FROM terreno WHERE chave = ${lote} FOR UPDATE`;
  if (!t?.escritorio || t.status !== "ativo" || !ehDonoOuSocio({ usuarioId: t.usuarioId, socios: t.socios ?? [] }, reg.usuarioId)) return false;
  const e: Escritorio = JSON.parse(JSON.stringify(t.escritorio));
  const m = e.equipe.find((x) => x.id === membroId); if (!m) return false;
  if (usadasNa(e, m.id).has(nova.id)) return false;
  const antiga = m.personalidadeId ? PERSONALIDADE_POR_ID[m.personalidadeId] : null;
  const padraoAntigo = antiga ? falaDe(antiga, "saudacao", { nome: m.nome, empresa: t.empresaNome }).slice(0, 160) : "";
  if (!m.treino?.saudacao || m.treino.saudacao === padraoAntigo || (!antiga && m.papel === "atendente")) m.treino = { descricao: m.treino?.descricao ?? "", saudacao: falaDe(nova, "saudacao", { nome: m.nome, empresa: t.empresaNome }).slice(0, 160) };
  m.personalidadeId = nova.id;
  await salvar(db, lote, e);
  await guardarEscopos(db, lote, e);
  return true;
}
// membros comprados deste lote, com o que precisa voltar junto (terrenos.ts › salvarEscritorio)
export async function contratadosDoLote(chave: string): Promise<Set<string>> {
  await migrar();
  const rows = await sql<{ membroId: string }[]>`SELECT membro_id FROM agente_contratado WHERE terreno_chave = ${chave} AND status = 'ativo'`;
  return new Set(rows.map((r) => r.membroId));
}
export async function contratosDoLote(chave: string) {
  await migrar();
  return sql<{ membroId: string; personalidadeId: string | null; escopo: Membro["escopo"] | null }[]>`SELECT membro_id, personalidade_id, escopo FROM agente_contratado WHERE terreno_chave = ${chave} AND status = 'ativo'`;
}
