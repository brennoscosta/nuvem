// "Indique um vizinho": GET = meu link, quem eu indiquei e o crédito; POST { codigo } = quem me indicou (digitado no cartão
// do lote, para quem abriu o link em outro aparelho).
import { usuarioAtual } from "@/server/usuarios";
import { meuCodigo, minhasIndicacoes, registrarIndicacao, codigoValido } from "@/server/ofertas";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const codigo = await meuCodigo(u);
    return ok({ codigo, link: `https://workend.online/?ind=${codigo}`, ...(await minhasIndicacoes(u)) });
  } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const k = `indicacao:${u.id}:${ipDe(req)}`; const espera = bloqueio(k, 8); if (espera) return demais(espera); contar(k, 60);
    const { codigo } = await corpo<{ codigo?: string }>(req);
    if (!codigoValido(codigo)) return erro("Esse código não parece certo. Ele tem letras e números, como K7Q2MX.", 400);
    const empresa = await registrarIndicacao(u.id, codigo);
    if (!empresa) return erro("Esse código não vale para esta conta (código errado, da sua própria conta, ou você já teve lote).", 400);
    return ok({ empresa });
  } catch (e) { return erro(e); }
}
