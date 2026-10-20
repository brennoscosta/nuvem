"use client";
// Vista "por fora": prédio térreo comprido, fechado em cortina de vidro azulada com grade escura e faixas brancas
// (referência: sede do Google), nome grande no vidro, letreiro no topo e jardim de arbustos na frente. Só aparece com vista === "fora".
import * as THREE from "three";
import { useMemo } from "react";
import { caixa, plano, esfera, mat } from "./geo";
import { LetreiroNuvem, IconeNuvem } from "./Predio";
import { useEscritorio } from "../store";
import { PREDIO } from "../data/layout";

const W = PREDIO.x1 - PREDIO.x0 + 1.6, D = 19.6, H = 6.6; // envelope (x ±36.8, z ±9.8); pé-direito alto, estilo galpão de vidro
const ESTRUTURA = "#1F2630";
const FAIXA = "#F4F1EB";

function Vidro({ w, h, position, rotation }: { w: number; h: number; position: [number, number, number]; rotation: [number, number, number] }) {
  const m = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#9FD0F0", transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0.08, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.6 }), []);
  return <mesh geometry={plano(w, h)} material={m} position={position} rotation={rotation} />;
}

function ParedeVidro({ comprimento, position, rotation }: { comprimento: number; position: [number, number, number]; rotation: number }) {
  const n = Math.round(comprimento / 2.4);
  const est = mat(ESTRUTURA, { rough: 0.6, metal: 0.3 });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Vidro w={comprimento} h={H} position={[0, H / 2, 0]} rotation={[0, 0, 0]} />
      {/* montantes verticais finos (grade do vidro) */}
      {Array.from({ length: n + 1 }).map((_, i) => (
        <mesh key={i} geometry={caixa(0.1, H, 0.1)} material={est} position={[-comprimento / 2 + (i * comprimento) / n, H / 2, 0]} castShadow />
      ))}
      {/* travessas escuras */}
      {[1.2, 2.4, 4.6].map((y) => <mesh key={y} geometry={caixa(comprimento, 0.08, 0.12)} material={est} position={[0, y, 0]} />)}
      {/* faixas brancas horizontais (base, meio e topo), como na foto */}
      <mesh geometry={caixa(comprimento, 0.35, 0.3)} material={mat(FAIXA, { rough: 0.9 })} position={[0, 0.18, 0]} />
      <mesh geometry={caixa(comprimento, 0.42, 0.34)} material={mat(FAIXA, { rough: 0.9 })} position={[0, 3.5, 0]} />
      <mesh geometry={caixa(comprimento, 0.5, 0.4)} material={mat(FAIXA, { rough: 0.9 })} position={[0, H - 0.25, 0]} castShadow />
    </group>
  );
}

// arbusto redondo (3 esferas) — jardim da frente
function Arbusto({ position, r = 0.55, cor = "#3E9B5B" }: { position: [number, number, number]; r?: number; cor?: string }) {
  return (
    <group position={position}>
      <mesh geometry={esfera(r, 10)} material={mat(cor, { rough: 1 })} position={[0, r * 0.85, 0]} castShadow />
      <mesh geometry={esfera(r * 0.8, 10)} material={mat("#58B06A", { rough: 1 })} position={[r * 0.7, r * 0.7, r * 0.3]} />
      <mesh geometry={esfera(r * 0.7, 10)} material={mat("#2F8A4C", { rough: 1 })} position={[-r * 0.65, r * 0.6, -r * 0.2]} />
    </group>
  );
}

