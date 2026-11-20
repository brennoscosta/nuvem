"use client";
// Bicicleta do personagem (19/11/2026, pedido do dono: "quero que meu personagem possa ter acesso a uma bicicleta para poder
// se locomover mais rápido"). Desenhada em código, low-poly e leve para o celular:
//  - quadro, selim, guidão, cestinha e corrente numa malha só (cor do quadro gravada nos vértices);
//  - cada roda (pneu, aro, raios e cubo) numa malha que gira conforme o quanto andou;
//  - o pedivela (coroa, braços e pedais) numa malha que gira mais devagar que as rodas.
// São 4 malhas por bicicleta com um material só; a geometria é compartilhada (uma por cor) e nada é criado a cada quadro.
// Medidas no sistema do boneco (scene/Boneco.tsx): frente em +z, chão em y = 0, quadril do boneco em z = 0. O boneco fica
// sentado no selim; usePedalar() põe os pés nos pedais (conta de duas articulações, coxa e canela) e inclina nas curvas.
// Parada na porta de um prédio, ela fica ao lado de um paraciclo simples (BicicletaParada).
import * as THREE from "three";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import type { BonecoHandle, Ossos } from "./Boneco";
import { SombraContato } from "./SombraContato";

export const RAIO_RODA = 0.2;
const RELACAO = 0.32; // o pedal dá ~1/3 de volta a cada volta da roda (marcha de passeio)
type YZ = [number, number]; // altura e frente, no plano do quadro
const EIXO_T: YZ = [RAIO_RODA, -0.26], EIXO_F: YZ = [RAIO_RODA, 0.5], CENTRO: YZ = [0.19, 0.1];
const PEDIVELA = 0.08;
const SELIM: YZ = [0.42, 0.03], CANOTE: YZ = [0.455, 0.02], COROA_GARFO: YZ = [0.4, 0.435], TOPO_CAIXA: YZ = [0.495, 0.404], GUIDAO: YZ = [0.6, 0.37];
const PRETO = "#22252B", METAL = "#C9CED6", CESTA = "#C49A63", SELA = "#3A2A22";

