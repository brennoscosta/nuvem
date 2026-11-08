// Atividade do mundo: cada coisa que acontece vira um evento (admin vê tudo; o dono da loja recebe por e-mail o
// que é da loja dele). Nunca lança: registrar não pode derrubar o fluxo principal.
import { sql, id, migrar } from "./db";
import { enviarEmail } from "./email";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

export type TipoEvento = "cadastro" | "reserva" | "pagamento" | "escritorio" | "contratacao" | "layout" | "contato" | "admin";
export interface Evento { id: string; tipo: TipoEvento; usuarioId: string | null; terrenoChave: string | null; titulo: string; dados: Record<string, unknown> | null; criadoEm: Date }
export interface EventoAdmin extends Evento { email: string | null; empresaNome: string | null }

export async function registrar(tipo: TipoEvento, titulo: string, o: { usuarioId?: string | null; terrenoChave?: string | null; dados?: Record<string, unknown>; avisarDono?: boolean } = {}) {
  try {
    await migrar();
    const eid = id("evt");
    await sql`INSERT INTO atividade (id, tipo, usuario_id, terreno_chave, titulo, dados) VALUES (${eid}, ${tipo}, ${o.usuarioId ?? null}, ${o.terrenoChave ?? null}, ${titulo.slice(0, 200)}, ${o.dados ? sql.json(o.dados as Parameters<typeof sql.json>[0]) : null})`;
    // avisa o dono da loja por e-mail (atividade na loja dele)
    if (o.avisarDono && o.terrenoChave) {
      const [d] = await sql<{ email: string; nome: string; empresaNome: string }[]>`SELECT u.email, u.nome, t.empresa_nome FROM terreno t JOIN usuario u ON u.id = t.usuario_id WHERE t.chave = ${o.terrenoChave}`;
      if (d) void enviarEmail("atividade", d.email, { nome: d.nome, empresa: d.empresaNome, lote: `Lote ${LOTE_POR_CHAVE[o.terrenoChave]?.numero ?? "?"}`, titulo, detalhes: typeof o.dados?.detalhes === "string" ? o.dados.detalhes : "", link_mapa: `https://workend.online/mundo?lote=${encodeURIComponent(o.terrenoChave)}`, link_painel: "https://workend.online/app" });
    }
  } catch (e) { console.error("[evento]", tipo, (e as Error).message); }
}
export async function listarEventosAdmin(n = 300, tipo?: string): Promise<EventoAdmin[]> {
  await migrar();
  return tipo
    ? sql<EventoAdmin[]>`SELECT e.id, e.tipo, e.usuario_id, e.terreno_chave, e.titulo, e.dados, e.criado_em, u.email, t.empresa_nome FROM atividade e LEFT JOIN usuario u ON u.id = e.usuario_id LEFT JOIN terreno t ON t.chave = e.terreno_chave WHERE e.tipo = ${tipo} ORDER BY e.criado_em DESC LIMIT ${n}`
    : sql<EventoAdmin[]>`SELECT e.id, e.tipo, e.usuario_id, e.terreno_chave, e.titulo, e.dados, e.criado_em, u.email, t.empresa_nome FROM atividade e LEFT JOIN usuario u ON u.id = e.usuario_id LEFT JOIN terreno t ON t.chave = e.terreno_chave ORDER BY e.criado_em DESC LIMIT ${n}`;
}
export async function eventosDoUsuario(usuarioId: string, n = 50): Promise<Evento[]> {
  await migrar();
  return sql<Evento[]>`SELECT id, tipo, usuario_id, terreno_chave, titulo, dados, criado_em FROM atividade WHERE usuario_id = ${usuarioId} OR terreno_chave IN (SELECT chave FROM terreno WHERE usuario_id = ${usuarioId}) ORDER BY criado_em DESC LIMIT ${n}`;
}
