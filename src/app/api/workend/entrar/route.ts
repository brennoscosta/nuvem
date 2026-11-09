// Login de usuário do WorkEnd, com limite de tentativas erradas por IP e por e-mail.
import { autenticar, abrirSessao } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, zerar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const d = await corpo<{ email: string; senha: string }>(req);
    const chaveIp = `entrar:ip:${ipDe(req)}`, chaveEmail = `entrar:email:${(d.email ?? "").trim().toLowerCase()}`;
    const espera = Math.max(bloqueio(chaveIp, 10), bloqueio(chaveEmail, 8));
    if (espera) return demais(espera);
    const u = await autenticar(d.email ?? "", d.senha ?? "");
    if (!u) { contar(chaveIp, 15); contar(chaveEmail, 15); return erro("E-mail ou senha não conferem.", 401); }
    zerar(chaveEmail);
    await abrirSessao(u.id);
    return ok(u);
  } catch (e) { return erro(e); }
}
