"use client";
// Terreno das bordas (v63, 12/11/2026): uma malha só, com relevo e cores por vértice, em volta da cidade (que tem chão
// próprio: o miolo fica vazado, sem sobrepor nada). Leste e sul: orla, areia com dunas baixas, areia molhada e o fundo
// que afunda embaixo do mar. Oeste: serra verde que sobe aos poucos a partir da cidade, com o vale do rio (a água desce
// dela) e, ao sul, morros que descem até o mar. Norte: chão da cidade que continua (os prédios ficam em Horizonte.tsx).
// Perto da cidade a malha é fina (3 m); longe, os espaços crescem (a névoa do CicloDia apaga a distância).
// Mata: copas instanciadas pelos morros perto da cidade. Tudo criado uma vez (sem "new" no JSX, sem recompilar).
import { contar } from "./medirGeracao";
import { lerGuardado, guardar, fatia } from "./guardaNoAparelho";
import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";
import { BORDAS, MUNDO, NORTE, costaLeste, costaSul, rioNoVale } from "../data/mundo";
import { MAT_AGUA, MAT_BRILHO } from "./Rio";
import { registrarMolhavel } from "./Clima";
import { leve } from "./qualidade";

// ---------- ruído (determinístico: a mesma serra em todo aparelho) ----------
function h21(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function ruido(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h21(xi, yi), b = h21(xi + 1, yi), c = h21(xi, yi + 1), d = h21(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oit = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oit; i++) { s += a * ruido(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, oit)); }
const crista = (x: number, y: number) => { const n = fbm(x, y, 4); return 1 - Math.abs(2 * n - 1); }; // picos e espigões
const suave = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

const MAR = BORDAS.nivelMar;
const XI = (z: number) => (z < NORTE.calcadao.z0 ? 86 : MUNDO.x); // borda de dentro da praia leste (ao lado do parque, a areia começa antes)
const ZI = MUNDO.z;
// perfil da praia: d = metros desde a borda de dentro; agua = metros até a linha d'água; orla = largura do calçadão
function praia(d: number, agua: number, orla: number, x: number, z: number) {
  if (d < orla) return -0.02; // debaixo do calçadão
  const s = (d - orla) / Math.max(4, agua - orla);
  if (s <= 1) {
    const duna = s < 0.6 ? 0.22 * Math.sin((Math.PI * s) / 0.6) * (0.5 + ruido(x * 0.11, z * 0.11)) : 0;
    return MAR * Math.pow(s, 1.3) + duna;
  }
  return MAR - (d - agua) * 0.055;
}
// morros: sobem a partir da borda oeste da cidade; vale do rio; ao sul, descem até o mar; bem ao fundo do norte, morros baixos
function morro(x: number, z: number) {
  let h = -10;
  const dW = -MUNDO.x - x;
  if (dW > 0) {
    const sobe = suave(30, 210, dW);
    const alto = 10 + 52 * fbm(x / 170 + 3.1, z / 170 - 1.7) + 28 * crista(x / 85 + 9, z / 85);
    const fundo = 0.45 + 0.85 * suave(120, 480, dW);
    let m = sobe * alto * fundo;
    m *= suave(9, 75, Math.abs(z - rioNoVale(x))); // vale do rio
    if (z > 80) m *= 1 - suave(96, 150 + 24 * ruido(x / 45, 7), z); // a serra desce no mar
    h = m - 0.03;
  }
  if (z < -380) h = Math.max(h, suave(-380, -660, z) * (18 + 55 * fbm(x / 210, z / 210)) - 0.03);
  return h;
}
// o morro do último ponto calculado (a cor do terreno reaproveita: era o mesmo cálculo duas vezes por ponto)
let ULTIMO_MORRO = -10;
export function alturaTerreno(x: number, z: number) {
  let h = -0.03;
  const xi = XI(z), leste = x > xi, sul = z > ZI;
  if (leste) h = praia(x - xi, costaLeste(z) - xi, z < NORTE.calcadao.z0 ? 0 : BORDAS.orla, x, z);
  if (sul) { const hs = praia(z - ZI, costaSul(x) - ZI, x < -MUNDO.x || x > costaLeste(z) ? 0 : BORDAS.orla, x, z); h = leste ? Math.min(h, hs) : hs; }
  const m = morro(x, z); ULTIMO_MORRO = m; if (m > h) h = m;
  // canal do rio: a oeste (vale da serra) e a leste (da ponta do calçadão até o mar)
  if (x < -97 || x > 85) {
    const dz = Math.abs(z - (x < -97 ? rioNoVale(x) : BORDAS.rioZ)), meia = BORDAS.rioMeia;
    if (dz < meia + 3) { const fundo = -1.3, t = suave(meia - 0.4, meia + 3, dz); h = Math.min(h, fundo + (h - fundo) * t); }
  }
  return h;
}

// ---------- cores por vértice ----------
const C = {
  areia: new THREE.Color("#EADBB2"), areiaClara: new THREE.Color("#F2E6C6"), molhada: new THREE.Color("#C7B286"), funda: new THREE.Color("#A89878"),
  grama: new THREE.Color("#74B061"), gramaSeca: new THREE.Color("#93B36A"), cidade: new THREE.Color("#8E9A88"),
  mata: new THREE.Color("#3E8746"), mataEsc: new THREE.Color("#2B6636"), mataClara: new THREE.Color("#5FA052"), pedra: new THREE.Color("#8F8C7A"), barro: new THREE.Color("#7A6F55"),
};
const tc = new THREE.Color();
function corTerreno(x: number, z: number, h: number, inclin: number, alvo: THREE.Color, morroJa?: number) {
  const xi = XI(z), praiaL = x > xi, praiaS = z > ZI && (x > -MUNDO.x || (morroJa ?? morro(x, z)) < 0.4);
  const n = ruido(x * 0.07, z * 0.07), n2 = ruido(x * 0.31 + 5, z * 0.31);
  if ((praiaL || praiaS) && h < 0.6) {
    // areia: clara e seca perto da orla, molhada perto da água, mais escura embaixo d'água
    alvo.copy(C.areia).lerp(C.areiaClara, n * 0.5);
    if (h < -0.25) alvo.lerp(C.molhada, suave(-0.25, MAR + 0.02, h));
    if (h < MAR) alvo.copy(C.molhada).lerp(C.funda, suave(MAR, MAR - 1.2, h));
    return alvo.multiplyScalar(0.94 + n2 * 0.1);
  }
  // margem do rio
  if (h < -0.35) return alvo.copy(C.barro).multiplyScalar(0.9 + n2 * 0.15);
  // chão plano: grama perto da cidade, cinza-esverdeado onde a cidade continua (norte)
  if (h < 1.2 && x > -MUNDO.x - 4) return alvo.copy(z < NORTE.fim + 2 ? C.cidade : C.grama).lerp(C.gramaSeca, n * 0.35).multiplyScalar(0.95 + n2 * 0.08);
  // serra: mata em manchas, mais clara no alto, pedra nos barrancos
  alvo.copy(C.mata).lerp(C.mataEsc, suave(0.35, 0.75, fbm(x / 38, z / 38, 3))).lerp(C.mataClara, suave(45, 110, h) * 0.6 + n * 0.2);
  if (h < 3) alvo.lerp(C.grama, (1 - h / 3) * 0.7);
  alvo.lerp(C.pedra, suave(0.55, 0.95, inclin) * 0.85);
  return alvo.multiplyScalar(0.92 + n2 * 0.12);
}

// ---------- malha ----------
function eixo(min: number, max: number, d0: number, d1: number, passo: number, cresce: number, exatos: number[]) {
  const v: number[] = [];
  for (let a = d0; a <= d1 + 1e-6; a += passo) v.push(a);
  let s = passo, a = d0; while (a > min) { s *= cresce; a -= s; v.push(Math.max(min, a)); }
  s = passo; a = d1; while (a < max) { s *= cresce; a += s; v.push(Math.min(max, a)); }
  v.push(...exatos); v.sort((p, q) => p - q);
  const out: number[] = [];
  for (const p of v) { const u = out[out.length - 1]; if (u !== undefined && p - u < passo * 0.45) { if (exatos.includes(p)) out[out.length - 1] = p; continue; } out.push(p); }
  return out;
}
// o miolo é da cidade (grama, calçadão, rio e parque já têm chão): esses quadrados não entram
const dentro = (x: number, z: number) => (x > -MUNDO.x && x < MUNDO.x && z > NORTE.calcadao.z0 && z < MUNDO.z) || (x > -98 && x < 86 && z > NORTE.fim && z < NORTE.calcadao.z0);
let TEX_DETALHE: THREE.CanvasTexture | null = null;
function texturaDetalhe() {
  if (TEX_DETALHE || typeof document === "undefined") return TEX_DETALHE;
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // grãos finos + manchas: some no conjunto, dá textura de perto (areia, grama, mata)
    const v = 0.82 + 0.1 * ruido(x / 9, y / 9) + 0.08 * h21(x, y);
    const i = (y * S + x) * 4; const b = Math.round(255 * Math.min(1, v)); img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  TEX_DETALHE = new THREE.CanvasTexture(c); TEX_DETALHE.wrapS = TEX_DETALHE.wrapT = THREE.RepeatWrapping; TEX_DETALHE.anisotropy = 4; // linear de propósito: só multiplica a cor de 0,82 a 1
  return TEX_DETALHE;
}
interface DadosTerreno { pos: Float32Array; cor: Float32Array; uv: Float32Array; normal: Float32Array; idx: Uint16Array | Uint32Array }
// v67: o mesmo cálculo de antes, mas em fatias de ~6 ms (a cidade continua desenhando) e devolvendo os números prontos
// (posição, cor, uv, normal, índices) para guardar no aparelho
async function terrenoAosPoucos(poucos: boolean): Promise<DadosTerreno> {
  const E = BORDAS.extensao;
  const xs = eixo(-E, 175, -135, 140, poucos ? 5 : 3, poucos ? 1.22 : 1.12, [-98, -MUNDO.x, 86, MUNDO.x, MUNDO.x + BORDAS.orla]);
  const zs = eixo(-E, 175, -215, 140, poucos ? 5 : 3, poucos ? 1.22 : 1.12, [NORTE.fim, NORTE.calcadao.z0, NORTE.rio.z0, NORTE.rio.z1, MUNDO.z, MUNDO.z + BORDAS.orla]);
  const nx = xs.length, nz = zs.length, n = nx * nz;
  const pos = new Float32Array(n * 3), cor = new Float32Array(n * 3), uv = new Float32Array(n * 2), alt = new Float32Array(n), mor = new Float32Array(n);
  let t = performance.now();
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) { const k = j * nx + i; alt[k] = alturaTerreno(xs[i], zs[j]); mor[k] = ULTIMO_MORRO; }
    if (performance.now() - t > 6) { await fatia(); t = performance.now(); }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = xs[i], z = zs[j], h = alt[k];
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
      const gx = (alt[j * nx + i1] - alt[j * nx + i0]) / Math.max(0.5, xs[i1] - xs[i0]), gz = (alt[j1 * nx + i] - alt[j0 * nx + i]) / Math.max(0.5, zs[j1] - zs[j0]);
      const inclin = Math.min(1, Math.hypot(gx, gz) / 1.4);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      corTerreno(x, z, h, inclin, tc, mor[k]); cor[k * 3] = tc.r; cor[k * 3 + 1] = tc.g; cor[k * 3 + 2] = tc.b;
      uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
    }
    if (performance.now() - t > 6) { await fatia(); t = performance.now(); }
  }
  const lista: number[] = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (dentro((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)) continue;
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    lista.push(a, c, b, b, c, d);
  }
  const idx = n > 65535 ? new Uint32Array(lista) : new Uint16Array(lista);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const normal = (g.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array; g.dispose();
  return { pos, cor, uv, normal, idx };
}
function geometriaDoTerreno(d: DadosTerreno) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(d.normal, 3));
  g.setAttribute("color", new THREE.BufferAttribute(d.cor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(d.uv, 2));
  g.setIndex(new THREE.BufferAttribute(d.idx, 1)); g.computeBoundingSphere();
  return g;
}
let MAT_TERRENO: THREE.MeshStandardMaterial | null = null;
function materialTerreno() {
  if (MAT_TERRENO) return MAT_TERRENO;
  MAT_TERRENO = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: texturaDetalhe() ?? undefined });
  registrarMolhavel(MAT_TERRENO, { escurece: 0.18, liso: 0.15 }); // na chuva, a areia e a mata escurecem um pouco
  return MAT_TERRENO;
}

