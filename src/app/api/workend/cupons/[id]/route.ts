// Um cupom (13/11/2026). POST: o visitante pega o cupom e recebe o código dele. DELETE: o dono encerra o cupom.
import { pegarCupom, encerrarCupom, ErroCupom } from "@/server/cupons";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const st = (e: unknown) => (e instanceof ErroCupom ? e.status : 500);
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta para pegar o cupom.", 401);
    const k = `cupom:${u.id}:${ipDe(req)}`; const espera = bloqueio(k, 30); if (espera) return demais(espera); contar(k, 60);
    const { id } = await params;
    return ok(await pegarCupom(u, decodeURIComponent(id)));
  } catch (e) { return erro(e, st(e)); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { id } = await params; await encerrarCupom(u, decodeURIComponent(id));
    return ok({ ok: true });
  } catch (e) { return erro(e, st(e)); }
}
