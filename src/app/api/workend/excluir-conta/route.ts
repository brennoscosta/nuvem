// Excluir minha conta (21/11/2026, LGPD art. 18). GET: o que a pessoa perde e como confirma. POST: exclui (senha, ou
// "EXCLUIR" para a conta só do Google), encerra a sessão e manda para a página inicial. Regras em src/server/exclusao.ts.
import { usuarioAtual, fecharSessao } from "@/server/usuarios";
import { resumoExclusao, excluirConta, ErroExclusao } from "@/server/exclusao";
import { ok, erro, corpo } from "@/server/http";
import { bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta para continuar.", 401);
    return ok(await resumoExclusao(u));
  } catch (e) { return erro(e); }
}

export async function POST(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta para continuar.", 401);
    // senha errada conta como tentativa (5 a cada 15 minutos por conta), como no entrar
    const chave = `excluir:${u.id}`, espera = bloqueio(chave, 5);
    if (espera) return demais(espera);
    const b = await corpo<{ senha?: unknown; palavra?: unknown }>(req);
    try {
      await excluirConta(u, { senha: b.senha, palavra: b.palavra });
    } catch (e) {
      if (e instanceof ErroExclusao) { if (e.status === 403) contar(chave, 15); return erro(e, e.status); }
      throw e;
    }
    await fecharSessao();
    return ok({ excluida: true, destino: "/?conta=excluida" });
  } catch (e) { return erro(e); }
}