// ---------- rio no vale da serra (continua o rio da cidade para oeste, com curvas) ----------
const NIVEL_RIO = -0.42;
function faixaRio(x0: number, x1: number, larg: number, metros: number) {
  const pts: number[] = []; for (let x = x0, s = 3; x > x1; x -= s, s = Math.min(24, s * 1.06)) pts.push(x); pts.push(x1);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let ac = 0;
  pts.forEach((x, i) => {
    const z = rioNoVale(x); if (i > 0) ac += Math.hypot(x - pts[i - 1], z - rioNoVale(pts[i - 1]));
    pos.push(x, 0, z - larg / 2, x, 0, z + larg / 2); uv.push(ac / metros, 0, ac / metros, larg / metros);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } // face para cima (x diminui)
  });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

// ---------- mata nos morros perto da cidade ----------
const GEO_COPA_MATA = new THREE.IcosahedronGeometry(1, 1), GEO_TRONCO_MATA = new THREE.CylinderGeometry(0.1, 0.16, 1, 6);
const MAT_MATA = new THREE.MeshStandardMaterial({ roughness: 0.92 }), MAT_TRONCO_MATA = new THREE.MeshStandardMaterial({ color: "#6B4E33", roughness: 0.95 });
export interface Arvoreta { x: number; z: number; y: number; raio: number; cor: THREE.Color; tronco: boolean }
// copas e troncos instanciados (2 draw calls) a partir de uma lista pronta; usado na serra e na faixa de mata do norte
export function criarArvoretas(lista: Arvoreta[]) {
  const copa = new THREE.InstancedMesh(GEO_COPA_MATA, MAT_MATA, Math.max(1, lista.length));
  const comTronco = lista.filter((a) => a.tronco), tronco = new THREE.InstancedMesh(GEO_TRONCO_MATA, MAT_TRONCO_MATA, Math.max(1, comTronco.length));
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  lista.forEach((a, i) => {
    e.set(0, (a.x * 13.7 + a.z) % 6.28, 0); q.setFromEuler(e);
    const alto = a.tronco ? a.raio * 1.15 + 0.9 : a.raio * 0.55; // perto da cidade a copa fica no alto do tronco; longe, "afunda" no morro
    copa.setMatrixAt(i, M.compose(p.set(a.x, a.y + alto, a.z), q, s.set(a.raio, a.raio * 0.92, a.raio))); copa.setColorAt(i, a.cor);
  });
  comTronco.forEach((a, i) => { tronco.setMatrixAt(i, M.compose(p.set(a.x, a.y + (a.raio * 1.15 + 0.9) / 2, a.z), q.identity(), s.set(a.raio * 0.5 + 0.5, a.raio * 1.15 + 0.9, a.raio * 0.5 + 0.5))); });
  for (const im of [copa, tronco]) { im.count = im === copa ? lista.length : comTronco.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = false; }
  return [copa, tronco];
}
export const VERDES_MATA = ["#2E6E3A", "#3B7F3F", "#4E9A4A", "#2A5E33", "#5C9E4E", "#3F8A46", "#6AA858"].map((h) => new THREE.Color(h));
async function mataAosPoucos(poucos: boolean): Promise<Float32Array> {
  const total = poucos ? 650 : 2400;
  const saida: number[] = []; let n = 0;
  let s = 4242; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let t = performance.now();
  for (let tent = 0; tent < total * 6 && n < total; tent++) {
    if (performance.now() - t > 6) { await fatia(); t = performance.now(); }
    const x = -MUNDO.x - 4 - Math.pow(r(), 1.4) * 320, z = -420 + r() * 560;
    const h = alturaTerreno(x, z);
    if (h < 0.4 || h > 95) continue;
    if (Math.abs(z - rioNoVale(x)) < BORDAS.rioMeia + 4) continue;
    if (h < 2 && r() < 0.45) continue;
    const perto = -MUNDO.x - x < 70;
    const raio = 1.5 + r() * 1.7 + Math.min(1.6, h / 45);
    const c = VERDES_MATA[Math.floor(r() * VERDES_MATA.length)].clone().multiplyScalar(0.88 + r() * 0.22);
    saida.push(x, z, h, raio, c.r, c.g, c.b, perto ? 1 : 0); n++;
  }
  return new Float32Array(saida);
}
function arvoretasDosNumeros(f: Float32Array): Arvoreta[] {
  const l: Arvoreta[] = [];
  for (let i = 0; i + 7 < f.length; i += 8) l.push({ x: f[i], z: f[i + 1], y: f[i + 2], raio: f[i + 3], cor: new THREE.Color(f[i + 4], f[i + 5], f[i + 6]), tronco: f[i + 7] > 0.5 });
  return l;
}
// a serra pronta para desenhar: do aparelho (2ª visita em diante) ou calculada em fatias (1ª visita) e guardada
const VERSAO_SERRA = "v67-1";
const PROMESSAS = new Map<string, Promise<{ terreno: DadosTerreno; mata: Float32Array }>>();
function dadosDaSerra(poucos: boolean) {
  const chave = `serra-${poucos ? "leve" : "alta"}@${VERSAO_SERRA}`;
  let p = PROMESSAS.get(chave);
  if (!p) {
    p = (async () => {
      const guardado = await lerGuardado<{ terreno: DadosTerreno; mata: Float32Array }>(chave);
      if (guardado?.terreno?.pos && guardado.mata) { contar("serra: do aparelho"); return guardado; }
      const t0 = performance.now();
      const terreno = await terrenoAosPoucos(poucos), mata = await mataAosPoucos(poucos);
      contar("serra: calculada (ms, com as pausas)", performance.now() - t0);
      guardar(chave, { terreno, mata });
      return { terreno, mata };
    })();
    PROMESSAS.set(chave, p);
  }
  return p;
}
export function Serra() {
  const poucos = leve();
  const [dados, setDados] = useState<{ terreno: DadosTerreno; mata: Float32Array } | null>(null);
  useEffect(() => { let vivo = true; void dadosDaSerra(poucos).then((d) => { if (vivo) setDados(d); }); return () => { vivo = false; }; }, [poucos]);
  const material = useMemo(() => materialTerreno(), []);
  const rio = useMemo(() => ({ agua: faixaRio(-98, -BORDAS.extensao, BORDAS.rioMeia * 2 + 0.6, 1e9), brilho: faixaRio(-98, -BORDAS.extensao, BORDAS.rioMeia * 2 + 0.6, 14) }), []);
  const geo = useMemo(() => (dados ? geometriaDoTerreno(dados.terreno) : null), [dados]);
  const mata = useMemo(() => (dados ? criarArvoretas(arvoretasDosNumeros(dados.mata)) : null), [dados]);
  return (
    <group>
      {geo && <mesh geometry={geo} material={material} receiveShadow />}
      <mesh geometry={rio.agua} material={MAT_AGUA} position={[0, NIVEL_RIO, 0]} />
      <mesh geometry={rio.brilho} material={MAT_BRILHO} position={[0, NIVEL_RIO + 0.02, 0]} renderOrder={2} />
      {mata && mata.map((im, i) => <primitive key={i} object={im} />)}
    </group>
  );
}
