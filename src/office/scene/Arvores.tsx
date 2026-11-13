"use client";
// Árvores da cidade (12/11/2026, v63): todas desenhadas em código, brasileiras e com cara de árvore de verdade.
// Espécies: frondosa (sibipiruna/munguba), oiti, figueira, ipê amarelo, ipê rosa, ipê roxo, palmeira imperial, coqueiro,
// arbusto e topiária (cerca viva aparada).
//  - Tronco e galhos: tubos que afinam (TubeGeometry), com casca pintada em canvas.
//  - Copa: "tufos" de folha em cartões cruzados com transparência (textura pintada em canvas: folhas, flores, palmas).
//    As normais apontam para fora da copa (luz macia, com volume) e a cor de vértice escurece o miolo (sombra interna).
//    Os tufos ficam nas pontas dos galhos: a copa tem falhas e o galho aparece por dentro.
//  - Vento: balanço leve no sombreador (vertex), sem custo de CPU; as folhas também tremem.
//  - Variação: cada árvore gira, espelha, muda de tamanho e de tom (cor por instância).
// Uma malha instanciada por espécie e parte (madeira, folhas, flores no chão): poucos draw calls para a cidade toda.
// Regras da integração de 12/11: geometria e material FIXOS (cache do módulo); as matrizes são preenchidas por ref de
// callback (sobrevive a uma recriação da malha) e o boundingSphere é recalculado; nada de recompilar material depois.
import * as THREE from "three";
import { useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import { registrarMolhavel } from "./Clima";
import type { ItemInstancia } from "./Modelos";

export type Especie = "frondosa" | "oiti" | "figueira" | "ipeAmarelo" | "ipeRosa" | "ipeRoxo" | "palmeiraImperial" | "coqueiro" | "arbusto" | "topiaria" | "azaleia";
export const ESPECIES: Especie[] = ["frondosa", "oiti", "figueira", "ipeAmarelo", "ipeRosa", "ipeRoxo", "palmeiraImperial", "coqueiro", "arbusto", "topiaria", "azaleia"];

// ---------- números aleatórios com semente (a mesma árvore sempre sai igual) ----------
function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const entre = (r: () => number, a: number, b: number) => a + (b - a) * r();
export const hashPos = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------- texturas pintadas em canvas ----------
// Cada espécie tem UMA folha de textura (atlas): em cima os tufos de folha (2×2 variações) ou a palma; embaixo uma faixa de
// casca. Assim madeira e folhas viram uma malha só (metade dos draw calls).
type Tinta = "larga" | "miuda" | "escura" | "florAmarelo" | "florRosa" | "florRoxo" | "aparada";
const PALETA: Record<Tinta, { h: [number, number]; s: [number, number]; l: [number, number]; tam: [number, number]; flor?: string[] }> = {
  larga: { h: [86, 108], s: [40, 58], l: [30, 50], tam: [26, 40] },
  miuda: { h: [92, 116], s: [38, 56], l: [28, 46], tam: [16, 24] },
  escura: { h: [100, 124], s: [36, 52], l: [24, 42], tam: [18, 28] },
  aparada: { h: [96, 118], s: [36, 52], l: [26, 44], tam: [11, 16] },
  florAmarelo: { h: [44, 52], s: [88, 98], l: [52, 64], tam: [13, 18], flor: ["#F5C518", "#FFD84D", "#E9A80F", "#FFE27A"] },
  florRosa: { h: [328, 340], s: [62, 80], l: [62, 74], tam: [13, 18], flor: ["#E8649F", "#F59AC2", "#D44A87", "#FBC1DA"] },
  florRoxo: { h: [268, 284], s: [45, 62], l: [52, 66], tam: [13, 18], flor: ["#8E62D6", "#A985EA", "#7449C4", "#C4A9F2"] },
};
const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
// uma folha: duas curvas de Bézier, degradê da base para a ponta e a nervura central clara
function folha(g: CanvasRenderingContext2D, x: number, y: number, ang: number, L: number, larg: number, cor1: string, cor2: string) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, cor1); gr.addColorStop(1, cor2);
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * 0.25, -larg, L * 0.7, -larg * 0.85, L, 0); g.bezierCurveTo(L * 0.7, larg * 0.85, L * 0.25, larg, 0, 0); g.fill();
  g.strokeStyle = "rgba(255,255,235,0.16)"; g.lineWidth = Math.max(0.6, larg * 0.12); g.beginPath(); g.moveTo(L * 0.05, 0); g.lineTo(L * 0.9, 0); g.stroke();
  g.restore();
}
// contorno irregular (lobos) de um tufo
function lobado(r: () => number, R: number) {
  const n = 9, k = Array.from({ length: n }, () => entre(r, 0.78, 1.04)), fase = entre(r, 0, 6.28);
  return (a: number) => { const t = (((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * n, i = Math.floor(t), f = t - i; return R * (k[i % n] * (1 - f) + k[(i + 1) % n] * f) * (0.9 + 0.1 * Math.sin(a * 4 + fase)); };
}
// tufos de folha (2×2 variações numa área de 512×512, começando em y0): uma massa cheia de folhagem (sem buracos no
// meio) com a borda recortada em folhas e o alto mais claro, como a luz do sol batendo de cima
function pintarTufos(g: CanvasRenderingContext2D, tinta: Tinta, semente: number, y0 = 0) {
  const T = 256, p = PALETA[tinta];
  for (let cel = 0; cel < 4; cel++) {
    const r = sorteio(semente * 31 + cel * 977);
    const ox = (cel % 2) * T, oy = y0 + Math.floor(cel / 2) * T, cx = ox + T / 2, cy = oy + T / 2;
    g.save(); g.beginPath(); g.rect(ox + 1, oy + 1, T - 2, T - 2); g.clip();
    const R = T * 0.3, raio = lobado(r, R); // folha mais comprida (40 px) + 0,3 × 256 × 1,04 < meia célula: nada é cortado
    const h0 = entre(r, p.h[0], p.h[1]), s0 = entre(r, p.s[0], p.s[1]), l0 = (p.l[0] + p.l[1]) / 2;
    if (!p.flor) {
      // massa de base: degradê do miolo (escuro) para a borda, mais claro em cima
      g.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, d = raio(a) * 0.92; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.95; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      const rg = g.createRadialGradient(cx - R * 0.25, cy - R * 0.35, R * 0.1, cx, cy, R * 1.05); rg.addColorStop(0, hsl(h0, s0, l0 + 6)); rg.addColorStop(1, hsl(h0 + 6, s0 - 4, l0 - 10));
      g.fillStyle = rg; g.fill();
      // folhas da borda, apontando para fora (fazem o recorte) e folhas por cima da massa
      const nBorda = tinta === "aparada" ? 150 : tinta === "larga" ? 70 : 110, nCima = tinta === "aparada" ? 260 : tinta === "larga" ? 75 : 140;
      for (let i = 0; i < nBorda + nCima; i++) {
        const borda = i < nBorda, a = entre(r, 0, Math.PI * 2), rr = raio(a);
        const d = borda ? rr * entre(r, 0.72, 0.98) : Math.sqrt(r()) * rr * 0.85;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.95;
        const L = entre(r, p.tam[0], p.tam[1]), cima = (cy - y) / R; // +1 no alto, -1 embaixo
        const l = THREE.MathUtils.clamp(l0 + cima * 9 + entre(r, -6, 6) + (borda ? -3 : 2), 12, 72);
        const ang = borda ? a + entre(r, -0.45, 0.45) : entre(r, 0, Math.PI * 2);
        folha(g, x, y, ang, L, L * (tinta === "larga" ? 0.4 : 0.34), hsl(h0 + entre(r, -5, 5), s0, l * 0.82), hsl(h0 - 6, s0 + 6, Math.min(78, l * 1.15 + 5)));
      }
    } else {
      // ipê em flor: um cacho cheio (massa na cor da flor, mais escura) coberto de flores de 5 pétalas, poucas folhas verdes
      g.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, d = raio(a) * 0.86; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.95; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      const base = new THREE.Color(p.flor[2]); const rg = g.createRadialGradient(cx - R * 0.2, cy - R * 0.3, R * 0.1, cx, cy, R);
      rg.addColorStop(0, `#${base.clone().offsetHSL(0, 0, 0.04).getHexString()}`); rg.addColorStop(1, `#${base.clone().offsetHSL(0, -0.03, -0.05).getHexString()}`);
      g.fillStyle = rg; g.fill();
      for (let i = 0; i < 14; i++) { const a = entre(r, 0, 6.28), d = raio(a) * entre(r, 0.75, 1.0); const L = entre(r, 16, 24); folha(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, a, L, L * 0.34, hsl(95, 40, 26), hsl(90, 45, 38)); }
      for (let f = 0; f < 135; f++) {
        const a = entre(r, 0, Math.PI * 2), d = Math.sqrt(r()) * raio(a) * 0.95, fx = cx + Math.cos(a) * d, fy = cy + Math.sin(a) * d * 0.95;
        const Rf = entre(r, p.tam[0], p.tam[1]) * 0.55, cima = (cy - fy) / R;
        const cor = new THREE.Color(p.flor[Math.floor(r() * p.flor.length)]).offsetHSL(0, 0, cima * 0.06 - 0.02);
        g.fillStyle = `#${cor.getHexString()}`;
        for (let k = 0; k < 5; k++) { const pa = (k / 5) * Math.PI * 2 + f; g.beginPath(); g.ellipse(fx + Math.cos(pa) * Rf * 0.62, fy + Math.sin(pa) * Rf * 0.62, Rf * 0.62, Rf * 0.5, pa, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "rgba(255,246,214,0.7)"; g.beginPath(); g.arc(fx, fy, Rf * 0.26, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }
}
// palma de palmeira (512×128, começando em y0): raque no meio e folíolos largos dos dois lados, mais curtos na base e
// na ponta (desenhados como lâminas cheias, não traços: de longe a palma fica cheia)
function pintarPalma(g: CanvasRenderingContext2D, coqueiro: boolean, semente: number, y0 = 0) {
  const W = 512, H = 128, r = sorteio(semente), meio = y0 + H / 2;
  for (let x = 12; x < W - 6; x += 4.4) {
    const s = x / W, perfil = Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.06 + 0.02)), 0.65);
    for (const lado of [-1, 1]) {
      if (r() < 0.04) continue;
      const L = (H * 0.47) * perfil * entre(r, 0.85, 1.04), dx = L * (coqueiro ? 0.6 : 0.4), larg = entre(r, 3.4, 4.8) * (1 - s * 0.3);
      const l = entre(r, 26, 40) + s * 6, h = coqueiro ? entre(r, 72, 92) : entre(r, 98, 116);
      const gr = g.createLinearGradient(x, meio, x + dx, meio + lado * L); gr.addColorStop(0, hsl(h, 46, l * 0.78)); gr.addColorStop(1, coqueiro && s > 0.78 ? hsl(56, 52, l + 12) : hsl(h - 4, 52, l + 10));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - larg * 0.6, meio); g.quadraticCurveTo(x + dx * 0.45 - larg, meio + lado * L * 0.55, x + dx, meio + lado * L); g.quadraticCurveTo(x + dx * 0.45 + larg, meio + lado * L * 0.5, x + larg * 0.6, meio); g.fill();
    }
  }
  g.strokeStyle = coqueiro ? "#8C8A4A" : "#6F8A48"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(4, meio); g.lineTo(W - 4, meio); g.stroke();
}
// faixa de casca (512 de comprimento × 64 em volta), na cor da espécie: estrias (árvores) ou anéis (palmeiras)
function pintarCasca(g: CanvasRenderingContext2D, tipo: "arvore" | "imperial" | "coqueiro", cor: string, semente: number, y0: number) {
  const W = 512, H = 64, r = sorteio(semente), c = new THREE.Color(cor), base = [c.r * 255, c.g * 255, c.b * 255].map(Math.round);
  g.fillStyle = `rgb(${base.join(",")})`; g.fillRect(0, y0, W, H);
  if (tipo === "arvore") {
    for (let i = 0; i < 300; i++) { const y = y0 + r() * H, x = r() * W, L = entre(r, 18, 80), k = entre(r, -40, 24); g.strokeStyle = `rgba(${base[0] + k},${base[1] + k},${base[2] + k},0.85)`; g.lineWidth = entre(r, 1, 3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + entre(r, -2, 2)); g.stroke(); }
  } else {
    for (let x = 0; x < W; x += tipo === "imperial" ? 7 : 4.5) { g.strokeStyle = `rgba(55,45,35,${tipo === "imperial" ? 0.2 : 0.45})`; g.lineWidth = tipo === "imperial" ? 1.2 : 2; g.beginPath(); g.moveTo(x + entre(r, -1, 1), y0); g.lineTo(x + entre(r, -1, 1), y0 + H); g.stroke(); }
    for (let i = 0; i < 300; i++) { const k = entre(r, -22, 22); g.fillStyle = `rgba(${base[0] + k},${base[1] + k},${base[2] + k},0.5)`; g.fillRect(r() * W, y0 + r() * H, entre(r, 1, 4), entre(r, 1, 3)); }
  }
}
function texturaCanvas(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// pétalas caídas (chão embaixo dos ipês): brancas, tingidas pela cor da instância
function pintarPetalas(semente: number) {
  const T = 256, c = document.createElement("canvas"); c.width = c.height = T; const g = c.getContext("2d")!; const r = sorteio(semente);
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.75) * T * 0.48; if (d > T * 0.36 && r() < 0.55) continue;
    const k = entre(r, 200, 255); g.fillStyle = `rgba(${k},${k},${k},0.95)`;
    g.beginPath(); g.ellipse(T / 2 + Math.cos(a) * d, T / 2 + Math.sin(a) * d, entre(r, 2.2, 4.4), entre(r, 1.4, 2.6), r() * 6.28, 0, Math.PI * 2); g.fill();
  }
  return texturaCanvas(c);
}

// ---------- vento no sombreador ----------
const VENTO = { uTempo: { value: 0 } };
// força do balanço (posição normalizada: altura da árvore = 1; a instância escala pela altura em metros)
function comVento(m: THREE.Material, forca: number, tremor: number, base = 0.25) {
  const u = { uForca: { value: forca }, uTremor: { value: tremor }, uBase: { value: base } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = VENTO.uTempo; Object.assign(sh.uniforms, u);
    sh.vertexShader = "uniform float uTempo;\nuniform float uForca;\nuniform float uTremor;\nuniform float uBase;\nattribute vec3 aCard;\nvarying float vDeFrente;\n" + sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
      // cartão de folha visto de lado vira uma linha escura: ele some aos poucos (vDeFrente = 0 de lado, 1 de frente)
      vec3 _cn = aCard;
      if (dot(_cn, _cn) > 0.0) {
        #ifdef USE_INSTANCING
          _cn = mat3(instanceMatrix) * _cn;
        #endif
        vDeFrente = abs(dot(normalize(normalMatrix * _cn), normalize(-mvPosition.xyz)));
      } else { vDeFrente = 1.0; }`).replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 _raiz = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 _raiz = vec2(modelMatrix[3][0], modelMatrix[3][2]);
      #endif
      float _fase = dot(_raiz, vec2(0.21, 0.17));
      float _h = max(position.y - uBase, 0.0);
      float _b = sin(uTempo * 1.05 + _fase) * 0.65 + sin(uTempo * 2.2 + _fase * 1.7) * 0.35;
      transformed.x += _b * uForca * _h * _h;
      transformed.z += cos(uTempo * 0.85 + _fase * 1.3) * uForca * 0.6 * _h * _h;
      transformed += objectNormal * sin(uTempo * 5.5 + position.x * 41.0 + position.z * 29.0 + _fase) * uTremor * _h;`);
  };
  const frag = (sh: { fragmentShader: string }) => { sh.fragmentShader = "varying float vDeFrente;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.a *= smoothstep(0.1, 0.36, vDeFrente);"); };
  const antes = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { antes.call(m, sh, r); frag(sh); };
  m.customProgramCacheKey = () => "arvore-vento-v2";
  return m;
}

// ---------- geometria: tubos que afinam e cartões de folha ----------
interface Peca { pos: number[]; nor: number[]; uv: number[]; cor: number[]; idx: number[]; card: number[] }
const nova = (): Peca => ({ pos: [], nor: [], uv: [], cor: [], idx: [], card: [] });
function emGeometria(p: Peca) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p.pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(p.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(p.uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(p.cor, 3));
  g.setAttribute("aCard", new THREE.Float32BufferAttribute(p.card.length ? p.card : new Array(p.pos.length).fill(0), 3));
  g.setIndex(p.idx); g.computeBoundingSphere(); return g;
}
// tubo ao longo dos pontos, afinando de r0 para r1 (cor de vértice: claro na base, um pouco mais escuro em cima)
function tubo(pontos: THREE.Vector3[], r0: number, r1: number, segs: number, lados: number, cor: [number, number, number] = [1, 1, 1], alargaBase = 0) {
  const curva = new THREE.CatmullRomCurve3(pontos);
  const g = new THREE.TubeGeometry(curva, segs, 1, lados, false);
  const pos = g.attributes.position as THREE.BufferAttribute, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curva.getPointAt(t, c);
    const r = THREE.MathUtils.lerp(r0, r1, t) * (1 + alargaBase * Math.max(0, 1 - t * 9) ** 2);
    for (let j = 0; j <= lados; j++) { const k = i * (lados + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  const n = pos.count, cores = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const t = Math.floor(k / (lados + 1)) / segs, f = 1 - t * 0.12; cores[k * 3] = cor[0] * f; cores[k * 3 + 1] = cor[1] * f; cores[k * 3 + 2] = cor[2] * f; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
  g.setAttribute("aCard", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}
// um tufo: dois cartões cruzados no centro c, normal para fora da copa (centro da copa = cc), sombra interna pela cor
function tufo(p: Peca, r: () => number, c: THREE.Vector3, tam: number, cc: THREE.Vector3, raioCopa: number, celula = -1, sombraInterna = 0.5) {
  const fora = c.clone().sub(cc); const dist = fora.length(); fora.normalize(); if (!Number.isFinite(fora.x)) fora.set(0, 1, 0);
  const n = fora.clone().multiplyScalar(0.75).add(new THREE.Vector3(0, 0.35, 0)).normalize();
  const aleat = new THREE.Vector3(entre(r, -1, 1), entre(r, -1, 1), entre(r, -1, 1)).normalize();
  const face = fora.clone().lerp(aleat, 0.55).normalize();
  const t = new THREE.Vector3().crossVectors(face, Math.abs(face.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const b = new THREE.Vector3().crossVectors(face, t).normalize();
  const giro = entre(r, 0, Math.PI); t.applyAxisAngle(face, giro); b.applyAxisAngle(face, giro);
  const cel = celula >= 0 ? celula : Math.floor(r() * 4), u0 = (cel % 2) * 0.5, v0 = Math.floor(cel / 2) * 0.5;
  // sombra interna: tufo no miolo e embaixo fica mais escuro
  const ao = THREE.MathUtils.clamp(1 - sombraInterna + sombraInterna * (dist / raioCopa) + (c.y - cc.y) / (raioCopa * 4), 0.56, 1.1);
  for (const [eu, ev, pl] of [[t, b, face.clone()], [face.clone(), b, t.clone()]] as [THREE.Vector3, THREE.Vector3, THREE.Vector3][]) {
    const base = p.pos.length / 3, h = tam / 2;
    for (const [su, sv, uu, vv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      p.pos.push(c.x + eu.x * su * h + ev.x * sv * h, c.y + eu.y * su * h + ev.y * sv * h, c.z + eu.z * su * h + ev.z * sv * h);
      p.nor.push(n.x, n.y, n.z); p.uv.push(u0 + uu * 0.5, v0 + vv * 0.5); p.cor.push(ao, ao, ao); p.card.push(pl.x, pl.y, pl.z);
    }
    p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// ---------- espécies folhosas ----------
interface ParamFolhosa { tronco: number; raio: number; torto: number; galhos: number; elev: [number, number]; comp: number; sub: number; porPonta: number; tamTufo: number; raioTufo: number; copaY: number; raioCopa: number; flores?: boolean; enche?: number }
const FOLHOSAS: Partial<Record<Especie, ParamFolhosa>> = {
  frondosa: { tronco: 0.42, raio: 0.034, torto: 0.035, galhos: 5, elev: [0.55, 1.0], comp: 0.4, sub: 3, porPonta: 4, tamTufo: 0.23, raioTufo: 0.1, copaY: 0.66, raioCopa: 0.36 },
  oiti: { tronco: 0.32, raio: 0.034, torto: 0.02, galhos: 6, elev: [0.65, 1.15], comp: 0.34, sub: 3, porPonta: 5, tamTufo: 0.22, raioTufo: 0.085, copaY: 0.6, raioCopa: 0.36, enche: 26 },
  figueira: { tronco: 0.3, raio: 0.05, torto: 0.03, galhos: 7, elev: [0.22, 0.6], comp: 0.5, sub: 3, porPonta: 4, tamTufo: 0.22, raioTufo: 0.09, copaY: 0.62, raioCopa: 0.52, enche: 18 },
  ipeAmarelo: { tronco: 0.4, raio: 0.03, torto: 0.07, galhos: 4, elev: [0.7, 1.15], comp: 0.42, sub: 3, porPonta: 3, tamTufo: 0.24, raioTufo: 0.09, copaY: 0.7, raioCopa: 0.34, flores: true },
  ipeRosa: { tronco: 0.38, raio: 0.03, torto: 0.08, galhos: 5, elev: [0.62, 1.05], comp: 0.42, sub: 3, porPonta: 3, tamTufo: 0.24, raioTufo: 0.09, copaY: 0.68, raioCopa: 0.36, flores: true },
  ipeRoxo: { tronco: 0.42, raio: 0.03, torto: 0.06, galhos: 4, elev: [0.68, 1.1], comp: 0.44, sub: 3, porPonta: 3, tamTufo: 0.25, raioTufo: 0.09, copaY: 0.7, raioCopa: 0.34, flores: true },
};
const TINTA: Partial<Record<Especie, Tinta>> = { frondosa: "larga", oiti: "escura", figueira: "miuda", ipeAmarelo: "florAmarelo", ipeRosa: "florRosa", ipeRoxo: "florRoxo", arbusto: "miuda", topiaria: "aparada", azaleia: "florRosa" };

function folhosa(esp: Especie, semente: number, simples: boolean) {
  const P = FOLHOSAS[esp]!, r = sorteio(semente);
  const madeira: THREE.BufferGeometry[] = [], folhas = nova();
  const lados = simples ? 5 : 7;
  // tronco: base levemente alargada, com uma curva suave
  const topo = new THREE.Vector3(entre(r, -P.torto, P.torto), P.tronco, entre(r, -P.torto, P.torto));
  const meio = new THREE.Vector3(entre(r, -P.torto, P.torto) * 0.6, P.tronco * 0.5, entre(r, -P.torto, P.torto) * 0.6);
  madeira.push(tubo([new THREE.Vector3(0, 0, 0), meio, topo], P.raio, P.raio * 0.62, simples ? 5 : 8, lados + 1, [1, 1, 1], 0.55));
  const cc = new THREE.Vector3(topo.x, P.copaY, topo.z), tufos: THREE.Vector3[] = [];
  // galhos principais saindo do alto do tronco, abrindo para os lados e para cima; galhos menores nas pontas
  for (let i = 0; i < P.galhos; i++) {
    const az = (i / P.galhos) * Math.PI * 2 + entre(r, -0.4, 0.4), el = entre(r, P.elev[0], P.elev[1]), L = P.comp * entre(r, 0.78, 1.18);
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const ini = topo.clone().add(new THREE.Vector3(0, -entre(r, 0, P.tronco * 0.12), 0));
    const fim = ini.clone().addScaledVector(dir, L).add(new THREE.Vector3(0, -L * 0.08, 0));
    const meioG = ini.clone().addScaledVector(dir, L * 0.5).add(new THREE.Vector3(entre(r, -0.02, 0.02), 0.03, entre(r, -0.02, 0.02)));
    // o galho termina dentro da folhagem (a ponta de fora virava um risco escuro)
    madeira.push(tubo([ini, meioG, meioG.clone().lerp(fim, 0.8)], P.raio * 0.62, P.raio * 0.26, simples ? 3 : 5, lados));
    const curva = new THREE.CatmullRomCurve3([ini, meioG, fim]);
    tufos.push(fim);
    for (let s = 0; s < P.sub; s++) {
      const t = entre(r, 0.45, 0.92), o = curva.getPointAt(t);
      const az2 = az + entre(r, -1.1, 1.1), el2 = el + entre(r, -0.25, 0.45), L2 = L * entre(r, 0.38, 0.6);
      const d2 = new THREE.Vector3(Math.cos(az2) * Math.cos(el2), Math.sin(el2), Math.sin(az2) * Math.cos(el2));
      const f2 = o.clone().addScaledVector(d2, L2);
      if (!simples) madeira.push(tubo([o, o.clone().lerp(f2, 0.45).add(new THREE.Vector3(0, 0.012, 0)), o.clone().lerp(f2, 0.78)], P.raio * 0.24, P.raio * 0.12, 3, 4));
      tufos.push(f2, o.clone().lerp(f2, 0.55));
    }
  }
  // folhas: vários tufos em volta de cada ponta (com falhas entre as pontas) e alguns no miolo para dar volume
  const mult = simples ? 0.55 : 1;
  for (const pt of tufos) {
    const n = Math.max(1, Math.round(P.porPonta * mult));
    for (let k = 0; k < n; k++) {
      const c = pt.clone().add(new THREE.Vector3(entre(r, -1, 1), entre(r, -0.6, 1), entre(r, -1, 1)).multiplyScalar(P.raioTufo));
      tufo(folhas, r, c, P.tamTufo * 1.18 * entre(r, 0.8, 1.2), cc, P.raioCopa, -1, P.flores ? 0.35 : 0.55);
    }
  }
  for (let k = 0; k < Math.round((P.enche ?? 10) * mult); k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * P.raioCopa * 0.85, y = cc.y + entre(r, -0.12, 0.2);
    tufo(folhas, r, new THREE.Vector3(cc.x + Math.cos(a) * d, y, cc.z + Math.sin(a) * d * 0.9), P.tamTufo * 1.18 * entre(r, 0.9, 1.25), cc, P.raioCopa, -1, P.flores ? 0.35 : 0.55);
  }
  return { madeira: mergeGeometries(madeira, false)!, folhas: emGeometria(folhas), raioCopa: P.raioCopa };
}
// arbusto (copa baixa e redonda) e topiária (dois cones aparados)
function moita(esp: "arbusto" | "topiaria" | "azaleia", semente: number, simples: boolean) {
  const r = sorteio(semente), folhas = nova(), madeira: THREE.BufferGeometry[] = [];
  const cc = new THREE.Vector3(0, esp === "topiaria" ? 0.55 : 0.42, 0);
  if (esp !== "topiaria") {
    const n = simples ? 26 : 48;
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, e = Math.acos(entre(r, -0.15, 1)), R = 0.48 * entre(r, 0.85, 1.05);
      const c = new THREE.Vector3(Math.cos(a) * Math.sin(e) * R, 0.42 + Math.cos(e) * R * 0.85, Math.sin(a) * Math.sin(e) * R);
      tufo(folhas, r, c, 0.5 * entre(r, 0.85, 1.15), cc, 0.5, -1, 0.6);
    }
    madeira.push(tubo([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.15, 0)], 0.04, 0.03, 2, 5));
  } else {
    madeira.push(tubo([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.3, 0)], 0.035, 0.03, 2, 6));
    // dois cones de folhas miúdas aparadas: os tufos ficam na superfície, virados para fora
    for (const [y0, y1, R] of [[0.18, 0.66, 0.3], [0.6, 1.0, 0.2]] as const) {
      const n = Math.round((simples ? 0.55 : 1) * (R > 0.25 ? 46 : 26));
      for (let k = 0; k < n; k++) {
        const t = r(), y = y0 + (y1 - y0) * t, raio = R * (1 - t * 0.85) + 0.02, a = r() * Math.PI * 2;
        tufo(folhas, r, new THREE.Vector3(Math.cos(a) * raio, y, Math.sin(a) * raio), 0.24 * (1 - t * 0.4) + 0.06, new THREE.Vector3(0, y, 0), R, -1, 0.45);
      }
    }
  }
  return { madeira: mergeGeometries(madeira, false)!, folhas: emGeometria(folhas), raioCopa: 0.5 };
}

// ---------- palmeiras ----------
// palma arqueada: tira de segmentos que sobe e cai (parábola), com a largura dos folíolos e uma dobra em "V"
function palma(p: Peca, r: () => number, ini: THREE.Vector3, az: number, el: number, L: number, larg: number, queda: number, cor: number) {
  const segs = 7, dirH = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), lado = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
  const base = p.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs, x = L * s * Math.cos(el), y = L * s * Math.sin(el) - queda * s * s * L;
    const c = ini.clone().addScaledVector(dirH, x).add(new THREE.Vector3(0, y, 0));
    const w = larg * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05 + 0.04)), 0.6);
    const dobra = w * 0.28;
    for (const [lv, v] of [[-1, 0], [1, 1]] as const) {
      p.pos.push(c.x + lado.x * w * lv, c.y - dobra, c.z + lado.z * w * lv);
      const n = new THREE.Vector3(0, 1, 0).addScaledVector(lado, lv * 0.35).normalize();
      p.nor.push(n.x, n.y, n.z); p.uv.push(s, v); p.cor.push(cor, cor, cor); p.card.push(0, 0, 0);
    }
    if (i < segs) { const k = base + i * 2; p.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
}
function palmeira(coqueiro: boolean, semente: number, simples: boolean) {
  const r = sorteio(semente), folhas = nova(), madeira: THREE.BufferGeometry[] = [];
  const H = coqueiro ? 0.86 : 0.84, raio = coqueiro ? 0.02 : 0.026;
  const inclina = coqueiro ? entre(r, 0.12, 0.24) : entre(r, 0, 0.02), az0 = r() * Math.PI * 2;
  const desloc = (t: number) => new THREE.Vector3(Math.cos(az0) * inclina * t * t, H * t, Math.sin(az0) * inclina * t * t);
  const pts = [0, 0.25, 0.5, 0.75, 1].map(desloc);
  // tronco: a imperial é lisa e cinza, um pouco mais grossa embaixo; o coqueiro é anelado e se inclina
  madeira.push(tubo(pts, raio * (coqueiro ? 1.1 : 1.15), raio * (coqueiro ? 0.72 : 0.82), simples ? 8 : 14, simples ? 6 : 9, [1, 1, 1], coqueiro ? 0.6 : 0.35));
  const topo = desloc(1);
  if (!coqueiro) {
    // palmito verde (a "coroa" lisa embaixo das palmas)
    const ate = topo.clone().add(new THREE.Vector3(0, 0.1, 0));
    madeira.push(tubo([topo.clone().add(new THREE.Vector3(0, -0.01, 0)), topo.clone().lerp(ate, 0.5), ate], raio * 0.95, raio * 0.75, 3, 9, [0.55, 0.78, 0.42]));
  } else {
    // cachos de coco embaixo das palmas
    const coco = new THREE.SphereGeometry(1, simples ? 6 : 9, simples ? 5 : 7);
    for (let k = 0; k < (simples ? 4 : 7); k++) {
      const a = r() * Math.PI * 2, g = coco.clone(); const s = 0.017 * entre(r, 0.85, 1.1);
      g.scale(s, s * 1.1, s); g.translate(topo.x + Math.cos(a) * 0.022, topo.y - 0.012 - r() * 0.018, topo.z + Math.sin(a) * 0.022);
      const n = g.attributes.position.count, cor = new Float32Array(n * 3), verde = r() < 0.5; for (let i = 0; i < n; i++) { cor[i * 3] = verde ? 0.55 : 0.6; cor[i * 3 + 1] = verde ? 0.7 : 0.45; cor[i * 3 + 2] = verde ? 0.3 : 0.25; }
      g.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3)); g.deleteAttribute("uv"); g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); g.setAttribute("aCard", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      madeira.push(g);
    }
  }
  // palmas: em volta do topo, as de cima mais em pé, as de baixo caindo; o coqueiro tem uma ou duas secas
  const ini = topo.clone().add(new THREE.Vector3(0, coqueiro ? 0.005 : 0.1, 0));
  const n = simples ? (coqueiro ? 12 : 11) : coqueiro ? 20 : 18;
  for (let k = 0; k < n; k++) {
    const az = (k / n) * Math.PI * 2 + entre(r, -0.25, 0.25), alta = k % 3 === 0;
    const el = coqueiro ? entre(r, 0.1, alta ? 0.75 : 0.45) : entre(r, alta ? 0.55 : 0.15, alta ? 1.05 : 0.6);
    const L = (coqueiro ? 0.3 : 0.27) * entre(r, 0.85, 1.12), queda = coqueiro ? entre(r, 0.9, 1.5) : entre(r, 0.55, 1.1);
    const seca = coqueiro && k === 1;
    palma(folhas, r, ini, az, el, L, coqueiro ? 0.066 : 0.06, queda, seca ? 0.55 : entre(r, 0.82, 1.05));
  }
  return { madeira: mergeGeometries(madeira, false)!, folhas: emGeometria(folhas), raioCopa: 0.3 };
}

// ---------- o kit de cada espécie (geometria, atlas e material), criado uma vez por sessão ----------
interface Kit { geo: THREE.BufferGeometry; mat: THREE.Material; profundidade: THREE.Material; chao: THREE.BufferGeometry | null; matChao: THREE.Material | null; sombra: boolean }
const KITS = new Map<Especie, Kit>();
let TEX_PETALAS: THREE.Texture | null = null;
const COR_CHAO: Partial<Record<Especie, string>> = { ipeAmarelo: "#F4C51F", ipeRosa: "#EE7FB1", ipeRoxo: "#9C74DE" };
const COR_CASCA: Record<Especie, string> = { frondosa: "#7E6048", oiti: "#665040", figueira: "#948778", ipeAmarelo: "#584538", ipeRosa: "#5A473B", ipeRoxo: "#56463D", palmeiraImperial: "#CFCBC3", coqueiro: "#8E7A62", arbusto: "#5E4A38", topiaria: "#5E4A38", azaleia: "#5E4A38" };
// u e v do tubo (comprimento × volta) vão para a faixa de casca; os cartões vão para a área de folhas
function moverUV(g: THREE.BufferGeometry, v0: number, v1: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
}
export function kitDaEspecie(esp: Especie): Kit {
  const ja = KITS.get(esp); if (ja) return ja;
  const simples = leve(), semente = ESPECIES.indexOf(esp) * 1013 + 7;
  const palm = esp === "palmeiraImperial" || esp === "coqueiro";
  const forma = palm ? palmeira(esp === "coqueiro", semente, simples) : esp === "arbusto" || esp === "topiaria" || esp === "azaleia" ? moita(esp, semente, simples) : folhosa(esp, semente, simples);
  // atlas: folhas (ou palma) em cima, faixa de casca de 64 px embaixo (no three a textura sobe: v = 0 é o pé do desenho)
  const W = 512, Hf = palm ? 128 : 512, H = Hf + 64, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  if (palm) pintarPalma(g, esp === "coqueiro", semente, 0); else pintarTufos(g, TINTA[esp]!, semente, 0);
  pintarCasca(g, esp === "palmeiraImperial" ? "imperial" : esp === "coqueiro" ? "coqueiro" : "arvore", COR_CASCA[esp], semente + 3, Hf);
  const atlas = texturaCanvas(c), vb = 64 / H;
  moverUV(forma.madeira, 0, vb * 0.96); moverUV(forma.folhas, vb, 1);
  const geo = mergeGeometries([forma.madeira, forma.folhas], false)!; geo.computeBoundingSphere();
  forma.madeira.dispose(); forma.folhas.dispose();
  const Mat = simples ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  const mat = comVento(new Mat({ map: atlas, alphaTest: 0.38, side: THREE.DoubleSide, vertexColors: true, ...(simples ? {} : { roughness: 0.86, metalness: 0, alphaToCoverage: true }) }), palm ? 0.06 : 0.04, palm ? 0.0025 : 0.0035, palm ? 0.62 : 0.3);
  if (!simples) registrarMolhavel(mat, { escurece: 0.2, liso: 0.28 });
  // sombra recortada pelas folhas (sem isso o cartão faria sombra quadrada)
  const profundidade = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.38, side: THREE.DoubleSide });
  let chao: THREE.BufferGeometry | null = null, matChao: THREE.Material | null = null;
  if (COR_CHAO[esp]) {
    // tapete de flores caídas embaixo do ipê
    chao = new THREE.PlaneGeometry(forma.raioCopa * 3.1, forma.raioCopa * 3.1); chao.rotateX(-Math.PI / 2); chao.translate(0, 0.004, 0);
    TEX_PETALAS ??= pintarPetalas(99);
    matChao = new Mat({ map: TEX_PETALAS, color: COR_CHAO[esp], alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  const kit: Kit = { geo, mat, profundidade, chao, matChao, sombra: !simples };
  KITS.set(esp, kit); return kit;
}

// ---------- instâncias ----------
interface Instancias { m: THREE.Matrix4[]; corFolha: THREE.Color[]; corMadeira: THREE.Color[] }
function montarInstancias(esp: Especie, itens: ItemInstancia[]): Instancias {
  const m: THREE.Matrix4[] = [], corFolha: THREE.Color[] = [], corMadeira: THREE.Color[] = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), palm = esp === "palmeiraImperial" || esp === "coqueiro";
  for (const it of itens) {
    const hz = hashPos(it.pos[0], it.pos[2]), h = it.altura ?? 5;
    e.set(0, (it.rot ?? 0) + hz * 6.28, 0); q.setFromEuler(e);
    // largura e altura variam um pouco; metade espelhada (parece outra árvore)
    const xz = h * (it.escalaXZ ?? 1) * (palm ? 1 : 0.88 + hz * 0.24), espelho = hz > 0.5 ? -1 : 1;
    m.push(new THREE.Matrix4().compose(new THREE.Vector3(...it.pos), q.clone(), new THREE.Vector3(xz * espelho, h * (0.94 + ((hz * 7) % 1) * 0.12), xz)));
    // tom de cada árvore: umas mais amareladas, outras mais azuladas, umas mais claras (multiplica a textura)
    const t1 = (hz * 13) % 1, t2 = (hz * 5) % 1, claro = 0.88 + ((hz * 7) % 1) * 0.2;
    corFolha.push(new THREE.Color((0.9 + t1 * 0.16) * claro, (0.95 + t2 * 0.08) * claro, (0.84 + (1 - t1) * 0.16) * claro));
    corMadeira.push(new THREE.Color(1, 1, 1).multiplyScalar(0.9 + ((hz * 3) % 1) * 0.2));
  }
  return { m, corFolha, corMadeira };
}
// preenche a malha (chamado pelo ref: se o React recriar a malha, ela é preenchida de novo)
function encher(im: THREE.InstancedMesh | null, inst: Instancias, chao = false) {
  if (!im) return;
  inst.m.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, chao ? inst.corMadeira[i] : inst.corFolha[i]); });
  im.count = inst.m.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
}
function Vento() { useFrame(({ clock }) => { VENTO.uTempo.value = clock.elapsedTime; }); return null; }

