// Chave Pix do dono para receber os pedidos (17/11/2026). POST { tipo, chave, nome, cidade } salva; DELETE apaga.
// O dinheiro vai direto do cliente para essa chave: o WorkEnd não recebe nada.
import { usuarioAtual } from "@/server/usuarios";
import { salvarRecebimento, apagarRecebimento, statusPedido } from "@/server/pedidos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    return ok(await salvarRecebimento(u, await corpo(req)));
  } catch (e) { return erro(e, statusPedido(e)); }
}
export async function DELETE() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    return ok(await apagarRecebimento(u));
  } catch (e) { return erro(e, statusPedido(e)); }
}
