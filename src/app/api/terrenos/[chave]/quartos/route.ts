// Lote em quartos (21/11/2026, data/quartosLote.ts): POST { quartos } grava o que cada quarto do lote tem (quiosques e o
// prédio médio; null volta ao prédio grande) depois de conferir tudo no servidor (src/server/quartos.ts). Sem cobrança.
import { salvarQuartos, ErroQuartos } from "@/server/quartos";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { chave } = await params;
    return ok(await salvarQuartos(u, decodeURIComponent(chave), await corpo(req)));
  } catch (e) { return erro(e, e instanceof ErroQuartos ? e.status : 400); }
}
