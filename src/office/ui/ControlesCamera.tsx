"use client";
// Barra da câmera no mapa (11/11/2026; refeita em 16/11/2026: "deixe tudo mais moderno e atual"). Ilha de vidro escuro no
// canto de baixo à esquerda com ícones próprios (src/office/ui/Icone.tsx) e uma dica com a tecla de atalho em cada botão:
// girar, aproximar/afastar, ver de cima, ver da rua, seguir meu personagem, girar devagar, drone, andar e voltar ao início.
// "Ajustes" junta o que antes ficava espalhado: gráficos leves/completos, mapa 3D ou simples, hora do dia e som.
// "Como mexer" mostra o mouse e os atalhos (a frase fixa embaixo virou um aviso que some sozinho).
// 19/11/2026: botão "Bicicleta" (ui/BotaoBicicleta.tsx) logo depois de "Andar pela rua", no computador e no celular.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCamera, useHora, ATALHOS, joystick, primeiraVisitaDeDia, type ComandoCamera, type ModoHora } from "../cameraStore";
import { usePersonagem } from "../personagemStore";
import { modoMundo } from "../mundoStore";
import { usarMapa2D, qualidade, escolherQualidade, escolherMapa } from "../scene/qualidade";
import { alternarSom, assinarSom, somLigado } from "../som";
import { Icone, type NomeIcone } from "./Icone";
import { BotaoBicicleta, AvisoBicicleta } from "./BotaoBicicleta";
import { useCartaoAberto } from "./cartaoAberto";

// modoMundo() lê o endereço do navegador: no servidor é sempre falso. Para não dar erro de hidratação, a barra só aparece
// depois de montar no navegador.
const semAssinatura = () => () => {};
// no mapa simples (2D) não tem câmera: a barra some
const useNoMundo = () => useSyncExternalStore(semAssinatura, () => modoMundo() && !usarMapa2D(), () => false);

const ICONE: Record<ComandoCamera, NomeIcone> = {
  girarEsq: "girarEsq", girarDir: "girarDir", aproximar: "zoomMais", afastar: "zoomMenos", cima: "cubo", rua: "rua",
  seguir: "seguir", passeio: "orbita", inicio: "casa", drone: "drone", andar: "andar",
} as Record<ComandoCamera, NomeIcone>;

function Botao({ tipo, rotulo, tecla, ativo }: { tipo: ComandoCamera; rotulo: string; tecla?: string; ativo?: boolean }) {
  const pedir = useCamera((s) => s.pedir);
  return (
    <button type="button" onClick={() => pedir(tipo)} aria-label={tecla ? `${rotulo} (${tecla})` : rotulo} aria-pressed={ativo ?? undefined} className="hud-btn hud-btn-icone">
      <Icone nome={ICONE[tipo]} tamanho={19} />
      <span className="hud-dica" aria-hidden="true">{rotulo}{tecla && <kbd>{tecla}</kbd>}</span>
    </button>
  );
}

// fecha um cartão aberto com Esc ou clicando fora da caixa
function useFecharFora(aberto: boolean, caixa: React.RefObject<HTMLElement | null>, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) fechar(); };
    window.addEventListener("keydown", tecla); document.addEventListener("pointerdown", fora);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", fora); };
  }, [aberto, caixa, fechar]);
}

export function ControlesCamera() {
  const { seguir, passeio, cima, rua, drone, andar } = useCamera();
  const personagem = usePersonagem((s) => s.ativo);
  const [aberto, setAberto] = useState<null | "ajustes" | "ajuda">(null);
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(null), []);
  useFecharFora(!!aberto, caixa, fechar);
  const noMundo = useNoMundo();
  // tela baixa (celular deitado, 21/11/2026): com um cartão aberto a barra some, como no celular em pé; ela ficava por
  // baixo do cartão, que só tem uns 280 px de altura ali
  const cartao = useCartaoAberto();
  if (!noMundo) return null;
  return (
    <>
      <ModoCamera />
      <AvisoMover />
      <AvisoBicicleta />
      <div ref={caixa} data-tour="camera" className={`hud-ilha hud-dock pointer-events-auto absolute bottom-4 left-3 z-10 hidden sm:flex ${cartao ? "[@media(max-height:600px)]:!hidden" : ""}`} role="toolbar" aria-label="Câmera">
        <Botao tipo="girarEsq" rotulo="Girar para a esquerda" tecla="Q" />
        <Botao tipo="girarDir" rotulo="Girar para a direita" tecla="E" />
        <span className="hud-sep" aria-hidden="true" />
        <Botao tipo="aproximar" rotulo="Aproximar" tecla="+" />
        <Botao tipo="afastar" rotulo="Afastar" tecla="−" />
        <span className="hud-sep" aria-hidden="true" />
        <Botao tipo="cima" rotulo="Ver de cima" tecla="T" ativo={cima} />
        <Botao tipo="rua" rotulo="Ver da altura da rua" tecla="V" ativo={rua} />
        {personagem && <Botao tipo="seguir" rotulo="Seguir meu personagem" tecla="F" ativo={seguir} />}
        <Botao tipo="passeio" rotulo="Girar devagar" tecla="P" ativo={passeio} />
        <Botao tipo="drone" rotulo="Voo de drone pela cidade" tecla="O" ativo={drone} />
        <Botao tipo="andar" rotulo={personagem ? "Andar pela rua" : "Andar pela rua (crie o seu personagem)"} tecla="C" ativo={andar} />
        <BotaoBicicleta />
        <span className="hud-sep" aria-hidden="true" />
        <Botao tipo="inicio" rotulo="Voltar ao início" tecla="H" />
        <button type="button" onClick={() => setAberto(aberto === "ajustes" ? null : "ajustes")} aria-expanded={aberto === "ajustes"} aria-label="Ajustes do mapa" className="hud-btn hud-btn-icone">
          <Icone nome="ajustes" tamanho={19} /><span className="hud-dica" aria-hidden="true">Ajustes</span>
        </button>
        <button type="button" onClick={() => setAberto(aberto === "ajuda" ? null : "ajuda")} aria-expanded={aberto === "ajuda"} aria-label="Como mexer no mapa" className="hud-btn hud-btn-icone">
          <Icone nome="ajuda" tamanho={19} /><span className="hud-dica" aria-hidden="true">Como mexer</span>
        </button>
        {aberto === "ajustes" && <PainelAjustes />}
        {aberto === "ajuda" && <PainelAjuda />}
      </div>
    </>
  );
}

