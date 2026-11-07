"use client";
// Estado do mundo WorkEnd: lotes reservados, lote selecionado, usuário do WorkEnd (sessão própria, separada do admin
// da Nuvem) e o rascunho da empresa enquanto o usuário monta a placa dele.
import { create } from "zustand";


export interface Terreno { chave: string; usuarioId: string; status: "reservado" | "ativo"; empresaNome: string; cor: string; temLogo: boolean; reservadoEm: string; reservadoAte: string | null; pagoAte: string | null }
export interface UsuarioWorkend { id: string; email: string; nome: string; empresaNome: string; papel?: "dono" | "admin"; banidoEm?: string | null }
export interface Rascunho { empresaNome: string; cor: string; logoDataUrl: string | null }

export const CORES_EMPRESA = ["#1D4ED8", "#0EA5A4", "#16A34A", "#D97706", "#DC2626", "#DB2777", "#7C3AED", "#1F2937"];

export { LOTES, LOTE_POR_CHAVE, NOME_CONSTRUCAO, descricaoLote, type LoteInfo } from "./data/mundo";
import { LOTE_POR_CHAVE } from "./data/mundo";

// Estamos no mapa do WorkEnd (workend.online/mundo)? Aí o login é o do WorkEnd, não o do admin da Nuvem.
export const modoMundo = () => typeof window !== "undefined" && (window.location.pathname.startsWith("/mundo") || new URLSearchParams(window.location.search).has("mundo"));
// Pra onde mandar quem quer comprar e não está logado: cadastro do WorkEnd, voltando pro lote escolhido
export function linkCadastro(chave: string) {
  const q = `?lote=${encodeURIComponent(chave)}`;
  return modoMundo() ? `/cadastro${q}` : `https://workend.online/cadastro${q}`;
}

interface Estado {
  terrenos: Record<string, Terreno>;
  meu: string | null; // chave do lote do usuário logado
  usuario: UsuarioWorkend | null;
  admin: boolean; // admin do WorkEnd (vê tudo, libera e bane)
  pagamentoLigado: boolean; // MP_ACCESS_TOKEN configurado no servidor
  preco: number; // R$ por lote por mês
  minutosReserva: number;
  desvioRelogio: number; // servidor - navegador (ms), pra contagem regressiva certa
  pagando: boolean;
  carregado: boolean;
  loteSelecionado: string | null;
  loteHover: string | null;
  painelEmpresa: boolean; // painel "Montar minha empresa" aberto
  rascunho: Rascunho | null; // o que está sendo editado (a cena mostra ao vivo)
  alvoCamera: [number, number, number] | null; // a câmera desliza até aqui
  carregar: () => Promise<void>;
  selecionarLote: (chave: string | null) => void;
  setLoteHover: (chave: string | null) => void;
  abrirPainel: () => void;
  fecharPainel: () => void;
  setRascunho: (r: Partial<Rascunho>) => void;
  reservar: () => Promise<string | null>;
  desistir: () => Promise<void>;
  pagar: (meses?: number) => Promise<string | null>;
  conferirPagamento: (ref: string) => Promise<string>;
  sairWorkend: () => Promise<void>;
  limparAlvo: () => void;
}

