// Ações do dono num pedido (17/11/2026): PATCH { acao: "pago" | "entregue" | "cancelar" }. Quem confirma o pagamento é
// sempre o dono: o WorkEnd não vê o dinheiro.
import { usuarioAtual } from "@/server/usuarios";
import { mudarStatusPedido, statusPedido } from "@/server/pedidos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { id } = await params; const d = await corpo<{ acao?: string }>(req);
    return ok(await mudarStatusPedido(u, id, d.acao));
  } catch (e) { return erro(e, statusPedido(e)); }
}
