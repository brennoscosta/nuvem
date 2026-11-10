// Roda uma vez quando o servidor liga: agenda a evolução automática das skills (só no Node, nunca na compilação).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { agendarEvolucao } = await import("./server/evolucao");
  agendarEvolucao();
}
