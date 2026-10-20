// "Me avise quando der pra comprar um escritório": marca o interesse do usuário logado.
import { usuarioAtual, marcarInteresse } from "@/server/usuarios";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST() {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401); await marcarInteresse(u.id); return ok({ ok: true }); } catch (e) { return erro(e); }
}
