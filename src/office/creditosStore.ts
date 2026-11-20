"use client";
// Saldo de créditos de quem está logado (20/11/2026, frente "creditos"): topo do mapa, painel e o botão único de cobrança
// (ui/Cobrar.tsx). 1 crédito = R$ 1,00. O servidor é quem decide: aqui é só para mostrar e escolher o botão.
import { create } from "zustand";

export interface SaldoCreditos { comprado: number; bonus: number; total: number }
interface Estado { saldo: SaldoCreditos | null; logado: boolean; carregado: boolean; carregar: () => Promise<void> }
let emCurso: Promise<void> | null = null;
export const useCreditos = create<Estado>((set) => ({
  saldo: null, logado: false, carregado: false,
  carregar: () => (emCurso ??= fetch("/api/workend/creditos/saldo", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j) set({ saldo: j.saldo ?? null, logado: !!j.logado, carregado: true }); else set({ carregado: true }); })
    .catch(() => { set({ carregado: true }); })
    .finally(() => { emCurso = null; })),
}));
export const fmtCreditos = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// chave do clique: o mesmo clique repetido (rede lenta, toque duplo) devolve a mesma cobrança no servidor
export const novoIdem = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID().replace(/-/g, "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`);
if (typeof window !== "undefined") (window as unknown as { __creditos: typeof useCreditos }).__creditos = useCreditos;
