"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, advance, useFrame } from "@react-three/fiber";
import { MapControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { Predio } from "./Predio";
import { Entorno, TERRENO } from "./Entorno";
import { Horizonte } from "./Horizonte";
import { Fachada } from "./Fachada";
import { Agente, handlers } from "./Agente";
import { qualidade } from "./qualidade";
import { useEscritorio } from "../store";
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
// ?cam=x,y,z,tx,ty,tz posiciona a câmera (usado nas prévias)
const CAM = (() => { if (typeof window === "undefined") return null; const v = new URLSearchParams(window.location.search).get("cam"); if (!v) return null; const n = v.split(",").map(Number); return n.length === 6 ? n : null; })();
// Celular em pé: a tela é estreita, então abre o ângulo e afasta um pouco pra o prédio inteiro caber na largura
const RETRATO = typeof window !== "undefined" && window.innerWidth < window.innerHeight;
const FOV = RETRATO ? Math.min(52, (32 / (window.innerWidth / window.innerHeight)) * 0.7) : 32;
if (RETRATO) { CAM_DENTRO.pos.multiplyScalar(1.2); CAM_FORA.pos.multiplyScalar(1.15); }
const CAM_INICIAL = CAM ? { pos: [CAM[0], CAM[1], CAM[2]] as [number, number, number], alvo: [CAM[3], CAM[4], CAM[5]] as [number, number, number] } : { pos: CAM_DENTRO.pos.toArray() as [number, number, number], alvo: CAM_DENTRO.alvo.toArray() as [number, number, number] };
// até onde o centro da tela pode ir ao arrastar (não deixa a câmera escapar do terreno e ver a borda dos painéis)
const LIMITE = { x: TERRENO.x - 16, z: TERRENO.z - 14 };

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
  useEffect(() => {
    if (primeira.current || CAM) { primeira.current = false; return; } // não mexe na câmera inicial nem nas prévias (?cam)
    const c = vista === "fora" ? CAM_FORA : CAM_DENTRO;
    alvo.current = c.alvo.clone(); posAlvo.current = c.pos.clone();
  }, [vista]);
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
// mancha de contato). Economiza um passe inteiro de desenho por quadro.
function SombrasFixas() {
  const vista = useEscritorio((s) => s.vista);
  const prox = useRef(0);
  const vistaFeita = useRef<string | null>(null);
  // modelos e fontes chegam aos poucos: refaz a sombra a cada 1 s nos primeiros 12 s, depois a cada 5 s e quando a vista muda
  useFrame(({ gl, clock }) => {
    gl.shadowMap.autoUpdate = false;
    const t = clock.elapsedTime;
    if (t >= prox.current || vistaFeita.current !== vista) { gl.shadowMap.needsUpdate = true; prox.current = t + (t < 12 ? 1 : 5); vistaFeita.current = vista; }
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

function Luzes({ sombras }: { sombras: boolean }) {
  return (
    <>
      <hemisphereLight args={["#FFFFFF", "#CDD3DB", 0.9]} />
      <directionalLight
        position={[12, 22, 10]} intensity={2.2} color="#FFF6E8" castShadow={sombras}
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4}
        shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={70}
      />
      <directionalLight position={[-14, 10, -8]} intensity={0.5} color="#DCE8FF" />
    </>
  );
}

export function Cena() {
  const agentes = useEscritorio((s) => s.agentes);
  const ordem = useEscritorio((s) => s.ordem);
  const controles = useRef<any>(null);
  const leve = qualidade() === "leve";
  // alta: resolução até 1,5x, baixa pra 1x se o computador não der conta (PerformanceMonitor); leve: sempre 1x
  const maxDpr = leve ? 1 : Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const [dpr, setDpr] = useState(maxDpr);
  const cam = CAM_INICIAL;
  return (
    <Canvas
      dpr={dpr}
      frameloop={leve ? "never" : "always"}
      shadows={leve ? false : { enabled: true, type: THREE.PCFShadowMap }}
      camera={{ position: cam.pos, fov: FOV, near: 0.5, far: 160 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => useEscritorio.getState().selecionar(null)}>
      <color attach="background" args={["#CFE3F5"]} />
      <fog attach="fog" args={["#CFE3F5", 55, 130]} />
      {leve ? <Limite30 /> : (
        <>
          <SombrasFixas />
          {/* só reage a queda sustentada (abaixo de 35 fps): os tropeços do carregamento não contam */}
          <PerformanceMonitor bounds={() => [35, 55]} flipflops={4} onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} onFallback={() => setDpr(1)} />
        </>
      )}
      <Luzes sombras={!leve} />
      <Suspense fallback={null}>
        <Horizonte />
        <Entorno />
        <Predio />
        <Fachada />
        {ordem.map((id) => agentes[id] && <Agente key={id} def={agentes[id]} />)}
      </Suspense>
      <Despachante />
      <MapControls ref={controles} target={cam.alvo} minDistance={4} maxDistance={RETRATO ? 60 : 52} minPolarAngle={0.35} maxPolarAngle={1.25} dampingFactor={0.08} enableDamping />
      <FocoCamera controles={controles} />
    </Canvas>
  );
}
