"use client";
// Estado do mundo WorkEnd: lotes reservados, lote selecionado, usuário do WorkEnd (sessão própria, separada do admin
// da Nuvem) e o rascunho da empresa enquanto o usuário monta a placa dele.
import { create } from "zustand";


import type { Escritorio } from "./data/escritorio";
export interface Terreno { chave: string; usuarioId: string; status: "reservado" | "ativo"; empresaNome: string; cor: string; temLogo: boolean; reservadoEm: string; reservadoAte: string | null; pagoAte: string | null; escritorio: Escritorio | null; nicho?: string; anexoDe?: string | null }
export interface UsuarioWorkend { id: string; email: string; nome: string; empresaNome: string; papel?: "dono" | "admin"; banidoEm?: string | null }
export interface Rascunho { empresaNome: string; cor: string; logoDataUrl: string | null; ceoNome: string; atendenteNome: string; nicho: string }
export type AbaEscritorio = "predio" | "visual" | "interior" | "setores" | "equipe" | "contratar" | "treinar";
export interface Pix { id: string; lote: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; status: "pendente" | "aprovado" | "rejeitado" | "expirado"; tipo: "lote" | "layout" | "personagem" | "outdoor" | "barraca" | "item" }
// praça de eventos e feira de sábado (12/11/2026)
export interface EventoPraca { id: string; titulo: string; descricao: string; link: string; inicio: string; fim: string; meu: boolean; empresa: { nome: string; cor: string; numero: number | null; chave: string | null; logo: string | null } }
export interface BarracaFeira { vaga: number; status: "livre" | "reservada" | "paga"; meu: boolean; nome: string; descricao: string; cor: string; tipo: string; contato: { whatsapp?: string; instagram?: string } }
export interface Praca { agenda: EventoPraca[]; feira: { dia: string; barracas: BarracaFeira[]; preco: number }; agora: string }

export const CORES_EMPRESA = ["#1D4ED8", "#0EA5A4", "#16A34A", "#D97706", "#DC2626", "#DB2777", "#7C3AED", "#1F2937"];

export { LOTES, LOTE_POR_CHAVE, NOME_CONSTRUCAO, descricaoLote, type LoteInfo } from "./data/mundo";
import { LOTE_POR_CHAVE } from "./data/mundo";
import { OUTDOOR_POR_ID, type OutdoorPublico } from "./data/outdoors";
import { PRACA_CHAVE } from "./data/praca";

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
  pix: Pix | null; // cobrança Pix aberta (QR no cartão do lote)
  painelEscritorio: boolean; // painel "Montar escritório" aberto
  abaEscritorio: AbaEscritorio; // aba inicial do painel (cada botão de edição do cartão abre numa aba)
  rascunhoEscritorio: Escritorio | null; // o que está sendo editado (a cena desenha ao vivo)
  salvandoEscritorio: boolean;
  carregado: boolean;
  loteSelecionado: string | null;
  loteHover: string | null;
  painelEmpresa: boolean; // painel "Montar minha empresa" aberto
  rascunho: Rascunho | null; // o que está sendo editado (a cena mostra ao vivo)
  alvoCamera: [number, number, number] | null; // a câmera desliza até aqui
  vagas: Record<string, number>; // vagas abertas por lote (placa "Estamos contratando")
  praca: Praca | null; carregarPraca: () => Promise<void>;
  abrirPix: (p: Pix) => void; // Pix de barraca e de roupa do personagem (criados fora do cartão do lote)
  // outdoors nas avenidas (12/11/2026)
  outdoors: OutdoorPublico[]; precoOutdoor: number; outdoorSelecionado: string | null;
  carregarOutdoors: () => Promise<void>;
  abrirOutdoor: (slot: string | null) => void;
  pagarOutdoor: (slot: string, frase: string) => Promise<string | null>;
  carregar: () => Promise<void>;
  selecionarLote: (chave: string | null) => void;
  setLoteHover: (chave: string | null) => void;
  abrirPainel: () => void;
  fecharPainel: () => void;
  setRascunho: (r: Partial<Rascunho>) => void;
  reservar: () => Promise<string | null>;
  desistir: () => Promise<string | null>;
  pagar: (meses?: number, tipo?: "lote" | "layout" | "personagem") => Promise<string | null>;
  conferirPagamento: (ref: string) => Promise<string>;
  fecharPix: () => void;
  abrirEscritorio: (aba?: AbaEscritorio) => void;
  setAbaEscritorio: (aba: AbaEscritorio) => void;
  fecharEscritorio: () => void;
  setEscritorio: (e: Escritorio) => void;
  salvarEscritorio: () => Promise<string | null>;
  sairWorkend: () => Promise<void>;
  limparAlvo: () => void;
}

