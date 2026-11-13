"use client";
// Bairros com identidade (12/11/2026): cada quarteirão de lotes tem piso de calçada, árvores de rua, galhardetes nos postes
// e uma placa com o nome do bairro, na cor dele. À noite os postes ganham um halo (na cor de luz do bairro) e o piso do
// Distrito Tech acende as linhas. Tudo instanciado ou estático; texturas desenhadas em canvas uma vez só.
import { registrarMolhavel } from "./Clima";
import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mat, cilindro, caixa } from "./geo";
import { leve } from "./qualidade";
import { ceu, texturaLuz } from "./CicloDia";
import { type ItemInstancia } from "./Modelos";
import { ArvoresInstanciadas, type Especie } from "./Arvores";
import { BAIRROS, BAIRRO_DO_QUARTEIRAO, MEIO_Q, CALCADA, BORDA_CALCADA, PASSO, type Bairro, type PisoBairro } from "../data/mundo";

// ---------- texturas de piso (cada uma representa `metros` de chão e repete) ----------
type Piso = PisoBairro | "ondas";
const METROS: Record<Piso, number> = { terracota: 1, xadrezRosa: 1.2, graficoNeon: 1.5, folhas: 1.6, granilite: 0.9, granito: 1.2, mosaico: 1.4, ondas: 3.6 };
const TEX_PISO = new Map<string, THREE.CanvasTexture>();
function semente(n: number) { let s = n; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function desenharPiso(tipo: Piso, g: CanvasRenderingContext2D, S: number, emissao = false) {
  const r = semente(7 + tipo.length * 13);
  if (tipo === "terracota") { // ladrilho de barro 4 × 4 com rejunte claro
    g.fillStyle = "#E9DCC8"; g.fillRect(0, 0, S, S);
    const n = 2, l = S / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const t = r(); g.fillStyle = `hsl(${18 + t * 8}, ${52 + t * 10}%, ${50 + t * 7}%)`; g.fillRect(a * l + 4, b * l + 4, l - 8, l - 8); }
  } else if (tipo === "xadrezRosa") { // xadrez na diagonal, rosa e branco, com fio dourado
    g.fillStyle = "#FBF2F5"; g.fillRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2); g.rotate(Math.PI / 4); g.fillStyle = "#F0BFD3";
    const l = S / Math.SQRT2 / 2; for (let a = -3; a < 3; a++) for (let b = -3; b < 3; b++) if ((a + b) % 2 === 0) g.fillRect(a * l, b * l, l, l);
    g.restore(); g.strokeStyle = "rgba(201,160,90,.55)"; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
  } else if (tipo === "graficoNeon") { // grafite com linhas finas (acendem à noite, ciano)
    if (!emissao) { g.fillStyle = "#3A404B"; g.fillRect(0, 0, S, S); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; g.fillRect(r() * S, r() * S, 2, 2); } }
    else { g.fillStyle = "#000"; g.fillRect(0, 0, S, S); }
    g.strokeStyle = emissao ? "#5FE3FF" : "#6E8FA3"; g.lineWidth = emissao ? 3 : 2;
    g.beginPath(); g.moveTo(0, S * 0.5); g.lineTo(S, S * 0.5); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S); g.stroke();
    if (emissao) { g.fillStyle = "#5FE3FF"; g.fillRect(S * 0.5 - 5, S * 0.5 - 5, 10, 10); }
  } else if (tipo === "folhas") { // concreto claro com folhas verdes embutidas
    g.fillStyle = "#E4E7DF"; g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(0,0,0,.08)"; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
    for (const [x, y, a] of [[0.3, 0.32, 0.6], [0.72, 0.7, -0.9]] as const) {
      g.save(); g.translate(x * S, y * S); g.rotate(a); g.fillStyle = "#57A86A";
      g.beginPath(); g.ellipse(0, 0, S * 0.12, S * 0.05, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#E4E7DF"; g.lineWidth = 2; g.beginPath(); g.moveTo(-S * 0.11, 0); g.lineTo(S * 0.11, 0); g.stroke(); g.restore();
    }
  } else if (tipo === "granilite") { // granilite (terrazzo) com lascas coloridas
    g.fillStyle = "#EFEAE2"; g.fillRect(0, 0, S, S);
    const cores = ["#7C4DDB", "#F2A33A", "#2BB3A3", "#E2575B", "#3B5BDB", "#9AA3AD"];
    for (let i = 0; i < 90; i++) { g.fillStyle = cores[i % cores.length]; g.globalAlpha = 0.55 + r() * 0.4; g.beginPath(); const x = r() * S, y = r() * S, t = 3 + r() * 7; g.moveTo(x, y); g.lineTo(x + t, y + r() * t); g.lineTo(x + r() * t, y + t); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
  } else if (tipo === "granito") { // placas de granito cinza com pontinhos
    g.fillStyle = "#B9BDC2"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { const t = r(); g.fillStyle = t < 0.5 ? "rgba(40,44,52,.35)" : "rgba(255,255,255,.35)"; g.fillRect(r() * S, r() * S, 1.6, 1.6); }
    g.strokeStyle = "rgba(60,64,72,.45)"; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S / 2 - 1); g.strokeRect(1, S / 2, S - 2, S / 2 - 1);
  } else if (tipo === "mosaico") { // mosaico em ondas, verde-água e branco
    g.fillStyle = "#F4FBF9"; g.fillRect(0, 0, S, S); g.fillStyle = "#3DB5A6";
    for (let k = 0; k < 2; k++) { g.beginPath(); const y0 = k * S / 2; g.moveTo(0, y0 + S * 0.18); for (let x = 0; x <= S; x += 4) g.lineTo(x, y0 + S * 0.18 + Math.sin((x / S) * Math.PI * 2) * S * 0.09); for (let x = S; x >= 0; x -= 4) g.lineTo(x, y0 + S * 0.3 + Math.sin((x / S) * Math.PI * 2) * S * 0.09); g.closePath(); g.fill(); }
  } else { // ondas: pedra portuguesa preta e branca (calçadão da beira-rio)
    g.fillStyle = "#F2EEE4"; g.fillRect(0, 0, S, S); g.fillStyle = "#4A4F57";
    for (let k = 0; k < 2; k++) { g.beginPath(); const y0 = k * S / 2; g.moveTo(0, y0); for (let x = 0; x <= S; x += 4) g.lineTo(x, y0 + S * 0.14 + Math.sin((x / S) * Math.PI * 2) * S * 0.1); for (let x = S; x >= 0; x -= 4) g.lineTo(x, y0 + S * 0.205 + Math.sin((x / S) * Math.PI * 2) * S * 0.1); g.closePath(); g.fill(); }
    for (let i = 0; i < 500; i++) { g.fillStyle = "rgba(0,0,0,.06)"; g.fillRect(r() * S, r() * S, 3, 3); }
  }
}
export function texturaPiso(tipo: Piso, emissao = false) {
  const k = tipo + (emissao ? ":e" : "");
  if (TEX_PISO.has(k) || typeof document === "undefined") return TEX_PISO.get(k) ?? null;
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  desenharPiso(tipo, c.getContext("2d")!, S, emissao);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  TEX_PISO.set(k, t); return t;
}
const MAT_PISO = new Map<string, THREE.Material>();
// material do piso (o do Distrito Tech tem as linhas acesas à noite: emissiveIntensity muda a cada quadro)
export function materialPiso(tipo: Piso) {
  let m = MAT_PISO.get(tipo); if (m) return m;
  const map = texturaPiso(tipo); if (!map) return mat("#D9D5CC");
  if (tipo === "graficoNeon") m = new THREE.MeshStandardMaterial({ map, roughness: 0.7, emissive: "#5FE3FF", emissiveMap: texturaPiso(tipo, true), emissiveIntensity: 0 });
  else m = leve() ? new THREE.MeshLambertMaterial({ map }) : new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
  registrarMolhavel(m); // a calçada do bairro também escurece e brilha na chuva (scene/Clima)
  MAT_PISO.set(tipo, m); return m;
}
// plano deitado com UV em metros (a textura repete do mesmo tamanho em qualquer tira)
const GEO_M = new Map<string, THREE.BufferGeometry>();
export function planoMetros(w: number, h: number, metros: number) {
  const k = `${w},${h},${metros}`; let g = GEO_M.get(k); if (g) return g;
  g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / metros, (uv.getY(i) * h) / metros);
  GEO_M.set(k, g); return g;
}
export const metrosDoPiso = (t: Piso) => METROS[t];

