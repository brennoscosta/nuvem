// Painel de resultados do lote (12/11/2026): visitas por dia (cartão no mapa e página da loja), conversas com a
// atendente de IA, candidaturas às vagas, cliques que levam ao WhatsApp/Instagram/site/produto e agendamentos.
// Quem não entrou na conta conta como visitante anônimo: um código que muda todo dia (IP + navegador + dia), sem guardar
// o IP. O próprio dono não conta como visita da loja dele.
// 17/11/2026: "Quanto a sua equipe trouxe" — vendas confirmadas, pedidos esperando o Pix, ticket médio, clientes novos,
// o funil (visitas → conversas → pedidos → pagos) e o custo da IA no período (vendasDoDono, logo abaixo do painel).
// Períodos: este mês (padrão), esta semana (desde segunda), últimos 30 e 90 dias; ?dias=7 (aviso semanal) continua.
import { createHash } from "node:crypto";
import { sql, migrar } from "./db";
import { bloqueio, contar } from "./limite";
import { contatosNaFala } from "./conectores";
import type { Usuario } from "./usuarios";
import { LOTES, LOTE_POR_CHAVE } from "@/office/data/mundo";
import type { Terreno } from "./terrenos";
import { numeroDaLoja } from "@/office/data/numeroLoja";
import { chaveDaLoja } from "@/office/data/numeroLoja";

const TZ = "America/Sao_Paulo";
export const diaBR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // AAAA-MM-DD
export function visitanteDe(h: Headers, usuarioId?: string | null) {
  if (usuarioId) return usuarioId;
  const ua = h.get("user-agent") ?? "", ip = h.get("x-real-ip")?.trim() || "sem-ip"; // o nginx do CapRover grava o IP real
  return "a:" + createHash("sha256").update(`${ip}|${ua}|${diaBR()}|workend-visita`).digest("base64url").slice(0, 18);
}
// robôs de busca e prévias de link não contam
// programas (curl, scripts) também não contam: só navegador de gente (12/11/2026, a checagem da publicação contou uma visita falsa)
const ehRobo = (h: Headers) => { const ua = h.get("user-agent") ?? ""; return !/mozilla\//i.test(ua) || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|curl|wget|python|node-fetch|axios|okhttp|go-http|java\//i.test(ua); };

// a loja (lote principal) de um número de lote; uma ampliação conta para o lote principal
export async function lojaDoNumero(numero: number): Promise<{ chave: string; donoId: string } | null> {
  const chave = chaveDaLoja(numero); if (!chave) return null; // 0 = a sede da Social RP
  await migrar();
  const [t] = await sql<{ chave: string; usuarioId: string; status: string; anexoDe: string | null }[]>`SELECT chave, usuario_id, status, anexo_de FROM terreno WHERE chave = ${chave}`;
  if (!t || t.status !== "ativo") return null;
  if (t.anexoDe) { const [p] = await sql<{ chave: string; usuarioId: string }[]>`SELECT chave, usuario_id FROM terreno WHERE chave = ${t.anexoDe} AND status = 'ativo'`; return p ? { chave: p.chave, donoId: p.usuarioId } : null; }
  return { chave: t.chave, donoId: t.usuarioId };
}

export async function registrarVisitaDia(h: Headers, loja: { chave: string; donoId: string }, usuarioId: string | null, origem: "mapa" | "pagina") {
  if (ehRobo(h) || usuarioId === loja.donoId) return;
  const v = visitanteDe(h, usuarioId);
  await sql`INSERT INTO visita_dia (terreno_chave, dono_id, dia, visitante, origem) VALUES (${loja.chave}, ${loja.donoId}, ${diaBR()}, ${v}, ${origem}) ON CONFLICT DO NOTHING`.catch((e) => console.error("[visita]", (e as Error).message));
}

export const TIPOS_CLIQUE = ["whatsapp", "instagram", "site", "email", "produto"] as const;
export type TipoClique = (typeof TIPOS_CLIQUE)[number];
// o mesmo visitante clicando de novo no mesmo botão em 10 minutos conta uma vez só
export async function registrarClique(h: Headers, loja: { chave: string; donoId: string }, usuarioId: string | null, tipo: TipoClique, ref?: string | null) {
  if (ehRobo(h) || usuarioId === loja.donoId || !TIPOS_CLIQUE.includes(tipo)) return;
  const v = visitanteDe(h, usuarioId), r = (ref ?? "").slice(0, 60) || null;
  const k = `clique:${loja.donoId}:${v}:${tipo}:${r ?? ""}`;
  if (bloqueio(k, 1)) return; contar(k, 10);
  await sql`INSERT INTO clique_loja (dono_id, terreno_chave, tipo, ref, visitante) VALUES (${loja.donoId}, ${loja.chave}, ${tipo}, ${r}, ${v})`.catch((e) => console.error("[clique]", (e as Error).message));
}

// ---------- período ----------
export type Periodo = "mes" | "semana" | "30" | "90" | "7";
// a ordem do seletor (o "7 dias" só aparece quando vem do aviso semanal)
export const PERIODOS: { id: Periodo; nome: string }[] = [{ id: "mes", nome: "Este mês" }, { id: "30", nome: "Últimos 30 dias" }, { id: "semana", nome: "Esta semana" }, { id: "90", nome: "90 dias" }];
export interface Janela { periodo: Periodo; desde: string; dias: number; antesDe: string; rotulo: string; Rotulo: string }
const somaDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);
// janela do período no horário de Brasília: de "desde" (inclusive) até hoje; "antesDe" abre o período anterior, do mesmo tamanho
export function janelaDe(p: string | number | null | undefined, hoje = diaBR()): Janela {
  const s = String(p ?? "");
  const id: Periodo = s === "7" || s === "30" || s === "90" || s === "semana" ? s : "mes";
  let desde: string, rotulo: string;
  if (id === "mes") { desde = `${hoje.slice(0, 8)}01`; rotulo = "este mês"; }
  else if (id === "semana") { const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay(); desde = somaDias(hoje, -((dow + 6) % 7)); rotulo = "esta semana"; }
  else { const n = Number(id); desde = somaDias(hoje, -(n - 1)); rotulo = `nos últimos ${n} dias`; }
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400_000) + 1;
  return { periodo: id, desde, dias, antesDe: somaDias(desde, -dias), rotulo, Rotulo: rotulo[0].toUpperCase() + rotulo.slice(1) };
}

