"use client";
// A cena 3D (o Canvas): escritório da Nuvem e, no WorkEnd, a cidade. Carregada à parte por scene/Cena, que escolhe
// entre ela e o mapa simples em 2D (aparelho sem WebGL ou fraco demais).
// 12/11/2026: a qualidade se ajusta durante o uso (mede os quadros por segundo; se travar, tira a resolução extra, depois
// as sombras, depois limita a 30 quadros; nunca sobe sozinha) e um aviso mostra quanto da cidade já carregou.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRodaNoCanvas } from "./roda";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { MapControls, PerformanceMonitor, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Predio } from "./Predio";
import { Mundo } from "./Mundo";
import { MUNDO, LIMITE_CAMERA } from "../data/mundo";
import { Fachada } from "./Fachada";
import { CameraMundo } from "./CameraMundo";
import { CicloDia } from "./CicloDia";
import { Acabamento } from "./Acabamento";
import { Agente, handlers } from "./Agente";
import { qualidade, qualidadeManual, lembrarLeveAuto, escolherQualidade, escolherMapa } from "./qualidade";
import { useEscritorio } from "../store";
import { useMundo, modoMundo } from "../mundoStore";
import { MESA } from "../data/layout";
import type { Evento } from "../data/eventos";

// Entrega os eventos da fila pros agentes
function Despachante() {
  const consumir = useEscritorio((s) => s.consumirEventos);
  const pendentes = useRef<{ ev: Evento; ate: number }[]>([]);
  useFrame(() => {
    const agora = performance.now();
    const lista = [...pendentes.current.map((p) => p.ev), ...consumir()];
    pendentes.current = [];
    for (const ev of lista) {
      const h = handlers.get(ev.agenteId);
      if (h) h(ev);
      else if (useEscritorio.getState().agentes[ev.agenteId]) pendentes.current.push({ ev, ate: agora + 5000 }); // agente ainda montando
    }
    pendentes.current = pendentes.current.filter((p) => p.ate > agora);
  });
  return null;
}

// Enquadramentos (prédio de 18 x 18 m): por dentro, de cima e um pouco de lado; por fora, mais baixo e afastado
const CAM_DENTRO = { pos: new THREE.Vector3(8, 23, 28), alvo: new THREE.Vector3(0, 0, 0.5) };
const CAM_FORA = { pos: new THREE.Vector3(12, 15, 32), alvo: new THREE.Vector3(0, 2, 1) };
// No mundo do WorkEnd a entrada é uma vista aérea do bairro (a Nuvem é só uma das lojas)
const CAM_MUNDO = { pos: new THREE.Vector3(34, 42, 74), alvo: new THREE.Vector3(2, 0, 12) };
// ?cam=x,y,z,tx,ty,tz posiciona a câmera (usado nas prévias)
const CAM = (() => { if (typeof window === "undefined") return null; const v = new URLSearchParams(window.location.search).get("cam"); if (!v) return null; const n = v.split(",").map(Number); return n.length === 6 ? n : null; })();
// Celular em pé: a tela é estreita, então abre o ângulo e afasta um pouco pra o prédio inteiro caber na largura
const RETRATO = typeof window !== "undefined" && window.innerWidth < window.innerHeight;
const FOV = RETRATO ? Math.min(52, (32 / (window.innerWidth / window.innerHeight)) * 0.7) : 32;
if (RETRATO) { CAM_DENTRO.pos.multiplyScalar(1.2); CAM_FORA.pos.multiplyScalar(1.15); CAM_MUNDO.pos.multiplyScalar(1.2); }
const CAM_PADRAO = typeof window !== "undefined" && modoMundo() ? CAM_MUNDO : CAM_DENTRO;
const CAM_INICIAL = CAM ? { pos: [CAM[0], CAM[1], CAM[2]] as [number, number, number], alvo: [CAM[3], CAM[4], CAM[5]] as [number, number, number] } : { pos: CAM_PADRAO.pos.toArray() as [number, number, number], alvo: CAM_PADRAO.alvo.toArray() as [number, number, number] };
// até onde o centro da tela pode ir ao arrastar (não deixa a câmera escapar do mundo e ver a borda dos painéis)
// 12/11/2026: ao norte vai até o Parque da Cidade (LIMITE_CAMERA em data/mundo.ts); no escritório da Nuvem, o de sempre
const LIMITE = typeof window !== "undefined" && modoMundo() ? LIMITE_CAMERA : { xMin: -(MUNDO.x - 22), xMax: MUNDO.x - 22, zMin: -(MUNDO.z - 22), zMax: MUNDO.z - 22 };

