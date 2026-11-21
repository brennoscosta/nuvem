// Guia passo a passo (21/11/2026, frente "tutorial"): GET devolve o progresso da conta e os fatos conferidos no banco;
// POST marca passos vistos, dispensa/reabre/conclui um roteiro ou registra a abertura de uma tela. Sem conta, o
// navegador guarda o progresso sozinho (src/office/guia/guiaStore.ts) e esta rota só responde { logado: false }.
import { usuarioAtual } from "@/server/usuarios";
import { estadoGuia, salvarGuia, type AcaoGuia } from "@/server/guia";
import { ok, erro, corpo } from "@/server/http";
import { bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";

export async function GET() {
  try { const u = await usuarioAtual(); if (!u) return ok({ logado: false }); return ok(await estadoGuia(u)); } catch (e) { return erro(e); }
}

export async function POST(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return ok({ erro: "Entre na sua conta para guardar o guia." }, 401);
    const chave = `guia:${u.id}`, espera = bloqueio(chave, 300);
    if (espera) return demais(espera);
    contar(chave, 10);
    await salvarGuia(u.id, await corpo<AcaoGuia>(req));
    return ok({ ok: true });
  } catch (e) { return erro(e, 400); }
}
