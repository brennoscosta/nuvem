import { obterAgente, atualizarAgente, desligarAgente, gravarEvento, fichaCompleta } from "@/server/agentes";
import { arrumarMesas } from "@/server/mesas";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const { id } = await params; const f = await fichaCompleta(id); return f ? ok(f) : erro("não encontrado", 404); } catch (e) { return erro(e); }
}
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const { id } = await params; const a = await obterAgente(id); if (!a) return erro("não encontrado", 404);
    const b = await corpo(req);
    let novo = await atualizarAgente(id, b as never);
    // mudou de área, cargo, função ou mesa: o servidor confere a sala e realoca (a cena segue a mesa gravada)
    if ("area" in b || "nivel" in b || "funcao" in b || "mesaId" in b) novo = (await arrumarMesas(a.empresaId)).find((x) => x.id === id) ?? novo;
    if (b.nivel && b.nivel !== a.nivel) await gravarEvento(a.empresaId, id, "promovido", `${a.nome} agora é ${b.nivel}`);
    else if (novo.area !== a.area || novo.mesaId !== a.mesaId) await gravarEvento(a.empresaId, id, "promovido", `${a.nome} mudou de sala`);
    return ok(novo); } catch (e) { return erro(e); }
}
export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const { id } = await params; const a = await obterAgente(id); if (!a) return erro("não encontrado", 404);
    await gravarEvento(a.empresaId, id, "demitido", `${a.nome} foi desligado(a)`); await desligarAgente(id); return ok({ ok: true }); } catch (e) { return erro(e); }
}
