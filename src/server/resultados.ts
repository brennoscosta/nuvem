// Painel de resultados do lote (12/11/2026): visitas por dia (cartão no mapa e página da loja), conversas com a
// atendente de IA, candidaturas às vagas, cliques que levam ao WhatsApp/Instagram/site/produto e agendamentos.
// Quem não entrou na conta conta como visitante anônimo: um código que muda todo dia (IP + navegador + dia), sem guardar
// o IP. O próprio dono não conta como visita da loja dele.
import { createHash } from "node:crypto";
import { sql, migrar } from "./db";
import { bloqueio, contar } from "./limite";
import type { Usuario } from "./usuarios";
import { LOTES, LOTE_POR_CHAVE } from "@/office/data/mundo";
import type { Terreno } from "./terrenos";

export const diaBR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // AAAA-MM-DD
export function visitanteDe(h: Headers, usuarioId?: string | null) {
  if (usuarioId) return usuarioId;
  const ua = h.get("user-agent") ?? "", ip = h.get("x-real-ip")?.trim() || "sem-ip"; // o nginx do CapRover grava o IP real
  return "a:" + createHash("sha256").update(`${ip}|${ua}|${diaBR()}|workend-visita`).digest("base64url").slice(0, 18);
}
// robôs de busca e prévias de link não contam
const ehRobo = (h: Headers) => /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless/i.test(h.get("user-agent") ?? "");

// a loja (lote principal) de um número de lote; uma ampliação conta para o lote principal
export async function lojaDoNumero(numero: number): Promise<{ chave: string; donoId: string } | null> {
  const l = LOTES.find((x) => x.numero === numero); if (!l) return null;
  await migrar();
  const [t] = await sql<{ chave: string; usuarioId: string; status: string; anexoDe: string | null }[]>`SELECT chave, usuario_id, status, anexo_de FROM terreno WHERE chave = ${l.chave}`;
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

// ---------- painel ----------
export type Serie = { dia: string; n: number }[];
export interface Resultados {
  dias: number; desde: string; lote: { chave: string; numero: number | null; empresa: string } | null;
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

export async function resultadosDoDono(u: Usuario, terreno: Terreno | null, dias: number): Promise<Resultados> {
  await migrar();
  dias = [7, 30, 90].includes(dias) ? dias : 30;
  const hoje = diaBR();
  const desdeD = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - (dias - 1) * 86400_000);
  const desde = desdeD.toISOString().slice(0, 10);
  const antesDe = new Date(desdeD.getTime() - dias * 86400_000).toISOString().slice(0, 10);
  const TZ = "America/Sao_Paulo";
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
    dias, desde,
    lote: terreno ? { chave: terreno.chave, numero: LOTE_POR_CHAVE[terreno.chave]?.numero ?? null, empresa: terreno.empresaNome } : null,
    visitas: { total: soma(sVis), anterior: visAnt[0]?.n ?? 0, serie: sVis, mapa: visOrigem[0]?.mapa ?? 0, pagina: visOrigem[0]?.pagina ?? 0, logados: visOrigem[0]?.logados ?? 0 },
    conversas: { total: soma(sConv), anterior: convAnt[0]?.n ?? 0, serie: sConv, mensagens: conv.reduce((a, x) => a + x.msgs, 0) },
    candidaturas: { total: soma(sCand), anterior: candAnt[0]?.n ?? 0, serie: sCand, vagasAbertas: vagas[0]?.n ?? 0 },
    cliques: { total: soma(sCliq), anterior: cliqAnt[0]?.n ?? 0, serie: sCliq, porTipo: Object.fromEntries(cliqTipo.map((c) => [c.tipo, c.n])), produtos },
    agendamentos, agendaLigada, produtosNaVitrine, topDias: top,
  };
}