const DESLOCA = new THREE.Vector3();
// Quando o usuário seleciona um agente, a câmera desliza até a mesa dele; trocar de vista reenquadra
function FocoCamera({ controles }: { controles: React.RefObject<any> }) {
  const selecionado = useEscritorio((s) => s.selecionado);
  const alvo = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    const a = selecionado ? useEscritorio.getState().agentes[selecionado] : null;
    if (!a) { alvo.current = null; return; }
    const m = MESA[a.mesaId]; alvo.current = new THREE.Vector3(m.pos[0], m.pos[1] + 0.5, m.pos[2]);
  }, [selecionado]);
  const vista = useEscritorio((s) => s.vista);
  const posAlvo = useRef<THREE.Vector3 | null>(null);
  const primeira = useRef(true);
  // lote clicado no mapa: a câmera desliza (arrasta) até ele, mantendo a altura e o ângulo
  const alvoLote = useMundo((s) => s.alvoCamera);
  const { camera } = useThree();
  useEffect(() => {
    if (!alvoLote) return;
    const c = controles.current; if (!c) return;
    const t = c.target as THREE.Vector3;
    const novo = new THREE.Vector3(...alvoLote);
    const d = novo.clone().sub(t);
    alvo.current = novo; posAlvo.current = camera.position.clone().add(d);
    useMundo.getState().limparAlvo();
  }, [alvoLote, camera, controles]);
  useEffect(() => {
    if (primeira.current || CAM) { primeira.current = false; return; } // não mexe na câmera inicial nem nas prévias (?cam)
    // só reenquadra se o usuário estiver olhando a Nuvem; longe dela (num lote, na lanchonete) a câmera fica onde está
    const t = controles.current?.target as THREE.Vector3 | undefined;
    if (t && (Math.abs(t.x) > 24 || Math.abs(t.z) > 24)) return;
    const c = vista === "fora" ? (modoMundo() ? CAM_MUNDO : CAM_FORA) : CAM_DENTRO;
    alvo.current = c.alvo.clone(); posAlvo.current = c.pos.clone();
  }, [vista, controles]);
  useFrame(({ camera }, dt) => {
    const c = controles.current; if (!c) return;
    if (posAlvo.current) { camera.position.lerp(posAlvo.current, Math.min(1, dt * 3)); if (camera.position.distanceTo(posAlvo.current) < 0.1) posAlvo.current = null; }
    if (alvo.current) { c.target.lerp(alvo.current, Math.min(1, dt * 3)); if (c.target.distanceTo(alvo.current) < 0.05) alvo.current = null; }
    // trava o arrasto dentro do terreno (move câmera e alvo juntos)
    const t = c.target as THREE.Vector3;
    const dx = THREE.MathUtils.clamp(t.x, LIMITE.xMin, LIMITE.xMax) - t.x, dz = THREE.MathUtils.clamp(t.z, LIMITE.zMin, LIMITE.zMax) - t.z;
    if (dx || dz) { const d = DESLOCA.set(dx, 0, dz); t.add(d); camera.position.add(d); }
    if (posAlvo.current || alvo.current || dx || dz) c.update();
  });
  return null;
}

