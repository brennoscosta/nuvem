// Relatório da semana escrito pelo CEO: POST { lote } → a resposta entra na conversa com o CEO.
import { usuarioAtual } from "@/server/usuarios";
import { pedirRelatorio, statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<{ lote?: string }>(req);
    return ok(await pedirRelatorio(u, d.lote ?? null));
  } catch (e) { return erro(e, statusDe(e)); }
}
