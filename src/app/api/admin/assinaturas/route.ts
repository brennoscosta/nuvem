// Admin do pagamento automático (WE-09): assinaturas com estado, próxima cobrança e falhas; pedidos de devolução dos 7 dias.
import { listarAssinaturasAdmin, resolverDevolucao } from "@/server/assinaturas";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() { try { await exigirAdmin(); return ok(await listarAssinaturasAdmin()); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) {
  try {
    const u = await exigirAdmin();
    const b = await corpo<{ acao?: string; id?: string }>(req);
    if (b.acao === "devolvido" && typeof b.id === "string") return ok(await resolverDevolucao(u, b.id));
    return erro("Ação inválida.", 400);
  } catch (e) { return erro(e, statusDe(e)); }
}
