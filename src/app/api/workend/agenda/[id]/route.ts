// Um horário marcado (12/11/2026): o cliente cancela o dele; o dono cancela ou marca concluído / faltou.
import { mudarStatus, statusAgenda } from "@/server/agenda";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { id } = await params; const { acao } = await corpo<{ acao?: string }>(req);
    return ok(await mudarStatus(u, decodeURIComponent(id), acao));
  } catch (e) { return erro(e, statusAgenda(e)); }
}
