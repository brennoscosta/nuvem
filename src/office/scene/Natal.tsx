"use client";
// Natal na cidade (12/11/2026, ideia escolhida pelo dono): de 1º de dezembro a 6 de janeiro (Dia de Reis), pelo horário
// de Brasília, a praça da Nuvem ganha uma árvore grande, os postes ganham pisca-pisca e cada empresa pode pôr a
// "Decoração de Natal" no lote (aba Fachada). Fora da época nada aparece; ?natal=1 liga e ?natal=0 desliga (prévias).
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { cilindro, caixa, mat } from "./geo";
import { ceu } from "./CicloDia";
import type { ItemInstancia } from "./Modelos";

export function natalAtivo(agora = new Date()): boolean {
  if (typeof window !== "undefined") { const q = new URLSearchParams(window.location.search).get("natal"); if (q === "1") return true; if (q === "0") return false; }
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", month: "numeric", day: "numeric" }).formatToParts(agora);
  const mes = Number(p.find((x) => x.type === "month")?.value), dia = Number(p.find((x) => x.type === "day")?.value);
  return mes === 12 || (mes === 1 && dia <= 6);
}

// lâmpadas coloridas que piscam: uma malha instanciada por cor, o brilho de cada cor sobe e desce fora de fase
const CORES = ["#FF3B3B", "#2BD46B", "#FFC53D", "#4DA3FF"];
let MATS: THREE.MeshStandardMaterial[] | null = null;
const materiais = () => (MATS ??= CORES.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, roughness: 0.35 })));
function piscar(t: number) { materiais().forEach((m, i) => { m.emissiveIntensity = (0.5 + ceu.noite * 1.6) * (0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7)); }); }
const GEO_BOLA = new THREE.SphereGeometry(1, 8, 6);

function Lampadas({ pontos, raio = 0.07 }: { pontos: [number, number, number][]; raio?: number }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const porCor = useMemo(() => CORES.map((_, c) => pontos.filter((_, i) => i % CORES.length === c)), [pontos]);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(raio, raio, raio);
    porCor.forEach((lista, c) => { const im = refs.current[c]; if (!im) return; lista.forEach((p, i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(...p), q, s))); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); });
  }, [porCor, raio]);
  useFrame(({ clock }) => piscar(clock.elapsedTime));
  return <>{porCor.map((lista, c) => <instancedMesh key={c} ref={(el) => { refs.current[c] = el; }} args={[GEO_BOLA, materiais()[c], Math.max(1, lista.length)]} frustumCulled={false} />)}</>;
}

// pontos numa espiral em volta de um cone (árvore) ou de um poste
function espiral(cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, voltas: number, n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1), a = t * voltas * Math.PI * 2, r = r0 + (r1 - r0) * t; return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r]; });
}

// árvore de Natal: camadas de cone, estrela, bolas e presentes na base
export function ArvoreNatal({ position = [0.5, 0, 17.4], escala = 1 }: { position?: [number, number, number]; escala?: number }) {
  const verde = mat("#1F7A3A", { rough: 0.9 }), verde2 = mat("#2A8F46", { rough: 0.9 });
  const camadas: [number, number, number][] = [[2.6, 2.4, 1.6], [2.1, 2.1, 3.2], [1.55, 1.8, 4.6], [1.0, 1.5, 5.8]]; // raio, altura, y
  const bolas = useMemo(() => {
    const l: [number, number, number][] = [];
    camadas.forEach(([r, h, y], k) => { const n = 9 - k * 2; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k; l.push([Math.cos(a) * r * 0.78, y - h * 0.32, Math.sin(a) * r * 0.78]); } });
    return l;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pisca = useMemo(() => espiral(0, 0, 0.9, 6.4, 2.45, 0.5, 4.5, 46), []);
  const estrela = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (estrela.current) estrela.current.rotation.y = clock.elapsedTime * 0.6; });
  return (
    <group position={position} scale={escala}>
      <mesh geometry={cilindro(0.28, 0.36, 1.1, 10)} material={mat("#6B4A2B", { rough: 0.95 })} position={[0, 0.55, 0]} castShadow />
      {camadas.map(([r, h, y], i) => <mesh key={i} geometry={coneGeo(r, h)} material={i % 2 ? verde2 : verde} position={[0, y, 0]} castShadow />)}
      <mesh ref={estrela} geometry={ESTRELA} material={mat("#FFD24A", { emissive: "#FFC21A", ei: 1.6, metal: 0.3 })} position={[0, 7.05, 0]} />
      {bolas.map((b, i) => <mesh key={i} geometry={GEO_BOLA} scale={0.17} material={mat(["#D62828", "#F2C14E", "#3A86FF", "#FFFFFF"][i % 4], { rough: 0.25, metal: 0.4 })} position={b} />)}
      <Lampadas pontos={pisca} raio={0.075} />
      {/* presentes */}
      {[[-1.6, 1.3, "#D62828", "#FFD24A"], [1.4, 1.5, "#3A86FF", "#FFFFFF"], [0.3, -1.9, "#22A86B", "#D62828"], [-1.1, -1.4, "#8B6CF0", "#FFD24A"]].map(([x, z, c, f], i) => (
        <group key={i} position={[x as number, 0, z as number]} rotation={[0, i * 0.6, 0]}>
          <mesh geometry={caixa(0.8, 0.6, 0.8)} material={mat(c as string, { rough: 0.6 })} position={[0, 0.3, 0]} castShadow />
          <mesh geometry={caixa(0.82, 0.62, 0.14)} material={mat(f as string, { rough: 0.5 })} position={[0, 0.31, 0]} />
          <mesh geometry={caixa(0.14, 0.62, 0.82)} material={mat(f as string, { rough: 0.5 })} position={[0, 0.31, 0]} />
        </group>
      ))}
    </group>
  );
}
const cones = new Map<string, THREE.ConeGeometry>();
const coneGeo = (r: number, h: number) => { const k = `${r},${h}`; let g = cones.get(k); if (!g) { g = new THREE.ConeGeometry(r, h, 14); cones.set(k, g); } return g; };
const ESTRELA = new THREE.OctahedronGeometry(0.42, 0);

// pisca-pisca enrolado nos postes da cidade
export function LuzesNatalPostes({ itens }: { itens: ItemInstancia[] }) {
  const pontos = useMemo(() => itens.flatMap((it) => espiral(it.pos[0], it.pos[2], 1.0, (it.altura ?? 5) - 0.9, 0.16, 0.12, 3, 10)), [itens]);
  return <Lampadas pontos={pontos} raio={0.06} />;
}

// decoração de Natal no lote da empresa: arvorezinha na entrada e luzinhas em volta do letreiro
export function NatalLote({ x = 3.1 }: { x?: number }) {
  return <ArvoreNatal position={[x, 0, -8.35]} escala={0.32} />;
}
export function NatalLetreiro({ y, z, largura }: { y: number; z: number; largura: number }) {
  const pontos = useMemo(() => {
    const l: [number, number, number][] = []; const n = Math.max(8, Math.round(largura / 0.45));
    for (let i = 0; i <= n; i++) { const x = -largura / 2 + (i * largura) / n; l.push([x, y + 0.72, z - 0.12], [x, y - 0.72, z - 0.12]); }
    for (const sx of [-1, 1]) for (let k = 1; k < 3; k++) l.push([sx * (largura / 2 + 0.05), y - 0.72 + k * 0.48, z - 0.12]);
    return l;
  }, [y, z, largura]);
  return <Lampadas pontos={pontos} raio={0.07} />;
}
