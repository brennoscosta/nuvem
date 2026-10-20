"use client";
import { create } from "zustand";
import type { AreaId, Nivel } from "./data/org";
import { NIVEL, AREAS } from "./data/org";
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
  falaPublica?: string; // o que um visitante vê
}

export interface NovoAgente { nome: string; area: AreaId; nivel: Nivel; funcao: string; personalidade: string; boneco: string }

interface Estado {
  agentes: Record<string, Agente>;
  ordem: string[];
  eventos: Evento[]; // fila consumida pela cena
  historico: Evento[]; // últimos eventos (barra lateral)
  selecionado: string | null;
  hover: string | null; // agente sob o mouse (menu rápido)
  menuReuniao: string | null; // agente que está convocando
  reuniaoAtiva: { convocadorId: string; participantes: string[]; setores: AreaId[]; inicio: number } | null;
  modalContratar: boolean;
  sirene: boolean;
  simulando: boolean;
  online: boolean; // banco + IA disponíveis
  checado: boolean; // já consultou o servidor pelo menos uma vez
  admin: boolean; // sessão de admin válida
  senhaConfigurada: boolean;
  modalLogin: boolean;
  abaPedida: string | null; // aba que o painel deve abrir ao selecionar (ex.: "tarefas" ao clicar no balão de concluído)
  vista: "dentro" | "fora"; // por dentro (planta) ou por fora (prédio de vidro + mural)
  setVista: (v: "dentro" | "fora") => void;
  andar: 0 | 1; // andar que está sendo visto (por dentro)
  setAndar: (a: 0 | 1) => void;
  statusServidor: { banco: string; ia: string; detalhe?: string } | null;
  carregarDoServidor: () => Promise<void>;
  login: (senha: string) => Promise<string | null>;
  logout: () => Promise<void>;
  setModalLogin: (v: boolean) => void;
  setAbaPedida: (v: string | null) => void;
  contratar: (dados: NovoAgente) => Promise<Agente | null>;
  demitir: (id: string) => Promise<void>;
  promover: (id: string, nivel: Nivel) => Promise<void>;
  atualizarLocal: (id: string, campos: Partial<Agente>) => void;
  emitir: (agenteId: string, tipo: TipoEvento, texto?: string, payload?: Record<string, unknown>) => void;
  consumirEventos: () => Evento[];
  setStatus: (id: string, status: Status, fala?: string) => void;
  selecionar: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setMenuReuniao: (id: string | null) => void;
  convocarReuniao: (convocadorId: string, setores: AreaId[]) => Promise<void>;
  encerrarReuniao: () => void;
  setModal: (v: boolean) => void;
  setSirene: (v: boolean) => void;
  setSimulando: (v: boolean) => void;
  mesasOcupadas: () => Set<string>;
}

let seq = 1;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

interface AgenteServidor { id: string; nome: string; area: AreaId; nivel: Nivel; funcao: string; personalidade?: string; boneco: string; mesaId: string | null; criadoEm: string; falaPublica?: string }

function doServidor(a: AgenteServidor, ocupadas: Set<string>): Agente | null {
  let mesaId = a.mesaId;
  // mesa inexistente (planta mudou), ocupada ou de outra área: realoca. Área desconhecida (setor antigo): cai na diretoria/planejamento.
  const area: AreaId = AREAS[a.area] ? a.area : (a.nivel === "diretor" || a.nivel === "ceo" ? "diretoria" : "planejamento");
  const sala = salaDoNivel(area, a.nivel);
  if (!mesaId || !MESA[mesaId] || MESA[mesaId].sala !== sala || ocupadas.has(mesaId)) { const m = mesaParaNivel(area, a.nivel, ocupadas); if (!m) return null; mesaId = m.id; }
  ocupadas.add(mesaId);
  return { id: a.id, nome: a.nome, area, nivel: a.nivel, funcao: a.funcao, personalidade: a.personalidade ?? "", boneco: a.boneco, mesaId, sala: salaDoNivel(area, a.nivel), status: "disponivel", criadoEm: new Date(a.criadoEm).getTime(), tarefasConcluidas: 0, gastoHoje: 0, real: true, falaPublica: a.falaPublica };
}

