"use client";
// Esfera de vidro (refração de verdade, MeshTransmissionMaterial) com um pedacinho do mundo dentro: grama e o prédio
// de vidro. O fundo azul-oceano é um plano do tamanho exato da tela, com manchas de luz perto da
// esfera para ela ter o que refratar. A posição e o tamanho vêm do layout (alvo: frações da seção).
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial, useTexture } from "@react-three/drei";
import { Suspense, useMemo, useRef, type RefObject } from "react";

export interface AlvoEsfera { fx: number; fy: number; fr: number }
const Z_FUNDO = -5;

function Fundo({ alvo }: { alvo: AlvoEsfera }) {
  const { camera, viewport } = useThree();
  const v = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, Z_FUNDO));
  const tex = useMemo(() => {
    const W = 1024, H = 768, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
    const l = g.createLinearGradient(0, 0, 0, H); l.addColorStop(0, "#061833"); l.addColorStop(0.55, "#0A3F80"); l.addColorStop(1, "#2E86D8"); g.fillStyle = l; g.fillRect(0, 0, W, H);
    const cx = (0.5 + alvo.fx) * W, cy = (0.5 + alvo.fy) * H, r = alvo.fr * H;
    const manchas: [number, number, number, string][] = [[cx - r * 0.9, cy - r * 0.8, r * 1.3, "rgba(255,110,190,.42)"], [cx + r * 1.1, cy + r * 0.2, r * 1.5, "rgba(110,225,255,.42)"], [cx - r * 0.2, cy + r * 1.2, r * 1.1, "rgba(255,255,255,.32)"]];
    for (const [x, y, rr, cor] of manchas) { const rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, cor); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [alvo.fx, alvo.fy, alvo.fr]);
  return <mesh position={[0, 0, Z_FUNDO]} scale={[v.width * 1.01, v.height * 1.01, 1]}><planeGeometry /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
}

// O prédio dentro da esfera é a foto renderizada (o modelo 3D de vidro vira um bloco branco no buffer de refração).
// Ele anda um pouco ao contrário do mouse dentro do vidro: a refração mostra a profundidade.
function Conteudo() {
  const tex = useTexture("/workend/predios/vidro.webp", (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; });
  return (
    <group>
      <mesh position={[0, -0.44, 0]} rotation={[0.3, 0, 0]}><cylinderGeometry args={[0.47, 0.51, 0.05, 48]} /><meshStandardMaterial color="#7CC46A" roughness={0.9} /></mesh>
      <mesh position={[0, -0.02, 0.05]}><planeGeometry args={[1.02, 1.02]} /><meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} /></mesh>
    </group>
  );
}

function Esfera({ alvo, leve }: { alvo: AlvoEsfera; leve: boolean }) {
  const { viewport } = useThree();
  const g = useRef<THREE.Group>(null), dentro = useRef<THREE.Group>(null);
  const R = Math.max(0.6, alvo.fr * viewport.height);
  const bx = alvo.fx * viewport.width, by = -alvo.fy * viewport.height;
  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    if (g.current) {
      g.current.position.x += (bx + pointer.x * 0.06 * R - g.current.position.x) * 0.05;
      g.current.position.y += (by + Math.sin(t * 0.8) * 0.05 * R + pointer.y * 0.04 * R - g.current.position.y) * 0.05;
    }
    if (dentro.current) {
      dentro.current.position.x += (-pointer.x * 0.14 - dentro.current.position.x) * 0.06;
      dentro.current.position.y += (-pointer.y * 0.07 + Math.sin(t * 1.1) * 0.015 - dentro.current.position.y) * 0.06;
      dentro.current.rotation.z = Math.sin(t * 0.6) * 0.025;
    }
  });
  return (
    <group ref={g} position={[bx, by, 0]} scale={R}>
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <MeshTransmissionMaterial samples={leve ? 3 : 6} resolution={leve ? 512 : 1024} thickness={0.3} roughness={0} ior={1.18} chromaticAberration={0.05} anisotropy={0.08} distortion={0.06} distortionScale={0.25} temporalDistortion={0.02} color="#FFFFFF" />
      </mesh>
      <group ref={dentro}><Conteudo /></group>
    </group>
  );
}

export default function EsferaVidro({ alvo, ativa, fonte, leve = false, onPronto }: { alvo: AlvoEsfera; ativa: boolean; fonte: RefObject<HTMLElement | null>; leve?: boolean; onPronto?: () => void }) {
  return (
    <Canvas dpr={[1, leve ? 1.25 : 1.75]} camera={{ position: [0, 0, 7.5], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={ativa ? "always" : "never"} eventSource={fonte as RefObject<HTMLElement>} eventPrefix="client" onCreated={() => onPronto?.()} aria-hidden>
      <Suspense fallback={null}>
        <Fundo alvo={alvo} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={1.5} />
        <Esfera alvo={alvo} leve={leve} />
        <Environment resolution={256}>
          <Lightformer intensity={1.6} position={[1.5, 4, 3]} scale={[3, 1, 1]} />
          <Lightformer intensity={1.3} position={[-4, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#FFB3D9" />
          <Lightformer intensity={1.3} position={[4, -1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} color="#A8E4FF" />
        </Environment>
      </Suspense>
    </Canvas>
  );
}
