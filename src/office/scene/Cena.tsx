"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls, ContactShadows, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import { Predio } from "./Predio";
import { Agente, handlers } from "./Agente";
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

// Quando o usuário seleciona um agente, a câmera desliza até a mesa dele
function FocoCamera({ controles }: { controles: React.RefObject<any> }) {
  const selecionado = useEscritorio((s) => s.selecionado);
  const alvo = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    const a = selecionado ? useEscritorio.getState().agentes[selecionado] : null;
    if (!a) { alvo.current = null; return; }
    const m = MESA[a.mesaId]; alvo.current = new THREE.Vector3(m.pos[0], 0.5, m.pos[2]);
  }, [selecionado]);
  useFrame((_, dt) => {
    const c = controles.current; if (!c || !alvo.current) return;
    c.target.lerp(alvo.current, Math.min(1, dt * 3));
    if (c.target.distanceTo(alvo.current) < 0.05) alvo.current = null;
    c.update();
  });
  return null;
}

function Luzes() {
  return (
    <>
      <hemisphereLight args={["#FFFFFF", "#CDD3DB", 0.9]} />
      <directionalLight
        position={[12, 22, 10]} intensity={2.2} color="#FFF6E8" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={1} shadow-camera-far={60}
      />
      <directionalLight position={[-14, 10, -8]} intensity={0.5} color="#DCE8FF" />
    </>
  );
}

// ?cam=x,y,z,tx,ty,tz posiciona a câmera (usado nas prévias)
const CAM = (() => { if (typeof window === "undefined") return null; const v = new URLSearchParams(window.location.search).get("cam"); if (!v) return null; const n = v.split(",").map(Number); return n.length === 6 ? n : null; })();

export function Cena() {
  const agentes = useEscritorio((s) => s.agentes);
  const ordem = useEscritorio((s) => s.ordem);
  const controles = useRef<any>(null);
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: CAM ? [CAM[0], CAM[1], CAM[2]] : [10, 30, 34], fov: 32, near: 0.5, far: 200 }} gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => useEscritorio.getState().selecionar(null)}>
      <color attach="background" args={["#DFE5EC"]} />
      <fog attach="fog" args={["#DFE5EC", 55, 110]} />
      <SoftShadows size={18} samples={10} focus={0.6} />
      <Luzes />
      <Suspense fallback={null}>
        <Predio />
        {ordem.map((id) => agentes[id] && <Agente key={id} def={agentes[id]} />)}
      </Suspense>
      <Despachante />
      <MapControls ref={controles} target={CAM ? [CAM[3], CAM[4], CAM[5]] : [0, 0, 1]} minDistance={5} maxDistance={48} minPolarAngle={0.35} maxPolarAngle={1.2} dampingFactor={0.08} enableDamping />
      <FocoCamera controles={controles} />
    </Canvas>
  );
}
