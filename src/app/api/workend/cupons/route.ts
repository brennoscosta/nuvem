// Cupons (13/11/2026). GET: os cupons da minha loja (com pegos e usados) e os cupons que eu peguei. POST: cria um cupom.
import { criarCupom, ErroCupom } from "@/server/cupons";
import { dadosCupons } from "@/server/telasIniciais";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
const st = (e: unknown) => (e instanceof ErroCupom ? e.status : 500);
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    return ok(await dadosCupons(u)); // WE-16: a mesma conta da página /app/cupons (server/telasIniciais.ts)
  } catch (e) { return erro(e, st(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    return ok(await criarCupom(u, await corpo(req)), 201);
  } catch (e) { return erro(e, st(e)); }
}