export const useEscritorio = create<Estado>((set, get) => ({
  agentes: {},
  ordem: [],
  eventos: [],
  historico: [],
  selecionado: null,
  hover: null,
  menuReuniao: null,
  reuniaoAtiva: null,
  modalContratar: false,
  sirene: false,
  simulando: false,
  online: false,
  checado: false,
  admin: false,
  senhaConfigurada: false,
  modalLogin: false,
  abaPedida: null,
  vista: "dentro",
  andar: 0,
  statusServidor: null,

  mesasOcupadas: () => new Set(Object.values(get().agentes).map((a) => a.mesaId)),

  carregarDoServidor: async () => {
    const primeiraCarga = !get().checado;
    try {
      const st = await fetch("/api/status").then((r) => r.json());
      set({ statusServidor: st, online: st.banco === "ok", checado: true, admin: !!st.admin, senhaConfigurada: !!st.senhaConfigurada });
      if (st.banco !== "ok") return;
      const lista: AgenteServidor[] = await fetch("/api/agentes").then((r) => r.json());
      const ocupadas = new Set<string>(); const agentes: Record<string, Agente> = {}; const ordem: string[] = [];
      for (const a of lista) { const ag = doServidor(a, ocupadas); if (ag) { agentes[ag.id] = ag; ordem.push(ag.id); } }
      // agentes já na cena mantêm status; a mesa é a que o servidor manda (se mudou de sala, o boneco anda até a nova)
      const atuais = get().agentes;
      for (const id of ordem) if (atuais[id]) agentes[id] = { ...agentes[id], status: atuais[id].status, fala: atuais[id].fala ?? agentes[id].falaPublica, tarefasConcluidas: atuais[id].tarefasConcluidas, gastoHoje: atuais[id].gastoHoje };
      set({ agentes, ordem });
      // quem apareceu depois da primeira carga (contratado em outra aba/sessão) entra pelo elevador;
      // na primeira carga todo mundo já nasce sentado na própria mesa (ninguém "chega andando" ao abrir a tela)
      if (primeiraCarga) return;
      for (const id of ordem) if (!atuais[id]) get().emitir(id, "contratado", `${agentes[id].nome} entrou como ${NIVEL[agentes[id].nivel].nome}`);
    } catch (e) { console.warn("[escritorio] sem servidor:", e); set({ online: false, checado: true }); }
  },

  login: async (senha) => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return j.erro ?? "Falha no login"; }
    set({ admin: true, modalLogin: false });
    await get().carregarDoServidor();
    return null;
  },
  logout: async () => { await fetch("/api/auth", { method: "DELETE" }); set({ admin: false, selecionado: null, modalContratar: false }); await get().carregarDoServidor(); },
  setModalLogin: (v) => set({ modalLogin: v }),
  setAbaPedida: (v) => set({ abaPedida: v }),
  setVista: (v) => set({ vista: v, selecionado: null, hover: null }),
  setAndar: (a) => set({ andar: a, selecionado: null, hover: null }),

  contratar: async (dados) => {
    if (!get().checado) await get().carregarDoServidor();
    if (get().online && !get().admin) throw new Error("Faça login como admin pra contratar.");
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
  setHover: (id) => set({ hover: id }),
  setMenuReuniao: (id) => set({ menuReuniao: id }),

  // Chama pra sala de reunião: o convocador + só o gerente de cada setor escolhido (ou o diretor, se não houver gerente)
  convocarReuniao: async (convocadorId, setores) => {
    const s = get(); const conv = s.agentes[convocadorId]; if (!conv) return;
    const todos = Object.values(s.agentes);
    const participantes: string[] = [convocadorId];
    for (const area of setores) {
      const ger = todos.find((a) => a.area === area && a.nivel === "gerente") ?? todos.find((a) => a.area === area && a.nivel === "diretor");
      if (ger && !participantes.includes(ger.id)) participantes.push(ger.id);
    }
    const nomes = participantes.slice(1).map((id) => s.agentes[id].nome);
    const texto = nomes.length ? `Reunião com ${nomes.join(", ")}` : "Foi pra sala de reunião (ninguém dos setores escolhidos ainda)";
    set({ reuniaoAtiva: { convocadorId, participantes, setores, inicio: Date.now() }, menuReuniao: null });
    participantes.forEach((id, i) => get().emitir(id, "reuniao", i === 0 ? texto : `Reunião chamada por ${conv.nome}`, { assento: i }));
    if (conv.real) fetch("/api/reunioes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ convocadorId, participantes, setores }) }).catch(() => {});
  },

  encerrarReuniao: () => {
    const r = get().reuniaoAtiva; if (!r) return;
    r.participantes.forEach((id) => get().agentes[id] && get().emitir(id, "voltou", "Reunião encerrada"));
    set({ reuniaoAtiva: null });
  },
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
