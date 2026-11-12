"use client";
// Escolhe o que desenhar no mapa (12/11/2026): a cena 3D (scene/Cena3D) ou, em aparelho sem WebGL ou fraco demais, o
// mapa simples em 2D (ui/Mapa2D). Os dois são carregados à parte: quem fica no 2D não baixa a biblioteca 3D nem os
// modelos. ?mapa=2d força o 2D; a escolha do botão "Mapa simples" fica salva no aparelho (scene/qualidade).
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { usarMapa2D } from "./qualidade";
import { modoMundo } from "../mundoStore";

const Carregando = () => <div className="flex h-full items-center justify-center text-sm text-[#5B6472]">Abrindo a cidade…</div>;
const Cena3D = dynamic(() => import("./Cena3D").then((m) => m.Cena3D), { ssr: false, loading: Carregando });
const Mapa2D = dynamic(() => import("../ui/Mapa2D").then((m) => m.Mapa2D), { ssr: false, loading: Carregando });
const semAssinatura = () => () => {};
const escolha = () => (modoMundo() && usarMapa2D() ? "2d" : "3d");

export function Cena() {
  const modo = useSyncExternalStore(semAssinatura, escolha, () => null);
  if (!modo) return <Carregando />;
  return modo === "2d" ? <Mapa2D /> : <Cena3D />;
}