// Calçada do bairro (substitui a calçada lisa do Mundo nos quarteirões de lotes). As tiras leste/oeste não cobrem os
// cantos, para as texturas não brigarem onde as tiras se cruzam.
export function CalcadaBairro({ cx, cz, b }: { cx: number; cz: number; b: Bairro }) {
  const a = MEIO_Q + CALCADA / 2, L = 2 * BORDA_CALCADA, m = METROS[b.piso], mt = materialPiso(b.piso);
  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={planoMetros(L, CALCADA, m)} material={mt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -a]} receiveShadow />
      <mesh geometry={planoMetros(L, CALCADA, m)} material={mt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, a]} receiveShadow />
      <mesh geometry={planoMetros(CALCADA, 2 * MEIO_Q, m)} material={mt} rotation={[-Math.PI / 2, 0, 0]} position={[-a, 0.0, 0]} receiveShadow />
      <mesh geometry={planoMetros(CALCADA, 2 * MEIO_Q, m)} material={mt} rotation={[-Math.PI / 2, 0, 0]} position={[a, 0.0, 0]} receiveShadow />
      {/* meio-fio na cor do bairro, bem discreto */}
      <mesh geometry={caixa(L, 0.12, 0.2)} material={mat("#C3BFB6")} position={[0, 0.0, -BORDA_CALCADA + 0.1]} />
      <mesh geometry={caixa(L, 0.12, 0.2)} material={mat("#C3BFB6")} position={[0, 0.0, BORDA_CALCADA - 0.1]} />
      <mesh geometry={caixa(0.2, 0.12, L)} material={mat("#C3BFB6")} position={[-BORDA_CALCADA + 0.1, 0.0, 0]} />
      <mesh geometry={caixa(0.2, 0.12, L)} material={mat("#C3BFB6")} position={[BORDA_CALCADA - 0.1, 0.0, 0]} />
    </group>
  );
}

