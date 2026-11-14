"use client";
// Etapas da abertura do mapa (v67, 13/11/2026): primeiro o que está perto da câmera (ruas, calçadas, lotes, prédios),
// depois o resto. 0 = abrindo; 1 = a cidade de perto já apareceu (árvores de rua, trânsito, gente); 2 = mar, serra, praia,
// nuvens, rio, parque, bichos e som. Quem é montado depois não atrasa o 1º quadro (nem a compilação dos materiais dele).
import { Suspense, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";

let etapa = 0;
const ouvintes = new Set<() => void>();
export const etapaAtual = () => etapa;
function avancar(n: number) { if (n <= etapa) return; etapa = n; ouvintes.forEach((f) => f()); }
function assinar(cb: () => void) { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; }
export function useEtapa() { return useSyncExternalStore(assinar, etapaAtual, () => 0); }
// ?medir=1: quando cada etapa começou (window.__etapas, segundos desde a abertura da página)
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");
const MARCAS: number[] = [];
if (MEDIR) (window as unknown as { __etapas?: number[] }).__etapas = MARCAS;

// cada grupo tem o próprio limite de carregamento: o texto 3D (<Text> do drei) suspende até gerar as letras da fonte, e
// sem isso uma placa de rua segurava a cidade inteira (chão e ruas inclusive) até a última letra ficar pronta
export function Isolado({ children }: { children: ReactNode }) { return <Suspense fallback={null}>{children}</Suspense>; }
export function Depois({ etapa: n, children }: { etapa: number; children: ReactNode }) {
  const e = useEtapa();
  return e >= n ? <Suspense fallback={null}>{children}</Suspense> : null;
}

// dentro do Canvas: decide quando passar de etapa. A 1 vem quando os modelos de perto chegaram e já saíram 2 quadros
// (ou no máximo 9 s); a 2, um pouco depois (ou no máximo 14 s), para a cidade aparecer antes de começar o resto.
export function MarcadorEtapas() {
  // "pronto" = já chegou pelo menos um modelo e nenhum está chegando agora
  const carregando = useProgress((s) => s.active || s.total === 0);
  const k = useRef({ inicio: 0, quadrosProntos: 0, em1: 0 });
  const carregandoRef = useRef(carregando);
  useEffect(() => { carregandoRef.current = carregando; }, [carregando]);
  useFrame(() => {
    const t = performance.now() / 1000, x = k.current;
    if (!x.inicio) x.inicio = t;
    if (etapa === 0) {
      x.quadrosProntos = carregandoRef.current ? 0 : x.quadrosProntos + 1;
      if (x.quadrosProntos >= 2 || t - x.inicio > 9) { avancar(1); x.em1 = t; if (MEDIR) MARCAS[1] = t; }
    } else if (etapa === 1 && (t - x.em1 > 1.2 || t - x.inicio > 14)) { avancar(2); if (MEDIR) MARCAS[2] = t; }
  });
  return null;
}
