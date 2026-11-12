"use client";
// Botão do som ambiente (12/11/2026): fica na barra do mapa. Desligado por padrão (src/office/som.ts).
import { useSyncExternalStore } from "react";
import { alternarSom, assinarSom, somLigado } from "../som";

export function BotaoSom() {
  const ligado = useSyncExternalStore(assinarSom, somLigado, () => false);
  return (
    <button onClick={alternarSom} aria-pressed={ligado} aria-label={ligado ? "Desligar o som da cidade" : "Ligar o som da cidade"} title={ligado ? "Som da cidade ligado: trânsito, pássaros, chuva e a música da praça" : "Ligar o som da cidade"}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ligado ? "bg-white/20 text-white" : "bg-white/10 text-white/70"}`}>
      <span aria-hidden>{ligado ? "🔊" : "🔇"}</span><span className="ml-1 hidden sm:inline">Som</span>
    </button>
  );
}
