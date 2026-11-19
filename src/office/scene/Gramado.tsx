"use client";
// Gramado com detalhe (18/11/2026, pedido do dono: "gramado com mais detalhes"). Três camadas, todas baratas:
//  - o chão de grama da cidade tem textura pintada em canvas (manchas de verde mais seco e mais escuro, folhinhas,
//    trevos e pontinhos de flor), repetindo a cada 16 m sem emenda: some a cara de verde chapado;
//  - a grama aparada dos lotes livres, com as listras do cortador (cor de vértice por faixa, uma malha para todos);
//  - tufos de capim e flores pequenas em malhas instanciadas (uma chamada de desenho cada), só nas beiradas, nos
//    canteiros e em volta das árvores, nunca no caminho. No modo leve (celular) não há tufos e as flores ficam só nos
//    canteiros, em menor número.
import * as THREE from "three";
import { useCallback, useMemo } from "react";
import { leve } from "./qualidade";

// números aleatórios com semente (o mesmo lote sai sempre igual)
export function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------- chão de grama ----------
export const METROS_GRAMA = 16; // a textura cobre 16 × 16 m e repete
let texGrama: THREE.CanvasTexture | null = null;
export function texturaGrama() {
  if (texGrama || typeof document === "undefined") return texGrama;
  const S = leve() ? 512 : 1024, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!, r = sorteio(20261118), k = S / 1024;
  g.fillStyle = "#77B765"; g.fillRect(0, 0, S, S);
  // o que passa da borda é desenhado de novo do outro lado: a repetição não tem emenda
  const emVolta = (x: number, y: number, raio: number, f: (x: number, y: number) => void) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const px = x + dx, py = y + dy; if (px + raio > 0 && px - raio < S && py + raio > 0 && py - raio < S) f(px, py); }
  };
  // manchas grandes (de 1,5 a 4,5 m): verde mais seco, mais escuro ou mais azulado
  for (let i = 0; i < 64; i++) {
    const x = r() * S, y = r() * S, raio = S * (0.05 + r() * 0.13);
    const h = 74 + r() * 34, s = 28 + r() * 26, l = 34 + r() * 20, a = 0.16 + r() * 0.2;
    emVolta(x, y, raio, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, raio); gr.addColorStop(0, `hsla(${h},${s}%,${l}%,${a})`); gr.addColorStop(1, `hsla(${h},${s}%,${l}%,0)`);
      g.fillStyle = gr; g.fillRect(px - raio, py - raio, raio * 2, raio * 2);
    });
  }
  // folhinhas: traços curtos claros e escuros (a textura do capim de perto)
  const tons = Array.from({ length: 16 }, (_, i) => { const claro = i % 2 === 0; return `hsla(${80 + ((i * 37) % 28)},${38 + ((i * 13) % 22)}%,${claro ? 49 + (i % 5) * 3 : 25 + (i % 5) * 3}%,${claro ? 0.55 : 0.5})`; });
  const n = Math.round((S * S) / 34);
  for (let i = 0; i < n; i++) { g.fillStyle = tons[(r() * tons.length) | 0]; g.fillRect(r() * S, r() * S, Math.max(1, k * 1.2), (1.6 + r() * 2.6) * k); }
  // trevos (verde mais escuro, em grupinhos) e pontinhos de flor do mato
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S;
    for (let j = 0; j < 6; j++) { g.fillStyle = `hsla(${104 + r() * 12},${40 + r() * 14}%,${28 + r() * 8}%,0.75)`; g.beginPath(); g.arc(x + (r() - 0.5) * 22 * k, y + (r() - 0.5) * 22 * k, (1.6 + r() * 1.6) * k, 0, Math.PI * 2); g.fill(); }
  }
  const flor = ["rgba(255,255,255,0.85)", "rgba(255,232,120,0.85)", "rgba(240,210,255,0.8)"];
  for (let i = 0; i < 160; i++) { g.fillStyle = flor[i % 3]; g.beginPath(); g.arc(r() * S, r() * S, (1 + r() * 0.8) * k, 0, Math.PI * 2); g.fill(); }
  texGrama = new THREE.CanvasTexture(c); texGrama.wrapS = texGrama.wrapT = THREE.RepeatWrapping; texGrama.colorSpace = THREE.SRGBColorSpace; texGrama.anisotropy = leve() ? 2 : 8;
  return texGrama;
}
let matGrama: THREE.Material | null = null;
// material do chão de grama da cidade (o plano precisa de UV em metros: planoMetros(w, h, METROS_GRAMA) de Bairros.tsx)
export function materialGrama(): THREE.Material | null {
  if (matGrama) return matGrama;
  const map = texturaGrama(); if (!map) return null;
  matGrama = leve() ? new THREE.MeshLambertMaterial({ map }) : new THREE.MeshStandardMaterial({ map, roughness: 1 });
  return matGrama;
}