const v3 = (x: number, [y, z]: YZ) => new THREE.Vector3(x, y, z);
const CIMA = new THREE.Vector3(0, 1, 0);
// pinta a peça (cor nos vértices) e deixa só posição, normal e cor: todas as peças se juntam numa malha
function pintar(geo: THREE.BufferGeometry, cor: string) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const nome of Object.keys(g.attributes)) if (nome !== "position" && nome !== "normal") g.deleteAttribute(nome);
  const c = new THREE.Color(cor), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
}
const lados = (n: number) => Math.max(4, Math.round(n * (leve() ? 0.7 : 1)));
// tubo reto de a até b
function tubo(a: THREE.Vector3, b: THREE.Vector3, r: number, cor: string) {
  const d = b.clone().sub(a), len = d.length();
  const geo = new THREE.CylinderGeometry(r, r, len, lados(6), 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(CIMA, d.normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return pintar(geo, cor);
}
const bloco = (w: number, h: number, d: number, x: number, y: number, z: number, cor: string) => pintar(new THREE.BoxGeometry(w, h, d).translate(x, y, z), cor);
// cilindro deitado no eixo x (cubo, guidão, manoplas, coroa)
const deitado = (r: number, comp: number, x: number, y: number, z: number, cor: string, segs = 8) => pintar(new THREE.CylinderGeometry(r, r, comp, lados(segs)).rotateZ(Math.PI / 2).translate(x, y, z), cor);
const juntar = (partes: THREE.BufferGeometry[]) => { const g = mergeGeometries(partes, false)!; partes.forEach((p) => p.dispose()); g.computeBoundingSphere(); return g; };

const cache = new Map<string, THREE.BufferGeometry>();
const guardado = (k: string, criar: () => THREE.BufferGeometry) => { let g = cache.get(k); if (!g) { g = criar(); cache.set(k, g); } return g; };

// quadro, garfo, selim, guidão, cestinha e corrente (tudo que não gira)
function geoCorpo(cor: string) {
  return guardado(`corpo|${cor}|${leve() ? 1 : 0}`, () => {
    const R = 0.017, p: THREE.BufferGeometry[] = [];
    const topoQuadro: YZ = [0.475, 0.408];
    p.push(tubo(v3(0, CENTRO), v3(0, SELIM), R, cor)); // tubo do selim
    p.push(tubo(v3(0, SELIM), v3(0, topoQuadro), R, cor)); // tubo de cima
    p.push(tubo(v3(0, CENTRO), v3(0, COROA_GARFO), R * 1.15, cor)); // tubo de baixo
    p.push(tubo(v3(0, COROA_GARFO), v3(0, TOPO_CAIXA), R * 1.3, cor)); // caixa de direção
    for (const s of [1, -1]) {
      p.push(tubo(v3(s * 0.035, CENTRO), v3(s * 0.035, EIXO_T), R * 0.75, cor)); // gancheira de baixo
      p.push(tubo(v3(s * 0.02, SELIM), v3(s * 0.035, EIXO_T), R * 0.7, cor)); // gancheira de cima
      p.push(tubo(v3(s * 0.02, COROA_GARFO), v3(s * 0.035, EIXO_F), R * 0.8, cor)); // garfo
    }
    p.push(tubo(v3(0, SELIM), v3(0, CANOTE), R * 0.7, METAL)); // canote
    p.push(bloco(0.075, 0.032, 0.17, 0, 0.47, 0.0, SELA)); // selim
    p.push(bloco(0.1, 0.026, 0.07, 0, 0.468, -0.07, SELA)); // traseira do selim, mais larga
    p.push(tubo(v3(0, TOPO_CAIXA), v3(0, GUIDAO), 0.013, METAL)); // mesa
    p.push(deitado(0.011, 0.36, 0, GUIDAO[0], GUIDAO[1], METAL)); // guidão
    for (const s of [1, -1]) p.push(deitado(0.017, 0.07, s * 0.2, GUIDAO[0], GUIDAO[1], PRETO)); // manoplas
    p.push(deitado(0.02, 0.05, 0, TOPO_CAIXA[0] - 0.02, TOPO_CAIXA[1] + 0.03, METAL)); // farol
    // cestinha na frente: fundo e quatro lados finos
    const cz = 0.53, cy = 0.53;
    p.push(bloco(0.2, 0.012, 0.15, 0, cy - 0.05, cz, CESTA));
    p.push(bloco(0.2, 0.1, 0.012, 0, cy, cz + 0.075, CESTA), bloco(0.2, 0.1, 0.012, 0, cy, cz - 0.075, CESTA));
    p.push(bloco(0.012, 0.1, 0.15, 0.1, cy, cz, CESTA), bloco(0.012, 0.1, 0.15, -0.1, cy, cz, CESTA));
    p.push(tubo(v3(0, [cy - 0.05, cz - 0.06]), v3(0, TOPO_CAIXA), 0.008, METAL)); // suporte da cesta
    // corrente (lado direito, -x): a parte de cima e a de baixo
    p.push(tubo(v3(-0.045, [CENTRO[0] + 0.055, CENTRO[1]]), v3(-0.045, [EIXO_T[0] + 0.03, EIXO_T[1]]), 0.006, PRETO));
    p.push(tubo(v3(-0.045, [CENTRO[0] - 0.055, CENTRO[1]]), v3(-0.045, [EIXO_T[0] - 0.03, EIXO_T[1]]), 0.006, PRETO));
    return juntar(p);
  });
}
// roda: pneu, aro, oito raios e cubo, girando no eixo x (a malha fica no centro da roda)
function geoRoda() {
  return guardado(`roda|${leve() ? 1 : 0}`, () => {
    const p: THREE.BufferGeometry[] = [];
    p.push(pintar(new THREE.TorusGeometry(RAIO_RODA - 0.021, 0.021, lados(6), lados(22)).rotateY(Math.PI / 2), PRETO));
    p.push(pintar(new THREE.TorusGeometry(RAIO_RODA - 0.045, 0.008, 4, lados(18)).rotateY(Math.PI / 2), METAL));
    for (let k = 0; k < 4; k++) p.push(pintar(new THREE.BoxGeometry(0.004, (RAIO_RODA - 0.045) * 2, 0.006).rotateX((k * Math.PI) / 4), METAL));
    p.push(deitado(0.02, 0.06, 0, 0, 0, METAL));
    return juntar(p);
  });
}
// pedivela: coroa, os dois braços e os pedais (o da esquerda, +x, aponta para cima no ângulo zero)
function geoPedivela() {
  return guardado(`pedivela|${leve() ? 1 : 0}`, () => {
    const p: THREE.BufferGeometry[] = [];
    p.push(deitado(0.055, 0.008, -0.045, 0, 0, METAL, 14));
    p.push(deitado(0.014, 0.16, 0, 0, 0, METAL));
    for (const s of [1, -1]) {
      p.push(bloco(0.012, PEDIVELA + 0.02, 0.018, s * 0.075, (s * PEDIVELA) / 2, 0, METAL));
      p.push(bloco(0.06, 0.014, 0.04, s * 0.11, s * PEDIVELA, 0, PRETO));
    }
    return juntar(p);
  });
}
// paraciclo em U invertido, ao lado da bicicleta parada (lado esquerdo, +x)
function geoParaciclo() {
  return guardado("paraciclo", () => {
    const x = 0.2, z0 = -0.12, z1 = 0.32, h = 0.5, r = 0.016, p: THREE.BufferGeometry[] = [];
    p.push(tubo(new THREE.Vector3(x, 0, z0), new THREE.Vector3(x, h - 0.06, z0), r, "#8C939D"), tubo(new THREE.Vector3(x, 0, z1), new THREE.Vector3(x, h - 0.06, z1), r, "#8C939D"));
    p.push(tubo(new THREE.Vector3(x, h - 0.06, z0), new THREE.Vector3(x, h, z0 + 0.06), r, "#8C939D"), tubo(new THREE.Vector3(x, h - 0.06, z1), new THREE.Vector3(x, h, z1 - 0.06), r, "#8C939D"));
    p.push(tubo(new THREE.Vector3(x, h, z0 + 0.06), new THREE.Vector3(x, h, z1 - 0.06), r, "#8C939D"));
    p.push(bloco(0.09, 0.012, 0.56, x, 0.006, (z0 + z1) / 2, "#6B727C")); // chapa no chão
    return juntar(p);
  });
}

let mat: THREE.Material | null = null;
const material = () => (mat ??= leve() ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12 }));

