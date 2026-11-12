// Central de avisos (sino, 12/11/2026): candidatura recebida, evento da praça daqui a 10 minutos, mensagem nova,
// conversa na loja, pagamento confirmado, indicação paga, agendamento. Cada aviso tem um `ref`: o mesmo ref não
// duplica; com `renovar`, um aviso que já existe volta a ficar não lido e sobe para o topo (uma conversa = um aviso).
// avisar() nunca lança: aviso não pode derrubar o fluxo principal.
import { sql, id, migrar } from "./db";

export type TipoAviso = "candidatura" | "evento" | "mensagem" | "loja" | "pagamento" | "indicacao" | "agendamento" | "amizade" | "negociacao" | "sistema";
export interface Aviso { id: string; tipo: TipoAviso; titulo: string; texto: string; link: string; lidoEm: Date | null; criadoEm: Date }

const limpa = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/\s+/g, " ").trim().slice(0, max);
// só links internos (começando com "/"): o aviso nunca manda ninguém para fora do WorkEnd
const linkInterno = (l: unknown) => { const s = limpa(l, 300); return s.startsWith("/") && !s.startsWith("//") ? s : ""; };

export async function avisar(usuarioId: string | null | undefined, a: { tipo: TipoAviso; titulo: string; texto?: string; link?: string; ref?: string; renovar?: boolean }) {
  if (!usuarioId) return;
  try {
    await migrar();
    const aid = id("av"), ref = limpa(a.ref, 200) || aid;
    const titulo = limpa(a.titulo, 140), texto = limpa(a.texto, 300), link = linkInterno(a.link);
    if (a.renovar) await sql`INSERT INTO aviso (id, usuario_id, tipo, titulo, texto, link, ref) VALUES (${aid}, ${usuarioId}, ${a.tipo}, ${titulo}, ${texto}, ${link}, ${ref})
      ON CONFLICT (usuario_id, ref) DO UPDATE SET titulo = EXCLUDED.titulo, texto = EXCLUDED.texto, link = EXCLUDED.link, lido_em = NULL, criado_em = now()`;
    else await sql`INSERT INTO aviso (id, usuario_id, tipo, titulo, texto, link, ref) VALUES (${aid}, ${usuarioId}, ${a.tipo}, ${titulo}, ${texto}, ${link}, ${ref}) ON CONFLICT (usuario_id, ref) DO NOTHING`;
  } catch (e) { console.error("[aviso]", a.tipo, (e as Error).message); }
}

// Avisos que dependem da hora (não têm um momento de "acontecer" no servidor): gerados quando a pessoa abre o sino.
// Evento da praça começando em até 10 minutos: avisa o dono do evento e quem tocou em "Me avise".
async function gerarAvisosDaHora(usuarioId: string) {
  const eventos = await sql<{ id: string; titulo: string; inicio: Date }[]>`
    SELECT e.id, e.titulo, e.inicio FROM evento_praca e
    WHERE NOT e.cancelado AND e.inicio > now() - interval '5 minutes' AND e.inicio <= now() + interval '10 minutes'
      AND (e.usuario_id = ${usuarioId} OR EXISTS (SELECT 1 FROM evento_lembrete l WHERE l.evento_id = e.id AND l.usuario_id = ${usuarioId}))`;
  for (const e of eventos) {
    const min = Math.max(0, Math.round((new Date(e.inicio).getTime() - Date.now()) / 60000));
    await avisar(usuarioId, { tipo: "evento", ref: `evento:${e.id}`, titulo: min > 0 ? `“${e.titulo}” começa em ${min} min na praça` : `“${e.titulo}” está começando na praça`, texto: "Toque para ir até o palco.", link: "/mundo?praca=1" });
  }
  // lembretes da agenda da loja (src/server/agenda.ts), quando existir
  const agenda = await import("./agenda").catch(() => null) as { lembretesDaAgenda?: (u: string) => Promise<void> } | null;
  if (agenda?.lembretesDaAgenda) await agenda.lembretesDaAgenda(usuarioId).catch((e: Error) => console.error("[aviso] agenda", e.message));
}

