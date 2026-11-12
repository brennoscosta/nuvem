"use client";
// Bichos da cidade (12/11/2026, "vida na rua"):
//  - Pássaros: bandos em V dando voltas largas sobre a cidade de dia, batendo as asas; somem à noite e na chuva forte.
//  - Cachorros: alguns pedestres passeiam com o cachorro na coleira (ele vai ao lado, um pouco atrás) e uns vira-latas
//    soltos andam pela calçada do quarteirão, param para cheirar e abanam o rabo. Cachorro solto não atravessa a rua.
// Tudo desenhado em código. Modo leve: menos bandos e menos cachorros.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, esfera, mat } from "./geo";
import { leve } from "./qualidade";
import { ceu } from "./CicloDia";
import { clima } from "../clima";
import { PEDESTRES } from "./Transito";
import { QUARTEIROES, PASSO, BORDA_CALCADA } from "../data/mundo";
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");

// ---------- pássaros ----------
// Silhueta escura (aparece contra o céu e contra a grama) e maior que a de verdade: de longe, pássaro do tamanho real some.
interface Bando { cx: number; cz: number; R: number; h: number; vel: number; fase: number; sentido: 1 | -1; aves: { tras: number; lado: number; alto: number; asa: number }[] }
function criarBandos(n: number, porBando: number): Bando[] {
  const lista: Bando[] = [];
  for (let b = 0; b < n; b++) {
    const aves = Array.from({ length: porBando }, (_, k) => {
      const fileira = Math.ceil(k / 2), lado = k === 0 ? 0 : (k % 2 ? 1 : -1) * fileira;
      return { tras: fileira * 2.4 + ((k * 37) % 7) * 0.15, lado: lado * 2.0, alto: ((k * 53) % 9) * 0.2 - 0.8, asa: (k * 0.9) % (Math.PI * 2) };
    });
    lista.push({ cx: [-20, 25, 5][b % 3], cz: [10, -15, 30][b % 3], R: 38 + b * 12, h: 19 + b * 5, vel: 3.6 + b * 0.45, // voo calmo (12/11/2026: o dono achou rápido demais a 7,5–9 m/s)
       fase: b * 2.1, sentido: b % 2 ? 1 : -1, aves });
  }
  return lista;
}
function geometriaAsa(lado: 1 | -1) {
  const g = new THREE.BufferGeometry();
  // 2,4 m de ponta a ponta
  g.setAttribute("position", new THREE.Float32BufferAttribute([0.34, 0, 0, -0.42, 0, 0, -0.14, 0, 1.2 * lado], 3));
  g.computeVertexNormals(); return g;
}
const MAT_AVE = new THREE.MeshBasicMaterial({ color: "#4A505A", side: THREE.DoubleSide });
const MAT_CORPO_AVE = MAT_AVE;
function Passaros() {
  const bandos = useMemo(() => (leve() ? criarBandos(2, 7) : criarBandos(3, 10)), []);
  const total = bandos.reduce((a, b) => a + b.aves.length, 0);
  const asaE = useMemo(() => geometriaAsa(1), []), asaD = useMemo(() => geometriaAsa(-1), []), corpo = useMemo(() => new THREE.BoxGeometry(0.75, 0.14, 0.18), []);
  const rE = useRef<THREE.InstancedMesh>(null), rD = useRef<THREE.InstancedMesh>(null), rC = useRef<THREE.InstancedMesh>(null);
  const aux = useMemo(() => ({ m: new THREE.Matrix4(), base: new THREE.Matrix4(), asa: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0) }), []);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    // de dia, sem chuva forte; ao entardecer vão sumindo
    const vis = Math.max(0, 1 - ceu.noite * 1.6) * (clima.chuva > 0.5 ? 0 : 1);
    for (const r of [rE.current, rD.current, rC.current]) if (r) r.visible = vis > 0.02;
    if (vis <= 0.02) return;
    let i = 0;
    for (const b of bandos) {
      const ang = b.fase + (t * b.vel * b.sentido) / b.R;
      const bx = b.cx + Math.cos(ang) * b.R, bz = b.cz + Math.sin(ang) * b.R * 0.75, by = b.h + Math.sin(t * 0.3 + b.fase) * 3;
      // direção do voo (derivada da elipse) e o lado
      const hx = -Math.sin(ang) * b.sentido, hz = Math.cos(ang) * 0.75 * b.sentido, hl = Math.hypot(hx, hz);
      const fx = hx / hl, fz = hz / hl, lx = -fz, lz = fx;
      const rot = Math.atan2(-fz, fx);
      for (const a of b.aves) {
        const ox = -fx * a.tras + lx * a.lado + Math.sin(t * 0.7 + a.asa) * 0.25, oz = -fz * a.tras + lz * a.lado + Math.cos(t * 0.6 + a.asa) * 0.25;
        aux.q.setFromAxisAngle(aux.y, rot); aux.p.set(bx + ox, by + a.alto + Math.sin(t * 1.3 + a.asa) * 0.2, bz + oz);
        // perto da câmera o pássaro some aos poucos (12/11/2026: passando na frente da lente virava um triângulo preto enorme)
        // e eles ficam com ~1,3 m de asa (o desenho tem 2,4 m): de perto pareciam setas pretas enormes
        const perto = Math.min(1, Math.max(0, (aux.p.distanceTo(camera.position) - 20) / 20));
        aux.s.setScalar(vis * perto * 0.55);
        aux.base.compose(aux.p, aux.q, aux.s);
        rC.current?.setMatrixAt(i, aux.base);
        // batida de asa mais lenta, com pausas planando (asa quase parada e aberta) de tempos em tempos
        const plana = 1 - 0.75 * THREE.MathUtils.smoothstep(Math.sin(t * 0.35 + a.asa * 0.7), 0.4, 0.75); // entra e sai do planeio suave
        const bate = Math.sin(t * 5.2 + a.asa) * 0.55 * plana + 0.12;
        rE.current?.setMatrixAt(i, aux.m.multiplyMatrices(aux.base, aux.asa.makeRotationX(bate)));
        rD.current?.setMatrixAt(i, aux.m.multiplyMatrices(aux.base, aux.asa.makeRotationX(-bate)));
        i++;
      }
    }
    for (const r of [rE.current, rD.current, rC.current]) if (r) r.instanceMatrix.needsUpdate = true;
    if (MEDIR) (window as unknown as { __aves?: number[][] }).__aves = bandos.map((b) => [b.cx + Math.cos(b.fase + (t * b.vel * b.sentido) / b.R) * b.R, b.h, b.cz + Math.sin(b.fase + (t * b.vel * b.sentido) / b.R) * b.R * 0.75]);
  });
  return (
    <>
      <instancedMesh ref={rE} args={[asaE, MAT_AVE, total]} frustumCulled={false} />
      <instancedMesh ref={rD} args={[asaD, MAT_AVE, total]} frustumCulled={false} />
      <instancedMesh ref={rC} args={[corpo, MAT_CORPO_AVE, total]} frustumCulled={false} />
    </>
  );
}

