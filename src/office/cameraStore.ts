"use client";
// Controles de câmera do mapa (11/11/2026, pedido do dono: "movimentação de câmera"). A barra de botões (ui/ControlesCamera)
// e o teclado pedem comandos; a cena (scene/CameraMundo) executa com animação suave.
import { create } from "zustand";

export type ComandoCamera = "girarEsq" | "girarDir" | "aproximar" | "afastar" | "cima" | "rua" | "inicio" | "seguir" | "passeio";
interface EstadoCamera {
  pedido: { tipo: ComandoCamera; n: number } | null;
  seguir: boolean; passeio: boolean; cima: boolean; rua: boolean;
  pedir: (tipo: ComandoCamera) => void;
  set: (p: Partial<Pick<EstadoCamera, "seguir" | "passeio" | "cima" | "rua">>) => void;
}
let n = 0;
export const useCamera = create<EstadoCamera>((set) => ({
  pedido: null, seguir: false, passeio: false, cima: false, rua: false,
  pedir: (tipo) => set({ pedido: { tipo, n: ++n } }),
  set: (p) => set(p),
}));

// Atalhos de teclado (mostrados na ajuda da barra)
export const ATALHOS: [string, string][] = [
  ["W A S D ou setas", "mover"], ["Q / E", "girar"], ["+ / −", "aproximar e afastar"], ["T", "ver de cima"], ["V", "ver da rua"],
  ["F", "seguir meu personagem"], ["P", "passeio automático"], ["H", "voltar ao início"], ["duplo clique", "ir até o ponto"],
];
