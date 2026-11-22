"use client";
// Barra simples para quem chega (WE-22, 22/11/2026). Visitante novo = sem conta, ou na primeira visita deste navegador com
// uma conta que ainda não tem personagem nem lote. Ele vê na barra de baixo só Andar, Passear, Aproximar, Afastar e Ajustes,
// com nome (girar, vistas, seguir, voltar ao início, bicicleta e "Como mexer" ficam dentro de Ajustes), e na barra de cima
// só a marca, as pessoas na cidade, criar o personagem e entrar. Quem já usa continua com a barra completa.
// "Mostrar todos os botões", em Ajustes, troca à mão e fica guardado neste navegador.
// Já visitou: a marca workend-ja-visitou no localStorage (com try/catch). A aba que chegou sem a marca continua como
// primeira visita até ser fechada (sessionStorage), mesmo recarregando a página.
import { useSyncExternalStore } from "react";
import { useMundo } from "../mundoStore";
import { usePersonagem } from "../personagemStore";

const CHAVE_VISITOU = "workend-ja-visitou";
const CHAVE_SESSAO = "workend-primeira-visita";
const CHAVE_BARRA = "workend-barra-completa"; // "1": todos os botões; "0": barra simples; sem valor: automático

let primeira: boolean | null = null;
export function primeiraVisita(): boolean {
  if (primeira !== null) return primeira;
  if (typeof window === "undefined") return true;
  try {
    if (window.sessionStorage.getItem(CHAVE_SESSAO) === "1") primeira = true;
    else if (window.localStorage.getItem(CHAVE_VISITOU)) primeira = false;
    else {
      primeira = true;
      window.localStorage.setItem(CHAVE_VISITOU, new Date().toISOString());
      window.sessionStorage.setItem(CHAVE_SESSAO, "1");
    }
  } catch { primeira = true; } // sem armazenamento: vale como primeira visita
  return primeira;
}

type Preferencia = "1" | "0" | null;
let preferencia: Preferencia | undefined;
const ouvintes = new Set<() => void>();
function lerPreferencia(): Preferencia {
  if (preferencia !== undefined) return preferencia;
  if (typeof window === "undefined") return null;
  try { const v = window.localStorage.getItem(CHAVE_BARRA); preferencia = v === "1" || v === "0" ? v : null; } catch { preferencia = null; }
  return preferencia;
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export function definirBarraCompleta(completa: boolean) {
  preferencia = completa ? "1" : "0";
  try { window.localStorage.setItem(CHAVE_BARRA, preferencia); } catch { /* sem armazenamento: vale só nesta visita */ }
  ouvintes.forEach((f) => f());
}

function decidir(p: Preferencia, logado: boolean, jaUsa: boolean) {
  if (p === "1") return false;
  if (p === "0") return true;
  const nova = primeiraVisita(); // marca a visita também de quem ainda não tem conta
  if (!logado) return true;
  return nova && !jaUsa;
}
export function useBarraSimples(): boolean {
  const p = useSyncExternalStore(assinar, lerPreferencia, () => null);
  const logado = useMundo((s) => !!s.usuario);
  const temLote = useMundo((s) => !!s.meu || s.meus.length > 0);
  const temPersonagem = usePersonagem((s) => !!s.meu);
  return decidir(p, logado, temLote || temPersonagem);
}
// fora do React (textos do guia, roteirosMundo.ts)
export function barraSimplesAgora(): boolean {
  const m = useMundo.getState();
  return decidir(lerPreferencia(), !!m.usuario, !!m.meu || m.meus.length > 0 || !!usePersonagem.getState().meu);
}
