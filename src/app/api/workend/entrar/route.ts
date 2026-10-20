// Login de usuário do WorkEnd.
import { autenticar, abrirSessao } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const d = await corpo<{ email: string; senha: string }>(req);
    const u = await autenticar(d.email ?? "", d.senha ?? "");
    if (!u) return erro("E-mail ou senha não conferem.", 401);
    await abrirSessao(u.id);
    return ok(u);
  } catch (e) { return erro(e); }
}
