"use client";
import { create } from "zustand";
import type { AreaId, Nivel } from "./data/org";
import { NIVEL } from "./data/org";
import { MESAS, MESA, mesaParaNivel, salaDoNivel } from "./data/layout";
import type { Evento, TipoEvento } from "./data/eventos";

export type Status = "chegando" | "disponivel" | "trabalhando" | "planejando" | "em_revisao" | "bloqueado" | "reuniao" | "pausa" | "fora" | "comemorando";

export interface Agente {
  id: string;
  nome: string;
  area: AreaId;
  nivel: Nivel;
  funcao: string;
  personalidade: string;
  boneco: string; // id do catálogo
  mesaId: string;
  sala: string;
  status: Status;
  fala?: string; // balão atual
  criadoEm: number;
  tarefasConcluidas: number;
  gastoHoje: number; // R$
  real: boolean; // veio do banco (agente de verdade) ou é simulado
}

export interface NovoAgente { nome: string; area: AreaId; nivel: Nivel; funcao: string; personalidade: string; boneco: string }

interface Estado {
  agentes: Record<string, Agente>;
  ordem: string[];
  eventos: Evento[]; // fila consumida pela cena
  historico: Evento[]; // últimos eventos (barra lateral)
  selecionado: string | null;
  modalContratar: boolean;
  sirene: boolean;
  simulando: boolean;
  online: boolean; // banco + IA disponíveis
  statusServidor: { banco: string; ia: string; detalhe?: string } | null;
  carregarDoServidor: () => Promise<void>;
  contratar: (dados: NovoAgente) => Promise<Agente | null>;
  demitir: (id: string) => Promise<void>;
  promover: (id: string, nivel: Nivel) => Promise<void>;
  atualizarLocal: (id: string, campos: Partial<Agente>) => void;
  emitir: (agenteId: string, tipo: TipoEvento, texto?: string, payload?: Record<string, unknown>) => void;
  consumirEventos: () => Evento[];
  setStatus: (id: string, status: Status, fala?: string) => void;
  selecionar: (id: string | null) => void;
  setModal: (v: boolean) => void;
  setSirene: (v: boolean) => void;
  setSimulando: (v: boolean) => void;
  mesasOcupadas: () => Set<string>;
}

let seq = 1;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

interface AgenteServidor { id: string; nome: string; area: AreaId; nivel: Nivel; funcao: string; personalidade: string; boneco: string; mesaId: string | null; criadoEm: string }

function doServidor(a: AgenteServidor, ocupadas: Set<string>): Agente | null {
  let mesaId = a.mesaId;
  if (!mesaId || ocupadas.has(mesaId)) { const m = mesaParaNivel(a.area, a.nivel, ocupadas); if (!m) return null; mesaId = m.id; }
  ocupadas.add(mesaId);
  return { id: a.id, nome: a.nome, area: a.area, nivel: a.nivel, funcao: a.funcao, personalidade: a.personalidade, boneco: a.boneco, mesaId, sala: salaDoNivel(a.area, a.nivel), status: "disponivel", criadoEm: new Date(a.criadoEm).getTime(), tarefasConcluidas: 0, gastoHoje: 0, real: true };
}

