// ?medir=1 (v67): quanto tempo cada gerador em código gastou na abertura (window.__geracao). Sem ?medir=1 não mede nada.
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");
const TOTAL: Record<string, { vezes: number; ms: number }> = {};
if (MEDIR) (window as unknown as { __geracao?: typeof TOTAL }).__geracao = TOTAL;
export function cronometrar<T>(nome: string, gerar: () => T): T {
  if (!MEDIR) return gerar();
  const t0 = performance.now(); const r = gerar(); const ms = performance.now() - t0;
  const x = (TOTAL[nome] ??= { vezes: 0, ms: 0 }); x.vezes++; x.ms += ms;
  return r;
}
// marca um acontecimento (com ou sem tempo): ex. "serra: do aparelho"
export function contar(nome: string, ms = 0) {
  if (!MEDIR) return;
  const x = (TOTAL[nome] ??= { vezes: 0, ms: 0 }); x.vezes++; x.ms += ms;
}
