// O dono confere o código do cupom na hora da compra (13/11/2026): POST { codigo } → marca como usado.
import { validarCupom, ErroCupom } from "@/server/cupons";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    // sem chute de código: 40 conferências por 10 minutos
    const k = `cupom-validar:${u.id}`; const espera = bloqueio(k, 40); if (espera) return demais(espera); contar(k, 10);
    const { codigo } = await corpo<{ codigo?: string }>(req);
    return ok(await validarCupom(u, codigo));
  } catch (e) { return erro(e, e instanceof ErroCupom ? e.status : 500); }
}
