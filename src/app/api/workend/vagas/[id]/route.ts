// Candidatar-se a uma vaga: POST { mensagem, contato }.
import { usuarioAtual } from "@/server/usuarios";
import { candidatar } from "@/server/cidade";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para se candidatar.", 401); const { id } = await params; return ok(await candidatar(u, id, await corpo(req))); } catch (e) { return erro(e, 400); }
}
