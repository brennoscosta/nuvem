"use client";
// Boneco com esqueleto. Duas versões com os MESMOS ossos e as MESMAS animações:
//  - BonecoProcedural: desenhado em código (leve, cor da camisa e logo por material)
//  - BonecoGLB: modelo gerado no Higgsfield + esqueleto do scripts/bonecos/rig.mjs
import * as THREE from "three";
import { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Boneco as BonecoDef } from "../data/bonecos";

export type Pose = "idle" | "walk" | "sit" | "type" | "celebrate" | "think" | "blocked" | "carry";

const OSSOS = ["hips", "spine", "chest", "head", "upperArmL", "lowerArmL", "handL", "upperArmR", "lowerArmR", "handR", "upperLegL", "lowerLegL", "footL", "upperLegR", "lowerLegR", "footR"] as const;
type Osso = (typeof OSSOS)[number];
export type Ossos = Partial<Record<Osso, THREE.Object3D>>;

export interface BonecoHandle { ossos: Ossos; raiz: THREE.Group | null }

const D = Math.PI / 180;
const tmpE = new THREE.Euler();

// Pose alvo (graus) por osso. Oscilações usam t (segundos).
function alvo(pose: Pose, t: number, fase: number): Partial<Record<Osso, [number, number, number]>> & { hipsY?: number } {
  const s = (f: number, a: number, o = 0) => Math.sin(t * f + fase + o) * a;
  switch (pose) {
    case "walk": {
      const w = 9;
      return {
        hipsY: Math.abs(Math.sin(t * w + fase)) * 0.03,
        upperLegL: [s(w, 32), 0, 0], lowerLegL: [Math.max(0, -s(w, 45, 0.6)) + 5, 0, 0],
        upperLegR: [-s(w, 32), 0, 0], lowerLegR: [Math.max(0, s(w, 45, 0.6)) + 5, 0, 0],
        upperArmL: [-s(w, 24), 0, -8], upperArmR: [s(w, 24), 0, 8], lowerArmL: [-12, 0, 0], lowerArmR: [-12, 0, 0],
        spine: [4, s(w / 2, 3), 0], head: [-3, s(w / 2, 3), 0],
      };
    }
    case "sit":
    case "type": {
      const dig = pose === "type";
      return {
        hipsY: -0.07,
        upperLegL: [-88, 0, 4], lowerLegL: [88, 0, 0], upperLegR: [-88, 0, -4], lowerLegR: [88, 0, 0],
        upperArmL: [-58, 0, -10], lowerArmL: [-38 + (dig ? s(14, 5) : 0), 0, 0], handL: [dig ? s(18, 12) : 0, 0, 0],
        upperArmR: [-58, 0, 10], lowerArmR: [-38 + (dig ? s(14, 5, 1.5) : 0), 0, 0], handR: [dig ? s(18, 12, 2) : 0, 0, 0],
        spine: [6, 0, 0], head: [10 + (dig ? s(1.2, 3) : 0), dig ? s(0.9, 6) : 0, 0],
      };
    }
    case "celebrate": {
      const j = Math.abs(Math.sin(t * 7 + fase));
      return {
        hipsY: j * 0.09,
        upperArmL: [s(7, 10), 0, 125 + s(7, 12)], upperArmR: [s(7, 10), 0, -125 - s(7, 12)], lowerArmL: [0, 0, 20], lowerArmR: [0, 0, -20],
        upperLegL: [-j * 10, 0, 0], upperLegR: [-j * 10, 0, 0], lowerLegL: [j * 18, 0, 0], lowerLegR: [j * 18, 0, 0],
        head: [-12, s(3, 8), 0], spine: [-4, 0, 0],
      };
    }
    case "think":
      return { upperArmR: [-72, -25, 20], lowerArmR: [-118, 0, 0], handR: [0, 0, -30], upperArmL: [0, 0, 8], head: [8 + s(1.3, 3), 14, 10], spine: [3, 0, 0] };
    case "blocked":
      return { upperArmL: [-30, 0, -40], upperArmR: [-30, 0, 40], lowerArmL: [-40, 0, -20], lowerArmR: [-40, 0, 20], head: [-6, s(5, 14), 0], spine: [2, 0, 0] };
    case "carry":
      return { upperArmL: [-70, 0, -8], upperArmR: [-70, 0, 8], lowerArmL: [-45, 0, 0], lowerArmR: [-45, 0, 0], spine: [-4, 0, 0], head: [6, 0, 0] };
    default: // idle
      return {
        hipsY: s(2.1, 0.008),
        upperArmL: [s(1.7, 2), 0, -8 + s(2.1, 1.5)], upperArmR: [s(1.7, 2, 1), 0, 8 - s(2.1, 1.5)],
        lowerArmL: [-6, 0, 0], lowerArmR: [-6, 0, 0],
        spine: [s(2.1, 1.2), 0, 0], chest: [0, 0, 0], head: [s(1.1, 2), s(0.7, 10), 0],
        upperLegL: [0, 0, 2], upperLegR: [0, 0, -2], lowerLegL: [0, 0, 0], lowerLegR: [0, 0, 0],
      };
  }
}

