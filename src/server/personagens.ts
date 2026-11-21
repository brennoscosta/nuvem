// Personagem do visitante: quem compra entra no mapa como um boneco com o nome num balãozinho, anda pela calçada,
// vê quem mais está online e interage. Presença por "batida" (o navegador manda a posição a cada poucos segundos).
import { sql, id, migrar } from "./db";
import { TIPOS_AVATAR, TODOS_BONECOS, bonecoDe, codificarVisual, limparVisual, visualCompleto, type Visual } from "@/office/data/bonecos";
import { ACESSORIO_POR_ID, ITEM_PAGO_POR_ID, ROUPA_PAGA_POR_ID, ehGratis, itensPagosDoVisual, limparEquipados } from "@/office/data/acessorios";
import { ehAdmin, ehDonoOuSocio, obterTerreno } from "./terrenos";
import { avisarRecado } from "./avisos";
import type { Usuario } from "./usuarios";
import { registrar } from "./eventos";
import { NICHOS, nomeNicho } from "@/office/data/mundo";
import { corDaBicicleta, ehVeiculo, VEL_MAX_VEICULO, type IdVeiculo, type VeiculoPublico } from "@/office/data/veiculos";

// 21/11/2026 (decisão do dono): o personagem básico é GRÁTIS para toda conta logada: montou, está ativo. A cobrança
// antiga (PRECO_PERSONAGEM, mercadopago.ts › criarCobrancaPersonagem, o produto "personagem", ativarPersonagem e
// reverterPersonagem) fica sem uso, sem apagar: pagamentos e estornos antigos continuam funcionando. Os itens de visual
// pagos (os premium de R$ 5,90 e o uniforme) continuam pagos: são outra cobrança (src/server/cidade.ts › comprarItem).
export const PERSONAGEM_GRATIS = true;
export const PRECO_PERSONAGEM = 5.9; // R$/mês (promoção) — sem uso desde 21/11/2026 (PERSONAGEM_GRATIS)
export const PRECO_PERSONAGEM_CHEIO = 19.9;
export const SEGUNDOS_ONLINE = 25;

export interface Redes { instagram?: string; linkedin?: string; whatsapp?: string; site?: string }
// Perfil profissional (11/11/2026): o que a pessoa faz, para quem procura profissionais na busca (/encontrar)
export interface Perfil { profissao: string; nicho: string; servicos: string; preco: string; local: string; portfolio: { titulo: string; url: string }[]; disponivel: boolean }
export interface Personagem extends Perfil { usuarioId: string; nome: string; tipo: string; boneco: string; roupa: string; bio: string; redes: Redes; mostrarRedes: boolean; pagoAte: Date | null; x: number; z: number; rot: number; destX: number | null; destZ: number | null; vel: number; vistoEm: Date | null; criadoEm: Date; acessorios: string[]; visual: Visual & { veiculo?: VeiculoSalvo } }
export interface PersonagemPublico { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; x: number; z: number; rot: number; destino: [number, number] | null; vel: number; redes?: Redes; online: boolean; perfil?: Perfil | null; reputacao?: { media: number | null; n: number }; acessorios?: string[]; veiculo?: VeiculoPublico | null }
// bicicleta (19/11/2026, data/veiculos.ts): guardada no JSON visual, na chave "veiculo" (sem migração). A cor vem do
// painel (PUT /api/personagem/veiculo); "em" e "parada" vêm da batida
export interface VeiculoSalvo { cor?: string; em?: IdVeiculo | null; parada?: number[] | null } // parada: [x, z, giro, vaga 0 ou 1]
function veiculoPublico(v: VeiculoSalvo | undefined): VeiculoPublico | null {
  if (!v) return null;
  const montado = ehVeiculo(v.em), pr = Array.isArray(v.parada) && v.parada.length >= 3 ? v.parada : null;
  if (!montado && !pr) return null;
  return { id: montado ? (v.em as IdVeiculo) : "bicicleta", cor: corDaBicicleta(v.cor), montado, parada: pr ? [pr[0], pr[1], pr[2]] : null, vaga: !!pr?.[3] };
}

