// Quem conversou com a equipe da loja: GET ?lote= → lista; GET ?lote=&visitante= → a conversa inteira.
import { usuarioAtual } from "@/server/usuarios";
import { conversaDeVisitante, conversasDeVisitantes, statusDe } from "@/server/equipeCliente";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = new URL(req.url).searchParams;
    const v = p.get("visitante");
    return ok(v ? await conversaDeVisitante(u, p.get("lote"), v) : await conversasDeVisitantes(u, p.get("lote")));
  } catch (e) { return erro(e, statusDe(e)); }
}
