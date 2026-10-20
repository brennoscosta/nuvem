"use client";
// Vista "por fora": o escritório fechado numa caixa de vidro com estrutura escura, telhado de vidro,
// nome na fachada e um letreiro grande no topo. Só aparece quando vista === "fora".
import * as THREE from "three";
import { useMemo } from "react";
import { caixa, plano, mat } from "./geo";
import { LetreiroNuvem, IconeNuvem } from "./Predio";
import { useEscritorio } from "../store";

const W = 37.6, D = 19.6, H = 4.8; // envelope ao redor do prédio (x ±18.8, z ±9.8)
const ESTRUTURA = "#1F2630";

function Vidro({ w, h, position, rotation }: { w: number; h: number; position: [number, number, number]; rotation: [number, number, number] }) {
  const m = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#BFE3F7", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.6 }), []);
  return <mesh geometry={plano(w, h)} material={m} position={position} rotation={rotation} />;
}

function ParedeVidro({ comprimento, position, rotation }: { comprimento: number; position: [number, number, number]; rotation: number }) {
  const n = Math.round(comprimento / 3.1);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Vidro w={comprimento} h={H} position={[0, H / 2, 0]} rotation={[0, 0, 0]} />
      {/* montantes verticais */}
      {Array.from({ length: n + 1 }).map((_, i) => (
        <mesh key={i} geometry={caixa(0.14, H, 0.14)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[-comprimento / 2 + (i * comprimento) / n, H / 2, 0]} castShadow />
      ))}
      {/* travessas */}
      <mesh geometry={caixa(comprimento, 0.22, 0.2)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[0, 0.11, 0]} />
      <mesh geometry={caixa(comprimento, 0.1, 0.16)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[0, 2.4, 0]} />
      <mesh geometry={caixa(comprimento, 0.3, 0.3)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[0, H - 0.15, 0]} castShadow />
    </group>
  );
}

export function Fachada() {
  const vista = useEscritorio((s) => s.vista);
  if (vista !== "fora") return null;
  const nx = Math.round(W / 3.1), nz = Math.round(D / 3.1);
  return (
    <group>
      {/* paredes de vidro */}
      <ParedeVidro comprimento={W} position={[0, 0, D / 2]} rotation={0} />
      <ParedeVidro comprimento={W} position={[0, 0, -D / 2]} rotation={Math.PI} />
      <ParedeVidro comprimento={D} position={[W / 2, 0, 0]} rotation={-Math.PI / 2} />
      <ParedeVidro comprimento={D} position={[-W / 2, 0, 0]} rotation={Math.PI / 2} />
      {/* telhado de vidro com grelha */}
      <Vidro w={W} h={D} position={[0, H, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {Array.from({ length: nx + 1 }).map((_, i) => <mesh key={"x" + i} geometry={caixa(0.12, 0.12, D)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[-W / 2 + (i * W) / nx, H, 0]} />)}
      {Array.from({ length: nz + 1 }).map((_, i) => <mesh key={"z" + i} geometry={caixa(W, 0.12, 0.12)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[0, H, -D / 2 + (i * D) / nz]} />)}
      {/* platibanda branca (borda do telhado) */}
      {[[0, D / 2, W + 0.6, 0.5], [0, -D / 2, W + 0.6, 0.5], [W / 2, 0, 0.5, D + 0.6], [-W / 2, 0, 0.5, D + 0.6]].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={caixa(w, 0.5, d)} material={mat("#F4F1EB", { rough: 0.9 })} position={[x, H + 0.1, z]} castShadow />
      ))}
      {/* porta de entrada (oeste) com marquise */}
      <mesh geometry={caixa(0.2, 2.6, 4.4)} material={mat(ESTRUTURA, { rough: 0.6, metal: 0.3 })} position={[-W / 2, 1.3, -2]} />
      <mesh geometry={caixa(0.1, 2.3, 3.8)} material={mat("#8FB9E8", { rough: 0.1, metal: 0.2, opacity: 0.6 })} position={[-W / 2 - 0.02, 1.25, -2]} />
      <mesh geometry={caixa(2.6, 0.16, 5.4)} material={mat("#F4F1EB", { rough: 0.9 })} position={[-W / 2 - 1.1, 2.9, -2]} castShadow />
      {/* nome na fachada da frente (sul) e letreiro grande no topo */}
      <group position={[0, 1.1, D / 2 + 0.35]}><LetreiroNuvem fundo={false} tamanho={1.5} /></group>
      <group position={[0, H + 0.6, -2]}>
        <mesh geometry={caixa(13, 0.5, 2)} material={mat(ESTRUTURA, { rough: 0.8 })} position={[0, 0.25, 0]} castShadow />
        <group position={[0, 0.5, 0.2]}><LetreiroNuvem fundo={false} tamanho={2.6} /></group>
      </group>
      {/* ícone de nuvem grande nos cantos do telhado */}
      <IconeNuvem position={[-W / 2 + 3, H + 0.35, -D / 2 + 3]} escala={1.6} cor="#FFFFFF" ei={0.15} />
      <IconeNuvem position={[W / 2 - 3, H + 0.35, D / 2 - 3]} escala={1.6} cor="#FFFFFF" ei={0.15} />
    </group>
  );
}