// Sombras "assadas": o mapa de sombras é recalculado só de vez em quando (quem anda não projeta sombra; usa a
// mancha de contato). Economiza um passe inteiro de desenho por quadro. O mundo é grande, então a câmera de sombra
// (±26 m) acompanha o ponto que o usuário está olhando: quando ele arrasta pra longe, a luz muda de lugar e refaz.
const SOL = new THREE.Vector3(12, 22, 10);
function SombrasFixas({ luz, controles }: { luz: React.RefObject<THREE.DirectionalLight | null>; controles: React.RefObject<any> }) {
  const vista = useEscritorio((s) => s.vista);
  const prox = useRef(0);
  const vistaFeita = useRef<string | null>(null);
  const centro = useRef(new THREE.Vector3(1e9, 0, 0));
  // modelos e fontes chegam aos poucos: refaz a sombra a cada 1 s nos primeiros 12 s, depois a cada 5 s e quando a vista muda
  useFrame(({ gl, clock }) => {
    gl.shadowMap.autoUpdate = false;
    const t = clock.elapsedTime;
    // qualidade baixada durante o uso: a sombra só é refeita quando a câmera anda ou a vista muda (sem o refazer periódico)
    let refaz = (!sombraEconomica && t >= prox.current) || vistaFeita.current !== vista;
    const l = luz.current, alvo = controles.current?.target as THREE.Vector3 | undefined;
    if (l && alvo && alvo.distanceTo(centro.current) > 6) {
      centro.current.copy(alvo);
      l.position.copy(alvo).add(SOL); l.target.position.copy(alvo); l.target.updateMatrixWorld();
      refaz = true;
    }
    if (refaz) { gl.shadowMap.needsUpdate = true; prox.current = t + (t < 12 ? 1 : 5); vistaFeita.current = vista; }
  });
  return null;
}

