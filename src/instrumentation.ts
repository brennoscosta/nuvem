// Roda uma vez quando o servidor liga (só no Node, nunca na compilação): agenda a evolução automática das skills e,
// desde a WE-17 (21/11/2026), os e-mails de ciclo de vida e o aviso de vencimento (src/server/emailsCiclo.ts).
// WE-23 (22/11/2026): liga o Sentry só se SENTRY_DSN existir (lida agora, ao subir) e agenda a conferência dos serviços
// da página /status (src/server/statusServicos.ts), a cada 5 minutos.
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SENTRY_DSN?.trim()) {
    const { ligarSentry } = await import("./server/sentry");
    ligarSentry();
  }
  const { agendarEvolucao } = await import("./server/evolucao");
  agendarEvolucao();
  // pagamento automático (WE-09): lembrete de 3 dias, conferência das cobranças e carência
  const { agendarAssinaturas } = await import("./server/assinaturas");
  agendarAssinaturas();
  // e-mails de ciclo de vida e aviso de vencimento (WE-17)
  const { agendarEmails } = await import("./server/emailsCiclo");
  agendarEmails();
  // conferência dos serviços para a página pública de status (WE-23)
  const { agendarStatus } = await import("./server/statusServicos");
  agendarStatus();
}

// Erro numa rota, página ou server component (WE-23): vai para o Sentry quando ele está ligado; sem SENTRY_DSN, nada
// é carregado.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN?.trim()) return;
  const { erroDaRequisicao } = await import("./server/sentry");
  erroDaRequisicao(...args);
};
