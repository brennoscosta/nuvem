// Conexões com serviços externos (contas do dono): guarda e renova tokens no nosso banco. Usado por youtube.ts, instagram.ts e tiktok.ts.
import { sql, id, migrar } from "./db";
import { EMPRESA_PADRAO } from "./agentes";

export type Provedor = "youtube" | "instagram" | "tiktok";
export const PROVEDORES: Provedor[] = ["youtube", "instagram", "tiktok"];
export interface Conexao { id: string; provedor: Provedor; contaNome: string; contaId: string; accessToken: string; refreshToken: string; expiraEm: Date | null; escopo: string; criadoEm: Date }

// atrás do proxy do CapRover o host público vem nos headers
export function base(req: Request) {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
export function urlCallback(req: Request, provedor: Provedor) { return `${base(req)}/api/conexoes/${provedor}/callback`; }

export async function salvarConexao(c: { provedor: Provedor; contaNome: string; contaId: string; accessToken: string; refreshToken?: string; expiraEm: Date | null; escopo?: string }) {
  await migrar();
  await sql`INSERT INTO conexao (id, empresa_id, provedor, conta_nome, conta_id, access_token, refresh_token, expira_em, escopo)
    VALUES (${id("cx")}, ${EMPRESA_PADRAO.id}, ${c.provedor}, ${c.contaNome}, ${c.contaId}, ${c.accessToken}, ${c.refreshToken ?? ""}, ${c.expiraEm}, ${c.escopo ?? ""})
    ON CONFLICT (empresa_id, provedor) DO UPDATE SET conta_nome = EXCLUDED.conta_nome, conta_id = EXCLUDED.conta_id, access_token = EXCLUDED.access_token,
      refresh_token = CASE WHEN EXCLUDED.refresh_token = '' THEN conexao.refresh_token ELSE EXCLUDED.refresh_token END, expira_em = EXCLUDED.expira_em, escopo = EXCLUDED.escopo, atualizado_em = now()`;
}
export async function atualizarTokens(cid: string, t: { accessToken: string; refreshToken?: string; expiraEm: Date | null }) {
  await sql`UPDATE conexao SET access_token = ${t.accessToken}, refresh_token = ${t.refreshToken ?? sql`refresh_token`}, expira_em = ${t.expiraEm}, atualizado_em = now() WHERE id = ${cid}`;
}
export async function obterConexao(provedor: Provedor): Promise<Conexao | null> {
  await migrar();
  const [c] = await sql<Conexao[]>`SELECT id, provedor, conta_nome, conta_id, access_token, refresh_token, expira_em, escopo, criado_em FROM conexao WHERE empresa_id = ${EMPRESA_PADRAO.id} AND provedor = ${provedor}`;
  return c ?? null;
}
export async function listarConexoes() {
  await migrar();
  return sql<{ provedor: Provedor; contaNome: string; contaId: string; criadoEm: Date }[]>`SELECT provedor, conta_nome, conta_id, criado_em FROM conexao WHERE empresa_id = ${EMPRESA_PADRAO.id}`;
}
export async function desconectar(provedor: Provedor) {
  await sql`DELETE FROM conexao WHERE empresa_id = ${EMPRESA_PADRAO.id} AND provedor = ${provedor}`;
}

export function resumoErro(t: string) {
  try { const j = JSON.parse(t); return j.error?.message ?? j.error?.error_user_msg ?? j.error?.errors?.[0]?.reason ?? j.error_description ?? j.error?.code ?? t.slice(0, 200); } catch { return t.slice(0, 200); }
}
export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
