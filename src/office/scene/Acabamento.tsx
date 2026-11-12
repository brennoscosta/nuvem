"use client";
// Acabamento da imagem no modo completo (12/11/2026, pedido do dono: "melhore a renderização"):
//  - reflexos de céu montados na hora (Environment com Lightformers, sem baixar imagem nenhuma): vidro, carros, água e
//    metal passam a refletir um céu de verdade em vez de um cinza chapado;
//  - a força desses reflexos acompanha o dia, a noite e a chuva (scene.environmentIntensity é só um número: não recompila);
//  - filtragem anisotrópica nas texturas (chão, ruas e fachadas ficam nítidos de longe e em ângulo).
// No modo leve nada disso é montado.
import * as THREE from "three";
import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { ceu } from "./CicloDia";
import { clima } from "../clima";

const CAMPOS_TEXTURA = ["map", "roughnessMap", "metalnessMap", "normalMap", "emissiveMap", "aoMap"] as const;

// fora do componente: as luzes são objetos do three.js, não estado do React
function compensarLuzes(h: THREE.HemisphereLight | null, p: THREE.DirectionalLight | null) {
  if (h) h.intensity *= 0.78;
  if (p) p.intensity *= 0.85;
}
// hemi e preench: o reflexo de céu já ilumina por todo lado, então a luz de preenchimento (que o CicloDia ajusta a cada
// quadro, antes deste componente) cai um pouco para a cena não ficar lavada e as formas ganharem volume
export function Acabamento({ hemi, preench }: { hemi: React.RefObject<THREE.HemisphereLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }) {
  const scene = useThree((s) => s.scene), gl = useThree((s) => s.gl);
  useFrame((estado) => {
    const chuva = Math.min(1, Math.max(0, clima.chuva));
    estado.scene.environmentIntensity = 0.55 * (1 - 0.85 * ceu.noite) * (1 - 0.35 * chuva);
    compensarLuzes(hemi.current, preench.current);
  });
  useEffect(() => {
    const max = Math.min(8, gl.capabilities.getMaxAnisotropy());
    // os modelos chegam aos poucos: passa de novo algumas vezes (cada textura só é reenviada uma vez)
    const aplicar = () => scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; if (!m) return;
      for (const x of Array.isArray(m) ? m : [m]) for (const k of CAMPOS_TEXTURA) {
        const t = (x as unknown as Record<string, THREE.Texture | null | undefined>)[k];
        if (t && t.anisotropy < max) { t.anisotropy = max; t.needsUpdate = true; }
      }
    });
    const ts = [4000, 15000, 40000].map((ms) => setTimeout(aplicar, ms));
    return () => ts.forEach(clearTimeout);
  }, [scene, gl]);
  return (
    <Environment frames={1} resolution={128} background={false}>
      {/* céu: abóbada azul clara em cima, horizonte mais quente, laterais frias e o sol forte na direção da luz principal */}
      <Lightformer form="rect" intensity={1.4} color="#CFE3F5" position={[0, 30, 0]} scale={[90, 90, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#FFEBD2" position={[0, 5, -40]} scale={[120, 14, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#DCE8FF" position={[40, 5, 0]} scale={[120, 14, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#DCE8FF" position={[-40, 5, 0]} scale={[120, 14, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#FFE3BD" position={[0, 5, 40]} scale={[120, 14, 1]} />
      {/* chão: reflexo escuro e neutro (sem ele o vidro "refletiria" céu de baixo para cima) */}
      <Lightformer form="rect" intensity={0.25} color="#8C9096" position={[0, -20, 0]} scale={[120, 120, 1]} />
      <Lightformer form="circle" intensity={7} color="#FFF4E0" position={[24, 44, 20]} scale={8} />
    </Environment>
  );
}
