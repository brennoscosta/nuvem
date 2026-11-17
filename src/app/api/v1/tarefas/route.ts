// API v1: POST /api/v1/tarefas { para?: id da pessoa (padrão: CEO), texto, avisar?: URL https } → 202 { id, status, para }.
// A equipe trabalha em segundo plano; consulte GET /api/v1/tarefas/{id} ou receba o aviso tarefa.entregue.
import { autenticar, criarTarefaApi } from "@/server/apiV1";
import { statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const ctx = await autenticar(req);
    return ok(await criarTarefaApi(ctx, await corpo<{ para?: string; texto?: string; avisar?: string }>(req)), 202);
  } catch (e) { return erro(e, statusDe(e)); }
}
