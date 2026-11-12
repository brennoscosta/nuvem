// Um produto da vitrine do dono: PATCH { ativo } mostra ou esconde; DELETE apaga.
import { usuarioAtual } from "@/server/usuarios";
import { mostrarProduto, apagarProduto } from "@/server/vitrine";
import { statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const { id } = await params; const d = await corpo<{ ativo?: unknown }>(req); return ok(await mostrarProduto(u, id, d.ativo !== false)); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const { id } = await params; return ok(await apagarProduto(u, id)); }
  catch (e) { return erro(e, statusDe(e)); }
}
