import { listarMensagens, obterAgente } from "@/server/agentes";
import { conversar } from "@/server/motor";
import { ok, erro, corpo } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  try { const { id } = await params; return ok(await listarMensagens(id, 80)); } catch (e) { return erro(e); }
}
export async function POST(req: Request, { params }: Ctx) {
  try { const { id } = await params; const a = await obterAgente(id); if (!a) return erro("não encontrado", 404);
    const { texto } = await corpo<{ texto: string }>(req); if (!texto?.trim()) return erro("texto vazio", 400);
    return ok(await conversar(id, texto.trim())); } catch (e) { return erro(e); }
}
