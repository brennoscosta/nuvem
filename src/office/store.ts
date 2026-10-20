"use client";
import { create } from "zustand";
import type { AreaId, Nivel } from "./data/org";
import { NIVEL } from "./data/org";
import { MESAS, MESA, mesaParaNivel, salaDoNivel, type Mesa } from "./data/layout";
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
  gastoHoje: number; // simulado, em R$
}

interface Estado {
  agentes: Record<string, Agente>;
  ordem: string[];
  eventos: Evento[]; // fila consumida pela cena
  historico: Evento[]; // últimos eventos (barra lateral)
  selecionado: string | null;
  modalContratar: boolean;
  sirene: boolean;
  simulando: boolean;
  contratar: (dados: Omit<Agente, "id" | "mesaId" | "sala" | "status" | "criadoEm" | "tarefasConcluidas" | "gastoHoje">) => Agente | null;
  demitir: (id: string) => void;
  promover: (id: string, nivel: Nivel) => void;
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

export const useEscritorio = create<Estado>((set, get) => ({
  agentes: {},
  ordem: [],
  eventos: [],
  historico: [],
  selecionado: null,
  modalContratar: false,
  sirene: false,
  simulando: true,

  mesasOcupadas: () => new Set(Object.values(get().agentes).map((a) => a.mesaId)),

  contratar: (dados) => {
    const mesa = mesaParaNivel(dados.area, dados.nivel, get().mesasOcupadas());
    if (!mesa) return null;
    if (dados.nivel === "ceo" && Object.values(get().agentes).some((a) => a.nivel === "ceo")) return null;
    const a: Agente = { ...dados, id: uid("ag"), mesaId: mesa.id, sala: salaDoNivel(dados.area, dados.nivel), status: "chegando", criadoEm: Date.now(), tarefasConcluidas: 0, gastoHoje: 0 };
    set((s) => ({ agentes: { ...s.agentes, [a.id]: a }, ordem: [...s.ordem, a.id] }));
    get().emitir(a.id, "contratado", `${a.nome} entrou como ${NIVEL[a.nivel].nome} de ${a.area}`);
    return a;
  },

  demitir: (id) => {
    get().emitir(id, "demitido", "foi desligado(a)");
  },

  promover: (id, nivel) => {
    const a = get().agentes[id]; if (!a) return;
    const ocupadas = get().mesasOcupadas(); ocupadas.delete(a.mesaId);
    const mesa: Mesa | undefined = mesaParaNivel(a.area, nivel, ocupadas);
    if (!mesa) return;
    set((s) => ({ agentes: { ...s.agentes, [id]: { ...a, nivel, mesaId: mesa.id, sala: salaDoNivel(a.area, nivel) } } }));
    get().emitir(id, "promovido", `foi promovido(a) a ${NIVEL[nivel].nome}`);
  },

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
    if (status === "comemorando") { extra.tarefasConcluidas = a.tarefasConcluidas + 1; extra.gastoHoje = +(a.gastoHoje + 0.4 + Math.random() * 2.2).toFixed(2); }
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
