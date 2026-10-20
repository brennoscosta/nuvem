// Dono aprovou o plano (podendo ajustar título/descrição/privacidade ou o prompt da arte): o agente executa de verdade.
import { executarTarefa, obterTarefa } from "@/server/tarefas";
import { dormir } from "@/server/conexoes";
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
    // Gerar imagem / publicar pode passar de 1 min e o proxy corta em 60 s (504). Então: espera só o começo (validações e
    // status "executando"); se ainda estiver rodando, responde já e o trabalho segue em segundo plano — o painel acompanha pelo status.
    const execucao = executarTarefa(id, base(req), ajustes);
    execucao.catch(() => { /* erro já fica gravado na tarefa */ });
    const r = await Promise.race([execucao, dormir(2500).then(() => "andamento" as const)]);
    if (r === "andamento") return ok(await obterTarefa(id));
    return ok(r);
  } catch (e) { return erro(e); }
}