// quantas bicicletas estão desenhadas (só para os roteiros de teste, com ?medir=1)
export const bicicletasNaCena = { minha: 0, outros: 0, paradas: 0 };

export interface BicicletaHandle { rodaT: THREE.Object3D | null; rodaF: THREE.Object3D | null; pedivela: THREE.Object3D | null }
type Quem = "minha" | "outros" | "paradas";
// escala (20/11/2026, editor do personagem): a bicicleta acompanha a altura do boneco (baixa 0,93×, alta 1,07×), assim os
// pés continuam nos pedais e as mãos no guidão
export const Bicicleta = forwardRef<BicicletaHandle, { cor: string; quem: Quem; escala?: number }>(function Bicicleta({ cor, quem, escala = 1 }, ref) {
  const rodaT = useRef<THREE.Mesh>(null), rodaF = useRef<THREE.Mesh>(null), ped = useRef<THREE.Mesh>(null);
  useImperativeHandle(ref, () => ({ get rodaT() { return rodaT.current; }, get rodaF() { return rodaF.current; }, get pedivela() { return ped.current; } }), []);
  useEffect(() => { bicicletasNaCena[quem]++; return () => { bicicletasNaCena[quem]--; }; }, [quem]);
  const corpo = useMemo(() => geoCorpo(cor), [cor]);
  const m = material();
  return (
    <group scale={escala}>
      <mesh geometry={corpo} material={m} raycast={() => null} />
      <mesh ref={rodaT} geometry={geoRoda()} material={m} position={[0, EIXO_T[0], EIXO_T[1]]} raycast={() => null} />
      <mesh ref={rodaF} geometry={geoRoda()} material={m} position={[0, EIXO_F[0], EIXO_F[1]]} raycast={() => null} />
      <mesh ref={ped} geometry={geoPedivela()} material={m} position={[0, CENTRO[0], CENTRO[1]]} raycast={() => null} />
    </group>
  );
});

