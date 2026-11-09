// Pedir o link de nova senha. A resposta é sempre a mesma, exista ou não a conta.
import { pedirNovaSenha } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { email } = await corpo<{ email: string }>(req);
    const e = (email ?? "").trim().toLowerCase();
    const espera = Math.max(bloqueio(`senha:ip:${ipDe(req)}`, 5), bloqueio(`senha:email:${e}`, 3));
    if (espera) return demais(espera);
    contar(`senha:ip:${ipDe(req)}`, 15); contar(`senha:email:${e}`, 60);
    if (e) await pedirNovaSenha(e);
    return ok({ pedido: true });
  } catch (x) { return erro(x); }
}