// ---------- árvores de rua ----------
// Duas por lado do quarteirão, no canteiro junto ao meio-fio (longe dos semáforos, que ficam perto das esquinas).
// Desde a v63 (12/11/2026) cada bairro tem a sua espécie desenhada em código (scene/Arvores.tsx): ipê amarelo, ipê rosa,
// ipê roxo (o "jacarandá" do bairro), oiti, frondosa, topiária aparada e palmeira imperial. A grade de ferro continua.
const ESPECIE_DO_BAIRRO: Record<string, Especie> = { ipeAmarelo: "ipeAmarelo", ipeRosa: "ipeRosa", jacaranda: "ipeRoxo", copaVerde: "frondosa", oiti: "oiti", topiaria: "topiaria", palmeiraImperial: "palmeiraImperial" };
const ALTURA_DA_ESPECIE: Partial<Record<Especie, number>> = { palmeiraImperial: 10, topiaria: 2.6, oiti: 5.6, frondosa: 6.2, ipeAmarelo: 6, ipeRosa: 6, ipeRoxo: 6.2 };
interface PosArvore { x: number; z: number; b: Bairro; n: number }
function posicoesArvores(): PosArvore[] {
  const out: PosArvore[] = []; const off = BORDA_CALCADA - 0.6; let n = 0;
  for (const b of BAIRROS) {
    const cx = b.i * PASSO, cz = b.j * PASSO;
    for (const s of [-11, 11]) { out.push({ x: cx + s, z: cz - off, b, n: n++ }, { x: cx + s, z: cz + off, b, n: n++ }, { x: cx - off, z: cz + s, b, n: n++ }, { x: cx + off, z: cz + s, b, n: n++ }); }
  }
  return out;
}
const MAT_GRADE = new THREE.MeshStandardMaterial({ color: "#3A3F47", roughness: 0.6, metalness: 0.3 });
const GEO_GRADE = caixa(1.1, 0.06, 1.1);
function preencher(im: THREE.InstancedMesh | null, lista: { m: THREE.Matrix4; c?: THREE.Color }[]) {
  if (!im) return;
  lista.forEach((x, i) => { im.setMatrixAt(i, x.m); if (x.c) im.setColorAt(i, x.c); });
  im.count = lista.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
}
export function ArvoresDeRua() {
  const todas = useMemo(() => posicoesArvores(), []);
  const porEspecie = useMemo(() => {
    const g = new Map<Especie, ItemInstancia[]>();
    for (const p of todas) {
      const e = ESPECIE_DO_BAIRRO[p.b.arvore] ?? "frondosa", h = ALTURA_DA_ESPECIE[e] ?? 6;
      let l = g.get(e); if (!l) { l = []; g.set(e, l); }
      l.push({ pos: [p.x, 0, p.z], rot: p.n * 1.3, altura: h * (0.92 + (p.n % 3) * 0.07) });
    }
    return [...g.entries()];
  }, [todas]);
  // grade de ferro no pé de cada árvore (ref de callback: se a malha for recriada, preenche de novo)
  const grades = useMemo(() => todas.map((p) => ({ m: new THREE.Matrix4().makeTranslation(p.x, 0.03, p.z) })), [todas]);
  const refGrade = useCallback((im: THREE.InstancedMesh | null) => preencher(im, grades), [grades]);
  return (
    <group>
      <instancedMesh ref={refGrade} args={[GEO_GRADE, MAT_GRADE, grades.length]} receiveShadow />
      {porEspecie.map(([e, itens]) => <ArvoresInstanciadas key={e} especie={e} itens={itens} />)}
    </group>
  );
}

