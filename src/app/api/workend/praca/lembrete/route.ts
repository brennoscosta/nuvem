// "Me avise" de um evento da praça (12/11/2026): GET = eventos que eu pedi para lembrar; POST { eventoId } liga/desliga.
// O aviso sai no sino 10 minutos antes (src/server/avisos.ts).
import { usuarioAtual } from "@/server/usuarios";
import { alternarLembrete, meusLembretes } from "@/server/avisos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual().catch(() => null); return ok({ lembretes: u ? await meusLembretes(u.id) : [] }); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta para receber o aviso.", 401);
    const { eventoId } = await corpo<{ eventoId?: string }>(req);
    if (!eventoId) return erro("Evento inválido.", 400);
    return ok(await alternarLembrete(u.id, String(eventoId)));
  } catch (e) { return erro(e, 400); }
}
