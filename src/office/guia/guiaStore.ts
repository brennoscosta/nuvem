"use client";
// Guia passo a passo (21/11/2026, frente "tutorial"): o progresso e o roteiro aberto. Quem tem conta guarda no servidor
// (/api/workend/guia, tabela guia_progresso); o visitante guarda neste navegador (localStorage). Os fatos (perfil
// completo, lote pago, personagem ativo…) vêm sempre do servidor; sem conta, todos são "não".
import { create } from "zustand";
import { FATOS_VAZIOS, ehPassoId, ehRoteiro, ehTelaGuia, type EstadoGuiaServidor, type IdRoteiro, type ProgressoGuia, type TelaGuia } from "../data/guias";
import type { CtxGuia, Passo, Roteiro } from "./tipos";

const CHAVE_LOCAL = "workend-guia-v1"; // visitante: progresso neste navegador
const CHAVE_SESSAO = "workend-guia-sessao"; // o que já abriu sozinho nesta visita (o guia volta na próxima entrada)
type Local = Pick<EstadoGuiaServidor, "progresso" | "telas">;
const memoria: { local: Local; sessao: string[] } = { local: { progresso: {}, telas: [] }, sessao: [] }; // sem storage

function lerLocal(): Local {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? "null") as Local | null;
    if (!j || typeof j !== "object") return memoria.local;
    const progresso: Local["progresso"] = {};
    for (const [k, v] of Object.entries(j.progresso ?? {})) if (ehRoteiro(k) && v) progresso[k] = { feitos: (v.feitos ?? []).filter(ehPassoId).slice(0, 80), dispensado: !!v.dispensado, concluido: !!v.concluido };
    return { progresso, telas: (j.telas ?? []).filter(ehTelaGuia) };
  } catch { return memoria.local; }
}
function gravarLocal(l: Local) { memoria.local = l; try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(l)); } catch { /* sem storage: fica só nesta carga */ } }
export function jaAbriuNaSessao(chave: string) {
  try { return (JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? "[]") as string[]).includes(chave); } catch { return memoria.sessao.includes(chave); }
}
export function marcarSessao(chave: string) {
  memoria.sessao = [...new Set([...memoria.sessao, chave])];
  try { const l = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? "[]") as string[]; sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify([...new Set([...l, chave])])); } catch { /* sem storage */ }
}

export interface AtivoGuia { roteiro: IdRoteiro; manual: boolean; vez: number }
interface Estado extends EstadoGuiaServidor {
  carregado: boolean;
  ativo: AtivoGuia | null;
  carregar: () => Promise<void>;
  abrir: (roteiro: IdRoteiro, manual: boolean) => void;
  fechar: () => void;
  marcar: (roteiro: IdRoteiro, passos: string[]) => void;
  dispensar: (roteiro: IdRoteiro) => void;
  concluir: (roteiro: IdRoteiro) => void;
  visitar: (tela: TelaGuia) => void;
}

