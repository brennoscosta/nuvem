"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRodaNoCanvas } from "./roda";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { MapControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { Predio } from "./Predio";
import { Mundo } from "./Mundo";
import { MUNDO } from "../data/mundo";
import { Fachada } from "./Fachada";
import { CameraMundo } from "./CameraMundo";
import { CicloDia } from "./CicloDia";
import { Agente, handlers } from "./Agente";
import { qualidade } from "./qualidade";
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
const LIMITE = { x: MUNDO.x - 22, z: MUNDO.z - 22 };

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
    const dx = THREE.MathUtils.clamp(t.x, -LIMITE.x, LIMITE.x) - t.x, dz = THREE.MathUtils.clamp(t.z, -LIMITE.z, LIMITE.z) - t.z;
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
    let refaz = t >= prox.current || vistaFeita.current !== vista;
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
    const loop = (t: number) => { id = requestAnimationFrame(loop); if (t - ultimo < 1000 / 30 - 3) return; ultimo = t; advance(t); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

// ?medir=1: expõe o renderer em window.__cena pra medir draw calls nas prévias (scripts/medir.mjs)
function Medidor() {
  const gl = useThree((s) => s.gl);
  useEffect(() => { (window as unknown as { __cena?: unknown }).__cena = gl; }, [gl]);
  return null;
}
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");

function Luzes({ sombras, luz, hemi, preench }: { sombras: boolean; luz: React.RefObject<THREE.DirectionalLight | null>; hemi: React.RefObject<THREE.HemisphereLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }) {
  return (
    <>
      <hemisphereLight ref={hemi} args={["#FFFFFF", "#CDD3DB", 0.9]} />
      <directionalLight
        ref={luz}
        position={[12, 22, 10]} intensity={2.2} color="#FFF6E8" castShadow={sombras}
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4}
        shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={26} shadow-camera-bottom={-26} shadow-camera-near={1} shadow-camera-far={80}
      />
      <directionalLight ref={preench} position={[-14, 10, -8]} intensity={0.5} color="#DCE8FF" />
    </>
  );
}

export function Cena() {
  const agentes = useEscritorio((s) => s.agentes);
  const ordem = useEscritorio((s) => s.ordem);
  const controles = useRef<any>(null);
  const luz = useRef<THREE.DirectionalLight | null>(null);
  const hemi = useRef<THREE.HemisphereLight | null>(null);
  const preench = useRef<THREE.DirectionalLight | null>(null);
  const leve = qualidade() === "leve";
  // alta: resolução até 1,5x, baixa pra 1x se o computador não der conta (PerformanceMonitor); leve: sempre 1x
  const maxDpr = leve ? 1 : Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const [dpr, setDpr] = useState(maxDpr);
  useRodaNoCanvas(); // zoom com a roda em qualquer lugar da tela (barra, botões, crachás, balões)
  const cam = CAM_INICIAL;
  return (
    <Canvas
      dpr={dpr}
      frameloop={leve ? "never" : "always"}
      shadows={leve ? false : { enabled: true, type: THREE.PCFShadowMap }}
      camera={{ position: cam.pos, fov: FOV, near: 0.5, far: 420 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => { useEscritorio.getState().selecionar(null); if (!useMundo.getState().painelEmpresa) useMundo.getState().selecionarLote(null); }}>
      <color attach="background" args={["#CFE3F5"]} />
      <fog attach="fog" args={["#CFE3F5", 140, 360]} />
      {leve ? <Limite30 /> : (
        <>
          <SombrasFixas luz={luz} controles={controles} />
          {/* só reage a queda sustentada (abaixo de 35 fps): os tropeços do carregamento não contam */}
          <PerformanceMonitor bounds={() => [35, 55]} flipflops={4} onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} onFallback={() => setDpr(1)} />
        </>
      )}
      <Luzes sombras={!leve} luz={luz} hemi={hemi} preench={preench} />
      {modoMundo() && <CicloDia luzes={{ hemi, sol: luz, preench }} />}
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
  );
}
