// Cupons (13/11/2026). GET: os cupons da minha loja (com pegos e usados) e os cupons que eu peguei. POST: cria um cupom.
import { cuponsDoDono, meusCupons, criarCupom, ErroCupom } from "@/server/cupons";
import { terrenoDoUsuario } from "@/server/terrenos";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
const st = (e: unknown) => (e instanceof ErroCupom ? e.status : 500);
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const t = await terrenoDoUsuario(u.id);
    return ok({ temLoja: t?.status === "ativo", daLoja: t?.status === "ativo" ? await cuponsDoDono(u) : [], meus: await meusCupons(u) });
  } catch (e) { return erro(e, st(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    return ok(await criarCupom(u, await corpo(req)), 201);
  } catch (e) { return erro(e, st(e)); }
}