// ---------- grama aparada dos lotes livres ----------
// Faixas do cortador ao longo de z (da rua para o fundo), alternando claro e escuro. A cor vai no vértice de cada faixa
// (fica fora do Estatico, que apaga a cor de vértice), a textura é a mesma do chão, um pouco mais verde e mais viva.
export interface AreaGramado { x0: number; x1: number; z0: number; z1: number }
let matGramado: THREE.Material | null = null;
function materialGramado() {
  if (matGramado) return matGramado;
  const map = texturaGrama() ?? undefined;
  matGramado = leve() ? new THREE.MeshLambertMaterial({ map, vertexColors: true }) : new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1 });
  return matGramado;
}
export function GramadoLotes({ areas }: { areas: AreaGramado[] }) {
  const geo = useMemo(() => {
    const FAIXAS = 8, pos: number[] = [], uv: number[] = [], cor: number[] = [], idx: number[] = [];
    const claro = [1.04, 1.12, 0.95], escuro = [0.92, 1.0, 0.86]; // verde mais vivo que o chão em volta
    for (const a of areas) {
      const larg = (a.x1 - a.x0) / FAIXAS;
      for (let f = 0; f < FAIXAS; f++) {
        const x0 = a.x0 + f * larg, x1 = x0 + larg, c = f % 2 ? escuro : claro, b = pos.length / 3;
        for (const [x, z] of [[x0, a.z1], [x1, a.z1], [x1, a.z0], [x0, a.z0]]) { pos.push(x, -0.018, z); uv.push(x / METROS_GRAMA, -z / METROS_GRAMA); cor.push(c[0], c[1], c[2]); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }, [areas]);
  if (!areas.length) return null;
  return <mesh geometry={geo} material={materialGramado()} receiveShadow matrixAutoUpdate={false} />;
}

// ---------- tufos de capim e flores pequenas ----------
export interface Tufo { x: number; z: number; s: number }
export interface Flor { x: number; z: number; s: number; cor: string }

// geometria de cartões cruzados em pé (a normal aponta para cima: a luz bate como no chão em volta)
function cartoes(n: number, larg: number, alt: number, v0 = 0, v1 = 1, topo?: { y: number; lado: number; v0: number; v1: number }) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI, cx = Math.cos(a) * larg / 2, cz = Math.sin(a) * larg / 2, b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, alt, cz, -cx, alt, -cz); uv.push(0, v0, 1, v0, 1, v1, 0, v1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  if (topo) { const h = topo.lado / 2, b = pos.length / 3; pos.push(-h, topo.y, h, h, topo.y, h, h, topo.y, -h, -h, topo.y, -h); uv.push(0, topo.v0, 1, topo.v0, 1, topo.v1, 0, topo.v1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
let kitTufo: { geo: THREE.BufferGeometry; mat: THREE.Material } | null = null;
function tufo() {
  if (kitTufo) return kitTufo;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!, r = sorteio(77);
  for (let i = 0; i < 52; i++) { // folhas do capim: da base (embaixo, no meio) para a ponta, mais claras na ponta
    const bx = 64 + (r() - 0.5) * 60, tx = bx + (r() - 0.5) * 56, ty = 8 + r() * 64, w = 3 + r() * 4, h = 96 + r() * 12, l = 42 + r() * 8;
    const gr = g.createLinearGradient(0, 128, 0, ty); gr.addColorStop(0, `hsl(${h} 48% ${l - 4}%)`); gr.addColorStop(1, `hsl(${h - 6} 52% ${l + 6}%)`); // um tom só um pouco mais escuro e mais saturado que o chão (nunca quase preto)
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx - w / 2, 128); g.quadraticCurveTo((bx + tx) / 2 - w * 0.25, (128 + ty) / 2, tx, ty); g.quadraticCurveTo((bx + tx) / 2 + w * 0.25, (128 + ty) / 2, bx + w / 2, 128); g.fill();
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  kitTufo = { geo: cartoes(3, 0.55, 0.42), mat: new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }) };
  return kitTufo;
}
let kitFlor: { geo: THREE.BufferGeometry; mat: THREE.Material } | null = null;
function flor() {
  if (kitFlor) return kitFlor;
  // metade de cima: o cacho visto de lado; metade de baixo: visto de cima. Pétalas brancas, a cor vem da instância.
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!, r = sorteio(91);
  const florzinha = (x: number, y: number, R: number) => {
    g.fillStyle = "#FFFFFF"; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + x; g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6, R * 0.6, R * 0.45, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#E9D9A8"; g.beginPath(); g.arc(x, y, R * 0.3, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 8; i++) florzinha(14 + r() * 100, 8 + r() * 34, 6 + r() * 3);
  for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 40; florzinha(64 + Math.cos(a) * d, 96 + Math.sin(a) * d * 0.9, 6 + r() * 3); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  kitFlor = { geo: cartoes(2, 0.36, 0.34, 0.5, 1, { y: 0.27, lado: 0.34, v0: 0, v1: 0.5 }), mat: leve() ? new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }) };
  return kitFlor;
}

function encher(im: THREE.InstancedMesh | null, itens: { x: number; z: number; s: number; cor?: string }[], ehFlor: boolean) {
  if (!im) return;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), esc = new THREE.Vector3(), c = new THREE.Color();
  itens.forEach((t, i) => {
    const h = hash(t.x, t.z); e.set(0, h * Math.PI * 2, 0); q.setFromEuler(e);
    esc.set(t.s, t.s * (0.8 + hash(t.z, t.x) * 0.45), t.s);
    im.setMatrixAt(i, m.compose(v.set(t.x, 0, t.z), q, esc));
    if (ehFlor && t.cor) c.set(t.cor).offsetHSL(0, 0, (h - 0.5) * 0.08); else c.setRGB(0.94 + h * 0.1, 0.95 + hash(t.z, 1) * 0.08, 0.92 + h * 0.1);
    im.setColorAt(i, c);
  });
  im.count = itens.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
}
export function TufosFlores({ tufos, flores }: { tufos: Tufo[]; flores: Flor[] }) {
  const kt = useMemo(() => (tufos.length && typeof document !== "undefined" ? tufo() : null), [tufos.length]);
  const kf = useMemo(() => (flores.length && typeof document !== "undefined" ? flor() : null), [flores.length]);
  const refT = useCallback((im: THREE.InstancedMesh | null) => encher(im, tufos, false), [tufos]);
  const refF = useCallback((im: THREE.InstancedMesh | null) => encher(im, flores, true), [flores]);
  return (
    <group>
      {kt && <instancedMesh key={`t${tufos.length}`} ref={refT} args={[kt.geo, kt.mat, tufos.length]} receiveShadow />}
      {kf && <instancedMesh key={`f${flores.length}`} ref={refF} args={[kf.geo, kf.mat, flores.length]} receiveShadow />}
    </group>
  );
}
