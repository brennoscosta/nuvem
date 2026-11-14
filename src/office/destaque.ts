// Loja destaque da semana no mapa (13/11/2026): um pedido só para o telão da praça e o selo do balão, renovado a cada 30 min.
import { useSyncExternalStore } from "react";

export interface DestaqueSemana { semana: string; chave: string; numero: number; empresa: string; nicho: string; cor: string; logo: string | null; visitas: number }
let atual: DestaqueSemana | null = null;
const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function buscar() {
  fetch("/api/workend/destaque").then((r) => (r.ok ? r.json() : null)).then((j) => {
    const novo = (j?.destaque ?? null) as DestaqueSemana | null;
    if (JSON.stringify(novo) === JSON.stringify(atual)) return;
    atual = novo; ouvintes.forEach((f) => f());
  }).catch(() => {});
}
function assinar(cb: () => void) {
  ouvintes.add(cb);
  if (!timer) { buscar(); timer = setInterval(buscar, 30 * 60_000); }
  return () => { ouvintes.delete(cb); if (!ouvintes.size && timer) { clearInterval(timer); timer = null; } };
}
export const useDestaque = () => useSyncExternalStore(assinar, () => atual, () => null);