// desliza a bicicleta parada até a vaga (posição e giro) e para quando chega
function deslizar(o: THREE.Object3D, a: [number, number, number], x: number, z: number, rot: number, dt: number) {
  let d = rot - a[2]; d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) + Math.abs(x - a[0]) + Math.abs(z - a[1]) < 0.002) { if (o.position.x !== x || o.position.z !== z || o.rotation.y !== rot) { o.position.set(x, 0, z); o.rotation.y = rot; } return; }
  const k = Math.min(1, Math.min(dt, 0.1) * 5);
  a[0] += (x - a[0]) * k; a[1] += (z - a[1]) * k; a[2] += d * k;
  o.position.set(a[0], 0, a[1]); o.rotation.y = a[2];
}

// Bicicleta estacionada (na porta de um prédio ou onde a pessoa desceu). Gira de leve até a posição da vaga (de frente
// para a porta) e para; com paraciclo quando é a vaga de um prédio.
export function BicicletaParada({ x, z, rot, de, cor, paraciclo }: { x: number; z: number; rot: number; de?: readonly [number, number, number]; cor: string; paraciclo: boolean }) {
  const g = useRef<THREE.Group>(null);
  const [inicio] = useState<[number, number, number]>(() => (de ? [de[0], de[1], de[2]] : [x, z, rot]));
  const atual = useRef<[number, number, number]>([...inicio]); // posição desenhada agora
  useFrame((_, dt) => { if (g.current) deslizar(g.current, atual.current, x, z, rot, dt); });
  return (
    <>
      <group ref={g} position={[inicio[0], 0, inicio[1]]} rotation={[0, inicio[2], 0]}>
        <Bicicleta cor={cor} quem="paradas" />
        <SombraAlongada />
      </group>
      {/* o paraciclo fica plantado na vaga (a bicicleta é que desliza até ele) */}
      {paraciclo && <mesh geometry={geoParaciclo()} material={material()} position={[x, 0, z]} rotation={[0, rot, 0]} raycast={() => null} />}
    </>
  );
}

// sombra de contato esticada no comprimento da bicicleta (quem anda não entra no mapa de sombras: ver SombraContato)
export function SombraAlongada() {
  return <group position={[0, 0, 0.12]} scale={[0.75, 1, 1.9]}><SombraContato r={0.36} /></group>;
}

