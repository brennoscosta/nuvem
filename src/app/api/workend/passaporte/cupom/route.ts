// Cupom do passaporte (20/11/2026, frente "visitante").
//  - GET (dono): qual cupom ativo da minha loja é o do passaporte.
//  - PUT { cupomId | null } (dono): marca (ou desmarca) o cupom que a recepcionista oferece a quem chega com o passaporte.
//  - POST { loja } (visitante): pega o cupom do passaporte daquela loja (precisa do carimbo dela).
import { usuarioAtual } from "@/server/usuarios";
import { cupomMarcadoDoDono, marcarCupomPassaporte, pegarCupomDoPassaporte, ErroPassaporte } from "@/server/passaporte";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
const st = (e: unknown) => (e instanceof ErroPassaporte ? e.status : 500);
export async function GET() {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401); return ok({ cupomId: await cupomMarcadoDoDono(u) }); }
  catch (e) { return erro(e, st(e)); }
}
export async function PUT(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const d = await corpo<{ cupomId?: unknown }>(req);
    return ok(await marcarCupomPassaporte(u, typeof d.cupomId === "string" && d.cupomId ? d.cupomId.slice(0, 60) : null));
  } catch (e) { return erro(e, st(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para pegar o cupom.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const d = await corpo<{ loja?: unknown }>(req);
    return ok(await pegarCupomDoPassaporte(u, Number(d.loja) | 0));
  } catch (e) { return erro(e, st(e)); }
}
