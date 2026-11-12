// Promoção na fachada (12/11/2026): POST { texto, duracao } liga; DELETE encerra. Só o dono do lote (ou o admin).
import { salvarPromocao, encerrarPromocao } from "@/server/terrenos";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { chave } = await params;
    return ok(await salvarPromocao(u, decodeURIComponent(chave), await corpo(req)));
  } catch (e) { return erro(e, 400); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { chave } = await params; await encerrarPromocao(u, decodeURIComponent(chave));
    return ok({ ok: true });
  } catch (e) { return erro(e, 400); }
}