// ---------- o boneco pedalando ----------
const COXA = 0.22, CANELA = 0.22;
const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// uma perna: do quadril até o tornozelo (logo acima e atrás do pedal), no plano do quadro; o joelho dobra para a frente
function perna(coxa: THREE.Object3D | undefined, canela: THREE.Object3D | undefined, pe: THREE.Object3D | undefined, quadrilY: number, ang: number, m: number) {
  if (!coxa || !canela) return;
  const tz = CENTRO[1] + PEDIVELA * Math.sin(ang) - 0.035, ty = CENTRO[0] + PEDIVELA * Math.cos(ang) + 0.045;
  const vz = tz, vy = ty - quadrilY;
  const d = limitar(Math.hypot(vz, vy), 0.06, COXA + CANELA - 0.003);
  const phi = Math.atan2(vz, -vy); // a partir da vertical, para a frente é positivo
  const a = Math.acos(limitar((COXA * COXA + d * d - CANELA * CANELA) / (2 * COXA * d), -1, 1));
  const e = Math.acos(limitar((COXA * COXA + CANELA * CANELA - d * d) / (2 * COXA * CANELA), -1, 1));
  const xCoxa = -(phi + a), xCanela = Math.PI - e, xPe = phi + a - (Math.PI - e) - 0.12; // pé quase reto no pedal
  coxa.rotation.x += (xCoxa - coxa.rotation.x) * m; coxa.rotation.z *= 1 - m;
  canela.rotation.x += (xCanela - canela.rotation.x) * m;
  if (pe) pe.rotation.x += (xPe - pe.rotation.x) * m;
}
function pernasNosPedais(o: Ossos, ang: number, m: number) {
  const q = (o.hips?.position.y ?? 0.535) - 0.02;
  perna(o.upperLegL, o.lowerLegL, o.footL, q, ang, m);
  perna(o.upperLegR, o.lowerLegR, o.footR, q, ang + Math.PI, m);
}

// Roda as rodas e os pedais pelo quanto o boneco andou neste quadro (serve para o meu e para os outros), põe os pés nos
// pedais e inclina o conjunto nas curvas. Roda depois de useAnimacao (mesmo componente, chamado depois).
interface Pedalada { px: number; pz: number; rot: number; roda: number; pedal: number; incl: number; m: number }
export function usePedalar(boneco: React.RefObject<BonecoHandle | null>, raiz: React.RefObject<THREE.Group | null>, inclina: React.RefObject<THREE.Group | null>, bike: React.RefObject<BicicletaHandle | null>, montado: () => boolean) {
  const e = useRef<Pedalada>({ px: NaN, pz: NaN, rot: NaN, roda: 0, pedal: 0, incl: 0, m: 0 });
  useFrame((_, dt0) => { if (raiz.current) pedalar(e.current, raiz.current, inclina.current, bike.current, boneco.current, Math.min(dt0, 0.1), montado()); });
}
function pedalar(s: Pedalada, o: THREE.Object3D, inc: THREE.Object3D | null, b: BicicletaHandle | null, h: BonecoHandle | null, dt: number, on: boolean) {
  s.m += ((on ? 1 : 0) - s.m) * Math.min(1, dt * 7); // subir e descer: a pose troca suave
  const dx = o.position.x - s.px, dz = o.position.z - s.pz;
  const passo = Number.isFinite(dx) ? Math.min(Math.hypot(dx, dz), 3) : 0;
  let dr = Number.isFinite(s.rot) ? o.rotation.y - s.rot : 0; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  s.px = o.position.x; s.pz = o.position.z; s.rot = o.rotation.y;
  if (!on && s.m < 0.01) { if (inc && inc.rotation.z !== 0) inc.rotation.z = 0; s.incl = 0; return; }
  if (on) {
    s.roda += passo / RAIO_RODA; s.pedal += (passo / RAIO_RODA) * RELACAO;
    if (b) { if (b.rodaT) b.rodaT.rotation.x = s.roda; if (b.rodaF) b.rodaF.rotation.x = s.roda; if (b.pedivela) b.pedivela.rotation.x = s.pedal; }
  }
  // inclina para dentro da curva (virando para a esquerda, +y, deita para +x), no máximo uns 16 graus
  const v = dt > 0 ? passo / dt : 0, w = dt > 0 ? dr / dt : 0;
  const alvo = on ? limitar((-w * Math.min(v, 7)) / 9.8, -0.28, 0.28) : 0;
  s.incl += (alvo - s.incl) * Math.min(1, dt * 5);
  if (inc) inc.rotation.z = s.incl;
  if (h) pernasNosPedais(h.ossos, s.pedal, s.m);
}
