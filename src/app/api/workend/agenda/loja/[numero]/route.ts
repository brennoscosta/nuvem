// Agenda pública da loja (12/11/2026): GET = serviços, meus horários e (com ?servico=) os horários livres; POST = marcar.
import { agendaPublica, marcar, statusAgenda } from "@/server/agenda";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { numero } = await params;
    const u = await usuarioAtual().catch(() => null);
    return ok(await agendaPublica(Number(numero) | 0, u, new URL(req.url).searchParams.get("servico")));
  } catch (e) { return erro(e, statusAgenda(e)); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta para marcar um horário.", 401);
    const { numero } = await params;
    return ok(await marcar(u, Number(numero) | 0, await corpo(req), "cartao"), 201);
  } catch (e) { return erro(e, statusAgenda(e)); }
}