export const useEscritorio = create<Estado>((set, get) => ({
  agentes: {},
  ordem: [],
  eventos: [],
  historico: [],
  selecionado: null,
  modalContratar: false,
  sirene: false,
  simulando: false,
  online: false,
  statusServidor: null,

  mesasOcupadas: () => new Set(Object.values(get().agentes).map((a) => a.mesaId)),

  carregarDoServidor: async () => {
    try {
      const st = await fetch("/api/status").then((r) => r.json());
      set({ statusServidor: st, online: st.banco === "ok" });
      if (st.banco !== "ok") return;
      const lista: AgenteServidor[] = await fetch("/api/agentes").then((r) => r.json());
      const ocupadas = new Set<string>(); const agentes: Record<string, Agente> = {}; const ordem: string[] = [];
      for (const a of lista) { const ag = doServidor(a, ocupadas); if (ag) { agentes[ag.id] = ag; ordem.push(ag.id); } }
      // agentes já na cena mantêm status/mesa
      const atuais = get().agentes;
      for (const id of ordem) if (atuais[id]) agentes[id] = { ...agentes[id], status: atuais[id].status, fala: atuais[id].fala, mesaId: atuais[id].mesaId, tarefasConcluidas: atuais[id].tarefasConcluidas, gastoHoje: atuais[id].gastoHoje };
      set({ agentes, ordem });
      // quem acabou de aparecer e ainda não estava na cena: entra pelo elevador
      for (const id of ordem) if (!atuais[id]) get().emitir(id, "contratado", `${agentes[id].nome} entrou como ${NIVEL[agentes[id].nivel].nome}`);
    } catch (e) { console.warn("[escritorio] sem servidor:", e); set({ online: false }); }
  },

  contratar: async (dados) => {
    const mesa = mesaParaNivel(dados.area, dados.nivel, get().mesasOcupadas());
    if (!mesa) return null;
    if (dados.nivel === "ceo" && Object.values(get().agentes).some((a) => a.nivel === "ceo")) return null;
    if (get().online) {
      const r = await fetch("/api/agentes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...dados, mesaId: mesa.id }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.erro ?? "Falha ao contratar"); }
      const s: AgenteServidor = await r.json();
      const a = doServidor({ ...s, mesaId: mesa.id }, get().mesasOcupadas())!;
      a.status = "chegando";
      set((st) => ({ agentes: { ...st.agentes, [a.id]: a }, ordem: [...st.ordem, a.id] }));
      get().emitir(a.id, "contratado", `${a.nome} entrou como ${NIVEL[a.nivel].nome} de ${a.area}`);
      return a;
    }
    const a: Agente = { ...dados, id: uid("ag"), mesaId: mesa.id, sala: salaDoNivel(dados.area, dados.nivel), status: "chegando", criadoEm: Date.now(), tarefasConcluidas: 0, gastoHoje: 0, real: false };
    set((s) => ({ agentes: { ...s.agentes, [a.id]: a }, ordem: [...s.ordem, a.id] }));
    get().emitir(a.id, "contratado", `${a.nome} entrou como ${NIVEL[a.nivel].nome} de ${a.area}`);
    return a;
  },

  demitir: async (id) => {
    const a = get().agentes[id]; if (!a) return;
    if (a.real) await fetch(`/api/agentes/${id}`, { method: "DELETE" });
    get().emitir(id, "demitido", "foi desligado(a)");
  },

  promover: async (id, nivel) => {
    const a = get().agentes[id]; if (!a) return;
    const ocupadas = get().mesasOcupadas(); ocupadas.delete(a.mesaId);
    const mesa = mesaParaNivel(a.area, nivel, ocupadas);
    if (!mesa) return;
    if (a.real) await fetch(`/api/agentes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ nivel, mesaId: mesa.id }) });
    set((s) => ({ agentes: { ...s.agentes, [id]: { ...a, nivel, mesaId: mesa.id, sala: salaDoNivel(a.area, nivel) } } }));
    get().emitir(id, "promovido", `foi promovido(a) a ${NIVEL[nivel].nome}`);
  },

  atualizarLocal: (id, campos) => set((s) => (s.agentes[id] ? { agentes: { ...s.agentes, [id]: { ...s.agentes[id], ...campos } } } : {})),

  emitir: (agenteId, tipo, texto, payload) => {
    const ev: Evento = { id: uid("ev"), ts: Date.now(), agenteId, tipo, texto, payload };
    set((s) => ({ eventos: [...s.eventos, ev], historico: [ev, ...s.historico].slice(0, 40) }));
  },

  consumirEventos: () => {
    const evs = get().eventos;
    if (evs.length) set({ eventos: [] });
    return evs;
  },

  setStatus: (id, status, fala) => set((s) => {
    const a = s.agentes[id]; if (!a) return {};
    const extra: Partial<Agente> = {};
    if (status === "comemorando" && !a.real) { extra.tarefasConcluidas = a.tarefasConcluidas + 1; extra.gastoHoje = +(a.gastoHoje + 0.4 + Math.random() * 2.2).toFixed(2); }
    if (status === "comemorando" && a.real) extra.tarefasConcluidas = a.tarefasConcluidas + 1;
    return { agentes: { ...s.agentes, [id]: { ...a, status, fala, ...extra } } };
  }),

  selecionar: (id) => set({ selecionado: id }),
  setModal: (v) => set({ modalContratar: v }),
  setSirene: (v) => set({ sirene: v }),
  setSimulando: (v) => set({ simulando: v }),
}));

export function removerAgente(id: string) {
  useEscritorio.setState((s) => {
    const agentes = { ...s.agentes }; delete agentes[id];
    return { agentes, ordem: s.ordem.filter((x) => x !== id), selecionado: s.selecionado === id ? null : s.selecionado };
  });
}

export { MESAS, MESA };

if (typeof window !== "undefined") (window as unknown as { __esc: typeof useEscritorio }).__esc = useEscritorio;