// ---------- painel ----------
export type Serie = { dia: string; n: number }[];
export interface Resultados {
  dias: number; desde: string; janela: Janela; lote: { chave: string; numero: number | null; empresa: string } | null;
  visitas: { total: number; anterior: number; serie: Serie; mapa: number; pagina: number; logados: number };
  conversas: { total: number; anterior: number; serie: Serie; mensagens: number };
  candidaturas: { total: number; anterior: number; serie: Serie; vagasAbertas: number };
  cliques: { total: number; anterior: number; serie: Serie; porTipo: Record<string, number>; produtos: { id: string; nome: string; n: number }[] };
  agendamentos: { total: number; anterior: number; serie: Serie; proximos: number } | null;
  agendaLigada: boolean; produtosNaVitrine: number;
  topDias: { dia: string; n: number } | null;
}
const preencher = (desde: string, dias: number, rows: { dia: string; n: number }[]): Serie => {
  const m = new Map(rows.map((r) => [String(r.dia).slice(0, 10), r.n]));
  const out: Serie = []; const d0 = new Date(`${desde}T12:00:00Z`);
  for (let i = 0; i < dias; i++) { const d = new Date(d0.getTime() + i * 86400_000).toISOString().slice(0, 10); out.push({ dia: d, n: m.get(d) ?? 0 }); }
  return out;
};
const soma = (s: Serie) => s.reduce((a, x) => a + x.n, 0);
async function existeTabela(nome: string) { const [r] = await sql<{ ok: boolean }[]>`SELECT to_regclass(${"public." + nome}) IS NOT NULL AS ok`; return !!r?.ok; }

