// Encaminha uma tarefa concluída (com arquivo) pro responsável de outro setor. Só admin.
import { encaminharTarefa } from "@/server/tarefas";
import { AREAS, type AreaId } from "@/office/data/org";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const { id } = await params;
    const b = await corpo<{ area: string; mensagem?: string }>(req);
    if (!b.area || !AREAS[b.area as AreaId]) return erro("setor inválido", 400);
    return ok(await encaminharTarefa(id, b.area as AreaId, b.mensagem));
  } catch (e) { return erro(e); }
}
