// Outdoors do mapa (12/11/2026): GET → as 6 vagas com o anúncio de cada uma (público).
import { usuarioAtual } from "@/server/usuarios";
import { listarOutdoors } from "@/server/outdoors";
import { PRECO_OUTDOOR, DIAS_OUTDOOR } from "@/office/data/outdoors";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual().catch(() => null); return ok({ vagas: await listarOutdoors(u?.id ?? null), preco: PRECO_OUTDOOR, dias: DIAS_OUTDOOR }); }
  catch (e) { return erro(e); }
}
