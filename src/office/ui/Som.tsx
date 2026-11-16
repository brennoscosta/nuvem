"use client";
// Botão do som ambiente (12/11/2026): fica na barra do mapa. Desligado por padrão (src/office/som.ts).
// 16/11/2026: ícone próprio (sem emoji); no celular o som fica no painel de ajustes da barra de baixo.
import { useSyncExternalStore } from "react";
import { alternarSom, assinarSom, somLigado } from "../som";
import { Icone } from "./Icone";

export function BotaoSom() {
  const ligado = useSyncExternalStore(assinarSom, somLigado, () => false);
  return (
    <button onClick={alternarSom} aria-pressed={ligado} aria-label={ligado ? "Desligar o som da cidade" : "Ligar o som da cidade"} title={ligado ? "Som da cidade ligado: trânsito, pássaros, chuva e a música da praça" : "Ligar o som da cidade"}
      className="hud-btn hud-so-pc">
      <Icone nome={ligado ? "som" : "mudo"} tamanho={18} /><span className="hud-rotulo">{ligado ? "Som ligado" : "Som"}</span>
    </button>
  );
}
