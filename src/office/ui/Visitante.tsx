"use client";
// Tudo o que a frente "visitante" põe por cima da cidade (20/11/2026), num lugar só (montado em ui/Painel.tsx, ao lado
// da Recepção): a janela do passaporte, o aviso depois do atendimento, a caça de Natal e o "acontecendo agora".
// No celular a faixa fica à esquerda, logo abaixo do contador de pessoas; do tablet para cima, no meio, abaixo da barra
// (à esquerda fica o minimapa e à direita abrem os cartões).
import { useEffect, useSyncExternalStore } from "react";
import { usePersonagem } from "../personagemStore";
import { useMundo, modoMundo } from "../mundoStore";
import { usePassaporte } from "../passaporteStore";
import { JanelaPassaporte } from "./Passaporte";
import { AvisoPassaporte } from "./AvisoPassaporte";
import { CacaNatal } from "./CacaNatal";
import { AcontecendoAgora } from "./AcontecendoAgora";

const semAssinatura = () => () => {};
export function Visitante() {
  const ativo = usePersonagem((s) => s.ativo);
  const logado = useMundo((s) => !!s.usuario);
  const mundo = useSyncExternalStore(semAssinatura, modoMundo, () => false); // só no mapa da cidade (não no escritório da Nuvem)
  // com personagem: o passaporte já vem carregado (selo do botão, presentes achados, pedidos do dia)
  useEffect(() => { if (mundo && ativo && logado) void usePassaporte.getState().carregar(); }, [mundo, ativo, logado]);
  if (!mundo) return null;
  return (
    <>
      <div className="faixa-visitante pointer-events-none absolute left-2 top-[6.4rem] z-[15] flex max-w-[calc(100vw-1rem)] flex-col items-start gap-1.5 sm:left-1/2 sm:top-[4.4rem] sm:-translate-x-1/2 sm:flex-row sm:items-center">
        <CacaNatal />
        <AcontecendoAgora />
      </div>
      <AvisoPassaporte />
      <JanelaPassaporte />
    </>
  );
}
