"use client";
// Estado dos moradores da cidade no navegador (19/11/2026): qual ficha está aberta, o que cada morador lembra do
// visitante logado (para o cumprimento quando ele passa perto) e os balões de fala que estão no ar.
// A rotina (onde cada um está) não mora aqui: sai de data/moradores.ts pela hora da cidade (segundosCidade).
import { create } from "zustand";
import { DIA, segundosBrasilia, type RelacaoCurta } from "./data/moradores";
import { useMundo } from "./mundoStore";
import { usePersonagem } from "./personagemStore";
import { useSede } from "./sedeStore";

// ?hora=21 (prévias e testes, como o céu de scene/CicloDia.tsx): a cidade começa nessa hora e o relógio anda a partir dela
const HORA_FIXA = (() => { if (typeof window === "undefined") return null; const h = new URLSearchParams(window.location.search).get("hora"); return h != null && h !== "" && Number.isFinite(Number(h)) ? Number(h) : null; })();
const INICIO = typeof performance !== "undefined" ? performance.now() : 0;
// hora da cidade em segundos do dia: a mesma para todos os visitantes (corrigida pelo relógio do servidor)
export function segundosCidade() {
  if (HORA_FIXA != null) return (((HORA_FIXA * 3600 + (performance.now() - INICIO) / 1000) % DIA) + DIA) % DIA;
  return segundosBrasilia(Date.now() + (useMundo.getState().desvioRelogio || 0));
}

// posição de quem está atravessando a rua agora (os carros param para eles, como para os outros pedestres)
export const MORADORES_NA_RUA: { x: number; z: number; estado: "andando" | "atravessando" }[] = [];

interface Estado {
  aberto: string | null; // id do morador com a ficha aberta
  relacoes: Record<string, RelacaoCurta> | null; // null: ainda não carregou (ou sem login)
  falas: Record<string, { texto: string; ate: number }>;
  abrir: (id: string) => void;
  fechar: () => void;
  carregarRelacoes: () => Promise<void>;
  guardarRelacao: (r: RelacaoCurta) => void;
  falar: (id: string, texto: string, ms?: number) => void;
}
export const useMoradores = create<Estado>((set, get) => ({
  aberto: null, relacoes: null, falas: {},
  abrir: (id) => {
    // um painel por vez: fecha a ficha de personagem e o cartão de lote
    usePersonagem.getState().fechar();
    const mu = useMundo.getState();
    if (mu.loteSelecionado || mu.outdoorSelecionado) useMundo.setState({ loteSelecionado: null, outdoorSelecionado: null });
    if (useSede.getState().aberto) useSede.setState({ aberto: false });
    set({ aberto: id });
  },
  fechar: () => set({ aberto: null }),
  carregarRelacoes: async () => {
    try {
      const r = await fetch("/api/workend/moradores", { cache: "no-store" }); if (!r.ok) return;
      const j = (await r.json()) as { relacoes?: RelacaoCurta[] };
      set({ relacoes: Object.fromEntries((j.relacoes ?? []).map((x) => [x.id, x])) });
    } catch { /* sem rede: sem cumprimento */ }
  },
  guardarRelacao: (r) => set({ relacoes: { ...(get().relacoes ?? {}), [r.id]: r } }),
  falar: (id, texto, ms = 6000) => {
    const ate = Date.now() + ms;
    set({ falas: { ...get().falas, [id]: { texto, ate } } });
    setTimeout(() => { const f = get().falas[id]; if (f && f.ate === ate) { const nx = { ...get().falas }; delete nx[id]; set({ falas: nx }); } }, ms);
  },
}));
