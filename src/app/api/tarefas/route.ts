// Tarefas de um agente. GET ?agente=id (admin) · POST cria "publicar_video" (admin).
import { listarTarefas, criarPublicacao } from "@/server/tarefas";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try { const agente = new URL(req.url).searchParams.get("agente"); if (!agente) return erro("agente ausente", 400); return ok(await listarTarefas(agente)); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const d = await corpo<{ agenteId: string; arquivoId: string; legenda: string; titulo?: string; plataformas?: string[]; privacidade?: "public" | "unlisted" | "private" }>(req);
    if (!d.agenteId || !d.arquivoId) return erro("agenteId e arquivoId são obrigatórios", 400);
    if (!d.legenda?.trim()) return erro("legenda vazia", 400);
    return ok(await criarPublicacao(d.agenteId, { arquivoId: d.arquivoId, legenda: d.legenda.trim(), titulo: d.titulo?.trim(), plataformas: d.plataformas?.length ? d.plataformas : ["youtube"], privacidade: d.privacidade }));
  } catch (e) { return erro(e); }
}
