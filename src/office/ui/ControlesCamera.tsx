"use client";
// Barra da câmera no mapa (11/11/2026): girar, aproximar/afastar, ver de cima, ver da rua, seguir meu personagem,
// passeio automático e voltar ao início, com a ajuda dos atalhos de teclado. Fica no canto de baixo à esquerda,
// acima da dica de navegação (os cartões ficam à direita).
import { useState, useSyncExternalStore } from "react";
import { useCamera, useHora, ATALHOS, type ComandoCamera } from "../cameraStore";
import { usePersonagem } from "../personagemStore";
import { modoMundo } from "../mundoStore";

// modoMundo() lê o endereço do navegador: no servidor é sempre falso. Para não dar erro de hidratação, a barra só aparece
// depois de montar no navegador (o mesmo jeito do botão de gráficos).
const semAssinatura = () => () => {};
const useNoMundo = () => useSyncExternalStore(semAssinatura, modoMundo, () => false);

const ICONE: Record<string, string> = {
  girarEsq: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4", girarDir: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4",
  aproximar: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM11 8v6M8 11h6M20 20l-4-4", afastar: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM8 11h6M20 20l-4-4",
  cima: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v18M4 7.5l8 4.5 8-4.5", rua: "M3 20h18M6 20l3-14h6l3 14M12 8v2M12 13v2M12 18v1",
  seguir: "M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 20c0-3.3 2.7-6 6-6s6 2.7 6 6M3 12h2M19 12h2", passeio: "M12 3a9 9 0 1 0 9 9M21 3v6h-6M12 8v4l3 2",
  inicio: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10",
  sol: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  lua: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z", auto: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
};
// dia e noite: automático (Brasília) → sempre dia → sempre noite
function BotaoHora() {
  const modo = useHora((s) => s.modo); const proximo = useHora((s) => s.proximo);
  const rotulo = modo === "auto" ? "Hora automática (Brasília). Clique para sempre dia" : modo === "dia" ? "Sempre dia. Clique para sempre noite" : "Sempre noite. Clique para a hora automática";
  const icone = modo === "auto" ? ICONE.auto : modo === "dia" ? ICONE.sol : ICONE.lua;
  return <button type="button" onClick={proximo} title={rotulo} aria-label={rotulo} className={`grid h-9 w-9 place-items-center rounded-xl transition active:scale-95 ${modo === "noite" ? "bg-[#1E2A4A] text-[#C9D6FF]" : modo === "dia" ? "bg-[#FFF4D6] text-[#7A5A00]" : "text-white/85 hover:bg-white/15"}`}><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icone} /></svg></button>;
}
function Botao({ tipo, rotulo, ativo = false }: { tipo: ComandoCamera; rotulo: string; ativo?: boolean }) {
  const pedir = useCamera((s) => s.pedir);
  return (
    <button type="button" onClick={() => pedir(tipo)} title={rotulo} aria-label={rotulo} aria-pressed={ativo}
      className={`grid h-9 w-9 place-items-center rounded-xl transition active:scale-95 ${ativo ? "bg-[#1D4ED8] text-white shadow-[0_0_0_2px_rgba(91,157,255,.5)]" : "text-white/85 hover:bg-white/15"}`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONE[tipo]} /></svg>
    </button>
  );
}

export function ControlesCamera() {
  const { seguir, passeio, cima, rua } = useCamera();
  const personagem = usePersonagem((s) => s.ativo);
  const [ajuda, setAjuda] = useState(false);
  const noMundo = useNoMundo();
  if (!noMundo) return null;
  const sep = <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden="true" />;
  return (
    <div data-tour="camera" className="pointer-events-auto absolute bottom-14 left-3 z-10 hidden items-center gap-0.5 rounded-2xl bg-[#111418]/75 p-1 shadow-xl backdrop-blur sm:flex" role="toolbar" aria-label="Câmera">
      <Botao tipo="girarEsq" rotulo="Girar para a esquerda (Q)" />
      <Botao tipo="girarDir" rotulo="Girar para a direita (E)" />
      {sep}
      <Botao tipo="aproximar" rotulo="Aproximar (+)" />
      <Botao tipo="afastar" rotulo="Afastar (−)" />
      {sep}
      <Botao tipo="cima" rotulo="Ver de cima (T)" ativo={cima} />
      <Botao tipo="rua" rotulo="Ver da altura da rua (V)" ativo={rua} />
      {personagem && <Botao tipo="seguir" rotulo="Seguir meu personagem (F)" ativo={seguir} />}
      <Botao tipo="passeio" rotulo="Passeio automático (P)" ativo={passeio} />
      {sep}
      <Botao tipo="inicio" rotulo="Voltar ao início (H)" />
      <BotaoHora />
      <span className="relative">
        <button type="button" onClick={() => setAjuda((v) => !v)} aria-expanded={ajuda} title="Atalhos do teclado" className="grid h-9 w-9 place-items-center rounded-xl text-[13px] font-black text-white/70 hover:bg-white/15">?</button>
        {ajuda && (
          <span className="absolute bottom-11 left-0 block w-64 rounded-xl bg-[#111418]/95 p-3 text-[11px] text-white/85 shadow-2xl">
            <b className="mb-1 block text-white">Atalhos do teclado</b>
            {ATALHOS.map(([k, o]) => <span key={k} className="flex justify-between gap-3 py-0.5"><kbd className="rounded bg-white/10 px-1.5 font-semibold text-white">{k}</kbd><span className="text-right">{o}</span></span>)}
          </span>
        )}
      </span>
    </div>
  );
}

// No celular: só girar e voltar ao início, ao lado do botão de gráficos
export function ControlesCameraCelular() {
  const pedir = useCamera((s) => s.pedir);
  const noMundo = useNoMundo();
  if (!noMundo) return null;
  return (
    <span className="pointer-events-auto flex gap-1 rounded-xl bg-[#111418]/70 p-0.5 backdrop-blur sm:hidden">
      {(["girarEsq", "girarDir", "inicio"] as ComandoCamera[]).map((t) => (
        <button key={t} type="button" onClick={() => pedir(t)} aria-label={t === "inicio" ? "Voltar ao início" : t === "girarEsq" ? "Girar para a esquerda" : "Girar para a direita"} className="grid h-8 w-8 place-items-center rounded-lg text-white/85">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONE[t]} /></svg>
        </button>
      ))}
    </span>
  );
}