// Árvores de uma espécie (troca direta do <ModeloInstanciado nome="arvore" itens={...} />): uma malha só (madeira e folhas)
export function ArvoresInstanciadas({ especie, itens, sombra = true }: { especie: Especie; itens: ItemInstancia[]; sombra?: boolean }) {
  const kit = useMemo(() => kitDaEspecie(especie), [especie]);
  const inst = useMemo(() => montarInstancias(especie, itens), [especie, itens]);
  const refArvore = useCallback((im: THREE.InstancedMesh | null) => encher(im, inst), [inst]);
  const refChao = useCallback((im: THREE.InstancedMesh | null) => encher(im, inst, true), [inst]);
  const n = inst.m.length; if (!n) return null;
  const s = sombra && kit.sombra;
  return (
    <group>
      <Vento />
      <instancedMesh ref={refArvore} args={[kit.geo, kit.mat, n]} castShadow={s} customDepthMaterial={kit.profundidade} />
      {kit.chao && kit.matChao && <instancedMesh ref={refChao} args={[kit.chao, kit.matChao, n]} receiveShadow={s} />}
    </group>
  );
}

// Várias espécies sorteadas pela posição (sempre a mesma árvore no mesmo lugar). mistura = peso de cada espécie.
export type Mistura = Partial<Record<Especie, number>>;
export const MISTURA_RUA: Mistura = { frondosa: 0.34, oiti: 0.26, figueira: 0.12, ipeAmarelo: 0.1, ipeRosa: 0.1, ipeRoxo: 0.08 };
export const MISTURA_PARQUE: Mistura = { figueira: 0.32, frondosa: 0.33, oiti: 0.2, ipeAmarelo: 0.05, ipeRoxo: 0.05, palmeiraImperial: 0.05 };
export function especieDaPosicao(x: number, z: number, mistura: Mistura): Especie {
  const entradas = Object.entries(mistura) as [Especie, number][]; const total = entradas.reduce((a, [, p]) => a + p, 0);
  let v = hashPos(x * 1.31 + 7, z * 0.77 - 3) * total;
  for (const [e, p] of entradas) { if ((v -= p) <= 0) return e; }
  return entradas[entradas.length - 1][0];
}
export function ArvoresMistas({ itens, mistura = MISTURA_RUA, sombra = true }: { itens: ItemInstancia[]; mistura?: Mistura; sombra?: boolean }) {
  const grupos = useMemo(() => {
    const g = new Map<Especie, ItemInstancia[]>();
    for (const it of itens) { const e = especieDaPosicao(it.pos[0], it.pos[2], mistura); let l = g.get(e); if (!l) { l = []; g.set(e, l); } l.push(it); }
    return [...g.entries()];
  }, [itens, mistura]);
  return <group>{grupos.map(([e, l]) => <ArvoresInstanciadas key={e} especie={e} itens={l} sombra={sombra} />)}</group>;
}

// Uma árvore avulsa (decoração do lote do cliente, praça): a mesma geometria e o mesmo material, sem instância
export function ArvoreAvulsa({ position, altura = 4.5, especie, giro }: { position: [number, number, number]; altura?: number; especie?: Especie; giro?: number }) {
  const esp = especie ?? (hashPos(position[0], position[2]) > 0.5 ? "frondosa" : "oiti");
  const kit = useMemo(() => kitDaEspecie(esp), [esp]);
  const hz = hashPos(position[0] + 3, position[2] - 1);
  const xz = altura * (0.9 + hz * 0.2) * (hz > 0.5 ? -1 : 1);
  return (
    <group position={position} rotation={[0, giro ?? hz * 6.28, 0]} scale={[xz, altura, Math.abs(xz)]}>
      <Vento />
      <mesh geometry={kit.geo} material={kit.mat} castShadow={kit.sombra} customDepthMaterial={kit.profundidade} />
      {kit.chao && kit.matChao && <mesh geometry={kit.chao} material={kit.matChao} />}
    </group>
  );
}
