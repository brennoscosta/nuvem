// Cartão de um pedido na conversa da loja (17/11/2026). GET → status atual (o cartão consulta de tempos em tempos);
// POST { acao: "cancelar" } → o cliente cancela o dele enquanto espera pagamento. Só o cliente e o dono veem.
import { usuarioAtual } from "@/server/usuarios";
import { cartaoDoPedido, mudarStatusPedido, statusPedido } from "@/server/pedidos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { id } = await params;
    return ok(await cartaoDoPedido(u, id));
  } catch (e) { return erro(e, statusPedido(e)); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { id } = await params; const d = await corpo<{ acao?: string }>(req);
    if (d.acao !== "cancelar") return erro("Ação inválida.", 400);
    const c = await cartaoDoPedido(u, id);
    if (!c.souCliente) return erro("Na sua loja, use a página Vendas.", 403);
    return ok(await mudarStatusPedido(u, id, "cancelar"));
  } catch (e) { return erro(e, statusPedido(e)); }
}