// ---------- cachorros ----------
const PELAGENS = [
  { corpo: "#C8853F", detalhe: "#A86A2C" }, // caramelo
  { corpo: "#2F2C2A", detalhe: "#1C1A19" }, // preto
  { corpo: "#EDE7DD", detalhe: "#6B5A48" }, // branco com orelhas marrons
  { corpo: "#8A8F96", detalhe: "#5E6369" }, // cinza
];
interface Cao { x: number; z: number; rot: number; v: number; passo: number; rabo: number; cheirando: number; dono: number | null; i: number; j: number; canto: number; alvo: [number, number]; pausaAte: number; pelo: number; tam: number }
const B_CALC = BORDA_CALCADA - 0.7; // perto do meio-fio, por dentro da calçada
const canto = (i: number, j: number, k: number): [number, number] => [i * PASSO + (k === 1 || k === 2 ? B_CALC : -B_CALC), j * PASSO + (k >= 2 ? B_CALC : -B_CALC)];
function criarCaes(comDono: number[], soltos: number): Cao[] {
  const lista: Cao[] = [];
  comDono.forEach((d, k) => lista.push({ x: 0, z: 0, rot: 0, v: 0, passo: 0, rabo: k, cheirando: 0, dono: d, i: 0, j: 0, canto: 0, alvo: [0, 0], pausaAte: 0, pelo: k % PELAGENS.length, tam: 0.85 + (k % 3) * 0.12 }));
  for (let k = 0; k < soltos; k++) {
    const q = QUARTEIROES[(k * 4 + 2) % QUARTEIROES.length]; const c0 = k % 4; const [x, z] = canto(q.i, q.j, c0);
    lista.push({ x, z, rot: 0, v: 0, passo: 0, rabo: k * 2, cheirando: 0, dono: null, i: q.i, j: q.j, canto: (c0 + 1) % 4, alvo: canto(q.i, q.j, (c0 + 1) % 4), pausaAte: 0, pelo: (k + 1) % PELAGENS.length, tam: 0.9 + (k % 2) * 0.18 });
  }
  return lista;
}
function passoCaes(caes: Cao[], dt: number, t: number) {
  for (const c of caes) {
    let tx: number, tz: number, vMax: number;
    if (c.dono != null) {
      const p = PEDESTRES[c.dono]; if (!p) continue;
      // ao lado do dono, um pouco atrás (a coleira tem ~1,2 m)
      const hx = Math.sin(p.rot), hz = Math.cos(p.rot);
      tx = p.x - hx * 0.85 + hz * 0.55; tz = p.z - hz * 0.85 - hx * 0.55; vMax = 3.2;
      if (Math.hypot(p.x - c.x, p.z - c.z) > 6) { c.x = tx; c.z = tz; } // nasceu longe: aparece já junto
    } else {
      // solto: anda de esquina em esquina pela calçada; às vezes para e cheira; às vezes volta
      if (t < c.pausaAte) { c.v = Math.max(0, c.v - 4 * dt); c.cheirando = Math.min(1, c.cheirando + dt * 3); c.passo += c.v * dt * 6; c.rabo += dt * 9; continue; }
      c.cheirando = Math.max(0, c.cheirando - dt * 3);
      [tx, tz] = c.alvo; vMax = 1.5;
      if (Math.hypot(tx - c.x, tz - c.z) < 0.3) {
        const volta = Math.random() < 0.25 ? -1 : 1;
        c.canto = (c.canto + volta + 4) % 4; c.alvo = canto(c.i, c.j, c.canto);
        if (Math.random() < 0.5) c.pausaAte = t + 2 + Math.random() * 3;
      } else if (Math.random() < dt * 0.08) c.pausaAte = t + 1.5 + Math.random() * 2.5; // parada no meio do caminho
    }
    const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
    const vAlvo = d > 0.08 ? Math.min(vMax, d * 2.2) : 0;
    c.v += (vAlvo - c.v) * Math.min(1, dt * 5);
    if (d > 0.02) { const s = Math.min(d, c.v * dt); c.x += (dx / d) * s; c.z += (dz / d) * s; if (c.v > 0.2) c.rot = Math.atan2(dx, dz); }
    c.passo += c.v * dt * 6.5; c.rabo += dt * (c.v > 0.3 ? 7 : 11);
  }
}
function Cachorro({ c }: { c: Cao }) {
  const g = useRef<THREE.Group>(null), cab = useRef<THREE.Group>(null), rabo = useRef<THREE.Mesh>(null), pernas = useRef<(THREE.Mesh | null)[]>([]), guia = useRef<THREE.Mesh>(null);
  const pel = PELAGENS[c.pelo];
  const aux = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3() }), []);
  useFrame(() => {
    const o = g.current; if (!o) return;
    o.position.set(c.x, 0, c.z);
    let dif = c.rot - o.rotation.y; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); o.rotation.y += dif * 0.2;
    const anda = Math.min(1, c.v / 1.2);
    pernas.current.forEach((p, k) => { if (p) p.rotation.x = Math.sin(c.passo + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.55 * anda; });
    if (rabo.current) rabo.current.rotation.y = Math.sin(c.rabo) * 0.6;
    if (cab.current) cab.current.rotation.x = c.cheirando * 0.55;
    // coleira: do pescoço do cachorro até a mão do dono
    const gl = guia.current;
    if (gl) {
      const p = c.dono != null ? PEDESTRES[c.dono] : null;
      gl.visible = !!p;
      if (p) {
        aux.a.set(c.x + Math.sin(o.rotation.y) * 0.3 * c.tam, 0.42 * c.tam, c.z + Math.cos(o.rotation.y) * 0.3 * c.tam);
        aux.b.set(p.x + Math.cos(p.rot) * 0.25, 0.92, p.z - Math.sin(p.rot) * 0.25);
        aux.d.subVectors(aux.b, aux.a); const L = aux.d.length();
        gl.position.copy(aux.a).addScaledVector(aux.d, 0.5);
        gl.quaternion.setFromUnitVectors(aux.up, aux.d.normalize());
        gl.scale.set(1, L, 1);
      }
    }
  });
  const corpo = mat(pel.corpo, { rough: 0.9 }), det = mat(pel.detalhe, { rough: 0.9 }), escuro = mat("#1B1E23", { rough: 0.6 });
  return (
    <>
      <group ref={g} scale={c.tam}>
        {/* o cachorro olha para +z (como os pedestres) */}
        <mesh geometry={caixa(0.26, 0.24, 0.62)} material={corpo} position={[0, 0.42, 0]} castShadow />
        {[[0.09, 0.22], [-0.09, 0.22], [0.09, -0.22], [-0.09, -0.22]].map(([x, z], k) => (
          <mesh key={k} ref={(el) => { pernas.current[k] = el; }} geometry={caixa(0.07, 0.3, 0.07)} material={corpo} position={[x, 0.22, z]} />
        ))}
        <group ref={cab} position={[0, 0.56, 0.32]}>
          <mesh geometry={caixa(0.22, 0.2, 0.22)} material={corpo} position={[0, 0.02, 0.06]} />
          <mesh geometry={caixa(0.13, 0.1, 0.14)} material={det} position={[0, -0.03, 0.22]} />
          <mesh geometry={esfera(0.025, 6)} material={escuro} position={[0, 0.0, 0.3]} />
          {[-0.08, 0.08].map((x) => <mesh key={x} geometry={caixa(0.06, 0.12, 0.04)} material={det} position={[x, 0.14, 0.0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]} />)}
          {[-0.055, 0.055].map((x) => <mesh key={`o${x}`} geometry={esfera(0.018, 6)} material={escuro} position={[x, 0.06, 0.17]} />)}
        </group>
        <mesh ref={rabo} geometry={caixa(0.05, 0.05, 0.26)} material={det} position={[0, 0.54, -0.38]} rotation={[0.7, 0, 0]} />
      </group>
      {c.dono != null && <mesh ref={guia} material={mat("#D64545", { rough: 0.6 })} visible={false}><cylinderGeometry args={[0.012, 0.012, 1, 4]} /></mesh>}
    </>
  );
}
function Cachorros() {
  const caes = useMemo(() => (leve() ? criarCaes([2], 1) : criarCaes([2, 5, 9, 12], 3)), []);
  useFrame(({ clock }, dt) => passoCaes(caes, Math.min(dt, 0.1), clock.elapsedTime));
  return <group>{caes.map((c, i) => <Cachorro key={i} c={c} />)}</group>;
}

// Bichos da cidade: montar dentro do <Mundo> (scene/Mundo.tsx), depois dos <Passantes /> (os cachorros com dono seguem
// os pedestres de lá)
export function Fauna() {
  return <><Passaros /><Cachorros /></>;
}