export const useMundo = create<Estado>((set, get) => ({
  vagas: {}, praca: null,
  carregarPraca: async () => { const j = await fetch("/api/workend/praca", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null); if (j?.agenda) set({ praca: j as Praca }); },
  abrirPix: (p) => set({ pix: p }),
  outdoors: [], precoOutdoor: 29.9, outdoorSelecionado: null,
  carregarOutdoors: async () => { const j = await fetch("/api/outdoors", { cache: "no-store" }).then((r) => r.json()).catch(() => null); if (j?.vagas) set({ outdoors: j.vagas, precoOutdoor: j.preco ?? 29.9 }); },
  abrirOutdoor: (slot) => { const v = slot ? OUTDOOR_POR_ID[slot] : null; set({ outdoorSelecionado: v ? slot : null, loteSelecionado: v ? null : get().loteSelecionado, painelEmpresa: false, painelEscritorio: false, alvoCamera: v ? [v.pos[0] * 0.82, 0.5, v.pos[1] * 0.82] : get().alvoCamera }); },
  pagarOutdoor: async (slot, frase) => {
    set({ pagando: true });
    try {
      const r = await fetch(`/api/outdoors/${encodeURIComponent(slot)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ frase }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      set({ pix: { id: j.id, lote: `outdoor:${slot}`, valor: j.valor, codigo: j.codigo, qrBase64: j.qrBase64, expiraEm: j.expiraEm, status: "pendente", tipo: "outdoor" } });
      void get().carregarOutdoors(); return null;
    } catch (e) { return (e as Error).message; } finally { set({ pagando: false }); }
  },
  terrenos: {}, meu: null, usuario: null, admin: false, pagamentoLigado: false, preco: 99, minutosReserva: 10, desvioRelogio: 0, pagando: false, pix: null, painelEscritorio: false, abaEscritorio: "predio", rascunhoEscritorio: null, salvandoEscritorio: false, carregado: false, loteSelecionado: null, loteHover: null, painelEmpresa: false, rascunho: null, alvoCamera: null,

  carregar: async () => {
    void get().carregarOutdoors();
    try {
      const [t, u] = await Promise.all([
        fetch("/api/terrenos").then((r) => r.json()).catch(() => ({ terrenos: [], meu: null })),
        fetch("/api/workend/eu").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const terrenos: Record<string, Terreno> = {};
      for (const x of (t.terrenos ?? []) as Terreno[]) terrenos[x.chave] = x;
      set({ terrenos, vagas: t.vagas ?? {}, meu: t.meu ?? null, usuario: u && u.id ? u : null, admin: !!t.admin, pagamentoLigado: !!t.pagamento, preco: t.preco ?? 99, minutosReserva: t.minutosReserva ?? 10, desvioRelogio: t.agora ? new Date(t.agora).getTime() - Date.now() : 0, carregado: true });
      // veio do cadastro com ?lote=: já abre o lote escolhido
      const busca = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const pedido = busca?.get("lote") ?? null;
      if (pedido && LOTE_POR_CHAVE[pedido] && !get().loteSelecionado) { get().selecionarLote(pedido); if (u && u.id && !terrenos[pedido] && pedido !== PRACA_CHAVE && !busca?.get("pagamento")) get().abrirPainel(); }
    } catch (e) { console.warn("[mundo] sem servidor:", e); set({ carregado: true }); }
  },

  selecionarLote: (chave) => {
    const l = chave ? LOTE_POR_CHAVE[chave] : null;
    // lote duplo ativo: a câmera vai para o meio dos dois terrenos, onde fica o prédio
    let alvo: [number, number, number] | null = l ? [l.centro[0], 0.5, l.centro[1]] : null;
    if (l && chave) {
      const ts = get().terrenos; const t = ts[chave];
      const par = t?.anexoDe ? (t.status === "ativo" ? t.anexoDe : null) : Object.values(ts).find((x) => x.anexoDe === chave && x.status === "ativo")?.chave ?? null;
      const lp = par ? LOTE_POR_CHAVE[par] : null; if (lp) alvo = [(l.centro[0] + lp.centro[0]) / 2, 0.5, l.centro[1]];
    }
    set({ outdoorSelecionado: null, loteSelecionado: l ? chave : null, painelEmpresa: false, rascunho: null, painelEscritorio: false, rascunhoEscritorio: null, alvoCamera: alvo });
  },
  setLoteHover: (chave) => set({ loteHover: chave }),

  abrirPainel: () => {
    const { loteSelecionado, terrenos, usuario } = get(); if (!loteSelecionado || loteSelecionado === PRACA_CHAVE) return; // a praça não está à venda
    const t = terrenos[loteSelecionado];
    const ceo = t?.escritorio?.equipe.find((m) => m.papel === "ceo")?.nome ?? "";
    const atendente = t?.escritorio?.equipe.find((m) => m.papel === "atendente")?.nome ?? "";
    set({ painelEmpresa: true, rascunho: { empresaNome: t?.empresaNome ?? usuario?.empresaNome ?? "", cor: t?.cor ?? CORES_EMPRESA[0], logoDataUrl: t?.temLogo ? `/api/terrenos/${encodeURIComponent(loteSelecionado)}/logo?v=${Date.now()}` : null, ceoNome: ceo, atendenteNome: atendente, nicho: t?.nicho ?? "negocios" } });
  },
  fecharPainel: () => set({ painelEmpresa: false, rascunho: null }),
  setRascunho: (r) => set((s) => ({ rascunho: s.rascunho ? { ...s.rascunho, ...r } : null })),

  reservar: async () => {
    const { loteSelecionado, rascunho, terrenos, usuario } = get();
    if (!loteSelecionado || !rascunho) return "Escolha um lote.";
    if (!usuario) return "Entre na sua conta do WorkEnd.";
    const atual = terrenos[loteSelecionado];
    const logoNovo = rascunho.logoDataUrl?.startsWith("data:") ? rascunho.logoDataUrl : null;
    const body = { empresaNome: rascunho.empresaNome, cor: rascunho.cor, ceoNome: rascunho.ceoNome, atendenteNome: rascunho.atendenteNome, nicho: rascunho.nicho, logoBase64: logoNovo, logoTipo: logoNovo ? (/^data:(image\/[a-z]+)/.exec(logoNovo)?.[1] ?? "image/png") : null, manterLogo: !logoNovo && !!rascunho.logoDataUrl && !!atual?.temLogo };
    const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ painelEmpresa: false, rascunho: null });
    await get().carregar();
    return null;
  },

  desistir: async () => {
    const { loteSelecionado } = get(); if (!loteSelecionado) return null;
    const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/reservar`, { method: "DELETE" });
    const j = r.ok ? null : await r.json().catch(() => null);
    await get().carregar();
    return r.ok ? null : j?.erro ?? "Não foi possível desistir agora.";
  },

  // Gera o Pix (QR Code + copia e cola) e mostra no cartão do lote; o mapa confere o pagamento a cada poucos segundos
  pagar: async (meses = 1, tipo = "lote") => {
    const { loteSelecionado } = get(); if (!loteSelecionado) return "Escolha um lote.";
    set({ pagando: true });
    try {
      const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/pagar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ meses, tipo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      set({ pix: { id: j.id, lote: loteSelecionado, valor: j.valor, codigo: j.codigo, qrBase64: j.qrBase64, expiraEm: j.expiraEm, status: "pendente", tipo } });
      return null;
    } catch (e) { return (e as Error).message; } finally { set({ pagando: false }); }
  },
  // Confere na API do Mercado Pago (pelo botão "já paguei", pelo relógio do cartão ou ao voltar com ?ref=) e recarrega
  conferirPagamento: async (ref) => {
    const r = await fetch(`/api/pagamentos/${encodeURIComponent(ref)}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    const status = r.ok ? (j.status as string) : "erro";
    const { pix } = get();
    if (pix && pix.id === ref) {
      if (status === "aprovado") {
        set({ pix: { ...pix, status: "aprovado" } }); await get().carregar();
        if (pix.tipo === "outdoor") await get().carregarOutdoors();
        if (pix.tipo === "barraca") await get().carregarPraca();
        if (pix.tipo === "personagem") { const { usePersonagem } = await import("./personagemStore"); await usePersonagem.getState().carregar(); }
        // crédito de troca de prédio comprado com o painel aberto: atualiza os contadores do rascunho
        const t = get().terrenos[pix.lote]; const r = get().rascunhoEscritorio;
        if (pix.tipo === "layout" && t?.escritorio && r) set({ rascunhoEscritorio: { ...r, trocasLayout: t.escritorio.trocasLayout, creditosLayout: t.escritorio.creditosLayout } });
      }
      else if (status === "rejeitado" || status === "cancelado" || status === "estornado") set({ pix: { ...pix, status: "rejeitado" } });
      else if (new Date(pix.expiraEm).getTime() < Date.now()) set({ pix: { ...pix, status: "expirado" } });
    } else await get().carregar();
    return status;
  },
  fecharPix: () => set({ pix: null }),

  // Painel "Montar escritório": edita uma cópia; a cena mostra a cópia enquanto o painel está aberto
  abrirEscritorio: (aba = "predio") => {
    const { loteSelecionado, terrenos } = get(); if (!loteSelecionado) return;
    const t = terrenos[loteSelecionado]; if (!t?.escritorio) return;
    set({ painelEscritorio: true, painelEmpresa: false, abaEscritorio: aba, rascunhoEscritorio: JSON.parse(JSON.stringify(t.escritorio)) as Escritorio });
  },
  setAbaEscritorio: (aba) => set({ abaEscritorio: aba }),
  fecharEscritorio: () => set({ painelEscritorio: false, rascunhoEscritorio: null }),
  setEscritorio: (e) => set({ rascunhoEscritorio: e }),
  salvarEscritorio: async () => {
    const { loteSelecionado, rascunhoEscritorio } = get(); if (!loteSelecionado || !rascunhoEscritorio) return "Nada pra salvar.";
    set({ salvandoEscritorio: true });
    try {
      const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/escritorio`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rascunhoEscritorio) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      set({ painelEscritorio: false, rascunhoEscritorio: null });
      await get().carregar();
      return null;
    } catch (e) { return (e as Error).message; } finally { set({ salvandoEscritorio: false }); }
  },

  sairWorkend: async () => { await fetch("/api/workend/sair", { method: "POST" }); set({ usuario: null, meu: null, painelEmpresa: false, rascunho: null }); await get().carregar(); },
  limparAlvo: () => set({ alvoCamera: null }),
}));

if (typeof window !== "undefined") (window as unknown as { __mundo: typeof useMundo }).__mundo = useMundo;
