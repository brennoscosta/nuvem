// Conversa do dono com uma pessoa da equipe. GET ?lote=&membro= → histórico. POST { lote, membro, texto } → resposta.
import { usuarioAtual } from "@/server/usuarios";
import { conversaDoDono, falarComMembro, statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = new URL(req.url).searchParams;
    return ok(await conversaDoDono(u, p.get("lote"), p.get("membro") ?? ""));
  } catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<{ lote?: string; membro?: string; texto?: string }>(req);
    return ok(await falarComMembro(u, d.lote ?? null, d.membro ?? "", d.texto ?? ""));
  } catch (e) { return erro(e, statusDe(e)); }
}
