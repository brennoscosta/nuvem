"use client";
// Gráficos leves (24/11/2026, mapa lento): muita peça ainda chegava à cena com o material "físico" (MeshStandardMaterial,
// o mais caro de pintar, pixel por pixel) — modelos GLB, bonecos, enfeites, letreiros. Aqui cada um é trocado por uma
// cópia no material simples (MeshLambertMaterial), com a mesma cor, textura, transparência e brilho próprio. Também
// diminui os tipos de material diferentes (cada tipo é um programa a compilar na placa de vídeo: as travadinhas ao abrir).
// Fica de fora quem tem sombreador próprio (onBeforeCompile: árvores, fachadas, céu), vidro com reflexo (envMap) e o
// material físico avançado (MeshPhysicalMaterial).
// O que o código muda depois no material original (cor, brilho à noite, opacidade, textura que chega) é copiado para a
// cópia; o que ele muda direto na malha (mesh.material) já cai na cópia.
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

interface Par { o: THREE.MeshStandardMaterial; c: THREE.MeshLambertMaterial; cor: number; emi: number; ei: number; op: number; vis: boolean; map: THREE.Texture | null; emap: THREE.Texture | null; tr: boolean }
const COPIAS = new WeakMap<THREE.Material, THREE.MeshLambertMaterial | null>();
const PARES: Par[] = [];

function copiar(o: THREE.MeshStandardMaterial): THREE.MeshLambertMaterial | null {
  if (COPIAS.has(o)) return COPIAS.get(o)!;
  const proprio = Object.prototype.hasOwnProperty.call(o, "onBeforeCompile") || Object.prototype.hasOwnProperty.call(o, "customProgramCacheKey");
  if (proprio || (o as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial || o.envMap || o.userData?.semTrocaLeve) { COPIAS.set(o, null); return null; }
  const c = new THREE.MeshLambertMaterial({
    color: o.color, map: o.map, emissive: o.emissive, emissiveMap: o.emissiveMap, emissiveIntensity: o.emissiveIntensity,
    alphaMap: o.alphaMap, aoMap: o.aoMap, aoMapIntensity: o.aoMapIntensity, lightMap: o.lightMap, lightMapIntensity: o.lightMapIntensity,
    transparent: o.transparent, opacity: o.opacity, alphaTest: o.alphaTest, side: o.side, vertexColors: o.vertexColors,
    depthWrite: o.depthWrite, depthTest: o.depthTest, blending: o.blending, toneMapped: o.toneMapped, fog: o.fog, flatShading: o.flatShading,
    polygonOffset: o.polygonOffset, polygonOffsetFactor: o.polygonOffsetFactor, polygonOffsetUnits: o.polygonOffsetUnits,
    visible: o.visible, wireframe: o.wireframe, colorWrite: o.colorWrite, premultipliedAlpha: o.premultipliedAlpha,
  });
  c.name = o.name; c.userData = { ...o.userData, copiaLeve: true };
  COPIAS.set(o, c);
  PARES.push({ o, c, cor: o.color.getHex(), emi: o.emissive.getHex(), ei: o.emissiveIntensity, op: o.opacity, vis: o.visible, map: o.map, emap: o.emissiveMap, tr: o.transparent });
  return c;
}

function trocar(cena: THREE.Object3D) {
  cena.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    if (Array.isArray(m.material)) {
      let mudou = false;
      const lista = m.material.map((mt) => { const s = (mt as THREE.MeshStandardMaterial).isMeshStandardMaterial ? copiar(mt as THREE.MeshStandardMaterial) : null; if (s) mudou = true; return s ?? mt; });
      if (mudou) m.material = lista;
    } else if ((m.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const s = copiar(m.material as THREE.MeshStandardMaterial); if (s) m.material = s;
    }
  });
}

// só acompanha o que o original mudou desde a última olhada (assim a mudança feita direto na cópia não é desfeita)
function acompanhar() {
  for (const p of PARES) {
    const { o, c } = p;
    const cor = o.color.getHex(); if (cor !== p.cor) { p.cor = cor; c.color.copy(o.color); }
    const emi = o.emissive.getHex(); if (emi !== p.emi) { p.emi = emi; c.emissive.copy(o.emissive); }
    if (o.emissiveIntensity !== p.ei) { p.ei = o.emissiveIntensity; c.emissiveIntensity = o.emissiveIntensity; }
    if (o.opacity !== p.op) { p.op = o.opacity; c.opacity = o.opacity; }
    if (o.visible !== p.vis) { p.vis = o.visible; c.visible = o.visible; }
    if (o.map !== p.map || o.emissiveMap !== p.emap || o.transparent !== p.tr) {
      p.map = o.map; p.emap = o.emissiveMap; p.tr = o.transparent;
      c.map = o.map; c.emissiveMap = o.emissiveMap; c.transparent = o.transparent; c.needsUpdate = true;
    }
  }
}

export function MateriaisLeves() {
  const cena = useThree((s) => s.scene);
  const n = useRef(0);
  useFrame(() => {
    // roda antes do desenho do quadro: o que entrou na cena troca de material antes de o físico chegar a ser compilado.
    // Nos primeiros ~20 s (a cidade montando em etapas, modelos chegando) olha todo quadro; depois, a cada ~0,5 s
    const k = n.current++;
    if (k < 600 || k % 15 === 0) trocar(cena);
    acompanhar();
  });
  return null;
}