// Aplica a pose com suavização. hipsBaseY = altura de descanso do quadril.
export function animar(ossos: Ossos, pose: Pose, t: number, dt: number, fase: number, hipsBaseY: number, escalaHips = 1) {
  const a = alvo(pose, t, fase);
  const k = 1 - Math.exp(-dt * 9);
  for (const nome of OSSOS) {
    const o = ossos[nome]; if (!o) continue;
    const r = a[nome] ?? [0, 0, 0];
    tmpE.set(r[0] * D, r[1] * D, r[2] * D);
    o.rotation.x += (tmpE.x - o.rotation.x) * k;
    o.rotation.y += (tmpE.y - o.rotation.y) * k;
    o.rotation.z += (tmpE.z - o.rotation.z) * k;
  }
  const h = ossos.hips;
  if (h) h.position.y += (hipsBaseY + (a.hipsY ?? 0) * escalaHips - h.position.y) * k;
}

// ---------- materiais compartilhados ----------
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(cor: string, rough = 0.85) {
  const k = cor + rough; let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: cor, roughness: rough, metalness: 0 }); matCache.set(k, m); }
  return m;
}
const geoCache = new Map<string, THREE.BufferGeometry>();
function capsula(r: number, len: number) {
  const k = `c${r}-${len}`; let g = geoCache.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2, 0); geoCache.set(k, g); }
  return g;
}
function esfera(r: number) {
  const k = `s${r}`; let g = geoCache.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, 18, 14); geoCache.set(k, g); }
  return g;
}
function caixa(x: number, y: number, z: number) {
  const k = `b${x}-${y}-${z}`; let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(x, y, z); geoCache.set(k, g); }
  return g;
}

interface Props { def: BonecoDef; camisa: string; headset?: boolean; cracha: string }

