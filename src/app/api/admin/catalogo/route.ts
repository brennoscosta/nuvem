// Admin: criar/treinar/apagar os agentes que o WorkEnd vende
import { listarCatalogoAdmin, salvarAgenteCatalogo, apagarAgenteCatalogo, semearCatalogo, APIS_DISPONIVEIS, type AgenteCatalogo } from "@/server/catalogo";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() { try { await exigirAdmin(); return ok({ agentes: await listarCatalogoAdmin(), apis: APIS_DISPONIVEIS }); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) {
  try {
    await exigirAdmin();
    const d = await corpo<{ acao?: string } & Partial<AgenteCatalogo>>(req);
    if (d.acao === "apagar" && d.id) { await apagarAgenteCatalogo(d.id); return ok({ feito: "apagar" }); }
    if (d.acao === "semear") { await semearCatalogo(); return ok({ feito: "semear" }); }
    return ok(await salvarAgenteCatalogo(d));
  } catch (e) { return erro(e, statusDe(e)); }
}
