// Geometrias e materiais compartilhados (leve: cada forma é criada uma vez só).
// No modo leve os materiais são Lambert (sem reflexo especular): quase o mesmo visual, bem mais barato por pixel.
import * as THREE from "three";
import { leve } from "./qualidade";

const geos = new Map<string, THREE.BufferGeometry>();
const mats = new Map<string, THREE.Material>();

function cache<T extends THREE.BufferGeometry>(k: string, criar: () => T): T {
  let g = geos.get(k) as T | undefined;
  if (!g) { g = criar(); geos.set(k, g); }
  return g;
}
export const caixa = (x: number, y: number, z: number) => cache(`b${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z));
export const cilindro = (rt: number, rb: number, h: number, seg = 16) => cache(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const esfera = (r: number, seg = 16) => cache(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)));
export const capsula = (r: number, len: number) => cache(`k${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
export const plano = (w: number, h: number) => cache(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));
export const toro = (r: number, tubo: number, seg = 32, arco = Math.PI * 2) => cache(`t${r},${tubo},${seg},${arco}`, () => new THREE.TorusGeometry(r, tubo, 8, seg, arco));
export const circulo = (r: number, seg = 24) => cache(`o${r},${seg}`, () => new THREE.CircleGeometry(r, seg));
export const anel = (r0: number, r1: number, seg = 32) => cache(`a${r0},${r1},${seg}`, () => new THREE.RingGeometry(r0, r1, seg));

export type OpcoesMat = { rough?: number; metal?: number; emissive?: string; ei?: number; opacity?: number };
export function mat(cor: string, opts: OpcoesMat = {}) {
  const k = `${cor}|${opts.rough ?? 0.85}|${opts.metal ?? 0}|${opts.emissive ?? ""}|${opts.ei ?? 0}|${opts.opacity ?? 1}`;
  let m = mats.get(k);
  if (!m) {
    const comum = { color: cor, emissive: opts.emissive ?? "#000000", emissiveIntensity: opts.ei ?? 0, transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1, depthWrite: (opts.opacity ?? 1) >= 1 };
    m = leve()
      ? new THREE.MeshLambertMaterial(comum)
      : new THREE.MeshStandardMaterial({ ...comum, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0 });
    mats.set(k, m);
  }
  return m as THREE.MeshStandardMaterial;
}
export const COR = {
  madeira: "#D9B38C", madeiraEscura: "#8E6B4A", branco: "#F7F7F5", cinza: "#BFC4CC", grafite: "#3A3F47", preto: "#1F2227",
  vidro: "#BFE3F2", tela: "#1B2A3A", metal: "#9AA3AD", verde: "#4CAF50", planta: "#3E9B5B", vaso: "#C98E5E",
};
