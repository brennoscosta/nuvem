import { obterAgente, atualizarAgente, desligarAgente, gravarEvento, fichaCompleta } from "@/server/agentes";
import { ok, erro, corpo } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  try { const { id } = await params; const f = await fichaCompleta(id); return f ? ok(f) : erro("não encontrado", 404); } catch (e) { return erro(e); }
}
export async function PATCH(req: Request, { params }: Ctx) {
  try { const { id } = await params; const a = await obterAgente(id); if (!a) return erro("não encontrado", 404);
    const b = await corpo(req); const novo = await atualizarAgente(id, b as never);
    if (b.nivel && b.nivel !== a.nivel) await gravarEvento(a.empresaId, id, "promovido", `${a.nome} agora é ${b.nivel}`);
    return ok(novo); } catch (e) { return erro(e); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  try { const { id } = await params; const a = await obterAgente(id); if (!a) return erro("não encontrado", 404);
    await gravarEvento(a.empresaId, id, "demitido", `${a.nome} foi desligado(a)`); await desligarAgente(id); return ok({ ok: true }); } catch (e) { return erro(e); }
}