// ---------- galhardetes nos postes ----------
const TEX_GALH = new Map<string, THREE.CanvasTexture>();
function texturaGalhardete(b: Bairro) {
  if (TEX_GALH.has(b.id) || typeof document === "undefined") return TEX_GALH.get(b.id) ?? null;
  const W = 128, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  g.fillStyle = b.cor; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, 0, W, 22);
  // pontas em V embaixo (o resto fica transparente)
  g.globalCompositeOperation = "destination-out"; g.beginPath(); g.moveTo(0, H); g.lineTo(W / 2, H - 34); g.lineTo(W, H); g.closePath(); g.fill(); g.globalCompositeOperation = "source-over";
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 4; g.beginPath(); g.moveTo(12, 34); g.lineTo(W - 12, 34); g.stroke();
  // nome do bairro na vertical
  g.save(); g.translate(W / 2 + 2, H / 2 + 6); g.rotate(-Math.PI / 2); g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "800 40px Inter, Arial, sans-serif"; g.fillText(b.nome.toUpperCase(), 0, 0, H - 90); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX_GALH.set(b.id, t); return t;
}
export function Galhardetes({ postes }: { postes: ItemInstancia[] }) {
  const grupos = useMemo(() => {
    const por = new Map<string, { b: Bairro; itens: ItemInstancia[] }>();
    for (const p of postes) {
      const i = Math.round(p.pos[0] / PASSO), j = Math.round(p.pos[2] / PASSO), b = BAIRRO_DO_QUARTEIRAO[`${i},${j}`]; if (!b) continue;
      if (!por.has(b.id)) por.set(b.id, { b, itens: [] }); por.get(b.id)!.itens.push(p);
    }
    return [...por.values()];
  }, [postes]);
  return <group>{grupos.map((g) => <GalhardetesDoBairro key={g.b.id} b={g.b} itens={g.itens} />)}</group>;
}
// faixas de 1 m entre 2,05 e 3,05 m: acima da cabeça de quem passa e abaixo das placas de rua (3,35 e 3,8 m)
const GEO_GALH = new THREE.PlaneGeometry(0.5, 1.0);
function GalhardetesDoBairro({ b, itens }: { b: Bairro; itens: ItemInstancia[] }) {
  const im = useRef<THREE.InstancedMesh>(null), barra = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => { const t = texturaGalhardete(b); return new THREE.MeshStandardMaterial({ map: t ?? undefined, color: t ? "#FFFFFF" : b.cor, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, roughness: 0.8 }); }, [b]);
  useEffect(() => {
    const ms: { m: THREE.Matrix4 }[] = [], bs: { m: THREE.Matrix4 }[] = [];
    for (const p of itens) {
      // o poste olha para o centro do quarteirão (rot); as duas faixas ficam de lado, uma de cada lado do poste
      const rot = p.rot ?? 0, tx = Math.cos(rot), tz = -Math.sin(rot);
      for (const s of [-1, 1]) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot + (s > 0 ? 0 : Math.PI), 0));
        ms.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(p.pos[0] + tx * s * 0.34, 2.55, p.pos[2] + tz * s * 0.34), q, new THREE.Vector3(1, 1, 1)) });
      }
      bs.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(p.pos[0], 3.08, p.pos[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1)) });
    }
    preencher(im.current, ms); preencher(barra.current, bs);
  }, [itens]);
  return (
    <group>
      <instancedMesh ref={im} args={[GEO_GALH, material, itens.length * 2]} castShadow />
      <instancedMesh ref={barra} args={[caixa(1.2, 0.05, 0.05), MAT_GRADE, itens.length]} />
    </group>
  );
}

