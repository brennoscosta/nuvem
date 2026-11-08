// Admin: personagens (quem comprou), dar dias
import { listarPersonagensAdmin, ativarPersonagem } from "@/server/personagens";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() { try { await exigirAdmin(); return ok({ personagens: await listarPersonagensAdmin() }); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) {
  try { await exigirAdmin(); const { usuarioId, dias } = await corpo<{ usuarioId: string; dias?: number }>(req); await ativarPersonagem(usuarioId, dias ?? 30); return ok({ feito: "dias" }); }
  catch (e) { return erro(e, statusDe(e)); }
}
