// Avaliação do atendimento da agenda (13/11/2026): POST { nota 1–5, texto } do cliente, uma por horário concluído.
import { avaliarAtendimento, statusAgenda } from "@/server/agenda";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta para avaliar.", 401);
    const { id } = await params;
    return ok(await avaliarAtendimento(u, decodeURIComponent(id), await corpo(req)));
  } catch (e) { return erro(e, statusAgenda(e)); }
}
