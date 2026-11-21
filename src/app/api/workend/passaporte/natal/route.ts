// Caça aos presentes de Natal (20/11/2026, frente "visitante"; só na época, data/natal.ts). GET → os presentes de hoje e
// quantos eu já achei; POST { idx, x, z, rot } → pega o presente (o servidor confere a batida de posição).
import { usuarioAtual } from "@/server/usuarios";
import { natalDoUsuario, acharPresente, ErroPassaporte } from "@/server/passaporte";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
const st = (e: unknown) => (e instanceof ErroPassaporte ? e.status : 500);
export async function GET() {
  try { const u = await usuarioAtual(); return ok(await natalDoUsuario(u && !u.banidoEm ? u : null)); }
  catch (e) { return erro(e, st(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para pegar presentes.", 401);
    return ok(await acharPresente(u, await corpo(req)));
  } catch (e) { return erro(e, st(e)); }
}
