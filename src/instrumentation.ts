// Roda uma vez quando o servidor liga (só no Node, nunca na compilação): agenda a evolução automática das skills e,
// desde a WE-17 (21/11/2026), os e-mails de ciclo de vida e o aviso de vencimento (src/server/emailsCiclo.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { agendarEvolucao } = await import("./server/evolucao");
  agendarEvolucao();
  // pagamento automático (WE-09): lembrete de 3 dias, conferência das cobranças e carência
  const { agendarAssinaturas } = await import("./server/assinaturas");
  agendarAssinaturas();
  // e-mails de ciclo de vida e aviso de vencimento (WE-17)
  const { agendarEmails } = await import("./server/emailsCiclo");
  agendarEmails();
}
