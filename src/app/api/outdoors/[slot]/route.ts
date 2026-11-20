// Uma vaga de outdoor: POST { frase } → reserva e devolve o Pix (30 dias); PUT { frase } → troca a frase do anúncio no ar;
// DELETE (admin) → tira a frase de um anúncio.
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { alugarOutdoor, mudarFraseOutdoor, limparFraseOutdoorAdmin } from "@/server/outdoors";
import { pagamentoLigado, opcoesDoCorpo } from "@/server/mercadopago";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slot: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { slot } = await params; const b = await corpo<{ frase?: string; creditos?: boolean; idem?: string }>(req);
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const url = new URL(req.url); const base = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? url.host}`;
    return ok(await alugarOutdoor(u, slot, b.frase ?? "", base, opcoesDoCorpo(b)));
  } catch (e) { return erro(e, 400); }
}
export async function PUT(req: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const { slot } = await params; const { frase } = await corpo<{ frase?: string }>(req); await mudarFraseOutdoor(u, slot, frase ?? ""); return ok({ ok: true }); }
  catch (e) { return erro(e, 400); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u || !ehAdmin(u)) return erro("Só o admin.", 403); const { slot } = await params; await limparFraseOutdoorAdmin(slot); return ok({ ok: true }); }
  catch (e) { return erro(e); }
}
