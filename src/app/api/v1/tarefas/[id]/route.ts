// API v1: GET /api/v1/tarefas/{id} → { id, status: trabalhando | entregue | erro, para, texto, resposta_inicial, entrega,
// erro, criado_em, entregue_em, pedidos_internos: [{ de, para, pedido, resposta, status }] }.
import { autenticar, obterTarefaApi } from "@/server/apiV1";
import { statusDe } from "@/server/equipeCliente";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await autenticar(req); return ok(await obterTarefaApi(ctx, (await params).id)); } catch (e) { return erro(e, statusDe(e)); }
}
