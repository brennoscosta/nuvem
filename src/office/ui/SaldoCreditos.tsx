"use client";
// Saldo de créditos no topo do mapa e da barra do painel (20/11/2026, frente "creditos"): só para quem está logado;
// leva para /app/creditos. Atualiza sozinho depois de cada pagamento (creditosStore).
import { useEffect } from "react";
import { useCreditos, fmtCreditos } from "../creditosStore";
import { Icone } from "./Icone";

export function SaldoCreditos({ tema = "claro" }: { tema?: "claro" | "escuro" }) {
  const saldo = useCreditos((s) => s.saldo);
  const logado = useCreditos((s) => s.logado);
  const carregado = useCreditos((s) => s.carregado);
  const carregar = useCreditos((s) => s.carregar);
  useEffect(() => { if (!carregado) void carregar(); const t = setInterval(() => void carregar(), 60_000); return () => clearInterval(t); }, [carregado, carregar]);
  if (!logado || !saldo) return null;
  const cor = tema === "escuro" ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#F1F3F6] text-[#1D2128] hover:bg-[#E6E9EE]";
  return (
    <a href="/app/creditos" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${cor}`} title="Saldo de créditos" data-saldo-topo={saldo.total}>
      <Icone nome="carteira" tamanho={16} />
      <span>{fmtCreditos(saldo.total)}</span>
      <span className="hidden sm:inline font-normal opacity-75">créditos</span>
    </a>
  );
}