export function Fachada() {
  const vista = useEscritorio((s) => s.vista);
  const arbustos = useMemo(() => {
    const lista: { p: [number, number, number]; r: number; cor: string }[] = [];
    const cores = ["#3E9B5B", "#4CAF50", "#7CB342", "#2F8A4C"];
    // fileira na frente (sul) e atrás (norte), com variação
    for (let x = -34; x <= 34; x += 2.2) { lista.push({ p: [x + ((x * 7) % 3) * 0.2, 0, D / 2 + 1.6 + ((x * 5) % 4) * 0.25], r: 0.45 + ((x * 3) % 4) * 0.08, cor: cores[Math.abs(Math.round(x)) % cores.length] }); }
    for (let x = -30; x <= 30; x += 3.1) { lista.push({ p: [x, 0, -D / 2 - 1.5], r: 0.5, cor: cores[(Math.abs(Math.round(x)) + 1) % cores.length] }); }
    return lista;
  }, []);
  if (vista !== "fora") return null;
  const cx = (PREDIO.x0 + PREDIO.x1) / 2;
  const nx = Math.round(W / 2.4), nz = Math.round(D / 2.4);
  const est = mat(ESTRUTURA, { rough: 0.6, metal: 0.3 });
  return (
    <group position={[cx, 0, 0]}>
      {/* paredes de vidro */}
      <ParedeVidro comprimento={W} position={[0, 0, D / 2]} rotation={0} />
      <ParedeVidro comprimento={W} position={[0, 0, -D / 2]} rotation={Math.PI} />
      <ParedeVidro comprimento={D} position={[W / 2, 0, 0]} rotation={-Math.PI / 2} />
      <ParedeVidro comprimento={D} position={[-W / 2, 0, 0]} rotation={Math.PI / 2} />
      {/* telhado de vidro com grelha + platibanda branca */}
      <Vidro w={W} h={D} position={[0, H, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {Array.from({ length: nx + 1 }).map((_, i) => <mesh key={"x" + i} geometry={caixa(0.1, 0.1, D)} material={est} position={[-W / 2 + (i * W) / nx, H, 0]} />)}
      {Array.from({ length: nz + 1 }).map((_, i) => <mesh key={"z" + i} geometry={caixa(W, 0.1, 0.1)} material={est} position={[0, H, -D / 2 + (i * D) / nz]} />)}
      {[[0, D / 2, W + 0.8, 0.6], [0, -D / 2, W + 0.8, 0.6], [W / 2, 0, 0.6, D + 0.8], [-W / 2, 0, 0.6, D + 0.8]].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={caixa(w, 0.6, d)} material={mat(FAIXA, { rough: 0.9 })} position={[x, H + 0.15, z]} castShadow />
      ))}
      {/* bloco técnico no topo (como o volume cinza da foto) */}
      <mesh geometry={caixa(W * 0.16, 1.0, D * 0.36)} material={mat("#CDD3D9", { rough: 0.8 })} position={[W * 0.36, H + 0.9, -D * 0.12]} castShadow />
      {/* porta de entrada (oeste) com marquise */}
      <mesh geometry={caixa(0.2, 2.6, 4.4)} material={est} position={[-W / 2, 1.3, -2]} />
      <mesh geometry={caixa(0.1, 2.3, 3.8)} material={mat("#8FB9E8", { rough: 0.1, metal: 0.2, opacity: 0.6 })} position={[-W / 2 - 0.02, 1.25, -2]} />
      <mesh geometry={caixa(2.6, 0.16, 5.4)} material={mat(FAIXA, { rough: 0.9 })} position={[-W / 2 - 1.1, 2.9, -2]} castShadow />
      {/* nome grande no vidro da frente (como o "Google" da foto) e letreiro no topo */}
      <group position={[-W * 0.18, 3.9, D / 2 + 0.3]}><LetreiroNuvem fundo={false} tamanho={2.1} cor="#FFFFFF" /></group>
      <group position={[0, H + 0.75, -1.5]}>
        <mesh geometry={caixa(12, 0.4, 1.6)} material={est} position={[0, 0.2, 0]} castShadow />
        <group position={[0, 0.4, 0.2]}><LetreiroNuvem fundo={false} tamanho={2.2} /></group>
      </group>
      <IconeNuvem position={[-W / 2 + 3, H + 0.45, D / 2 - 3]} escala={1.5} cor="#FFFFFF" ei={0.15} />
      {/* jardim: canteiro baixo + arbustos na frente e atrás */}
      <mesh geometry={caixa(W - 2, 0.3, 2.6)} material={mat("#D8D3CA", { rough: 0.9 })} position={[0, 0.15, D / 2 + 2.1]} receiveShadow />
      <mesh geometry={caixa(W - 2.4, 0.08, 2.2)} material={mat("#5C4634", { rough: 1 })} position={[0, 0.33, D / 2 + 2.1]} />
      {arbustos.map((a, i) => <Arbusto key={i} position={[a.p[0], a.p[2] > 0 ? 0.3 : 0, a.p[2]]} r={a.r} cor={a.cor} />)}
    </group>
  );
}
