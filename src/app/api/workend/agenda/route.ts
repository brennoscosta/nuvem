// Agenda do dono (12/11/2026): GET = configuração + próximos horários e histórico; POST = salvar a configuração.
import { agendaDoDono, salvarAgenda, statusAgenda } from "@/server/agenda";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401); return ok(await agendaDoDono(u)); }
  catch (e) { return erro(e, statusAgenda(e)); }
}
export async function POST(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401); return ok(await salvarAgenda(u, await corpo(req))); }
  catch (e) { return erro(e, statusAgenda(e)); }
}
