import { sql, id } from "@/server/db";
import { garantirEmpresa, gravarEvento } from "@/server/agentes";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const emp = await garantirEmpresa(); return ok(await sql`SELECT * FROM reuniao WHERE empresa_id = ${emp} ORDER BY criado_em DESC LIMIT 50`); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const emp = await garantirEmpresa();
    const b = await corpo<{ convocadorId: string; participantes: string[]; setores: string[]; pauta?: string }>(req);
    if (!b.convocadorId) return erro("convocadorId obrigatório", 400);
    const [r] = await sql`INSERT INTO reuniao (id, empresa_id, convocador_id, participantes, setores, pauta) VALUES (${id("reu")}, ${emp}, ${b.convocadorId}, ${sql.json(b.participantes ?? [])}, ${sql.json(b.setores ?? [])}, ${b.pauta ?? ""}) RETURNING *`;
    await gravarEvento(emp, b.convocadorId, "reuniao", `Convocou reunião (${(b.setores ?? []).join(", ")})`, { reuniaoId: r.id });
    return ok(r, 201);
  } catch (e) { return erro(e); }
}
export async function PATCH(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const b = await corpo<{ id: string; ata?: string; status?: string }>(req);
    const [r] = await sql`UPDATE reuniao SET ata = COALESCE(${b.ata ?? null}, ata), status = COALESCE(${b.status ?? null}, status), encerrado_em = CASE WHEN ${b.status ?? ""} = 'encerrada' THEN now() ELSE encerrado_em END WHERE id = ${b.id} RETURNING *`;
    return ok(r);
  } catch (e) { return erro(e); }
}
