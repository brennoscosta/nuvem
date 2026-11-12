// Central de avisos (sino, 12/11/2026). GET = os últimos avisos e quantos não lidos; POST { ids? } = marca como lidos
// (sem ids, todos). Sem conta: lista vazia (o sino nem aparece).
import { usuarioAtual } from "@/server/usuarios";
import { listarAvisos, marcarLidos, limparAvisosVelhos } from "@/server/avisos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual().catch(() => null);
    if (!u) return ok({ avisos: [], naoLidos: 0, logado: false });
    if (Math.random() < 0.02) void limparAvisosVelhos();
    return ok({ ...(await listarAvisos(u.id)), logado: true });
  } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { ids } = await corpo<{ ids?: string[] }>(req);
    await marcarLidos(u.id, Array.isArray(ids) ? ids : null);
    return ok({ ok: true });
  } catch (e) { return erro(e); }
}
