// Saldo de créditos para o topo do mapa e do painel e para o botão "Pagar com créditos" (leve, sem extrato)
import { usuarioAtual } from "@/server/usuarios";
import { saldoDe } from "@/server/creditos";
import { liberarReservasVencidas } from "@/server/mercadopago";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return ok({ logado: false, saldo: null });
    // Pix com créditos reservados que venceu sem pagar: os créditos voltam antes de mostrar o saldo
    await liberarReservasVencidas(u.id).catch((e) => console.error("[creditos] reservas:", (e as Error).message));
    return ok({ logado: true, saldo: await saldoDe(u.id) });
  }
  catch (e) { return erro(e); }
}
