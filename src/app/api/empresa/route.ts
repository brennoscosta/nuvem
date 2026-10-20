import { sql } from "@/server/db";
import { garantirEmpresa } from "@/server/agentes";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const id = await garantirEmpresa(); const [e] = await sql`SELECT id, slug, nome, sobre FROM empresa WHERE id = ${id}`; return ok(e); } catch (e) { return erro(e); }
}
export async function PATCH(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const id = await garantirEmpresa(); const b = await corpo<{ nome?: string; sobre?: string }>(req);
    const [e] = await sql`UPDATE empresa SET nome = COALESCE(${b.nome ?? null}, nome), sobre = COALESCE(${b.sobre ?? null}, sobre) WHERE id = ${id} RETURNING id, slug, nome, sobre`; return ok(e); } catch (e) { return erro(e); }
}
