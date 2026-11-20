"use client";
// Grade do telão da Praça de Eventos (20/11/2026): busca /api/workend/telao uma vez por minuto e reparte entre quem usa
// (cena 3D, cartão da praça). Também diz qual item está no ar agora (todo mundo vê o mesmo, em fatias de 15 s).
import { useEffect, useState } from "react";
import type { GradeTelao } from "./data/telao";

let cache: GradeTelao | null = null;
const ouvintes = new Set<(g: GradeTelao) => void>();
let relogio: ReturnType<typeof setInterval> | null = null;
async function carregar() {
  const j = (await fetch("/api/workend/telao", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as GradeTelao | null;
  if (j && Array.isArray(j.itens)) { cache = j; for (const f of ouvintes) f(j); }
}
export function recarregarGrade() { return carregar(); }
export function useGradeTelao() {
  const [g, setG] = useState<GradeTelao | null>(cache);
  useEffect(() => {
    ouvintes.add(setG);
    if (!relogio) { void carregar(); relogio = setInterval(() => void carregar(), 60_000); }
    return () => { ouvintes.delete(setG); if (!ouvintes.size && relogio) { clearInterval(relogio); relogio = null; } };
  }, []);
  return g;
}
// ?telao=N fixa o item N da grade; ?telao=anuncio|patrocinio|casa|feira|destaque fixa o 1º item desse tipo (prévias e fotos)
export function telaoFixo(): number | string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("telao"); if (!v) return null;
  const n = Number(v); return Number.isFinite(n) ? n : v;
}
