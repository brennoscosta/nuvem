"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Painel } from "./ui/Painel";

const Cena = dynamic(() => import("./scene/Cena").then((m) => m.Cena), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-[#5B6472]">Carregando o escritório…</div> });

export function Escritorio() {
  // 21/11/2026: no iPhone a pinça que começava num balão, num cartão ou na barra ampliava o site inteiro (e os cartões
  // ficavam cortados na borda direita). No mapa a pinça é da câmera: o gesto do Safari (gesturestart) é barrado aqui e
  // o touch-action da .mapa-raiz (globals.css) faz o mesmo nos outros navegadores. As outras páginas continuam ampliando.
  useEffect(() => {
    const barra = (e: Event) => e.preventDefault();
    for (const t of ["gesturestart", "gesturechange"]) document.addEventListener(t, barra, { passive: false });
    return () => { for (const t of ["gesturestart", "gesturechange"]) document.removeEventListener(t, barra); };
  }, []);
  return (
    <div className="mapa-raiz relative h-dvh w-full overflow-hidden bg-[#DFE5EC] font-sans">
      <Cena />
      <Painel />
    </div>
  );
}
