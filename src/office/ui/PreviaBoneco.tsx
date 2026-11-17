"use client";
// Prévia 3D do painel "Meu personagem" (16/11/2026): o mesmo boneco do mapa, parado respirando e girando devagar.
// Arrastar gira com a mão (e solta com inércia); `perto` aproxima a câmera do rosto. Canvas próprio e pequeno, que só
// existe enquanto o painel está aberto.
import * as THREE from "three";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle } from "../scene/Boneco";
import { SombraContato } from "../scene/SombraContato";
import { leve } from "../scene/qualidade";
import type { Boneco } from "../data/bonecos";

type Giro = { angulo: number; vel: number; segurando: boolean; ultimoX: number };
const CAM_CORPO = { pos: new THREE.Vector3(0, 0.95, 3.1), alvo: new THREE.Vector3(0, 0.72, 0) };
const CAM_ROSTO = { pos: new THREE.Vector3(0, 1.3, 1.9), alvo: new THREE.Vector3(0, 1.13, 0) };

function Cena({ def, camisa, acessorios, perto }: { def: Boneco; camisa: string; acessorios?: string[]; perto: boolean }) {
  const g = useRef<THREE.Group>(null);
  const giro = useRef<Giro>({ angulo: -0.5, vel: 0.45, segurando: false, ultimoX: 0 });
  const el = useThree((s) => s.gl.domElement);
  // arrastar gira o boneco (o resto do tempo ele gira sozinho, devagar)
  useEffect(() => {
    const descer = (e: PointerEvent) => { const gi = giro.current; gi.segurando = true; gi.ultimoX = e.clientX; gi.vel = 0; el.setPointerCapture(e.pointerId); };
    const mover = (e: PointerEvent) => { const gi = giro.current; if (!gi.segurando) return; const dx = e.clientX - gi.ultimoX; gi.ultimoX = e.clientX; gi.angulo += dx * 0.012; gi.vel = dx * 0.6; };
    const soltar = () => { giro.current.segurando = false; };
    el.addEventListener("pointerdown", descer); el.addEventListener("pointermove", mover); el.addEventListener("pointerup", soltar); el.addEventListener("pointercancel", soltar);
    return () => { el.removeEventListener("pointerdown", descer); el.removeEventListener("pointermove", mover); el.removeEventListener("pointerup", soltar); el.removeEventListener("pointercancel", soltar); };
  }, [el]);
  const h = useRef<BonecoHandle>(null);
  const alvo = useRef(new THREE.Vector3().copy(CAM_CORPO.alvo));
  useAnimacao(h, () => "idle", 0.9, HIPS.procedural.base);
  useFrame(({ camera }, dt) => {
    dt = Math.min(dt, 0.05);
    const gi = giro.current;
    if (!gi.segurando) { gi.vel += (0.45 - gi.vel) * Math.min(1, dt * 1.5); gi.angulo += gi.vel * dt; } // volta a girar devagar
    if (g.current) g.current.rotation.y = gi.angulo;
    const c = perto ? CAM_ROSTO : CAM_CORPO, k = Math.min(1, dt * 6);
    camera.position.lerp(c.pos, k); alvo.current.lerp(c.alvo, k); camera.lookAt(alvo.current);
  });
  return (
    <>
      <hemisphereLight args={["#FFFFFF", "#8A93A3", 1.5]} />
      <directionalLight position={[1.6, 3, 2.4]} intensity={1.7} />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={0.5} color="#C7D7FF" />
      <group ref={g}>
        <Suspense fallback={null}><BonecoProcedural ref={h} def={def} camisa={camisa} cracha="#FFD166" acessorios={acessorios} /></Suspense>
      </group>
      <SombraContato r={0.42} />
    </>
  );
}

export function PreviaBoneco({ def, camisa, acessorios, perto = false, className }: { def: Boneco; camisa: string; acessorios?: string[]; perto?: boolean; className?: string }) {
  return (
    <div className={`touch-pan-y select-none ${className ?? ""}`} style={{ cursor: "grab" }}>
      <Canvas dpr={leve() ? 1 : [1, 2]} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} camera={{ fov: 30, near: 0.05, far: 30, position: [CAM_CORPO.pos.x, CAM_CORPO.pos.y, CAM_CORPO.pos.z] }} style={{ width: "100%", height: "100%" }}>
        <Cena def={def} camisa={camisa} acessorios={acessorios} perto={perto} />
      </Canvas>
    </div>
  );
}
