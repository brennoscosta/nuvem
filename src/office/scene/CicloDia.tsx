"use client";
// Dia e noite do mapa (12/11/2026, ideia escolhida pelo dono). A cidade segue o horário de Brasília: dia, entardecer
// (17h30–19h30), noite (estrelas, lua, postes acesos) e amanhecer (5h–6h30). O botão da barra troca entre automático,
// sempre dia e sempre noite; ?hora=21 fixa uma hora (prévias e testes).
// `ceu` é lido a cada quadro por quem acende à noite (postes, faróis dos carros, horizonte).
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useHora } from "../cameraStore";
import type { ItemInstancia } from "./Modelos";

export const ceu = { noite: 0, crep: 0 };
const HORA_FIXA = (() => { if (typeof window === "undefined") return null; const h = new URLSearchParams(window.location.search).get("hora"); return h != null && h !== "" && Number.isFinite(Number(h)) ? Number(h) : null; })();

function horaBrasilia() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 12), m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + m / 60;
}
// 0 = dia pleno, 1 = noite plena, com rampas no entardecer e no amanhecer
export function noiteDaHora(h: number) {
  if (h >= 19.5 || h < 5) return 1;
  if (h >= 17.5) return (h - 17.5) / 2;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}

// paletas: dia, crepúsculo (pico no meio da rampa) e noite
const C = {
  fundo: [new THREE.Color("#CFE3F5"), new THREE.Color("#F2A774"), new THREE.Color("#0C1628")],
  hemiCeu: [new THREE.Color("#FFFFFF"), new THREE.Color("#FFD7B0"), new THREE.Color("#6F82BE")],
  hemiChao: [new THREE.Color("#CDD3DB"), new THREE.Color("#B48C7A"), new THREE.Color("#1A2030")],
  sol: [new THREE.Color("#FFF6E8"), new THREE.Color("#FF9F5A"), new THREE.Color("#A9BCFF")],
  horizonte: [new THREE.Color("#FFFFFF"), new THREE.Color("#F4B48C"), new THREE.Color("#28324A")],
};
const tmp = new THREE.Color();
function mistura(lista: THREE.Color[], n: number, crep: number, alvo: THREE.Color) {
  alvo.copy(lista[0]).lerp(lista[2], n); // dia → noite
  return alvo.lerp(lista[1], crep * 0.75); // puxa para o laranja no meio do caminho
}

// painéis do horizonte (fotos de dia): escurecem à noite
const horizonte = new Set<THREE.MeshBasicMaterial>();
export function registrarHorizonte(m: THREE.MeshBasicMaterial) { horizonte.add(m); }

interface Luzes { hemi: React.RefObject<THREE.HemisphereLight | null>; sol: React.RefObject<THREE.DirectionalLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }

function atualizar(scene: THREE.Scene, l: Luzes, dt: number) {
  const modo = useHora.getState().modo;
  const alvo = HORA_FIXA != null ? noiteDaHora(HORA_FIXA) : modo === "dia" ? 0 : modo === "noite" ? 1 : noiteDaHora(horaBrasilia());
  ceu.noite += (alvo - ceu.noite) * Math.min(1, dt * 1.5); // troca suave quando o modo muda
  const n = ceu.noite; const crep = Math.max(0, 1 - Math.abs(2 * n - 1)); ceu.crep = crep;
  if (scene.background instanceof THREE.Color) mistura(C.fundo, n, crep, scene.background);
  if (scene.fog) mistura(C.fundo, n, crep, (scene.fog as THREE.Fog).color);
  const h = l.hemi.current, s = l.sol.current, p = l.preench.current;
  if (h) { mistura(C.hemiCeu, n, crep, h.color); mistura(C.hemiChao, n, crep, h.groundColor); h.intensity = THREE.MathUtils.lerp(0.9, 0.42, n); }
  if (s) { mistura(C.sol, n, crep, s.color); s.intensity = THREE.MathUtils.lerp(2.2, 0.5, n) * (1 - crep * 0.25); }
  if (p) p.intensity = THREE.MathUtils.lerp(0.5, 0.15, n);
  mistura(C.horizonte, n, crep, tmp);
  for (const m of horizonte) m.color.copy(tmp);
}

