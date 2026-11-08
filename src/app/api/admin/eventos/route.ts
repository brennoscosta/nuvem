// Admin: atividade do mundo (tudo que aconteceu), com filtro por tipo
import { listarEventosAdmin } from "@/server/eventos";
import { ok, erro } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { await exigirAdmin(); const tipo = new URL(req.url).searchParams.get("tipo") || undefined; return ok({ eventos: await listarEventosAdmin(300, tipo) }); }
  catch (e) { return erro(e, statusDe(e)); }
}
