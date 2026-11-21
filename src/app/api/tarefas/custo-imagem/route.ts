// Custo de uma arte em unidades de IA, mostrado ANTES de gerar (WE-10, 21/11/2026). É o mesmo preço que a geração usa
// (imagens.ts › custoImagemBRL, qualidade alta), em unidades pela mesma conta do designer da equipe (imagens.ts ›
// custoImagemUnidades, que converte como no débito), mais o saldo da empresa do agente. GET ?agente=id (admin, como as
// outras rotas de tarefas).
import { custoImagemBRL, custoImagemUnidades, FORMATOS, type Formato } from "@/server/imagens";
import { saldoIA, UNIDADES_MES_LOTE } from "@/server/unidadesIA";
import { obterAgente } from "@/server/agentes";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const agente = new URL(req.url).searchParams.get("agente"); if (!agente) return erro("agente ausente", 400);
    const a = await obterAgente(agente); if (!a) return erro("Agente não encontrado", 404);
    const formatos = Object.fromEntries((Object.keys(FORMATOS) as Formato[]).map((f) => [f, { custoBrl: custoImagemBRL(f), unidades: custoImagemUnidades(f) }]));
    const s = await saldoIA(a.empresaId);
    return ok({ formatos, saldo: { cobrada: s.cobrada, total: s.total }, mensalidade: UNIDADES_MES_LOTE });
  } catch (e) { return erro(e); }
}
