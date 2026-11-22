"use client";
// Escolhe o que desenhar no mapa (12/11/2026): a cena 3D (scene/Cena3D) ou, em aparelho sem WebGL ou fraco demais, o
// mapa simples em 2D (ui/Mapa2D). Os dois são carregados à parte: quem fica no 2D não baixa a biblioteca 3D nem os
// modelos. ?mapa=2d força o 2D; a escolha do botão "Mapa simples" fica salva no aparelho (scene/qualidade).
// WE-20 (22/11/2026): sem o 3D por conta do aparelho (sem WebGL ou já caiu antes) e chegando por link de uma loja aberta,
// a pessoa vai para a página da loja (/loja/N, sem WebGL), que tem a conversa, os produtos e os contatos.
import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { usarMapa2D, motivo2D, paginaDaLojaDoLink, veioPorLinkDeLoja } from "./qualidade";
import { modoMundo, useMundo } from "../mundoStore";

const Carregando = () => <div className="flex h-full items-center justify-center text-sm text-[#5B6472]">Abrindo a cidade…</div>;
const AbrindoLoja = () => <div className="flex h-full items-center justify-center text-sm text-[#5B6472]">Abrindo a loja…</div>;
const Cena3D = dynamic(() => import("./Cena3D").then((m) => m.Cena3D), { ssr: false, loading: Carregando });
const Mapa2D = dynamic(() => import("../ui/Mapa2D").then((m) => m.Mapa2D), { ssr: false, loading: Carregando });
const semAssinatura = () => () => {};
const escolha = () => (modoMundo() && usarMapa2D() ? "2d" : "3d");

export function Cena() {
  const modo = useSyncExternalStore(semAssinatura, escolha, () => null);
  const indo = useIrParaPaginaDaLoja(modo === "2d");
  if (!modo) return <Carregando />;
  if (indo) return <AbrindoLoja />;
  return modo === "2d" ? <Mapa2D /> : <Cena3D />;
}
// espera os terrenos (para saber se a loja do link está aberta) e troca de página; true enquanto decide ou vai
function useIrParaPaginaDaLoja(no2d: boolean) {
  const motivo = no2d ? motivo2D() : null, automatico = motivo != null && veioPorLinkDeLoja();
  const carregado = useMundo((s) => s.carregado), terrenos = useMundo((s) => s.terrenos);
  const destino = automatico && carregado ? paginaDaLojaDoLink(terrenos, motivo === "sem-webgl") : null;
  useEffect(() => { if (destino) window.location.replace(destino); }, [destino]);
  return automatico && (!carregado || destino != null);
}
