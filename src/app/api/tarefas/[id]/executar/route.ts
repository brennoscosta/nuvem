// Dono aprovou o plano (podendo ajustar título/descrição/privacidade ou o prompt da arte): o agente executa de verdade.
import { executarTarefa } from "@/server/tarefas";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";
import { base } from "@/server/conexoes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const { id } = await params;
    const ajustes = await corpo<Record<string, unknown>>(req).catch(() => ({}));
    return ok(await executarTarefa(id, base(req), ajustes));
  } catch (e) { return erro(e); }
}
