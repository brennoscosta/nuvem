"use client";
// Rio da cidade (12/11/2026): além da Avenida Beira-Rio, um calçadão de pedra portuguesa com árvores, bancos e postes, o
// rio correndo de oeste para o mar (leste), três pontes de pedestre (a do meio em arco de pedra, as dos lados de madeira) e
// um barquinho descendo o rio. Ninguém dirige aqui: os carros continuam virando na avenida.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat } from "./geo";
import { leve } from "./qualidade";
import { ceu } from "./CicloDia";
import { Estatico } from "./Estatico";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { planoMetros, materialPiso, metrosDoPiso, HalosPostes } from "./Bairros";
import { NORTE, MUNDO } from "../data/mundo";
import { OUTDOORS } from "../data/outdoors";

export const X_OESTE = -(MUNDO.x + 6), X_LESTE = MUNDO.x - 6; // do painel oeste até a areia da praia (leste)
const { z0: CZ0, z1: CZ1 } = NORTE.calcadao, { z0: RZ0, z1: RZ1 } = NORTE.rio;
const NIVEL = -0.42; // a água fica abaixo do chão, entre muretas
const PONTES = NORTE.pontes;

// ---------- água (compartilhada com o lago do parque) ----------
const CORES_AGUA = { dia: new THREE.Color("#3E8FC4"), noite: new THREE.Color("#1F4A78") };
export const MAT_AGUA = new THREE.MeshStandardMaterial({ color: "#3E8FC4", roughness: 0.08, metalness: 0.35 });
let TEX_BRILHO: THREE.CanvasTexture | null = null;
// riscos claros de correnteza / ondinhas (somados por cima da água)
export function texturaBrilho() {
  if (TEX_BRILHO || typeof document === "undefined") return TEX_BRILHO;
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S); let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120; i++) { const x = r() * S, y = r() * S, w = 10 + r() * 34; g.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`; g.lineWidth = 1 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 2 - r() * 3, x + w, y); g.stroke(); }
  TEX_BRILHO = new THREE.CanvasTexture(c); TEX_BRILHO.wrapS = TEX_BRILHO.wrapT = THREE.RepeatWrapping; return TEX_BRILHO;
}
export const MAT_BRILHO = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const corAgua = new THREE.Color();
// a água escurece à noite e ganha reflexo quente (das luzes da cidade); a correnteza anda para leste
export function animarAgua(t: number) {
  corAgua.copy(CORES_AGUA.dia).lerp(CORES_AGUA.noite, ceu.noite); MAT_AGUA.color.copy(corAgua);
  MAT_BRILHO.color.setRGB(1 - ceu.noite * 0.2, 1 - ceu.noite * 0.08, 1); MAT_BRILHO.opacity = 0.28 + ceu.noite * 0.25;
  if (MAT_BRILHO.map) { MAT_BRILHO.map.offset.x = (t * 0.035) % 1; MAT_BRILHO.map.offset.y = Math.sin(t * 0.4) * 0.02; }
}

// ---------- calçadão, muretas e margens ----------
function CalcadaoFixo() {
  const L = X_LESTE - X_OESTE, cx = (X_LESTE + X_OESTE) / 2, larg = CZ0 - CZ1, m = metrosDoPiso("ondas");
  const pedra = mat("#C9C2B4", { rough: 0.95 }), borda = mat("#B4AC9C", { rough: 0.95 });
  // muretas do calçadão com aberturas nas pontes
  const trechos: [number, number][] = []; let x0 = X_OESTE;
  for (const p of [...PONTES].sort((a, b) => a - b)) { trechos.push([x0, p - 2.9]); x0 = p + 2.9; }
  trechos.push([x0, X_LESTE]);
  return (
    <group>
      <mesh geometry={planoMetros(L, larg, m)} material={materialPiso("ondas")} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.005, (CZ0 + CZ1) / 2]} receiveShadow />
      {/* meio-fio entre a avenida e o calçadão */}
      <mesh geometry={caixa(L, 0.12, 0.2)} material={mat("#C3BFB6")} position={[cx, 0.0, CZ0 - 0.1]} />
      {trechos.map(([a, b], i) => <mesh key={i} geometry={caixa(b - a, 0.55, 0.38)} material={pedra} position={[(a + b) / 2, 0.27, CZ1 + 0.19]} castShadow receiveShadow />)}
      {trechos.map(([a, b], i) => <mesh key={"t" + i} geometry={caixa(b - a, 0.08, 0.5)} material={borda} position={[(a + b) / 2, 0.58, CZ1 + 0.19]} />)}
      {/* paredes das margens (da água até o chão) e o fundo do rio */}
      <mesh geometry={caixa(L, -NIVEL + 0.02, 0.3)} material={pedra} position={[cx, NIVEL / 2, RZ0 + 0.15]} />
      <mesh geometry={caixa(L, -NIVEL + 0.02, 0.3)} material={pedra} position={[cx, NIVEL / 2, RZ1 - 0.15]} />
      <mesh geometry={new THREE.PlaneGeometry(L, RZ0 - RZ1)} material={mat("#24506E", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[cx, NIVEL - 0.6, (RZ0 + RZ1) / 2]} />
    </group>
  );
}

// água do rio e os riscos de correnteza (animados)
function Agua() {
  const L = X_LESTE - X_OESTE + 12, cx = (X_LESTE + X_OESTE) / 2 + 6, w = RZ0 - RZ1;
  const geoBrilho = useMemo(() => { const g = new THREE.PlaneGeometry(L, w); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (L / 14), uv.getY(i) * (w / 14)); return g; }, [L, w]);
  const geoAgua = useMemo(() => new THREE.PlaneGeometry(L, w), [L, w]);
  useEffect(() => { const t = texturaBrilho(); if (t) { MAT_BRILHO.map = t; MAT_BRILHO.needsUpdate = true; } }, []);
  useFrame(({ clock }) => animarAgua(clock.elapsedTime));
  return (
    <group>
      <mesh geometry={geoAgua} material={MAT_AGUA} rotation={[-Math.PI / 2, 0, 0]} position={[cx, NIVEL, (RZ0 + RZ1) / 2]} receiveShadow />
      <mesh geometry={geoBrilho} material={MAT_BRILHO} rotation={[-Math.PI / 2, 0, 0]} position={[cx, NIVEL + 0.02, (RZ0 + RZ1) / 2]} renderOrder={2} />
    </group>
  );
}

// ---------- pontes ----------
// tabuleiro em arco: segmentos inclinados que seguem y = base + subida·sen(π·t)
function arco(x: number, largura: number, subida: number, n: number) {
  const z0 = CZ1 + 0.6, z1 = RZ1 - 1.4, comp = z0 - z1, out: { x: number; y: number; z: number; inc: number; len: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ta = i / n, tb = (i + 1) / n, ya = 0.12 + subida * Math.sin(Math.PI * ta), yb = 0.12 + subida * Math.sin(Math.PI * tb);
    const za = z0 - ta * comp, zb = z0 - tb * comp, dz = za - zb, dy = yb - ya;
    out.push({ x, y: (ya + yb) / 2, z: (za + zb) / 2, inc: Math.atan2(dy, dz), len: Math.hypot(dz, dy) + 0.04 });
  }
  return { segs: out, largura };
}
function PontePedra({ x }: { x: number }) {
  const { segs } = useMemo(() => arco(x, 5, 1.5, 14), [x]);
  const pedra = mat("#E4DED2", { rough: 0.9 }), escura = mat("#BDB5A6", { rough: 0.95 });
  const meio = (RZ0 + RZ1) / 2;
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={[s.x, s.y, s.z]} rotation={[s.inc, 0, 0]}>
          <mesh geometry={caixa(5, 0.35, s.len)} material={pedra} castShadow receiveShadow />
          {/* guarda-corpo de pedra, dos dois lados */}
          {[-2.35, 2.35].map((dx) => <mesh key={dx} geometry={caixa(0.3, 0.85, s.len)} material={escura} position={[dx, 0.6, 0]} castShadow />)}
        </group>
      ))}
      {/* arco por baixo, dos dois lados, e os pilares dentro d'água */}
      {[-2.2, 2.2].map((dx) => <mesh key={dx} geometry={new THREE.TorusGeometry(5.6, 0.32, 8, 24, Math.PI)} material={escura} position={[x + dx, NIVEL - 0.2, meio]} rotation={[0, Math.PI / 2, 0]} scale={[1, 0.37, 1]} />)}
      {[RZ0 - 0.9, RZ1 + 0.9].map((z) => <mesh key={z} geometry={caixa(4.8, 1.2, 1.4)} material={escura} position={[x, NIVEL - 0.1, z]} />)}
    </group>
  );
}
function PonteMadeira({ x }: { x: number }) {
  const { segs } = useMemo(() => arco(x, 2.8, 0.85, 10), [x]);
  const tabua = mat("#A87548", { rough: 0.9 }), escura = mat("#6E4B2E", { rough: 0.9 });
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={[s.x, s.y, s.z]} rotation={[s.inc, 0, 0]}>
          <mesh geometry={caixa(2.8, 0.16, s.len)} material={tabua} castShadow receiveShadow />
          {[-1.32, 1.32].map((dx) => <mesh key={dx} geometry={caixa(0.08, 0.06, s.len)} material={escura} position={[dx, 0.92, 0]} />)}
          {[-1.32, 1.32].map((dx) => <mesh key={"p" + dx} geometry={caixa(0.1, 0.95, 0.1)} material={escura} position={[dx, 0.47, 0]} />)}
        </group>
      ))}
      {[RZ0 - 1.2, (RZ0 + RZ1) / 2, RZ1 + 1.2].map((z) => <mesh key={z} geometry={cilindro(0.16, 0.18, 1.6, 8)} material={escura} position={[x, NIVEL - 0.2, z]} />)}
    </group>
  );
}

// ---------- barquinho que desce o rio ----------
function Barquinho() {
  const g = useRef<THREE.Group>(null);
  const casco = mat("#D9573B", { rough: 0.7 }), interno = mat("#F4E9D8", { rough: 0.9 }), madeira = mat("#8E6B4A");
  useFrame(({ clock }) => {
    const o = g.current; if (!o) return; const t = clock.elapsedTime;
    const L = X_LESTE - X_OESTE - 10; o.position.x = X_OESTE + 5 + ((t * 1.6) % L);
    o.position.y = NIVEL + 0.12 + Math.sin(t * 1.7) * 0.04; o.rotation.z = Math.sin(t * 1.3) * 0.04;
  });
  return (
    <group ref={g} position={[X_OESTE + 5, NIVEL + 0.12, (RZ0 + RZ1) / 2 + 2.2]}>
      <mesh geometry={caixa(3.2, 0.42, 1.25)} material={casco} castShadow />
      <mesh geometry={new THREE.ConeGeometry(0.62, 1.1, 4)} material={casco} position={[2.15, 0, 0]} rotation={[0, Math.PI / 4, -Math.PI / 2]} scale={[1, 1, 0.72]} />
      <mesh geometry={caixa(2.9, 0.06, 1.0)} material={interno} position={[0, 0.2, 0]} />
      <mesh geometry={caixa(0.35, 0.12, 1.0)} material={madeira} position={[-0.3, 0.32, 0]} />
      <mesh geometry={esfera(0.2, 10)} material={mat("#F2C230")} position={[-0.3, 0.7, 0]} />
    </group>
  );
}

// ---------- árvores, bancos e postes do calçadão ----------
function itensCalcadao() {
  const livre = (x: number, folga: number) => !PONTES.some((p) => Math.abs(x - p) < folga) && !OUTDOORS.some((o) => o.pos[1] < 0 && Math.abs(o.pos[1] - (-87.5)) < 2 && Math.abs(x - o.pos[0]) < folga + 2);
  const arvores: ItemInstancia[] = [], bancos: ItemInstancia[] = [], postes: ItemInstancia[] = [];
  const passo = leve() ? 18 : 12; let n = 0;
  for (let x = X_OESTE + 6; x <= X_LESTE - 4; x += passo) {
    if (livre(x, 5)) arvores.push({ pos: [x, 0, CZ0 - 2.6], rot: (n * 1.7) % 6.28, altura: 5.2 + (n % 3) * 0.5 });
    const xb = x + passo / 2; if (livre(xb, 4.5)) bancos.push({ pos: [xb, 0, CZ1 + 1.25], rot: Math.PI, altura: 0.95 });
    n++;
  }
  for (let x = X_OESTE + 12; x <= X_LESTE - 4; x += 24) if (livre(x, 3.5)) postes.push({ pos: [x, 0, CZ1 + 0.9], rot: 0, altura: 4.4 });
  // postes nas cabeceiras das pontes
  for (const p of PONTES) for (const dx of [-3.2, 3.2]) postes.push({ pos: [p + dx, 0, CZ1 + 0.9], rot: 0, altura: 4.4 });
  return { arvores, bancos, postes };
}
const MAT_GLOBO = new THREE.MeshStandardMaterial({ color: "#F4F1E6", emissive: "#FFE2AA", emissiveIntensity: 0, roughness: 0.4 });
// poste clássico (coluna preta e globo branco que acende à noite)
export function PostesClassicos({ itens }: { itens: ItemInstancia[] }) {
  const col = useRef<THREE.InstancedMesh>(null), globo = useRef<THREE.InstancedMesh>(null), base = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    itens.forEach((it, i) => {
      const h = it.altura ?? 4.4;
      col.current?.setMatrixAt(i, m.compose(new THREE.Vector3(it.pos[0], h / 2, it.pos[2]), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
      base.current?.setMatrixAt(i, m.compose(new THREE.Vector3(it.pos[0], 0.3, it.pos[2]), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
      globo.current?.setMatrixAt(i, m.compose(new THREE.Vector3(it.pos[0], h + 0.12, it.pos[2]), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    });
    for (const r of [col, globo, base]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere(); }
  }, [itens]);
  useFrame(() => { MAT_GLOBO.emissiveIntensity = ceu.noite * 2.4; });
  const preto = mat("#22262C", { metal: 0.4, rough: 0.5 });
  return (
    <group>
      <instancedMesh ref={col} args={[cilindro(0.05, 0.07, 1, 8), preto, itens.length]} castShadow />
      <instancedMesh ref={base} args={[cilindro(0.13, 0.17, 0.6, 8), preto, itens.length]} />
      <instancedMesh ref={globo} args={[esfera(0.26, 12), MAT_GLOBO, itens.length]} />
    </group>
  );
}

export function Rio() {
  const { arvores, bancos, postes } = useMemo(() => itensCalcadao(), []);
  const halos = useMemo(() => postes.map((p) => ({ ...p, altura: (p.altura ?? 4.4) + 0.3 })), [postes]);
  return (
    <group>
      <Estatico>
        <CalcadaoFixo />
        {PONTES.map((x) => (x === 0 ? <PontePedra key={x} x={x} /> : <PonteMadeira key={x} x={x} />))}
      </Estatico>
      <Agua />
      <Barquinho />
      <ComFallback fallback={null}><ModeloInstanciado nome="arvore" itens={arvores} /></ComFallback>
      <ComFallback fallback={null}><ModeloInstanciado nome="banco" itens={bancos} /></ComFallback>
      <PostesClassicos itens={postes} />
      <HalosPostes postes={halos} />
    </group>
  );
}