// Boneco desenhado em código. Altura ~1.1 m.
export const BonecoProcedural = forwardRef<BonecoHandle, Props>(function BonecoProcedural({ def, camisa, headset, cracha }, ref) {
  const raiz = useRef<THREE.Group>(null);
  const ossos = useRef<Ossos>({});
  const logo = useLoader(THREE.TextureLoader, "/brand/nuvem-branco.png");
  useEffect(() => { logo.colorSpace = THREE.SRGBColorSpace; logo.anisotropy = 4; }, [logo]);
  useImperativeHandle(ref, () => ({ ossos: ossos.current, raiz: raiz.current }), []);
  const reg = (nome: Osso) => (o: THREE.Object3D | null) => { if (o) ossos.current[nome] = o; };
  const pele = mat(def.pele), cab = mat(def.cabelo, 0.7), cam = mat(camisa), calca = mat(def.calca), tenis = mat("#F4F4F4", 0.6), preto = mat("#2A2D33", 0.5);
  const logoMat = useMemo(() => new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }), [logo]);
  const crachaMat = mat(cracha, 0.5);
  const S = { ombro: 0.2, bracoR: 0.055, bracoL: 0.17, antebracoL: 0.16, pernaR: 0.075, coxaL: 0.22, canelaL: 0.2, cabecaR: 0.23 };
  return (
    <group ref={raiz}>
      <group ref={reg("hips")} name="hips" position={[0, 0.5, 0]}>
        {/* quadril */}
        <mesh geometry={caixa(0.3, 0.14, 0.22)} material={calca} position={[0, 0.02, 0]} castShadow />
        {/* pernas */}
        {(["L", "R"] as const).map((lado) => {
          const sg = lado === "L" ? 1 : -1;
          return (
            <group key={lado} ref={reg(`upperLeg${lado}`)} name={`upperLeg${lado}`} position={[sg * 0.09, -0.02, 0]}>
              <mesh geometry={capsula(S.pernaR, S.coxaL)} material={calca} castShadow />
              <group ref={reg(`lowerLeg${lado}`)} name={`lowerLeg${lado}`} position={[0, -S.coxaL, 0]}>
                <mesh geometry={capsula(S.pernaR * 0.92, S.canelaL)} material={calca} castShadow />
                <group ref={reg(`foot${lado}`)} name={`foot${lado}`} position={[0, -S.canelaL - 0.02, 0.03]}>
                  <mesh geometry={caixa(0.14, 0.09, 0.22)} material={tenis} position={[0, 0, 0.02]} castShadow />
                </group>
              </group>
            </group>
          );
        })}
        <group ref={reg("spine")} name="spine" position={[0, 0.08, 0]}>
          <group ref={reg("chest")} name="chest" position={[0, 0.1, 0]}>
            {/* tronco (camisa) */}
            <mesh geometry={capsula(0.17, 0.2)} material={cam} position={[0, 0.2, 0]} scale={[1, 1, 0.78]} castShadow />
            {/* logo no peito */}
            <mesh geometry={caixa(0.17, 0.042, 0.001)} material={logoMat} position={[0, 0.09, 0.137]} />
            {/* crachá */}
            <mesh geometry={caixa(0.05, 0.065, 0.006)} material={crachaMat} position={[-0.09, 0.07, 0.135]} />
            {/* gola */}
            <mesh geometry={caixa(0.14, 0.03, 0.12)} material={cam} position={[0, 0.2, 0.02]} />
            {/* braços */}
            {(["L", "R"] as const).map((lado) => {
              const sg = lado === "L" ? 1 : -1;
              return (
                <group key={lado} ref={reg(`upperArm${lado}`)} name={`upperArm${lado}`} position={[sg * S.ombro, 0.16, 0]}>
                  <mesh geometry={capsula(S.bracoR, S.bracoL * 0.55)} material={cam} position={[0, 0.01, 0]} castShadow />
                  <mesh geometry={capsula(S.bracoR * 0.85, S.bracoL)} material={pele} />
                  <group ref={reg(`lowerArm${lado}`)} name={`lowerArm${lado}`} position={[0, -S.bracoL, 0]}>
                    <mesh geometry={capsula(S.bracoR * 0.8, S.antebracoL)} material={pele} castShadow />
                    <group ref={reg(`hand${lado}`)} name={`hand${lado}`} position={[0, -S.antebracoL - 0.01, 0]}>
                      <mesh geometry={esfera(0.06)} material={pele} />
                    </group>
                  </group>
                </group>
              );
            })}
            {/* cabeça */}
            <group ref={reg("head")} name="head" position={[0, 0.3, 0]}>
              <mesh geometry={esfera(S.cabecaR)} material={pele} position={[0, 0.2, 0]} castShadow />
              {/* olhos */}
              <mesh geometry={esfera(0.028)} material={preto} position={[-0.08, 0.2, 0.2]} />
              <mesh geometry={esfera(0.028)} material={preto} position={[0.08, 0.2, 0.2]} />
              {/* sorriso */}
              <mesh geometry={caixa(0.07, 0.012, 0.01)} material={mat("#B0533F")} position={[0, 0.12, 0.215]} />
              {/* cabelo */}
              {def.estiloCabelo !== "careca" && <mesh geometry={esfera(S.cabecaR + 0.025)} material={cab} position={[0, 0.235, -0.03]} scale={[1, 0.75, 1]} />}
              {def.estiloCabelo === "coque" && <mesh geometry={esfera(0.09)} material={cab} position={[0, 0.46, -0.08]} />}
              {def.estiloCabelo === "longo" && <mesh geometry={caixa(0.4, 0.3, 0.16)} material={cab} position={[0, 0.08, -0.14]} />}
              {/* óculos */}
              {def.oculos && <mesh geometry={caixa(0.25, 0.06, 0.02)} material={new THREE.MeshStandardMaterial({ color: "#222", transparent: true, opacity: 0.55 })} position={[0, 0.2, 0.215]} />}
              {/* headset */}
              {headset && (
                <>
                  <mesh geometry={caixa(0.06, 0.08, 0.06)} material={preto} position={[0.23, 0.17, 0.02]} />
                  <mesh geometry={caixa(0.06, 0.08, 0.06)} material={preto} position={[-0.23, 0.17, 0.02]} />
                  <mesh geometry={new THREE.TorusGeometry(0.235, 0.012, 6, 20, Math.PI)} material={preto} position={[0, 0.2, 0.02]} />
                  <mesh geometry={caixa(0.015, 0.015, 0.14)} material={preto} position={[0.14, 0.1, 0.1]} rotation={[0, 0.9, 0]} />
                </>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});

// Boneco do Higgsfield (GLB com esqueleto). Mesmos ossos.
export const BonecoGLB = forwardRef<BonecoHandle, { arquivo: string }>(function BonecoGLB({ arquivo }, ref) {
  const gltf = useGLTF(arquivo);
  const raiz = useRef<THREE.Group>(null);
  const cena = useMemo(() => cloneSkeleton(gltf.scene) as THREE.Group, [gltf.scene]);
  const ossos = useMemo(() => {
    const o: Ossos = {};
    for (const n of OSSOS) { const b = cena.getObjectByName(n); if (b) o[n] = b; }
    cena.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; (m as THREE.Mesh).frustumCulled = false; } });
    return o;
  }, [cena]);
  useImperativeHandle(ref, () => ({ ossos, raiz: raiz.current }), [ossos]);
  return <group ref={raiz} scale={1.1}><primitive object={cena} /></group>;
});

// Hook que anima um boneco a partir de uma pose
export function useAnimacao(handle: React.RefObject<BonecoHandle | null>, pose: () => Pose, fase: number, hipsBaseY = 0.5, escalaHips = 1) {
  useFrame((st, dt) => {
    const h = handle.current; if (!h) return;
    animar(h.ossos, pose(), st.clock.elapsedTime, Math.min(dt, 0.05), fase, hipsBaseY, escalaHips);
  });
}
// Altura de descanso do quadril de cada tipo de boneco
export const HIPS = { procedural: { base: 0.5, escala: 1 }, glb: { base: 0.34, escala: 0.75 } };