export function CicloDia({ luzes }: { luzes: Luzes }) {
  const scene = useThree((s) => s.scene);
  useFrame((_, dt) => atualizar(scene, luzes, Math.min(dt, 0.1)));
  return <><Estrelas /><Lua /></>;
}

// ---------- céu da noite ----------
const MAT_ESTRELAS = new THREE.PointsMaterial({ color: "#FFFFFF", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
function Estrelas() {
  const geo = useMemo(() => {
    const n = 900, pos = new Float32Array(n * 3); let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85), R = 330; pos.set([Math.cos(th) * Math.sin(ph) * R, Math.cos(ph) * R + 20, Math.sin(th) * Math.sin(ph) * R], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  useFrame(() => { MAT_ESTRELAS.opacity = Math.max(0, ceu.noite - 0.35) / 0.65 * 0.9; });
  return <points geometry={geo} material={MAT_ESTRELAS} frustumCulled={false} renderOrder={-1} />;
}
const MAT_LUA = new THREE.MeshBasicMaterial({ color: "#F4F1E6", transparent: true, opacity: 0, fog: false, depthWrite: false });
function Lua() {
  useFrame(() => { MAT_LUA.opacity = Math.max(0, ceu.noite - 0.4) / 0.6; });
  return <mesh position={[-160, 150, -230]} material={MAT_LUA}><circleGeometry args={[9, 32]} /></mesh>;
}

// ---------- luz dos postes à noite ----------
// Mancha de luz no chão (textura radial somada) e a lâmpada acesa no alto de cada poste.
let TEX_LUZ: THREE.CanvasTexture | null = null;
export function texturaLuz() {
  if (TEX_LUZ || typeof document === "undefined") return TEX_LUZ;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,226,170,1)"); gr.addColorStop(0.45, "rgba(255,200,120,.45)"); gr.addColorStop(1, "rgba(255,190,110,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); TEX_LUZ = new THREE.CanvasTexture(c); TEX_LUZ.colorSpace = THREE.SRGBColorSpace; return TEX_LUZ;
}
const MAT_CHAO_LUZ = new THREE.MeshBasicMaterial({ color: "#FFE2AA", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
const MAT_LAMPADA = new THREE.MeshStandardMaterial({ color: "#4A4E55", emissive: "#FFD58A", emissiveIntensity: 0, roughness: 0.5 });
export function LuzesPostes({ itens }: { itens: ItemInstancia[] }) {
  const chao = useRef<THREE.InstancedMesh>(null), lamp = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const t = texturaLuz(); if (t) { MAT_CHAO_LUZ.map = t; MAT_CHAO_LUZ.needsUpdate = true; }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), um = new THREE.Vector3(1, 1, 1);
    itens.forEach((it, i) => {
      chao.current?.setMatrixAt(i, m.compose(new THREE.Vector3(it.pos[0], 0.03, it.pos[2]), q, um));
      lamp.current?.setMatrixAt(i, new THREE.Matrix4().makeTranslation(it.pos[0], (it.altura ?? 5) - 0.15, it.pos[2]));
    });
    if (chao.current) { chao.current.instanceMatrix.needsUpdate = true; chao.current.computeBoundingSphere(); }
    if (lamp.current) { lamp.current.instanceMatrix.needsUpdate = true; lamp.current.computeBoundingSphere(); }
  }, [itens]);
  useFrame(() => { MAT_CHAO_LUZ.opacity = ceu.noite * 0.55; MAT_LAMPADA.emissiveIntensity = ceu.noite * 3; });
  const geoChao = useMemo(() => new THREE.PlaneGeometry(9, 9), []), geoLamp = useMemo(() => new THREE.SphereGeometry(0.22, 10, 8), []);
  return (
    <>
      <instancedMesh ref={chao} args={[geoChao, MAT_CHAO_LUZ, itens.length]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={lamp} args={[geoLamp, MAT_LAMPADA, itens.length]} frustumCulled={false} />
    </>
  );
}
