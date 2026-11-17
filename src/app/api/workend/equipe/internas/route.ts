// Conversas internas da equipe (16/11/2026, src/server/delegacao.ts): quem pediu o quê a quem e o que respondeu.
// GET ?lote= → { internas: [...] } (só o dono do lote ou o admin).
import { usuarioAtual } from "@/server/usuarios";
import { internasDoDono, statusDe } from "@/server/equipeCliente";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await internasDoDono(u, new URL(req.url).searchParams.get("lote"))); }
  catch (e) { return erro(e, statusDe(e)); }
}
