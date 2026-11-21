// Pedidos dos moradores (20/11/2026, frente "visitante"). GET ?morador= → o pedido de hoje na ficha (oferta, aceito, feito)
// ou o obrigado de um pedido cumprido; POST { morador, aceitar } → aceita ou recusa. Até 2 pedidos por dia por pessoa.
import { usuarioAtual } from "@/server/usuarios";
import { pedidoNaFicha, responderPedido, ErroPassaporte } from "@/server/passaporte";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
const st = (e: unknown) => (e instanceof ErroPassaporte ? e.status : 500);
const idMorador = (v: unknown) => (typeof v === "string" && /^[a-z0-9_-]{1,30}$/.test(v) ? v : "");
export async function GET(req: Request) {
  try { const u = await usuarioAtual(); if (!u || u.banidoEm) return ok({ estado: "sem-conta" }); return ok(await pedidoNaFicha(u, idMorador(new URL(req.url).searchParams.get("morador")))); }
  catch (e) { return erro(e, st(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<{ morador?: unknown; aceitar?: unknown }>(req);
    return ok(await responderPedido(u, idMorador(d.morador), d.aceitar !== false));
  } catch (e) { return erro(e, st(e)); }
}