export const useMundo = create<Estado>((set, get) => ({
  terrenos: {}, meu: null, usuario: null, admin: false, pagamentoLigado: false, preco: 99, minutosReserva: 10, desvioRelogio: 0, pagando: false, carregado: false, loteSelecionado: null, loteHover: null, painelEmpresa: false, rascunho: null, alvoCamera: null,

  carregar: async () => {
    try {
      const [t, u] = await Promise.all([
        fetch("/api/terrenos").then((r) => r.json()).catch(() => ({ terrenos: [], meu: null })),
        fetch("/api/workend/eu").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const terrenos: Record<string, Terreno> = {};
      for (const x of (t.terrenos ?? []) as Terreno[]) terrenos[x.chave] = x;
      set({ terrenos, meu: t.meu ?? null, usuario: u && u.id ? u : null, admin: !!t.admin, pagamentoLigado: !!t.pagamento, preco: t.preco ?? 99, minutosReserva: t.minutosReserva ?? 10, desvioRelogio: t.agora ? new Date(t.agora).getTime() - Date.now() : 0, carregado: true });
      // veio do cadastro com ?lote=: já abre o lote escolhido
      const busca = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const pedido = busca?.get("lote") ?? null;
      if (pedido && LOTE_POR_CHAVE[pedido] && !get().loteSelecionado) { get().selecionarLote(pedido); if (u && u.id && !terrenos[pedido] && !busca?.get("pagamento")) get().abrirPainel(); }
    } catch (e) { console.warn("[mundo] sem servidor:", e); set({ carregado: true }); }
  },

  selecionarLote: (chave) => {
    const l = chave ? LOTE_POR_CHAVE[chave] : null;
    set({ loteSelecionado: l ? chave : null, painelEmpresa: false, rascunho: null, alvoCamera: l ? [l.centro[0], 0.5, l.centro[1]] : null });
  },
  setLoteHover: (chave) => set({ loteHover: chave }),

  abrirPainel: () => {
    const { loteSelecionado, terrenos, usuario } = get(); if (!loteSelecionado) return;
    const t = terrenos[loteSelecionado];
    set({ painelEmpresa: true, rascunho: { empresaNome: t?.empresaNome ?? usuario?.empresaNome ?? "", cor: t?.cor ?? CORES_EMPRESA[0], logoDataUrl: t?.temLogo ? `/api/terrenos/${encodeURIComponent(loteSelecionado)}/logo?v=${Date.now()}` : null } });
  },
  fecharPainel: () => set({ painelEmpresa: false, rascunho: null }),
  setRascunho: (r) => set((s) => ({ rascunho: s.rascunho ? { ...s.rascunho, ...r } : null })),

  reservar: async () => {
    const { loteSelecionado, rascunho, terrenos, usuario } = get();
    if (!loteSelecionado || !rascunho) return "Escolha um lote.";
    if (!usuario) return "Entre na sua conta do WorkEnd.";
    const atual = terrenos[loteSelecionado];
    const logoNovo = rascunho.logoDataUrl?.startsWith("data:") ? rascunho.logoDataUrl : null;
    const body = { empresaNome: rascunho.empresaNome, cor: rascunho.cor, logoBase64: logoNovo, logoTipo: logoNovo ? (/^data:(image\/[a-z]+)/.exec(logoNovo)?.[1] ?? "image/png") : null, manterLogo: !logoNovo && !!rascunho.logoDataUrl && !!atual?.temLogo };
    const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ painelEmpresa: false, rascunho: null });
    await get().carregar();
    return null;
  },

  desistir: async () => {
    const { loteSelecionado } = get(); if (!loteSelecionado) return;
    await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/reservar`, { method: "DELETE" });
    await get().carregar();
  },

  // Abre o checkout do Mercado Pago (na mesma aba; ele volta pra /mundo?lote=…&pagamento=ok)
  pagar: async (meses = 1) => {
    const { loteSelecionado } = get(); if (!loteSelecionado) return "Escolha um lote.";
    set({ pagando: true });
    try {
      const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/pagar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ meses }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      window.location.href = j.url;
      return null;
    } catch (e) { return (e as Error).message; } finally { set({ pagando: false }); }
  },
  // Voltou do checkout: confere na API do Mercado Pago e recarrega
  conferirPagamento: async (ref) => {
    const r = await fetch(`/api/pagamentos/${encodeURIComponent(ref)}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    await get().carregar();
    return r.ok ? (j.status as string) : "erro";
  },

  sairWorkend: async () => { await fetch("/api/workend/sair", { method: "POST" }); set({ usuario: null, meu: null, painelEmpresa: false, rascunho: null }); await get().carregar(); },
  limparAlvo: () => set({ alvoCamera: null }),
}));

if (typeof window !== "undefined") (window as unknown as { __mundo: typeof useMundo }).__mundo = useMundo;