export async function listarAvisos(usuarioId: string, n = 30) {
  await migrar();
  await gerarAvisosDaHora(usuarioId).catch((e) => console.error("[aviso] hora", (e as Error).message));
  const avisos = await sql<Aviso[]>`SELECT id, tipo, titulo, texto, link, lido_em, criado_em FROM aviso WHERE usuario_id = ${usuarioId} ORDER BY criado_em DESC LIMIT ${Math.min(60, n)}`;
  const [{ n: naoLidos }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM aviso WHERE usuario_id = ${usuarioId} AND lido_em IS NULL`;
  return { avisos, naoLidos };
}
// sem ids: marca todos
export async function marcarLidos(usuarioId: string, ids?: string[] | null) {
  await migrar();
  if (ids?.length) await sql`UPDATE aviso SET lido_em = now() WHERE usuario_id = ${usuarioId} AND lido_em IS NULL AND id = ANY(${sql.array(ids.slice(0, 100).map(String))})`;
  else await sql`UPDATE aviso SET lido_em = now() WHERE usuario_id = ${usuarioId} AND lido_em IS NULL`;
}
// guarda só os últimos 90 dias (chamado de vez em quando ao listar)
export async function limparAvisosVelhos() { await sql`DELETE FROM aviso WHERE criado_em < now() - interval '90 days'`.catch(() => {}); }

// "Me avise" de um evento da praça
export async function alternarLembrete(usuarioId: string, eventoId: string) {
  await migrar();
  const r = await sql`DELETE FROM evento_lembrete WHERE evento_id = ${eventoId} AND usuario_id = ${usuarioId}`;
  if (r.count) return { lembrete: false };
  const [e] = await sql`SELECT 1 FROM evento_praca WHERE id = ${eventoId} AND NOT cancelado AND fim > now()`;
  if (!e) throw new Error("Esse evento já acabou ou foi cancelado.");
  await sql`INSERT INTO evento_lembrete (evento_id, usuario_id) VALUES (${eventoId}, ${usuarioId}) ON CONFLICT DO NOTHING`;
  return { lembrete: true };
}
export async function meusLembretes(usuarioId: string): Promise<string[]> {
  await migrar();
  const r = await sql<{ eventoId: string }[]>`SELECT l.evento_id FROM evento_lembrete l JOIN evento_praca e ON e.id = l.evento_id WHERE l.usuario_id = ${usuarioId} AND e.fim > now()`;
  return r.map((x) => x.eventoId);
}

// Recado entre personagens (conversa, pedido de amizade, negociação): vira aviso para quem recebe. Uma conversa ou uma
// negociação = um aviso só, que volta para o topo a cada novidade.
const STATUS_NEG: Record<string, string> = { aceita: "foi aceita", recusada: "foi recusada", cancelada: "foi cancelada", entregue: "foi marcada como entregue", concluida: "foi concluída" };
export async function avisarRecado(deId: string, paraId: string, tipo: string, texto: string) {
  try {
    const [p] = await sql<{ nome: string }[]>`SELECT COALESCE((SELECT nome FROM personagem WHERE usuario_id = ${deId}), (SELECT split_part(nome, ' ', 1) FROM usuario WHERE id = ${deId}), 'Alguém') AS nome`;
    const nome = p?.nome ?? "Alguém";
    let neg: { negociacaoId?: string; titulo?: string; status?: string } = {};
    if (tipo === "negocio" || tipo === "negocio_status") { try { neg = JSON.parse(texto); } catch { /* texto livre */ } }
    if (tipo === "chat") await avisar(paraId, { tipo: "mensagem", ref: `dm:${deId}`, renovar: true, titulo: `Mensagem de ${nome}`, texto, link: "/mundo?caixa=1" });
    else if (tipo === "amizade_pedido") await avisar(paraId, { tipo: "amizade", ref: `amz:${deId}`, renovar: true, titulo: `${nome} quer ser seu amigo`, texto: "Aceite ou recuse em Minha rede.", link: "/app/rede" });
    else if (tipo === "amizade_aceite") await avisar(paraId, { tipo: "amizade", ref: `amz:${deId}`, renovar: true, titulo: `${nome} aceitou a sua amizade`, link: "/app/rede" });
    else if (tipo === "negocio") await avisar(paraId, { tipo: "negociacao", ref: `neg:${neg.negociacaoId ?? deId}`, renovar: true, titulo: `${nome} propôs um negócio`, texto: neg.titulo ?? "", link: "/app/rede" });
    else if (tipo === "negocio_status") await avisar(paraId, { tipo: "negociacao", ref: `neg:${neg.negociacaoId ?? deId}`, renovar: true, titulo: `Negociação ${STATUS_NEG[neg.status ?? ""] ?? "atualizada"}`, texto: `“${neg.titulo ?? ""}”, com ${nome}.`, link: "/app/rede" });
  } catch (e) { console.error("[aviso] recado", (e as Error).message); }
}