const enviar = (corpo: Record<string, unknown>) => { void fetch("/api/workend/guia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo), keepalive: true }).catch(() => null); };
let vez = 0;

export const useGuia = create<Estado>((set, get) => {
  // muda o progresso de um roteiro: na tela na hora; no servidor (conta) ou no navegador (visitante)
  const mudar = (roteiro: IdRoteiro, f: (p: ProgressoGuia) => ProgressoGuia, corpo: Record<string, unknown>) => {
    const atual = get().progresso[roteiro] ?? { feitos: [], dispensado: false, concluido: false };
    const progresso = { ...get().progresso, [roteiro]: f(atual) };
    set({ progresso });
    if (get().logado) enviar({ roteiro, ...corpo }); else gravarLocal({ progresso, telas: get().telas });
  };
  return {
    logado: false, nome: "", fatos: FATOS_VAZIOS, progresso: {}, telas: [], carregado: false, ativo: null,
    carregar: async () => {
      const j = (await fetch("/api/workend/guia", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Partial<EstadoGuiaServidor> | null;
      if (j?.logado) set({ logado: true, nome: j.nome ?? "", fatos: { ...FATOS_VAZIOS, ...j.fatos }, progresso: j.progresso ?? {}, telas: j.telas ?? [], carregado: true });
      else set({ logado: false, nome: "", fatos: FATOS_VAZIOS, ...lerLocal(), carregado: true });
    },
    abrir: (roteiro, manual) => {
      marcarSessao(`roteiro:${roteiro}`); // aberto nesta visita: não reabre sozinho até a próxima entrada
      set({ ativo: { roteiro, manual, vez: ++vez } });
      if (manual && get().progresso[roteiro]?.dispensado) mudar(roteiro, (p) => ({ ...p, dispensado: false }), { reabrir: true });
    },
    fechar: () => set({ ativo: null }),
    marcar: (roteiro, passos) => {
      const novos = passos.filter((p) => ehPassoId(p) && !(get().progresso[roteiro]?.feitos ?? []).includes(p));
      if (novos.length) mudar(roteiro, (p) => ({ ...p, feitos: [...p.feitos, ...novos] }), { feitos: novos });
    },
    dispensar: (roteiro) => { mudar(roteiro, (p) => ({ ...p, dispensado: true }), { dispensar: true }); set({ ativo: null }); },
    concluir: (roteiro) => { if (!get().progresso[roteiro]?.concluido) mudar(roteiro, (p) => ({ ...p, concluido: true }), { concluir: true }); },
    visitar: (tela) => {
      if (get().telas.includes(tela)) return;
      const telas = [...get().telas, tela];
      set({ telas });
      if (get().logado) enviar({ tela }); else gravarLocal({ progresso: get().progresso, telas });
    },
  };
});

// um passo está feito? fato: pelo servidor; visita: abriu a tela; manual: tocou em Seguir
export function passoFeito(p: Passo, roteiro: IdRoteiro, e: Pick<EstadoGuiaServidor, "fatos" | "telas" | "progresso">) {
  if (p.tipo === "fato") return !!(p.fato && e.fatos[p.fato]);
  const feitos = e.progresso[roteiro]?.feitos ?? [];
  if (p.tipo === "visita") return (!!p.tela && e.telas.includes(p.tela)) || feitos.includes(p.id);
  return feitos.includes(p.id);
}
export const passosDoRoteiro = (r: Roteiro, c: CtxGuia) => r.passos.filter((p) => !p.quando || p.quando(c));
export const pendentes = (r: Roteiro, c: CtxGuia, e: Pick<EstadoGuiaServidor, "fatos" | "telas" | "progresso">) => passosDoRoteiro(r, c).filter((p) => !p.ultimo && !p.opcional && !passoFeito(p, r.id, e));

// o contexto de agora (quem é, o que já fez, tamanho da tela) para escolher roteiros e montar os textos
export function ctxAgora(tela: CtxGuia["tela"]): CtxGuia {
  const s = useGuia.getState();
  return { logado: s.logado, nome: s.nome, fatos: s.fatos, celular: typeof window !== "undefined" && window.innerWidth <= 640, tela };
}

// o roteiro que abre sozinho: o primeiro da tela que vale nesta situação, não foi dispensado e ainda tem passo pendente
export function escolherAuto(roteiros: Roteiro[], gatilho: Roteiro["gatilho"], c: CtxGuia, ignorarSessao = false): Roteiro | null {
  const s = useGuia.getState();
  for (const r of roteiros) {
    if (r.tela !== c.tela || r.gatilho !== gatilho || (r.quando && !r.quando(c))) continue;
    const p = s.progresso[r.id];
    if (p?.dispensado || (!ignorarSessao && jaAbriuNaSessao(`roteiro:${r.id}`))) continue;
    if (pendentes(r, c, s).length) return r;
  }
  return null;
}
// pedido pela URL: ?guia=0 desliga, ?guia=1 abre sozinho mesmo em navegador automático, ?guia=<roteiro> abre aquele
export function pedidoDaUrl(): { desligado: boolean; forcar: boolean; roteiro: IdRoteiro | null } {
  const q = new URLSearchParams(window.location.search);
  const g = q.get("guia") ?? (q.get("tour") === "1" ? "1" : q.get("tour") === "0" ? "0" : null);
  return { desligado: g === "0", forcar: g === "1", roteiro: ehRoteiro(g) ? g : null };
}
// robôs e testes automáticos não recebem o guia por cima (só com ?guia=1)
export const navegadorAutomatico = () => typeof navigator !== "undefined" && navigator.webdriver === true;
