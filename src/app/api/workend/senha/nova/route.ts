// Grava a nova senha a partir do link e já abre a sessão.
import { trocarSenhaPorLink, abrirSessao } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const chave = `senha-nova:ip:${ipDe(req)}`;
    const espera = bloqueio(chave, 10);
    if (espera) return demais(espera);
    contar(chave, 15);
    const { token, senha } = await corpo<{ token: string; senha: string }>(req);
    const uid = await trocarSenhaPorLink(token ?? "", senha ?? "");
    await abrirSessao(uid);
    return ok({ trocada: true });
  } catch (x) { return erro(x, 400); }
}