// periodo: 7, 30 ou 90 (dias, como antes) ou "mes" / "semana" (17/11/2026); um número fora da lista vale 30 dias
export async function resultadosDoDono(u: Usuario, terreno: Terreno | null, periodo: number | string): Promise<Resultados> {
  await migrar();
  const janela = janelaDe(typeof periodo === "number" ? ([7, 30, 90].includes(periodo) ? periodo : 30) : periodo);
  const { dias, desde, antesDe } = janela;
  const uid = u.id;

  const [vis, visAnt, visOrigem, conv, convAnt, cand, candAnt, vagas, cliq, cliqAnt, cliqTipo, cliqProd] = await Promise.all([
    sql<{ dia: string; n: number }[]>`SELECT dia::text AS dia, count(*)::int AS n FROM visita_dia WHERE dono_id = ${uid} AND dia >= ${desde}::date GROUP BY dia`,
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM visita_dia WHERE dono_id = ${uid} AND dia >= ${antesDe}::date AND dia < ${desde}::date`,
    sql<{ mapa: number; pagina: number; logados: number }[]>`SELECT count(*) FILTER (WHERE origem = 'mapa')::int AS mapa, count(*) FILTER (WHERE origem = 'pagina')::int AS pagina, count(*) FILTER (WHERE visitante NOT LIKE 'a:%')::int AS logados FROM visita_dia WHERE dono_id = ${uid} AND dia >= ${desde}::date`,
    // conversa = um visitante que escreveu para a equipe da loja num dia
    sql<{ dia: string; n: number; msgs: number }[]>`SELECT (m.criado_em AT TIME ZONE ${TZ})::date::text AS dia, count(DISTINCT m.visitante_id)::int AS n, count(*)::int AS msgs
      FROM mensagem m JOIN agente a ON a.id = m.agente_id WHERE a.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid}) AND m.visitante_id IS NOT NULL AND m.papel = 'user' AND (m.criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date GROUP BY 1`,
    sql<{ n: number }[]>`SELECT count(DISTINCT (m.visitante_id, (m.criado_em AT TIME ZONE ${TZ})::date))::int AS n FROM mensagem m JOIN agente a ON a.id = m.agente_id
      WHERE a.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid}) AND m.visitante_id IS NOT NULL AND m.papel = 'user' AND (m.criado_em AT TIME ZONE ${TZ})::date >= ${antesDe}::date AND (m.criado_em AT TIME ZONE ${TZ})::date < ${desde}::date`,
    sql<{ dia: string; n: number }[]>`SELECT (c.criado_em AT TIME ZONE ${TZ})::date::text AS dia, count(*)::int AS n FROM candidatura c JOIN vaga v ON v.id = c.vaga_id WHERE v.usuario_id = ${uid} AND (c.criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date GROUP BY 1`,
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM candidatura c JOIN vaga v ON v.id = c.vaga_id WHERE v.usuario_id = ${uid} AND (c.criado_em AT TIME ZONE ${TZ})::date >= ${antesDe}::date AND (c.criado_em AT TIME ZONE ${TZ})::date < ${desde}::date`,
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM vaga WHERE usuario_id = ${uid} AND aberta`,
    sql<{ dia: string; n: number }[]>`SELECT (criado_em AT TIME ZONE ${TZ})::date::text AS dia, count(*)::int AS n FROM clique_loja WHERE dono_id = ${uid} AND (criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date GROUP BY 1`,
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM clique_loja WHERE dono_id = ${uid} AND (criado_em AT TIME ZONE ${TZ})::date >= ${antesDe}::date AND (criado_em AT TIME ZONE ${TZ})::date < ${desde}::date`,
    sql<{ tipo: string; n: number }[]>`SELECT tipo, count(*)::int AS n FROM clique_loja WHERE dono_id = ${uid} AND (criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date GROUP BY tipo`,
    sql<{ ref: string; n: number }[]>`SELECT ref, count(*)::int AS n FROM clique_loja WHERE dono_id = ${uid} AND tipo = 'produto' AND ref IS NOT NULL AND (criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date GROUP BY ref ORDER BY 2 DESC LIMIT 5`,
  ]);

  // nomes dos produtos mais clicados (vitrine, src/server/vitrine.ts)
  let produtos: { id: string; nome: string; n: number }[] = [];
  if (cliqProd.length && (await existeTabela("produto"))) {
    const nomes = await sql<{ id: string; nome: string }[]>`SELECT id, nome FROM produto WHERE id = ANY(${sql.array(cliqProd.map((p) => p.ref))})`;
    produtos = cliqProd.map((p) => ({ id: p.ref, nome: nomes.find((x) => x.id === p.ref)?.nome ?? "Produto removido", n: p.n }));
  }
  // agendamentos (src/server/agenda.ts): marcados no período, pela data em que foram marcados
  let agendamentos: Resultados["agendamentos"] = null;
  if (await existeTabela("agendamento")) {
    const [ag, agAnt, prox] = await Promise.all([
      sql<{ dia: string; n: number }[]>`SELECT (criado_em AT TIME ZONE ${TZ})::date::text AS dia, count(*)::int AS n FROM agendamento WHERE dono_id = ${uid} AND status <> 'cancelado' AND (criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date GROUP BY 1`,
      sql<{ n: number }[]>`SELECT count(*)::int AS n FROM agendamento WHERE dono_id = ${uid} AND status <> 'cancelado' AND (criado_em AT TIME ZONE ${TZ})::date >= ${antesDe}::date AND (criado_em AT TIME ZONE ${TZ})::date < ${desde}::date`,
      sql<{ n: number }[]>`SELECT count(*)::int AS n FROM agendamento WHERE dono_id = ${uid} AND status = 'marcado' AND inicio > now()`,
    ]);
    const s = preencher(desde, dias, ag);
    agendamentos = { total: soma(s), anterior: agAnt[0]?.n ?? 0, serie: s, proximos: prox[0]?.n ?? 0 };
  }

  // vitrine e agenda montadas? (para os próximos passos)
  const produtosNaVitrine = (await existeTabela("produto")) ? ((await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM produto WHERE usuario_id = ${uid} AND ativo`.catch(() => [{ n: 0 }]))[0]?.n ?? 0) : 0;
  const agendaLigada = (await existeTabela("agenda_loja")) ? !!(await sql`SELECT 1 FROM agenda_loja WHERE dono_id = ${uid} AND ligada`.catch(() => []))[0] : false;
  const sVis = preencher(desde, dias, vis), sConv = preencher(desde, dias, conv), sCand = preencher(desde, dias, cand), sCliq = preencher(desde, dias, cliq);
  const top = sVis.reduce<{ dia: string; n: number } | null>((m, x) => (x.n > (m?.n ?? 0) ? x : m), null);
  return {
    dias, desde, janela,
    lote: terreno ? { chave: terreno.chave, numero: numeroDaLoja(terreno), empresa: terreno.empresaNome } : null,
    visitas: { total: soma(sVis), anterior: visAnt[0]?.n ?? 0, serie: sVis, mapa: visOrigem[0]?.mapa ?? 0, pagina: visOrigem[0]?.pagina ?? 0, logados: visOrigem[0]?.logados ?? 0 },
    conversas: { total: soma(sConv), anterior: convAnt[0]?.n ?? 0, serie: sConv, mensagens: conv.reduce((a, x) => a + x.msgs, 0) },
    candidaturas: { total: soma(sCand), anterior: candAnt[0]?.n ?? 0, serie: sCand, vagasAbertas: vagas[0]?.n ?? 0 },
    cliques: { total: soma(sCliq), anterior: cliqAnt[0]?.n ?? 0, serie: sCliq, porTipo: Object.fromEntries(cliqTipo.map((c) => [c.tipo, c.n])), produtos },
    agendamentos, agendaLigada, produtosNaVitrine, topDias: top,
  };
}

// ---------- vendas: "Quanto a sua equipe trouxe" (17/11/2026) ----------
// Pedidos feitos na conversa com a atendente (tabela pedido, migração 0038; a tela de Vendas fica em /app/vendas). O
// WorkEnd não passa o dinheiro: o Pix cai na chave do dono e é ele quem confirma. Como no resto do painel, os números
// são da conta (pedido.usuario_id = o titular da loja; um sócio de sede não vê as vendas do titular). Tudo em centavos.
//  - vendas confirmadas: status pago ou entregue, pela data do pagamento (pago_em);
//  - aguardando: pedidos feitos no período que ainda esperam o Pix;
//  - funil: pedidos feitos no período (qualquer situação) e, desses, quantos já foram pagos ou entregues;
//  - clientes novos: quem deixou telefone ou e-mail na conversa com a atendente (contatosNaFala, o mesmo teste do aviso
//    visitante.contato) + quem comprou, cada pessoa uma vez, sem contar quem já tinha deixado contato ou comprado antes;
//  - IA: o que a equipe de IA da conta gastou no período (uso_ia, a mesma soma do "IA do mês" da Minha equipe).
// As consultas usam o período direto na coluna (pago_em >= início), com os índices por dono (0038 e 0040).
export type DiaVenda = { dia: string; centavos: number; pedidos: number };
export interface Vendas {
  temPedidos: boolean; pixLigado: boolean;
  confirmadas: { centavos: number; pedidos: number };
  aguardando: { centavos: number; pedidos: number };
  ticketCentavos: number | null;
  serie: DiaVenda[];
  funil: { pedidos: number; pagos: number };
  clientesNovos: { total: number; peloContato: number; compraram: number };
  iaBrl: number;
}
type Comprador = { clienteUsuarioId: string | null; clienteContato: string; clienteNome: string };
const nada = <T,>() => Promise.resolve([] as T[]);

// chaves de uma pessoa a partir do que ela escreveu: e-mail em minúsculas e telefone só com os dígitos (sem o 55)
function chavesDoContato(texto: string): string[] {
  const c = contatosNaFala(texto ?? ""); if (!c) return [];
  const out: string[] = [];
  if (c.email) out.push(`e:${c.email.toLowerCase()}`);
  if (c.telefone) { const d = c.telefone.replace(/\D/g, ""); out.push(`t:${d.length > 11 && d.startsWith("55") ? d.slice(2) : d}`); }
  return out;
}
function chavesDoComprador(p: Comprador): string[] {
  const k = [...(p.clienteUsuarioId ? [`u:${p.clienteUsuarioId}`] : []), ...chavesDoContato(p.clienteContato)];
  return k.length ? k : [`n:${(p.clienteNome || "").trim().toLowerCase()}`];
}
// junta as chaves que são da mesma pessoa (mesma conta, e-mail ou telefone) e conta quem não era conhecido antes
function contarNovos(grupos: { chaves: string[]; fonte: "contato" | "compra" }[], conhecidas: Set<string>) {
  const pai = new Map<string, string>();
  const raiz = (k: string): string => { const p = pai.get(k) ?? k; if (p === k) return k; const r = raiz(p); pai.set(k, r); return r; };
  for (const g of grupos) for (const k of g.chaves) { if (!pai.has(k)) pai.set(k, k); pai.set(raiz(k), raiz(g.chaves[0])); }
  const pessoas = new Map<string, { nova: boolean; contato: boolean; compra: boolean }>();
  for (const g of grupos) {
    const r = raiz(g.chaves[0]);
    const p = pessoas.get(r) ?? { nova: true, contato: false, compra: false };
    if (g.chaves.some((k) => conhecidas.has(k))) p.nova = false;
    if (g.fonte === "contato") p.contato = true; else p.compra = true;
    pessoas.set(r, p);
  }
  const novas = [...pessoas.values()].filter((p) => p.nova);
  return { total: novas.length, peloContato: novas.filter((p) => p.contato).length, compraram: novas.filter((p) => p.compra).length };
}
const preencherVendas = (desde: string, dias: number, rows: DiaVenda[]): DiaVenda[] => {
  const m = new Map(rows.map((r) => [String(r.dia).slice(0, 10), r]));
  return Array.from({ length: dias }, (_, i) => { const d = somaDias(desde, i), r = m.get(d); return { dia: d, centavos: Math.round(Number(r?.centavos ?? 0)), pedidos: r?.pedidos ?? 0 }; });
};

export async function vendasDoDono(u: Usuario, j: Janela): Promise<Vendas> {
  await migrar();
  const uid = u.id;
  const [tem, temPix] = await Promise.all([existeTabela("pedido"), existeTabela("recebimento_pix")]);
  const [porDia, feitos, compradores, falas, ia, pix] = await Promise.all([
    tem ? sql<DiaVenda[]>`SELECT (pago_em AT TIME ZONE ${TZ})::date::text AS dia, count(*)::int AS pedidos, sum(total_centavos)::float8 AS centavos
      FROM pedido WHERE usuario_id = ${uid} AND status IN ('pago', 'entregue') AND pago_em >= (${j.desde}::timestamp AT TIME ZONE ${TZ}) GROUP BY 1` : nada<DiaVenda>(),
    tem ? sql<{ pedidos: number; pagos: number; aguardando: number; aguardandoCentavos: number }[]>`SELECT count(*)::int AS pedidos,
        count(*) FILTER (WHERE status IN ('pago', 'entregue'))::int AS pagos,
        count(*) FILTER (WHERE status = 'aguardando')::int AS aguardando,
        COALESCE(sum(total_centavos) FILTER (WHERE status = 'aguardando'), 0)::float8 AS aguardando_centavos
      FROM pedido WHERE usuario_id = ${uid} AND criado_em >= (${j.desde}::timestamp AT TIME ZONE ${TZ})` : nada<{ pedidos: number; pagos: number; aguardando: number; aguardandoCentavos: number }>(),
    tem ? sql<Comprador[]>`SELECT DISTINCT cliente_usuario_id, cliente_contato, cliente_nome FROM pedido
      WHERE usuario_id = ${uid} AND status IN ('pago', 'entregue') AND pago_em >= (${j.desde}::timestamp AT TIME ZONE ${TZ})` : nada<Comprador>(),
    // falas de visitantes com @ ou 4 dígitos seguidos (o resto do teste é o contatosNaFala, aqui no servidor)
    sql<{ vid: string; conteudo: string }[]>`SELECT m.visitante_id AS vid, m.conteudo FROM mensagem m JOIN agente a ON a.id = m.agente_id
      WHERE a.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid}) AND m.papel = 'user' AND m.visitante_id IS NOT NULL AND m.visitante_id <> ${uid}
        AND m.criado_em >= (${j.desde}::timestamp AT TIME ZONE ${TZ}) AND m.conteudo ~ '@|[0-9]{4}'`,
    sql<{ g: string }[]>`SELECT COALESCE(sum(x.custo_brl), 0)::text AS g FROM uso_ia x JOIN agente a ON a.id = x.agente_id
      WHERE a.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid}) AND x.criado_em >= (${j.desde}::timestamp AT TIME ZONE ${TZ})`,
    temPix ? sql<{ ok: number }[]>`SELECT 1 AS ok FROM recebimento_pix WHERE usuario_id = ${uid}` : nada<{ ok: number }>(),
  ]);

  const serie = preencherVendas(j.desde, j.dias, [...porDia]);
  const conf = serie.reduce((a, x) => ({ centavos: a.centavos + x.centavos, pedidos: a.pedidos + x.pedidos }), { centavos: 0, pedidos: 0 });
  const f = feitos[0];

  // clientes novos: as pessoas do período e quem delas já era conhecido antes
  const grupos: { chaves: string[]; fonte: "contato" | "compra" }[] = [];
  for (const m of falas) { const k = chavesDoContato(m.conteudo); if (k.length) grupos.push({ chaves: [`u:${m.vid}`, ...k], fonte: "contato" }); }
  for (const c of compradores) grupos.push({ chaves: chavesDoComprador(c), fonte: "compra" });
  const conhecidas = new Set<string>();
  if (grupos.length) {
    const todas = [...new Set(grupos.flatMap((g) => g.chaves))];
    const vids = todas.filter((k) => k.startsWith("u:")).map((k) => k.slice(2));
    const emails = todas.filter((k) => k.startsWith("e:")).map((k) => `%${k.slice(2)}%`);
    const fones = todas.filter((k) => k.startsWith("t:")).flatMap((k) => [k.slice(2), `55${k.slice(2)}`]);
    const nomes = todas.filter((k) => k.startsWith("n:")).map((k) => k.slice(2));
    const [falasAntes, comprasAntes] = await Promise.all([
      vids.length ? sql<{ vid: string; conteudo: string }[]>`SELECT DISTINCT m.visitante_id AS vid, m.conteudo FROM mensagem m JOIN agente a ON a.id = m.agente_id
        WHERE a.empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid}) AND m.papel = 'user' AND m.visitante_id = ANY(${sql.array(vids)}::text[])
          AND m.criado_em < (${j.desde}::timestamp AT TIME ZONE ${TZ}) AND m.conteudo ~ '@|[0-9]{4}'` : nada<{ vid: string; conteudo: string }>(),
      tem ? sql<Comprador[]>`SELECT DISTINCT cliente_usuario_id, cliente_contato, cliente_nome FROM pedido
        WHERE usuario_id = ${uid} AND status IN ('pago', 'entregue') AND pago_em < (${j.desde}::timestamp AT TIME ZONE ${TZ})
          AND (cliente_usuario_id = ANY(${sql.array(vids)}::text[]) OR lower(cliente_contato) LIKE ANY(${sql.array(emails)}::text[])
            OR regexp_replace(cliente_contato, '[^0-9]', '', 'g') = ANY(${sql.array(fones)}::text[])
            OR (cliente_usuario_id IS NULL AND lower(btrim(cliente_nome)) = ANY(${sql.array(nomes)}::text[])))` : nada<Comprador>(),
    ]);
    for (const m of falasAntes) { const k = chavesDoContato(m.conteudo); if (k.length) [`u:${m.vid}`, ...k].forEach((x) => conhecidas.add(x)); }
    for (const c of comprasAntes) chavesDoComprador(c).forEach((x) => conhecidas.add(x));
  }

  return {
    temPedidos: (f?.pedidos ?? 0) > 0 || conf.pedidos > 0,
    pixLigado: pix.length > 0,
    confirmadas: conf,
    aguardando: { centavos: Math.round(Number(f?.aguardandoCentavos ?? 0)), pedidos: f?.aguardando ?? 0 },
    ticketCentavos: conf.pedidos ? Math.round(conf.centavos / conf.pedidos) : null,
    serie,
    funil: { pedidos: f?.pedidos ?? 0, pagos: f?.pagos ?? 0 },
    clientesNovos: contarNovos(grupos, conhecidas),
    iaBrl: Number(ia[0]?.g ?? 0),
  };
}

// cartão pequeno do painel /app: vendas confirmadas do mês e pedidos esperando o Pix
export async function vendasDoMes(uid: string): Promise<{ centavos: number; pedidos: number; aguardando: number } | null> {
  await migrar();
  if (!(await existeTabela("pedido"))) return null;
  const desde = janelaDe("mes").desde;
  const [[v], [a]] = await Promise.all([
    sql<{ pedidos: number; centavos: number }[]>`SELECT count(*)::int AS pedidos, COALESCE(sum(total_centavos), 0)::float8 AS centavos FROM pedido
      WHERE usuario_id = ${uid} AND status IN ('pago', 'entregue') AND pago_em >= (${desde}::timestamp AT TIME ZONE ${TZ})`,
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pedido WHERE usuario_id = ${uid} AND status = 'aguardando' AND criado_em >= (${desde}::timestamp AT TIME ZONE ${TZ})`,
  ]);
  return { centavos: Math.round(Number(v?.centavos ?? 0)), pedidos: v?.pedidos ?? 0, aguardando: a?.n ?? 0 };
}
