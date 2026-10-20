// Tarefas de um agente. GET ?agente=id (admin) · POST cria uma tarefa (admin): tipo "publicar_video" (padrão) ou "criar_arte".
import { listarTarefas, criarPublicacao, criarArte } from "@/server/tarefas";
import { FORMATOS } from "@/server/imagens";
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
    const d = await corpo<{ agenteId: string; tipo?: string; arquivoId: string; legenda: string; titulo?: string; plataformas?: string[]; privacidade?: "public" | "unlisted" | "private"; briefing?: string; formato?: string; referenciaIds?: string[] }>(req);
    if (!d.agenteId) return erro("agenteId é obrigatório", 400);
    if (d.tipo === "criar_arte") {
      if (!d.briefing?.trim()) return erro("briefing vazio", 400);
      const formato = (d.formato && d.formato in FORMATOS ? d.formato : "quadrado") as keyof typeof FORMATOS;
      return ok(await criarArte(d.agenteId, { briefing: d.briefing.trim(), formato, referenciaIds: (d.referenciaIds ?? []).slice(0, 4), titulo: d.titulo?.trim() }));
    }
    if (!d.arquivoId) return erro("arquivoId é obrigatório", 400);
    if (!d.legenda?.trim()) return erro("legenda vazia", 400);
    return ok(await criarPublicacao(d.agenteId, { arquivoId: d.arquivoId, legenda: d.legenda.trim(), titulo: d.titulo?.trim(), plataformas: d.plataformas?.length ? d.plataformas : ["youtube"], privacidade: d.privacidade }));
  } catch (e) { return erro(e); }
}
