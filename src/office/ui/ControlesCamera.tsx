"use client";
// Barra da câmera no mapa (11/11/2026): girar, aproximar/afastar, ver de cima, ver da rua, seguir meu personagem,
// passeio automático e voltar ao início, com a ajuda dos atalhos de teclado. Fica no canto de baixo à esquerda,
// acima da dica de navegação (os cartões ficam à direita).
// 12/11/2026: voo de drone (O) e andar pela rua (C), com joystick na tela do celular e as dicas de cada modo.
import { useRef, useState, useSyncExternalStore } from "react";
import { useCamera, useHora, ATALHOS, joystick, type ComandoCamera } from "../cameraStore";
import { usePersonagem } from "../personagemStore";
import { modoMundo } from "../mundoStore";
import { usarMapa2D } from "../scene/qualidade";

// modoMundo() lê o endereço do navegador: no servidor é sempre falso. Para não dar erro de hidratação, a barra só aparece
// depois de montar no navegador (o mesmo jeito do botão de gráficos).
const semAssinatura = () => () => {};
// no mapa simples (2D) não tem câmera: a barra some
const useNoMundo = () => useSyncExternalStore(semAssinatura, () => modoMundo() && !usarMapa2D(), () => false);

const ICONE: Record<string, string> = {
  girarEsq: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4", girarDir: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4",
  aproximar: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM11 8v6M8 11h6M20 20l-4-4", afastar: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM8 11h6M20 20l-4-4",
  cima: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v18M4 7.5l8 4.5 8-4.5", rua: "M3 20h18M6 20l3-14h6l3 14M12 8v2M12 13v2M12 18v1",
  seguir: "M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 20c0-3.3 2.7-6 6-6s6 2.7 6 6M3 12h2M19 12h2", passeio: "M12 3a9 9 0 1 0 9 9M21 3v6h-6M12 8v4l3 2",
  inicio: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10",
  drone: "M12 10h0M9 10h6v4H9zM5 6a2 2 0 1 0 0 .1M19 6a2 2 0 1 0 0 .1M5 18a2 2 0 1 0 0 .1M19 18a2 2 0 1 0 0 .1M7 7.5l2 2.5M17 7.5l-2 2.5M7 16.5l2-2.5M17 16.5l-2-2.5",
  andar: "M13 4a1.6 1.6 0 1 0 0 .1M10 21l2-6 2 2v4M9 11l2-3 3 2 2 3M11 8l-2 5",
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
  const { seguir, passeio, cima, rua, drone, andar } = useCamera();
  const personagem = usePersonagem((s) => s.ativo);
  const [ajuda, setAjuda] = useState(false);
  const noMundo = useNoMundo();
  if (!noMundo) return null;
  const sep = <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden="true" />;
  return (
    <>
    <ModoCamera />
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
      <Botao tipo="passeio" rotulo="Girar devagar (P)" ativo={passeio} />
      <Botao tipo="drone" rotulo="Voo de drone pela cidade (O)" ativo={drone} />
      <Botao tipo="andar" rotulo={personagem ? "Andar pela rua com o meu personagem (C)" : "Andar pela rua: crie o seu personagem"} ativo={andar} />
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
    </>
  );
}

// No celular: só girar e voltar ao início, ao lado do botão de gráficos
const ROTULO_CEL: Partial<Record<ComandoCamera, string>> = { inicio: "Voltar ao início", girarEsq: "Girar para a esquerda", girarDir: "Girar para a direita", drone: "Voo de drone pela cidade", andar: "Andar pela rua com o meu personagem" };
export function ControlesCameraCelular() {
  const pedir = useCamera((s) => s.pedir);
  const drone = useCamera((s) => s.drone), andar = useCamera((s) => s.andar);
  const noMundo = useNoMundo();
  if (!noMundo) return null;
  return (
    <span className="pointer-events-auto flex gap-1 rounded-xl bg-[#111418]/70 p-0.5 backdrop-blur sm:hidden">
      {(["girarEsq", "girarDir", "inicio", "drone", "andar"] as ComandoCamera[]).map((t) => (
        <button key={t} type="button" onClick={() => pedir(t)} aria-label={ROTULO_CEL[t]} aria-pressed={t === "drone" ? drone : t === "andar" ? andar : undefined} className={`grid h-8 w-8 place-items-center rounded-lg ${(t === "drone" && drone) || (t === "andar" && andar) ? "bg-[#1D4ED8] text-white" : "text-white/85"}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONE[t]} /></svg>
        </button>
      ))}
    </span>
  );
}

// Dica do modo ligado (drone ou andar) e o joystick do celular para andar. Montado junto da barra da câmera.
export function ModoCamera() {
  const drone = useCamera((s) => s.drone), andar = useCamera((s) => s.andar), pedir = useCamera((s) => s.pedir);
  const noMundo = useNoMundo();
  if (!noMundo || (!drone && !andar)) return null;
  return (
    <>
      <div className="pointer-events-auto absolute left-1/2 top-[7.2rem] z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#111418]/85 py-1.5 pl-3 pr-1.5 text-[12px] font-semibold text-white shadow-xl backdrop-blur sm:top-20">
        <span className={`h-2 w-2 rounded-full ${drone ? "animate-pulse bg-[#38BDF8]" : "bg-[#22C55E]"}`} aria-hidden="true" />
        {drone ? <span>Voo de drone<span className="hidden text-white/60 sm:inline"> · toque ou aperte uma tecla para assumir</span></span>
          : <span>Andando pela rua<span className="hidden text-white/60 sm:inline"> · W A S D andam · arraste para olhar em volta · Esc sai</span></span>}
        <button type="button" onClick={() => pedir(drone ? "drone" : "andar")} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold hover:bg-white/25">Sair</button>
      </div>
      {andar && <Joystick />}
    </>
  );
}

// joystick de tela (só em toque): arrasta a bolinha para a direção em que o personagem anda
function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [bola, setBola] = useState<[number, number]>([0, 0]);
  const id = useRef<number | null>(null);
  const R = 46;
  const mover = (e: React.PointerEvent) => {
    const b = base.current; if (!b || id.current !== e.pointerId) return;
    const r = b.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    joystick.x = dx / R; joystick.y = dy / R; setBola([dx, dy]);
  };
  const soltar = (e: React.PointerEvent) => { if (id.current !== e.pointerId) return; id.current = null; joystick.x = 0; joystick.y = 0; setBola([0, 0]); };
  return (
    <div ref={base} role="application" aria-label="Joystick: arraste para andar"
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); mover(e); }}
      onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
      className="pointer-events-auto absolute bottom-24 left-6 z-20 grid h-32 w-32 touch-none select-none place-items-center rounded-full bg-[#111418]/45 ring-2 ring-white/25 backdrop-blur [@media(pointer:fine)]:hidden">
      <span className="h-14 w-14 rounded-full bg-white/85 shadow-lg" style={{ transform: `translate(${bola[0]}px, ${bola[1]}px)` }} />
    </div>
  );
}
