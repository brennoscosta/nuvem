// DELETE → cancela um anúncio da praça que ainda não foi pago (libera a vaga).
import { usuarioAtual } from "@/server/usuarios";
import { cancelarAnuncio } from "@/server/praca";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function DELETE(_: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const { id } = await params; await cancelarAnuncio(u, id); return ok({ ok: true }); }
  catch (e) { return erro(e, 400); }
}
