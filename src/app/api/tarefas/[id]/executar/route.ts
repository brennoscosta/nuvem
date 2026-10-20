// Dono aprovou o plano (podendo ajustar título/descrição/privacidade): o agente publica de verdade.
import { executarPublicacao } from "@/server/tarefas";
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
    const ajustes = await corpo<{ titulo?: string; descricao?: string; privacidade?: "public" | "unlisted" | "private" }>(req).catch(() => ({}));
    return ok(await executarPublicacao(id, base(req), ajustes));
  } catch (e) { return erro(e); }
}
