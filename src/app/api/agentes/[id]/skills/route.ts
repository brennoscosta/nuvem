import { salvarSkill, removerSkill } from "@/server/agentes";
import { ok, erro, corpo } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try { const { id } = await params; const b = await corpo(req); return ok(await salvarSkill(id, b as never)); } catch (e) { return erro(e); }
}
export async function DELETE(req: Request, { params }: Ctx) {
  try { const { id } = await params; const { itemId } = await corpo<{ itemId: string }>(req); if (!itemId) return erro("itemId obrigatório", 400); await removerSkill(id, itemId); return ok({ ok: true }); } catch (e) { return erro(e); }
}
