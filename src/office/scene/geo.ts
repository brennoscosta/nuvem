// Geometrias e materiais compartilhados (leve: cada forma é criada uma vez só).
import * as THREE from "three";

const geos = new Map<string, THREE.BufferGeometry>();
const mats = new Map<string, THREE.Material>();

export function caixa(x: number, y: number, z: number) {
  const k = `b${x},${y},${z}`; let g = geos.get(k);
  if (!g) { g = new THREE.BoxGeometry(x, y, z); geos.set(k, g); }
  return g;
}
export function cilindro(rt: number, rb: number, h: number, seg = 16) {
  const k = `c${rt},${rb},${h},${seg}`; let g = geos.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); geos.set(k, g); }
  return g;
}
export function esfera(r: number, seg = 16) {
  const k = `s${r},${seg}`; let g = geos.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)); geos.set(k, g); }
  return g;
}
export function capsula(r: number, len: number) {
  const k = `k${r},${len}`; let g = geos.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(r, len, 4, 10); geos.set(k, g); }
  return g;
}
export function plano(w: number, h: number) {
  const k = `p${w},${h}`; let g = geos.get(k);
  if (!g) { g = new THREE.PlaneGeometry(w, h); geos.set(k, g); }
  return g;
}
export function mat(cor: string, opts: { rough?: number; metal?: number; emissive?: string; ei?: number; opacity?: number } = {}) {
  const k = `${cor}|${opts.rough ?? 0.85}|${opts.metal ?? 0}|${opts.emissive ?? ""}|${opts.ei ?? 0}|${opts.opacity ?? 1}`;
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: cor, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? "#000000", emissiveIntensity: opts.ei ?? 0,
      transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1,
    });
    mats.set(k, m);
  }
  return m as THREE.MeshStandardMaterial;
}
export const COR = {
  madeira: "#D9B38C", madeiraEscura: "#8E6B4A", branco: "#F7F7F5", cinza: "#BFC4CC", grafite: "#3A3F47", preto: "#1F2227",
  vidro: "#BFE3F2", tela: "#1B2A3A", metal: "#9AA3AD", verde: "#4CAF50", planta: "#3E9B5B", vaso: "#C98E5E",
};
