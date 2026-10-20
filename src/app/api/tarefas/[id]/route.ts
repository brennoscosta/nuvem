import { obterTarefa, cancelarTarefa } from "@/server/tarefas";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const { id } = await params; const t = await obterTarefa(id); return t ? ok(t) : erro("não encontrada", 404); } catch (e) { return erro(e); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const { id } = await params; return ok(await cancelarTarefa(id)); } catch (e) { return erro(e); }
}