// ---------- ajustes: gráficos, mapa, hora do dia e som ----------
function Segmentos<T extends string>({ itens, atual, escolher, rotulo }: { itens: [T, NomeIcone, string][]; atual: T | null; escolher: (v: T) => void; rotulo: string }) {
  return (
    <div className="hud-seg" role="group" aria-label={rotulo}>
      {itens.map(([v, ic, nome]) => <button key={v} type="button" aria-pressed={atual === v} onClick={() => { if (atual !== v) escolher(v); }}><Icone nome={ic} tamanho={15} />{nome}</button>)}
    </div>
  );
}
export function PainelAjustes() {
  const q = useSyncExternalStore(semAssinatura, qualidade, () => null);
  const hora = useHora((s) => s.modo), definirHora = useHora((s) => s.definir);
  const som = useSyncExternalStore(assinarSom, somLigado, () => false);
  return (
    <div className="hud-pop" role="dialog" aria-label="Ajustes do mapa">
      <b className="hud-pop-titulo"><Icone nome="ajustes" tamanho={18} />Ajustes do mapa</b>
      <div className="hud-secao">
        <span>Gráficos</span>
        <Segmentos rotulo="Gráficos" atual={q} escolher={(v) => escolherQualidade(v)} itens={[["leve", "raio", "Leves"], ["alta", "brilho", "Completos"]]} />
        <p className="hud-nota">{q === "leve" ? "Sem sombras e a 30 quadros por segundo: melhor em celular e computador fraco." : "Sombras, reflexos e mais detalhes."} Trocar recarrega a página.</p>
      </div>
      <div className="hud-secao">
        <span>Mapa</span>
        <Segmentos rotulo="Mapa" atual={"3d" as "3d" | "2d"} escolher={(v) => escolherMapa(v)} itens={[["3d", "cubo", "Cidade 3D"], ["2d", "camadas", "Simples (2D)"]]} />
      </div>
      <div className="hud-secao">
        <span>Hora do dia</span>
        <Segmentos<ModoHora> rotulo="Hora do dia" atual={hora} escolher={definirHora} itens={[["auto", "relogio", "Automática"], ["dia", "sol", "Dia"], ["noite", "lua", "Noite"]]} />
        <p className="hud-nota">{hora === "dia" && primeiraVisitaDeDia() ? "Na primeira visita a cidade abre de dia. " : ""}Automática segue o horário de Brasília.</p>
      </div>
      <div className="hud-linha">
        <span><Icone nome={som ? "som" : "mudo"} tamanho={18} />Som da cidade</span>
        <button type="button" role="switch" aria-checked={som} aria-label="Som da cidade" onClick={alternarSom} className="hud-chave" />
      </div>
    </div>
  );
}

// ---------- como mexer: mouse e teclado ----------
const MOUSE: [NomeIcone, string][] = [["mouse", "Arraste para mover"], ["zoomMais", "Roda do mouse para aproximar e afastar"], ["girarDir", "Botão direito para girar"], ["pino", "Duplo clique vai até o ponto"]];
function PainelAjuda() {
  return (
    <div className="hud-pop hud-ajuda" role="dialog" aria-label="Como mexer no mapa">
      <b className="hud-pop-titulo"><Icone nome="mouse" tamanho={18} />Como mexer no mapa</b>
      <ul className="mt-2">{MOUSE.map(([ic, t]) => <li key={t}><Icone nome={ic} tamanho={16} />{t}</li>)}</ul>
      <b className="hud-pop-titulo mt-3"><Icone nome="teclado" tamanho={18} />Atalhos do teclado</b>
      <ul className="mt-1">{ATALHOS.map(([k, o]) => <li key={k}><kbd>{k}</kbd><span>{o}</span></li>)}</ul>
    </div>
  );
}

