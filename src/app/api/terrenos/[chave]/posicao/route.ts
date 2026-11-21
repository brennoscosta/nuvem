// Posição do prédio no terreno (21/11/2026, modo "Editar posição"): POST { giro: 0..3, desloc: [dx, dz] } grava o giro e o
// deslocamento depois de conferir tudo no servidor (src/server/posicao.ts). Lote e quiosque: o dono ou sócio; sede: admin.
import { salvarPosicao, ErroPosicao } from "@/server/posicao";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { chave } = await params;
    return ok(await salvarPosicao(u, decodeURIComponent(chave), await corpo(req)));
  } catch (e) { return erro(e, e instanceof ErroPosicao ? e.status : 400); }
}
