// Vendas do dono (17/11/2026): GET → chave Pix cadastrada, contagem por status, somas e os pedidos (filtro ?status=).
import { usuarioAtual } from "@/server/usuarios";
import { vendasDoDono, statusPedido } from "@/server/pedidos";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    return ok(await vendasDoDono(u, new URL(req.url).searchParams.get("status")));
  } catch (e) { return erro(e, statusPedido(e)); }
}