// aviso de como mexer na primeira visita: some sozinho em 10 s ou ao fechar (lembrado neste navegador)
const CHAVE_AVISO = "workend-aviso-mover";
function AvisoMover() {
  const [ver, setVer] = useState(() => { try { return window.localStorage.getItem(CHAVE_AVISO) !== "1"; } catch { return true; } });
  const fechar = useCallback(() => { setVer(false); try { window.localStorage.setItem(CHAVE_AVISO, "1"); } catch { /* sem armazenamento */ } }, []);
  useEffect(() => { if (!ver) return; const t = setTimeout(fechar, 10000); return () => clearTimeout(t); }, [ver, fechar]);
  if (!ver) return null;
  return (
    <div className="hud-ilha hud-aviso-mover pointer-events-auto absolute bottom-[4.6rem] left-3 z-10 hidden items-center gap-2.5 py-2 pl-3 pr-1.5 text-[12.5px] text-white/85 sm:flex" role="status">
      <Icone nome="mouse" tamanho={18} className="text-[#93C5FD]" />
      <span>Arraste para mover, use a roda para aproximar e o botão direito para girar.</span>
      <button type="button" onClick={fechar} aria-label="Fechar o aviso" className="hud-btn hud-btn-icone !h-8 !w-8"><Icone nome="fechar" tamanho={15} /></button>
    </div>
  );
}

// No celular: girar, voltar ao início, drone, andar, bicicleta e os ajustes, no canto de baixo
const ROTULO_CEL: Partial<Record<ComandoCamera, string>> = { inicio: "Voltar ao início", girarEsq: "Girar para a esquerda", girarDir: "Girar para a direita", drone: "Voo de drone pela cidade", andar: "Andar pela rua com o meu personagem" };
export function ControlesCameraCelular() {
  const pedir = useCamera((s) => s.pedir);
  const drone = useCamera((s) => s.drone), andar = useCamera((s) => s.andar);
  const [ajustes, setAjustes] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const fechar = useCallback(() => setAjustes(false), []);
  useFecharFora(ajustes, caixa, fechar);
  const noMundo = useNoMundo();
  if (!noMundo) return null;
  return (
    <span ref={caixa} className="dock-cel hud-ilha pointer-events-auto relative flex gap-0.5 p-1 sm:hidden">
      {(["girarEsq", "girarDir", "inicio", "drone", "andar"] as ComandoCamera[]).map((t) => (
        <button key={t} type="button" onClick={() => pedir(t)} aria-label={ROTULO_CEL[t]} aria-pressed={t === "drone" ? drone : t === "andar" ? andar : undefined} className="hud-btn hud-btn-icone !h-9 !w-9">
          <Icone nome={ICONE[t]} tamanho={18} />
        </button>
      ))}
      <BotaoBicicleta celular />
      <button type="button" onClick={() => setAjustes(!ajustes)} aria-expanded={ajustes} aria-label="Ajustes do mapa" className="hud-btn hud-btn-icone !h-9 !w-9"><Icone nome="ajustes" tamanho={18} /></button>
      {ajustes && <PainelAjustes />}
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
      <div className="hud-ilha pointer-events-auto absolute left-1/2 top-[7.2rem] z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap !rounded-full py-1.5 pl-3 pr-1.5 text-[12.5px] font-semibold sm:top-20">
        <Icone nome={drone ? "drone" : "andar"} tamanho={17} className={drone ? "text-[#38BDF8]" : "text-[#4ADE80]"} />
        {drone ? <span>Voo de drone<span className="hidden text-white/60 sm:inline"> · toque ou aperte uma tecla para assumir</span></span>
          : <span>Andando pela rua<span className="hidden text-white/60 sm:inline"> · W A S D andam · arraste para olhar em volta · Esc sai</span></span>}
        <button type="button" onClick={() => pedir(drone ? "drone" : "andar")} className="hud-btn !h-7 !rounded-full !px-3 !text-[12px] bg-white/15">Sair</button>
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
      className="pointer-events-auto absolute bottom-24 left-6 z-20 grid h-32 w-32 touch-none select-none place-items-center rounded-full bg-[#0E1219]/50 ring-2 ring-white/25 backdrop-blur [@media(pointer:fine)]:hidden">
      <span className="h-14 w-14 rounded-full bg-white/90 shadow-lg" style={{ transform: `translate(${bola[0]}px, ${bola[1]}px)` }} />
    </div>
  );
}
