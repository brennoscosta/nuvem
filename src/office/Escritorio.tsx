"use client";
import dynamic from "next/dynamic";
import { Painel } from "./ui/Painel";

const Cena = dynamic(() => import("./scene/Cena").then((m) => m.Cena), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-[#5B6472]">Carregando o escritório…</div> });

export function Escritorio() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#DFE5EC] font-sans">
      <Cena />
      <Painel />
    </div>
  );
}