// ---------- placa do bairro (no lado do quarteirão que dá para o centro da cidade) ----------
const TEX_PLACA = new Map<string, THREE.CanvasTexture>();
function texturaPlacaBairro(b: Bairro) {
  if (TEX_PLACA.has(b.id) || typeof document === "undefined") return TEX_PLACA.get(b.id) ?? null;
  const W = 1024, H = 248, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, b.cor); gr.addColorStop(1, new THREE.Color(b.cor).multiplyScalar(0.62).getStyle());
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.95)"; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
  g.fillStyle = "#FFFFFF"; g.textAlign = "left"; g.textBaseline = "middle";
  g.font = "600 34px Inter, Arial, sans-serif"; g.globalAlpha = 0.8; g.fillText("BAIRRO", 48, 64); g.globalAlpha = 1;
  g.font = "900 92px Inter, Arial, sans-serif"; g.fillText(b.nome, 44, 138, W - 90);
  g.font = "500 34px Inter, Arial, sans-serif"; g.globalAlpha = 0.88; g.fillText(b.lema, 48, 202, W - 96); g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEX_PLACA.set(b.id, t); return t;
}
export function ladoDaPlaca(b: Bairro): { dx: number; dz: number } {
  // lado que olha para o centro (Nuvem): pelo eixo de maior distância
  if (Math.abs(b.i) >= Math.abs(b.j)) return { dx: -Math.sign(b.i), dz: 0 };
  return { dx: 0, dz: -Math.sign(b.j) };
}
const GEO_PLACA_B = new THREE.PlaneGeometry(5.16, 1.25);
function PlacaBairro({ b }: { b: Bairro }) {
  const tex = useMemo(() => texturaPlacaBairro(b), [b]);
  const m = useMemo(() => (tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : null), [tex]);
  const { dx, dz } = ladoDaPlaca(b);
  const off = BORDA_CALCADA - 0.32, ao = -6; // perto do meio-fio, entre a árvore e o poste do meio
  const cx = b.i * PASSO + dx * off + (dz !== 0 ? ao : 0), cz = b.j * PASSO + dz * off + (dx !== 0 ? ao : 0);
  const rot = Math.atan2(dx, dz); // a frente da placa (+z local) olha para a rua
  const ferro = mat("#2B2F36", { metal: 0.4, rough: 0.5 });
  return (
    <group position={[cx, 0, cz]} rotation={[0, rot, 0]}>
      {[-2.35, 2.35].map((x) => <mesh key={x} geometry={cilindro(0.07, 0.08, 4.25, 8)} material={ferro} position={[x, 2.12, 0]} castShadow />)}
      <mesh geometry={caixa(5.3, 1.38, 0.12)} material={ferro} position={[0, 3.45, 0]} castShadow />
      {m && <mesh geometry={GEO_PLACA_B} material={m} position={[0, 3.45, 0.065]} />}
      {m && <mesh geometry={GEO_PLACA_B} material={m} position={[0, 3.45, -0.065]} rotation={[0, Math.PI, 0]} />}
    </group>
  );
}
export function PlacasBairro() { return <group>{BAIRROS.map((b) => <PlacaBairro key={b.id} b={b} />)}</group>; }

// ---------- halos dos postes à noite ----------
// Um ponto de luz (sprite somado) em cada lâmpada, na cor de luz do bairro (fora dos bairros, a luz quente de sempre).
const MAT_HALO = new THREE.PointsMaterial({ size: 3.4, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true });
export function HalosPostes({ postes }: { postes: ItemInstancia[] }) {
  const geo = useMemo(() => {
    const pos = new Float32Array(postes.length * 3), cor = new Float32Array(postes.length * 3); const c = new THREE.Color();
    postes.forEach((p, k) => {
      const i = Math.round(p.pos[0] / PASSO), j = Math.round(p.pos[2] / PASSO), b = BAIRRO_DO_QUARTEIRAO[`${i},${j}`];
      pos.set([p.pos[0], (p.altura ?? 5) - 0.12, p.pos[2]], k * 3); c.set(b?.corLuz ?? "#FFE2AA"); cor.set([c.r, c.g, c.b], k * 3);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(cor, 3)); return g;
  }, [postes]);
  useEffect(() => { const t = texturaLuz(); if (t) { MAT_HALO.map = t; MAT_HALO.needsUpdate = true; } }, []);
  useFrame(() => {
    MAT_HALO.opacity = Math.max(0, ceu.noite - 0.15) / 0.85 * 0.95;
    const tech = MAT_PISO.get("graficoNeon") as THREE.MeshStandardMaterial | undefined; if (tech) tech.emissiveIntensity = ceu.noite * 1.6;
  });
  return <points geometry={geo} material={MAT_HALO} frustumCulled={false} renderOrder={3} />;
}