const CAMPOS = () => sql`usuario_id, nome, tipo, boneco, roupa, bio, redes, mostrar_redes, pago_ate, x, z, rot, dest_x, dest_z, vel, visto_em, criado_em, profissao, nicho, servicos, preco, local, portfolio, disponivel, acessorios, visual`;
const texto = (t: unknown, max: number, padrao = "") => (typeof t === "string" ? t.trim().slice(0, max) : padrao) || padrao;
function limparPerfil(x: unknown, atual: Partial<Perfil> | null): Perfil {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const pega = (k: keyof Perfil, max: number) => (k in o ? texto(o[k], max) : texto(atual?.[k], max));
  const nichoIn = pega("nicho", 24);
  const portIn = Array.isArray(o.portfolio) ? (o.portfolio as unknown[]) : (atual?.portfolio ?? []);
  const portfolio = portIn.slice(0, 6).map((p) => { const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>; let url = texto(r.url, 200); if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`; try { const u = new URL(url); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) url = ""; } catch { url = ""; } return { titulo: texto(r.titulo, 60) || (url ? new URL(url).hostname.replace(/^www\./, "") : ""), url }; }).filter((p) => p.url);
  return { profissao: pega("profissao", 60), nicho: NICHOS.some((n) => n.id === nichoIn) ? nichoIn : "", servicos: pega("servicos", 600), preco: pega("preco", 60), local: pega("local", 60), portfolio, disponivel: "disponivel" in o ? o.disponivel !== false : atual?.disponivel ?? true };
}
const perfilDe = (p: Personagem): Perfil | null => (p.profissao || p.servicos ? { profissao: p.profissao, nicho: p.nicho, servicos: p.servicos, preco: p.preco, local: p.local, portfolio: Array.isArray(p.portfolio) ? p.portfolio : [], disponivel: p.disponivel } : null);
const limparRedes = (r: unknown): Redes => { const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>; const s = (k: string) => texto(o[k], 120); return { instagram: s("instagram").replace(/^@/, ""), linkedin: s("linkedin"), whatsapp: s("whatsapp").replace(/\D/g, "").slice(0, 15), site: s("site") }; };

export async function meuPersonagem(usuarioId: string): Promise<Personagem | null> {
  await migrar();
  const [p] = await sql<Personagem[]>`SELECT ${CAMPOS()} FROM personagem WHERE usuario_id = ${usuarioId}`;
  return p ?? null;
}
export const personagemAtivo = (p: Personagem | null, u?: Usuario | null) => !!p && (PERSONAGEM_GRATIS || !!(p.pagoAte && new Date(p.pagoAte).getTime() > Date.now()) || ehAdmin(u));
// o mesmo "ativo" nas consultas (mapa, pessoas online, busca de profissionais e perfil público)
export const filtroPersonagemAtivo = () => (PERSONAGEM_GRATIS ? sql`TRUE` : sql`(pago_ate > now() OR usuario_id IN (SELECT id FROM usuario WHERE papel = 'admin'))`);

// o boneco (código v1:…) e a cor da roupa de um visual sobre o tipo pronto
function bonecoDoVisual(tipo: (typeof TIPOS_AVATAR)[number], v: Visual) {
  const personalizado = Object.keys(v).length > 0;
  return { boneco: personalizado ? codificarVisual(visualCompleto(bonecoDe(tipo.boneco), tipo.roupa, v), tipo.boneco) : TODOS_BONECOS[tipo.boneco] ? tipo.boneco : "classico", roupa: v.roupa ?? tipo.roupa };
}
const itensComprados = async (usuarioId: string, db: typeof sql = sql) => (await db<{ item: string }[]>`SELECT item FROM item_comprado WHERE usuario_id = ${usuarioId}`).map((r) => r.item);
// Editor completo (20/11/2026): o uniforme só vale para empresa ativa de que a pessoa é dona ou sócia, e a cor da roupa é a
// da empresa; roupa paga (terno de grife, jaqueta de couro, tênis de grife) só com o item comprado
async function conferirVisual(u: Usuario, v: Visual) {
  if (v.uniforme) {
    const t = await obterTerreno(v.uniforme);
    if (!t || t.status !== "ativo" || !ehDonoOuSocio(t, u.id)) delete v.uniforme;
    else if (/^#[0-9a-fA-F]{6}$/.test(t.cor)) v.roupa = t.cor.toUpperCase();
  }
  const pagos = itensPagosDoVisual(v);
  if (pagos.length && !ehAdmin(u)) {
    const comprados = await itensComprados(u.id);
    const falta = pagos.filter((i) => !comprados.includes(i));
    if (falta.length) throw new Error(`Para usar ${falta.map((i) => ITEM_PAGO_POR_ID[i]?.nome ?? i).join(" e ")}, compre o item primeiro (ou escolha outra peça).`);
  }
  return v;
}

// Cria ou edita (nome, tipo, bio, redes). Não mexe no pagamento.
// Desde 16/11/2026 aceita o visual personalizado (pele, cabelo, roupa, calça, tênis, barba, óculos): vai inteiro na coluna
// visual e, codificado (v1:…), na coluna boneco, que é o que o mapa, a rede e a busca já leem.
// 20/11/2026: o visual do editor completo (corpo, rosto, parte de baixo, sapatos, uniforme) e, se vierem, os acessórios
// em uso (os grátis e os comprados) vão juntos no mesmo salvar.
export async function salvarPersonagem(u: Usuario, d: { nome?: string; tipo?: string; bio?: string; redes?: unknown; mostrarRedes?: boolean; perfil?: unknown; visual?: unknown; acessorios?: unknown }) {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const atual = await meuPersonagem(u.id);
  const tipo = TIPOS_AVATAR.find((t) => t.id === d.tipo) ?? TIPOS_AVATAR.find((t) => t.id === atual?.tipo) ?? TIPOS_AVATAR[0];
  const nome = texto(d.nome, 24, atual?.nome ?? u.nome.split(" ")[0]);
  if (nome.length < 2) throw new Error("Dê um nome ao seu personagem.");
  // visual: o que veio no pedido; sem ele (aplicativo antigo), mantém o salvo se o tipo não mudou
  const v = await conferirVisual(u, limparVisual(d.visual !== undefined ? d.visual : atual && atual.tipo === tipo.id ? atual.visual : {}));
  const { boneco, roupa } = bonecoDoVisual(tipo, v);
  // acessórios em uso: só os grátis e os comprados, um por lugar (sem o campo, ficam os de antes)
  let acessorios: string[] | null = null;
  if (d.acessorios !== undefined) { const comprados = await itensComprados(u.id); acessorios = limparEquipados((Array.isArray(d.acessorios) ? d.acessorios : []).filter((i) => typeof i === "string" && (ehGratis(i) || comprados.includes(i) || (ehAdmin(u) && !!ACESSORIO_POR_ID[i])))); }
  const redes = sql.json(limparRedes(d.redes ?? atual?.redes ?? {}) as unknown as Parameters<typeof sql.json>[0]);
  const pf = limparPerfil(d.perfil, atual);
  const [p] = await sql<Personagem[]>`INSERT INTO personagem (usuario_id, nome, tipo, boneco, roupa, bio, redes, mostrar_redes, profissao, nicho, servicos, preco, local, portfolio, disponivel, visual)
    VALUES (${u.id}, ${nome}, ${tipo.id}, ${boneco}, ${roupa}, ${texto(d.bio, 200, atual?.bio ?? "")}, ${redes}, ${d.mostrarRedes ?? atual?.mostrarRedes ?? false},
            ${pf.profissao}, ${pf.nicho}, ${pf.servicos}, ${pf.preco}, ${pf.local}, ${sql.json(pf.portfolio as never)}, ${pf.disponivel}, ${sql.json(v as never)})
    ON CONFLICT (usuario_id) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, boneco = EXCLUDED.boneco, roupa = EXCLUDED.roupa, bio = EXCLUDED.bio, redes = EXCLUDED.redes, mostrar_redes = EXCLUDED.mostrar_redes,
      profissao = EXCLUDED.profissao, nicho = EXCLUDED.nicho, servicos = EXCLUDED.servicos, preco = EXCLUDED.preco, local = EXCLUDED.local, portfolio = EXCLUDED.portfolio, disponivel = EXCLUDED.disponivel,
      visual = CASE WHEN personagem.visual ? 'veiculo' THEN EXCLUDED.visual || jsonb_build_object('veiculo', personagem.visual->'veiculo') ELSE EXCLUDED.visual END, atualizado_em = now()
    RETURNING ${CAMPOS()}`;
  let final = p;
  if (acessorios) { const [q] = await sql<Personagem[]>`UPDATE personagem SET acessorios = ${sql.json(acessorios)} WHERE usuario_id = ${u.id} RETURNING ${CAMPOS()}`; if (q) final = q; }
  if (!atual) void registrar("cadastro", `${u.nome} montou o personagem "${nome}"`, { usuarioId: u.id });
  return final;
}
// Roupa premium paga (20/11/2026, chamado pelo Pix aprovado em src/server/cidade.ts › ativarItem): já veste a peça no
// visual salvo. No estorno (comprada = false) troca pela peça comum parecida, se estiver em uso.
const PECA_COMUM: Record<string, string> = { ternoGrife: "terno", jaquetaCouro: "jaqueta", tenisGrife: "tenis" };
export async function vestirRoupaComprada(usuarioId: string, itemId: string, comprada: boolean, db: typeof sql = sql) {
  const r = ROUPA_PAGA_POR_ID[itemId]; if (!r) return false;
  const [p] = await db<Personagem[]>`SELECT ${CAMPOS()} FROM personagem WHERE usuario_id = ${usuarioId}`;
  if (!p) return true; // comprou antes de montar o personagem: fica na conta
  const tipo = TIPOS_AVATAR.find((t) => t.id === p.tipo) ?? TIPOS_AVATAR[0];
  const v = limparVisual(p.visual ?? {});
  const campo = r.parte === "traje" ? "traje" : "sapato";
  if (comprada) (v as Record<string, unknown>)[campo] = r.valor;
  else if ((v as Record<string, unknown>)[campo] === r.valor) (v as Record<string, unknown>)[campo] = PECA_COMUM[r.valor];
  else return true;
  const { boneco, roupa } = bonecoDoVisual(tipo, v);
  await db`UPDATE personagem SET boneco = ${boneco}, roupa = ${roupa}, visual = ${sql.json(v as never)}::jsonb || CASE WHEN visual ? 'veiculo' THEN jsonb_build_object('veiculo', visual->'veiculo') ELSE '{}'::jsonb END, atualizado_em = now() WHERE usuario_id = ${usuarioId}`;
  return true;
}
// Pagamento aprovado (ou admin): +30 dias
export async function ativarPersonagem(usuarioId: string, dias = 30, db: typeof sql = sql) {
  await migrar();
  await db`UPDATE personagem SET pago_ate = GREATEST(COALESCE(pago_ate, now()), now()) + make_interval(days => ${dias}), atualizado_em = now() WHERE usuario_id = ${usuarioId}`;
}
// Pagamento estornado: tira os dias pagos
export async function reverterPersonagem(usuarioId: string, dias: number, db: typeof sql = sql) {
  await db`UPDATE personagem SET pago_ate = pago_ate - make_interval(days => ${dias}), atualizado_em = now() WHERE usuario_id = ${usuarioId} AND pago_ate IS NOT NULL`;
}
// Batida de presença: grava posição e devolve quem mais está online (sem o próprio)
export async function presenca(usuarioId: string, pos: { x: number; z: number; rot: number; destino?: [number, number] | null; vel?: number; veiculo?: unknown; parada?: unknown }): Promise<PersonagemPublico[]> {
  await migrar();
  const lim = (n: unknown) => Math.max(-100, Math.min(100, Number(n) || 0));
  const x = lim(pos.x), z = lim(pos.z), rot = Number(pos.rot) || 0;
  const d = Array.isArray(pos.destino) && pos.destino.length === 2 ? [lim(pos.destino[0]), lim(pos.destino[1])] : null;
  // de bicicleta passa dos 5 m/s de antes (a velocidade só serve para os outros desenharem o boneco andando)
  const vel = Math.max(0, Math.min(VEL_MAX_VEICULO + 1, Number(pos.vel) || 0));
  // bicicleta: em que veículo está e onde a bicicleta ficou parada; só grava quando muda (quem nunca usou não ganha a chave)
  const arred = (n: unknown) => Math.round(lim(n) * 100) / 100;
  const pr = Array.isArray(pos.parada) && pos.parada.length >= 3 ? [arred(pos.parada[0]), arred(pos.parada[1]), Math.round((Number(pos.parada[2]) || 0) * 100) / 100, pos.parada[3] ? 1 : 0] : null;
  const ve = { em: ehVeiculo(pos.veiculo) ? pos.veiculo : null, parada: pr };
  await sql`UPDATE personagem SET x = ${x}, z = ${z}, rot = ${rot}, dest_x = ${d ? d[0] : null}, dest_z = ${d ? d[1] : null}, vel = ${vel}, visto_em = now(),
    visual = CASE WHEN jsonb_build_object('em', COALESCE(visual->'veiculo'->'em', 'null'::jsonb), 'parada', COALESCE(visual->'veiculo'->'parada', 'null'::jsonb)) = ${sql.json(ve as never)}::jsonb THEN visual
      ELSE jsonb_set(visual, '{veiculo}', COALESCE(visual->'veiculo', '{}'::jsonb) || ${sql.json(ve as never)}::jsonb) END
    WHERE usuario_id = ${usuarioId}`;
  return outrosOnline(usuarioId);
}
// cor da bicicleta (uma das cores de data/veiculos.ts), guardada junto do visual
export async function escolherCorVeiculo(usuarioId: string, cor: unknown) {
  await migrar();
  const c = corDaBicicleta(cor);
  await sql`UPDATE personagem SET visual = jsonb_set(visual, '{veiculo}', COALESCE(visual->'veiculo', '{}'::jsonb) || jsonb_build_object('cor', ${c}::text)), atualizado_em = now() WHERE usuario_id = ${usuarioId}`;
  return c;
}
export async function outrosOnline(excetoId: string | null): Promise<PersonagemPublico[]> {
  await migrar();
  const lista = await sql<(Personagem & { usuarioNome: string })[]>`SELECT ${CAMPOS()} FROM personagem WHERE visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE}) AND ${filtroPersonagemAtivo()} AND usuario_id <> ${excetoId ?? ""} ORDER BY visto_em DESC LIMIT 200`;
  return lista.map((p) => ({ usuarioId: p.usuarioId, nome: p.nome, boneco: p.boneco, roupa: p.roupa, bio: p.bio, x: p.x, z: p.z, rot: p.rot, destino: p.destX != null && p.destZ != null ? [p.destX, p.destZ] as [number, number] : null, vel: p.vel ?? 0, redes: p.mostrarRedes ? p.redes : undefined, online: true, acessorios: p.acessorios ?? [], veiculo: veiculoPublico(p.visual?.veiculo) }));
}
export async function personagemPublico(usuarioId: string, paraId: string | null): Promise<PersonagemPublico | null> {
  await migrar();
  const [p] = await sql<Personagem[]>`SELECT ${CAMPOS()} FROM personagem WHERE usuario_id = ${usuarioId}`;
  if (!p) return null;
  // redes aparecem se ele mostra pra todos ou se os dois são amigos
  let redes: Redes | undefined = p.mostrarRedes ? p.redes : undefined;
  if (!redes && paraId) { const [am] = await sql<{ id: string }[]>`SELECT id FROM amizade WHERE status = 'aceita' AND LEAST(de_id, para_id) = LEAST(${usuarioId}, ${paraId}) AND GREATEST(de_id, para_id) = GREATEST(${usuarioId}, ${paraId}) LIMIT 1`; if (am) redes = p.redes; }
  const [rep] = await sql<{ media: number | null; n: number }[]>`SELECT AVG(nota)::float AS media, COUNT(*)::int AS n FROM avaliacao WHERE para_id = ${usuarioId}`;
  return { usuarioId: p.usuarioId, nome: p.nome, boneco: p.boneco, roupa: p.roupa, bio: p.bio, x: p.x, z: p.z, rot: p.rot, destino: null, vel: 0, redes, online: !!p.vistoEm && Date.now() - new Date(p.vistoEm).getTime() < SEGUNDOS_ONLINE * 1000, perfil: perfilDe(p), reputacao: { media: rep?.media ?? null, n: rep?.n ?? 0 }, acessorios: p.acessorios ?? [] };
}

// Busca de profissionais (11/11/2026): personagens ativos com perfil profissional, por texto, área, disponibilidade e online.
// Só o que a pessoa escolheu mostrar: nome, boneco, perfil, nota e as redes se ela mostra para todos.
export async function buscarProfissionais(f: { q?: string | null; nicho?: string | null; disponivel?: boolean; online?: boolean }) {
  await migrar();
  const q = (f.q ?? "").trim().slice(0, 60);
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  const nicho = f.nicho && NICHOS.some((n) => n.id === f.nicho) ? f.nicho : null;
  const rows = await sql<(Personagem & { media: number | null; n: number })[]>`SELECT ${CAMPOS()},
      (SELECT AVG(a.nota)::float FROM avaliacao a WHERE a.para_id = personagem.usuario_id) AS media,
      (SELECT COUNT(*)::int FROM avaliacao a WHERE a.para_id = personagem.usuario_id) AS n
    FROM personagem
    WHERE ${filtroPersonagemAtivo()}
      AND usuario_id NOT IN (SELECT id FROM usuario WHERE banido_em IS NOT NULL)
      AND (profissao <> '' OR servicos <> '')
      AND (${q} = '' OR nome ILIKE ${like} OR profissao ILIKE ${like} OR servicos ILIKE ${like} OR bio ILIKE ${like} OR local ILIKE ${like})
      AND (${nicho}::text IS NULL OR nicho = ${nicho})
      AND (${!!f.disponivel} = false OR disponivel)
      AND (${!!f.online} = false OR visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE}))
    ORDER BY (visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE})) DESC NULLS LAST, disponivel DESC, n DESC, atualizado_em DESC NULLS LAST
    LIMIT 60`;
  return rows.map((p) => ({ usuarioId: p.usuarioId, nome: p.nome, boneco: p.boneco, roupa: p.roupa, bio: p.bio, redes: p.mostrarRedes ? p.redes : undefined, online: !!p.vistoEm && Date.now() - new Date(p.vistoEm).getTime() < SEGUNDOS_ONLINE * 1000, perfil: perfilDe(p)!, nichoNome: p.nicho ? nomeNicho(p.nicho) : null, reputacao: { media: p.media, n: p.n } }));
}

// ---- mensagens (conversa / chat ao vivo / negócios / redes) ----
export interface Mensagem { id: string; deId: string; paraId: string; tipo: string; texto: string; lidaEm: Date | null; criadoEm: Date }
export async function enviarMensagem(de: Usuario, paraId: string, tipo: string, texto: string) {
  await migrar();
  if (de.banidoEm) throw new Error("Conta suspensa.");
  if (de.id === paraId) throw new Error("Esse personagem é você.");
  const t = (texto ?? "").trim().slice(0, 1000);
  const tp = ["chat", "negocio", "negocio_status", "amizade_pedido", "amizade_aceite", "chamada"].includes(tipo) ? tipo : "chat";
  if (!t) throw new Error("Escreva algo.");
  const [alvo] = await sql<{ usuarioId: string }[]>`SELECT usuario_id FROM personagem WHERE usuario_id = ${paraId}`;
  if (!alvo) throw new Error("Esse personagem não existe mais.");
  const [m] = await sql<Mensagem[]>`INSERT INTO recado (id, de_id, para_id, tipo, texto) VALUES (${id("msg")}, ${de.id}, ${paraId}, ${tp}, ${t}) RETURNING id, de_id, para_id, tipo, texto, lida_em, criado_em`;
  void avisarRecado(de.id, paraId, tp, t); // sino de quem recebe (12/11/2026)
  return m;
}
// Conversa entre dois (as últimas 80), marcando como lidas as recebidas
export async function conversa(euId: string, outroId: string, desde?: string | null): Promise<Mensagem[]> {
  await migrar();
  await sql`UPDATE recado SET lida_em = now() WHERE para_id = ${euId} AND de_id = ${outroId} AND lida_em IS NULL`;
  return desde
    ? sql<Mensagem[]>`SELECT id, de_id, para_id, tipo, texto, lida_em, criado_em FROM recado WHERE ((de_id = ${euId} AND para_id = ${outroId}) OR (de_id = ${outroId} AND para_id = ${euId})) AND criado_em > ${new Date(desde)} ORDER BY criado_em ASC LIMIT 80`
    : sql<Mensagem[]>`SELECT * FROM (SELECT id, de_id, para_id, tipo, texto, lida_em, criado_em FROM recado WHERE (de_id = ${euId} AND para_id = ${outroId}) OR (de_id = ${outroId} AND para_id = ${euId}) ORDER BY criado_em DESC LIMIT 80) q ORDER BY criado_em ASC`;
}
// Caixa de entrada: último recado de cada pessoa + não lidas
export async function caixaDeEntrada(euId: string) {
  await migrar();
  return sql<{ outroId: string; nome: string; boneco: string; roupa: string; ultimo: string; tipo: string; quando: Date; naoLidas: number; online: boolean }[]>`
    WITH pares AS (
      SELECT CASE WHEN de_id = ${euId} THEN para_id ELSE de_id END AS outro_id, MAX(criado_em) AS quando FROM recado WHERE de_id = ${euId} OR para_id = ${euId} GROUP BY 1)
    SELECT p.outro_id, pe.nome, pe.boneco, pe.roupa, m.texto AS ultimo, m.tipo, p.quando,
      (SELECT COUNT(*) FROM recado n WHERE n.de_id = p.outro_id AND n.para_id = ${euId} AND n.lida_em IS NULL)::int AS nao_lidas,
      (pe.visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE})) AS online
    FROM pares p JOIN personagem pe ON pe.usuario_id = p.outro_id
    JOIN LATERAL (SELECT texto, tipo FROM recado m WHERE ((m.de_id = ${euId} AND m.para_id = p.outro_id) OR (m.de_id = p.outro_id AND m.para_id = ${euId})) ORDER BY criado_em DESC LIMIT 1) m ON TRUE
    ORDER BY p.quando DESC LIMIT 50`;
}
export async function naoLidas(euId: string): Promise<number> {
  await migrar();
  const [r] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM recado WHERE para_id = ${euId} AND lida_em IS NULL`;
  return r?.n ?? 0;
}
export async function listarPersonagensAdmin() {
  await migrar();
  return sql<(Personagem & { email: string })[]>`SELECT p.usuario_id, p.nome, p.tipo, p.boneco, p.roupa, p.bio, p.redes, p.mostrar_redes, p.pago_ate, p.x, p.z, p.rot, p.visto_em, p.criado_em, u.email FROM personagem p JOIN usuario u ON u.id = p.usuario_id ORDER BY p.criado_em DESC LIMIT 300`;
}
