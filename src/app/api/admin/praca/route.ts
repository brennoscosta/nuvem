// Admin: fila de aprovação dos anúncios da praça. GET → fila; POST { id, acao: "aprovar" | "recusar", motivo }.
import { exigirAdmin, statusDe } from "../_guarda";
import { filaAdmin, decidirAnuncio } from "@/server/praca";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await exigirAdmin(); return ok({ fila: await filaAdmin() }); } catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request) {
  try { const u = await exigirAdmin(); const { id, acao, motivo } = await corpo<{ id?: string; acao?: string; motivo?: string }>(req); return ok(await decidirAnuncio(u, String(id ?? ""), acao, motivo)); }
  catch (e) { const s = statusDe(e); return erro(e, s === 500 ? 400 : s); }
}