// Modo leve: no máximo 30 quadros por segundo (a cena anda e a navegação continua lisa, gastando metade)
function Limite30() {
  useEffect(() => {
    let id = 0, ultimo = 0;
    // advance() com frameloop "never" usa o número como clock.elapsedTime: tem de ser em SEGUNDOS (12/11/2026). Em milissegundos
    // a água, os pássaros e tudo que usa clock.elapsedTime andavam 1000× mais rápido no modo leve, e o trânsito 3× (dt preso em 0,1).
    const loop = (t: number) => { id = requestAnimationFrame(loop); if (t - ultimo < 1000 / 30 - 3) return; ultimo = t; advance(t / 1000); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

// ?medir=1: expõe o renderer em window.__cena pra medir draw calls nas prévias (scripts/medir.mjs)
function Medidor() {
  const gl = useThree((s) => s.gl), cena = useThree((s) => s.scene);
  useEffect(() => { const w = window as unknown as { __cena?: unknown; __cenaObjetos?: unknown }; w.__cena = gl; w.__cenaObjetos = cena; }, [gl, cena]);
  return null;
}
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");

// ---------- qualidade durante o uso ----------
// ?simularfps=12 finge que o aparelho está rodando a 12 quadros por segundo (para testar a queda)
const SIMULAR_FPS = (() => { if (typeof window === "undefined") return null; const v = Number(new URLSearchParams(window.location.search).get("simularfps")); return v > 0 ? v : null; })();
// nível: 0 = completo; 1 = resolução 1x e sombra sem refazer periódico; 2 = também no máximo 30 quadros por segundo (igual aos gráficos leves)
function QualidadeViva({ nivel, maximo, aoBaixar, aoTravar }: { nivel: number; maximo: number; aoBaixar: (n: number) => void; aoTravar: () => void }) {
  const k = useRef({ quadros: 0, desde: 0, inicio: 0, ruins: 0, avisou: false });
  useFrame(() => {
    const agora = performance.now(), x = k.current;
    if (!x.inicio) { x.inicio = agora; x.desde = agora; }
    x.quadros++;
    if (agora - x.desde < 1000) return;
    const fps = SIMULAR_FPS ?? (x.quadros * 1000) / (agora - x.desde);
    x.quadros = 0; x.desde = agora;
    // os primeiros 10 s são de carregamento (modelos chegando travam de verdade) e aba escondida não conta
    if (agora - x.inicio < 10000 || document.visibilityState !== "visible") { x.ruins = 0; return; }
    if (fps < (nivel >= 2 ? 18 : 24)) x.ruins++; else x.ruins = 0;
    if (x.ruins < 5) return; // 5 segundos seguidos ruins
    x.ruins = 0; x.inicio = agora - 7000; // espera 3 s antes de julgar o nível novo
    if (nivel < maximo) aoBaixar(nivel + 1);
    else if (!x.avisou) { x.avisou = true; aoTravar(); }
  });
  return null;
}
// 1º degrau da queda (12/11/2026, na integração): resolução 1x e sombra sem o refazer periódico. NÃO desliga a sombra nem
// recompila os materiais com a cena aberta: as árvores de rua (cor por instância) e as fachadas (sombreador próprio)
// sumiam depois da recompilação. Sem sombra mesmo, só na próxima visita (fica marcado como leve). Fora do componente:
// o renderer é objeto do three.js, não estado do React.
let sombraEconomica = false;
function desligarSombras(gl: THREE.WebGLRenderer) {
  if (sombraEconomica) return;
  sombraEconomica = true;
  if (gl.getPixelRatio() > 1) gl.setPixelRatio(1);
}
function AplicarNivel({ nivel }: { nivel: number; luz?: React.RefObject<THREE.DirectionalLight | null> }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => { if (nivel >= 1) desligarSombras(gl); }, [nivel, gl]);
  return null;
}
// quanto da cidade já chegou (modelos 3D): some quando termina
function Progresso() {
  const { active, progress, total } = useProgress();
  const [visto, setVisto] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setVisto(true), 600); return () => clearTimeout(t); } }, [active]);
  if (!active || !visto || total < 3) return null;
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#111418]/80 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg backdrop-blur" role="status">
      Montando a cidade… {Math.round(progress)}%
      <span className="mt-1 block h-1 w-36 overflow-hidden rounded-full bg-white/20"><span className="block h-1 rounded-full bg-[#5B9DFF] transition-[width] duration-300" style={{ width: `${Math.max(6, progress)}%` }} /></span>
    </div>
  );
}
function AvisoQualidade({ tipo, aoFechar }: { tipo: "baixou" | "travou"; aoFechar: () => void }) {
  useEffect(() => { if (tipo !== "baixou") return; const t = setTimeout(aoFechar, 9000); return () => clearTimeout(t); }, [tipo, aoFechar]);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-40 z-20 w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl sm:bottom-24 sm:top-auto bg-[#111418]/92 p-3 text-[12px] text-white shadow-2xl backdrop-blur" role="status">
      {tipo === "baixou" ? (
        <div className="flex items-center gap-3">
          <span className="flex-1">Deixei os gráficos mais leves para o mapa andar liso neste aparelho.</span>
          <button onClick={() => escolherQualidade("alta")} className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 font-bold">Voltar aos completos</button>
          <button onClick={aoFechar} aria-label="Fechar" className="shrink-0 px-1 text-white/60">✕</button>
        </div>
      ) : (
        <>
          <div className="font-bold">O mapa 3D está pesado neste aparelho</div>
          <div className="mt-0.5 text-white/75">O mapa simples mostra as mesmas lojas, em 2D, e abre na hora.</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => escolherMapa("2d")} className="flex-1 rounded-lg bg-[#1D4ED8] px-3 py-1.5 font-bold">Usar o mapa simples</button>
            <button onClick={aoFechar} className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold">Continuar no 3D</button>
          </div>
        </>
      )}
    </div>
  );
}

