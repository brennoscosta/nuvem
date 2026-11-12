// Lote duplo (12/11/2026): POST → reserva este lote como ampliação do meu lote ativo (vizinho, mesmo quarteirão).
import { usuarioAtual } from "@/server/usuarios";
import { reservarAnexo } from "@/server/terrenos";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };
export async function POST(_: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const { chave } = await params; return ok(await reservarAnexo(u, decodeURIComponent(chave))); } catch (e) { return erro(e, 400); }
}
