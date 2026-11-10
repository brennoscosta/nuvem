// Admin: evolução automática das skills (painel, configuração, rodar agora e voltar versão)
import { painelEvolucao, salvarConfig, rodarCiclo, voltarVersao, type ConfigEvolucao } from "@/server/evolucao";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() { try { await exigirAdmin(); return ok(await painelEvolucao()); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) {
  try {
    await exigirAdmin();
    const d = await corpo<{ acao?: string; config?: Partial<ConfigEvolucao>; especialistaId?: string; skill?: string }>(req);
    if (d.acao === "config") return ok(await salvarConfig(d.config ?? {}));
    if (d.acao === "voltar") { await voltarVersao(d.especialistaId ?? "", d.skill ?? ""); return ok({ feito: "voltar" }); }
    if (d.acao === "rodar") {
      // o ciclo leva minutos: responde logo e ele segue em segundo plano (erros de saída, como teto do mês, voltam aqui)
      const ciclo = rodarCiclo("manual");
      const r = await Promise.race([ciclo.then(() => "terminou" as const), new Promise<"rodando">((res) => setTimeout(() => res("rodando"), 1500))]);
      ciclo.catch((x) => console.error("[evolucao] manual:", (x as Error).message));
      return ok({ iniciado: true, situacao: r });
    }
    return erro("Ação desconhecida.", 400);
  } catch (e) { return erro(e, statusDe(e) === 500 ? 400 : statusDe(e)); }
}
