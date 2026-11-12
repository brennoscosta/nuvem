// Praça de eventos (12/11/2026): GET → agenda e feira do próximo sábado; POST { titulo, descricao, link, inicio, duracao } → marca
// um evento (empresas com lote ativo); DELETE ?evento= → cancela.
import { usuarioAtual } from "@/server/usuarios";
import { agendaPraca, feira, marcarEvento, cancelarEvento } from "@/server/cidade";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual().catch(() => null); const [agenda, f] = await Promise.all([agendaPraca(u?.id ?? null), feira(u?.id ?? null)]); return ok({ agenda, feira: f, agora: new Date().toISOString() }); }
  catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await marcarEvento(u, await corpo(req))); } catch (e) { return erro(e, 400); }
}
export async function DELETE(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); await cancelarEvento(u, new URL(req.url).searchParams.get("evento") ?? ""); return ok({ ok: true }); } catch (e) { return erro(e, 400); }
}