function Luzes({ sombras, luz, hemi, preench }: { sombras: boolean; luz: React.RefObject<THREE.DirectionalLight | null>; hemi: React.RefObject<THREE.HemisphereLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }) {
  return (
    <>
      <hemisphereLight ref={hemi} args={["#FFFFFF", "#CDD3DB", 0.9]} />
      <directionalLight
        ref={luz}
        position={[12, 22, 10]} intensity={2.2} color="#FFF6E8" castShadow={sombras}
        // modo completo (12/11/2026): sombra em 2048 cobrindo ±32 m (antes 1024 em ±26 m): mais nítida e mais longe
        shadow-mapSize={sombras ? [2048, 2048] : [1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={sombras ? 3 : 4}
        shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-camera-near={1} shadow-camera-far={90}
      />
      <directionalLight ref={preench} position={[-14, 10, -8]} intensity={0.5} color="#DCE8FF" />
    </>
  );
}

export function Cena3D() {
  const agentes = useEscritorio((s) => s.agentes);
  const ordem = useEscritorio((s) => s.ordem);
  const controles = useRef<any>(null);
  const luz = useRef<THREE.DirectionalLight | null>(null);
  const hemi = useRef<THREE.HemisphereLight | null>(null);
  const preench = useRef<THREE.DirectionalLight | null>(null);
  const leveInicial = qualidade() === "leve";
  // a queda automática respeita quem escolheu "Gráficos completos" no botão
  const [nivel, setNivel] = useState(leveInicial ? 2 : 0);
  const maximo = qualidadeManual() === "alta" ? 0 : 2;
  const [aviso, setAviso] = useState<"baixou" | "travou" | null>(null);
  const leve = leveInicial || nivel >= 2;
  // alta: resolução até 1,5x, baixa pra 1x se o computador não der conta (PerformanceMonitor); leve: sempre 1x
  const maxDpr = leve || nivel >= 1 ? 1 : Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const [dprMonitor, setDpr] = useState(maxDpr);
  const dpr = Math.min(dprMonitor, maxDpr);
  const fecharAviso = useCallback(() => setAviso(null), []);
  const baixar = (n: number) => { setNivel(n); setAviso("baixou"); if (n >= 2) lembrarLeveAuto(); };
  useRodaNoCanvas(); // zoom com a roda em qualquer lugar da tela (barra, botões, crachás, balões)
  const cam = CAM_INICIAL;
  return (
    <>
    <Canvas
      dpr={dpr}
      frameloop={leve ? "never" : "always"}
      shadows={leveInicial ? false : { enabled: true, type: THREE.PCFShadowMap }}
      camera={{ position: cam.pos, fov: FOV, near: 0.5, far: 420 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => { useEscritorio.getState().selecionar(null); if (!useMundo.getState().painelEmpresa) useMundo.getState().selecionarLote(null); }}>
      <color attach="background" args={["#CFE3F5"]} />
      <fog attach="fog" args={["#CFE3F5", 140, 360]} />
      {modoMundo() && <QualidadeViva nivel={nivel} maximo={maximo} aoBaixar={baixar} aoTravar={() => setAviso("travou")} />}
      <AplicarNivel nivel={nivel} luz={luz} />
      {leve ? <Limite30 /> : (
        <>
          {nivel === 0 && <SombrasFixas luz={luz} controles={controles} />}
          {/* só reage a queda sustentada (abaixo de 35 fps): os tropeços do carregamento não contam */}
          <PerformanceMonitor bounds={() => [35, 55]} flipflops={4} onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} onFallback={() => setDpr(1)} />
        </>
      )}
      <Luzes sombras={!leveInicial} luz={luz} hemi={hemi} preench={preench} />
      {modoMundo() && <CicloDia luzes={{ hemi, sol: luz, preench }} />}
      {modoMundo() && !leveInicial && <Acabamento hemi={hemi} preench={preench} />}
      <Suspense fallback={null}>
        <Mundo />
        <Predio />
        <Fachada />
        {ordem.map((id) => agentes[id] && <Agente key={id} def={agentes[id]} />)}
      </Suspense>
      <Despachante />
      {MEDIR && <Medidor />}
      <MapControls ref={controles} target={cam.alvo} minDistance={4} maxDistance={RETRATO ? 138 : 119} minPolarAngle={0.35} maxPolarAngle={1.25} dampingFactor={0.08} enableDamping />
      <FocoCamera controles={controles} />
      {modoMundo() && <CameraMundo controles={controles} inicio={CAM_MUNDO} />}
    </Canvas>
    {modoMundo() && <Progresso />}
    {aviso && <AvisoQualidade tipo={aviso} aoFechar={fecharAviso} />}
    </>
  );
}
