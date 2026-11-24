"use client";
// Natal na cidade (12/11/2026, ideia escolhida pelo dono). Época em data/natal.ts: desde 20/11/2026 vai de 20/11 a 6/1
// (Dia de Reis), pelo horário de Brasília; ?natal=1 liga e ?natal=0 desliga (prévias). Fora da época nada aparece.
// 20/11/2026 (pedido do dono: "adicione a temática de Natal também"), com bom gosto para uma cidade tropical (sem neve):
//  - árvore grande na praça da Nuvem e outra na Praça de Eventos, com presentes embaixo e a estrela que brilha à noite;
//  - trenó decorativo num canteiro da Praça de Eventos, com o saco e presentes;
//  - guirlandas (festão com pisca-pisca, laços e a coroa redonda no meio) em cima das logos das sedes: a da entrada e a do
//    alto da frente. Apoia só na posição e na largura das logos (data/sedes.ts › logosModeloSede, as mesmas do
//    scene/SedeModelo.tsx desde que as sedes viraram modelos do catálogo; SedeEstilos › logosDe para sede sem modelo);
//  - laço vermelho e pisca-pisca nos postes; fios de luz entre os postes do calçadão e nos guarda-corpos das pontes;
//  - cada empresa pode pôr a "Decoração de Natal" no lote (aba Fachada): arvorezinha na entrada e luzinhas no letreiro.
// Tudo instanciado (uma malha por tipo de peça, preenchida uma vez) e sem criar objeto a cada quadro; nos gráficos leves
// (celular) vão menos lâmpadas e folhas.
import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cilindro, mat } from "./geo";
import { ceu, texturaHalo } from "./CicloDia";
import { leve, celular } from "./qualidade";
import { SoDePerto } from "./etapas";
import { Estatico } from "./Estatico";
import type { ItemInstancia } from "./Modelos";
import { logosDe } from "./SedeEstilos";
import { postesDoCalcadao, PONTE_DADOS } from "./Rio";
import { SEDES, paraMundoSede, logosModeloSede, type Sede } from "../data/sedes";
import { LOTE_POR_CHAVE, NORTE, frenteDoLote } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";
import { epocaDeNatal } from "../data/natal";
import { useEscritorio } from "../store";

type V3 = [number, number, number];

// lido muitas vezes por quadro (lotes, letreiros): a resposta fica guardada durante a visita
let ativoGuardado: boolean | null = null;
export function natalAtivo(agora?: Date): boolean {
  if (!agora && ativoGuardado != null) return ativoGuardado;
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("natal") : null;
  const v = q === "1" ? true : q === "0" ? false : epocaDeNatal(agora);
  if (!agora && typeof window !== "undefined") ativoGuardado = v;
  return v;
}

// ---------- materiais e peças compartilhados ----------
// lâmpadas: uma malha instanciada por cor; o brilho de cada cor sobe e desce fora de fase (vermelho, verde, dourado e
// branco quente)
const CORES = ["#FF3B3B", "#2BD46B", "#FFC53D", "#FFE9C2"];
let MATS: THREE.MeshStandardMaterial[] | null = null;
const materiais = () => (MATS ??= CORES.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, roughness: 0.35 })));
const MAT_ESTRELA = new THREE.MeshStandardMaterial({ color: "#FFD24A", emissive: "#FFC21A", emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.4 });
const MAT_HALO = new THREE.SpriteMaterial({ color: "#FFE3A0", transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
// uma vez por quadro, por mais lâmpadas e estrelas que existam (cada uma chama; só a primeira do quadro conta)
let tPisca = -1;
function piscar(t: number) {
  if (t === tPisca) return; tPisca = t;
  const n = ceu.noite;
  materiais().forEach((m, i) => { m.emissiveIntensity = (0.45 + n * 1.7) * (0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7)); });
  // a estrela: dourada de dia; à noite acende e a auréola pulsa devagar
  MAT_ESTRELA.emissiveIntensity = 1.1 + n * 2.8 * (0.86 + 0.14 * Math.sin(t * 3.1));
  MAT_HALO.opacity = (0.06 + n * 0.82) * (0.8 + 0.2 * Math.sin(t * 2.4));
}
// lâmpada: uma esfera bem simples (20 triângulos; de longe e acesa é um ponto de luz); as bolas da árvore são redondas
const GEO_LAMPADA = new THREE.IcosahedronGeometry(1, 0), GEO_BOLA = new THREE.SphereGeometry(1, 10, 8);
// a auréola da estrela usa a textura de halo dos postes (feita em canvas: só no navegador)
function garantirHalo() { if (!MAT_HALO.map && typeof document !== "undefined") { MAT_HALO.map = texturaHalo(); MAT_HALO.needsUpdate = true; } }
// branco por baixo: a cor vem de cada peça (instanceColor)
const MATS_COR = new Map<string, THREE.Material>();
function matCor(tipo: "brilho" | "fosco" | "folha"): THREE.Material {
  let m = MATS_COR.get(tipo);
  if (!m) {
    const o = tipo === "brilho" ? { roughness: 0.25, metalness: 0.45 } : tipo === "folha" ? { roughness: 0.9, metalness: 0, flatShading: true } : { roughness: 0.6, metalness: 0.05 };
    m = leve() ? new THREE.MeshLambertMaterial({ color: "#FFFFFF" }) : new THREE.MeshStandardMaterial({ color: "#FFFFFF", ...o });
    MATS_COR.set(tipo, m);
  }
  return m;
}
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 11.3) * 43758.5453; return s - Math.floor(s); };

// laço de fita (duas alças, o nó e as duas pontas), de frente para +z, com uns 42 cm de largura
function criarLaco() {
  const partes: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) { const t = new THREE.TorusGeometry(0.1, 0.032, 4, 10); t.scale(1, 0.62, 0.7); t.rotateZ(sx * 0.5); t.translate(sx * 0.1, 0.02, 0); partes.push(t); }
  partes.push(new THREE.SphereGeometry(0.05, 6, 5));
  for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.055, 0.24, 0.018); b.translate(0, -0.12, 0); b.rotateZ(sx * 0.32); b.translate(sx * 0.015, -0.03, 0); partes.push(b); }
  const g = mergeGeometries(partes, false)!; partes.forEach((p) => p.dispose()); return g;
}
// estrela de cinco pontas com volume (meio metro de raio)
function criarEstrela() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5, a = Math.PI / 2 + (i * Math.PI) / 5; if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 }); g.center(); return g;
}
let GEOS: { laco: THREE.BufferGeometry; folha: THREE.BufferGeometry; estrela: THREE.BufferGeometry; caixa: THREE.BufferGeometry } | null = null;
const geos = () => (GEOS ??= { laco: criarLaco(), folha: new THREE.IcosahedronGeometry(1, 0), estrela: criarEstrela(), caixa: new THREE.BoxGeometry(1, 1, 1) });

// várias peças iguais numa malha só (posição, tamanho, giro e cor de cada uma), preenchida pelo ref (se o React recriar a
// malha, ela é preenchida de novo)
interface Peca { p: V3; s?: V3; r?: V3; cor?: string }
function Pecas({ geo, material, pecas, sombra = false }: { geo: THREE.BufferGeometry; material: THREE.Material; pecas: Peca[]; sombra?: boolean }) {
  const encher = useCallback((im: THREE.InstancedMesh | null) => {
    if (!im) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    pecas.forEach((x, i) => {
      e.set(...(x.r ?? [0, 0, 0])); q.setFromEuler(e); v.set(...x.p); s.set(...(x.s ?? [1, 1, 1]));
      im.setMatrixAt(i, m.compose(v, q, s)); if (x.cor) im.setColorAt(i, c.set(x.cor));
    });
    im.count = pecas.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
  }, [pecas]);
  if (!pecas.length) return null;
  return <instancedMesh key={pecas.length} ref={encher} args={[geo, material, pecas.length]} castShadow={sombra} />;
}

function Lampadas({ pontos, raio = 0.07 }: { pontos: V3[]; raio?: number }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const porCor = useMemo(() => CORES.map((_, c) => pontos.filter((_, i) => i % CORES.length === c)), [pontos]);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(raio, raio, raio), v = new THREE.Vector3();
    porCor.forEach((lista, c) => { const im = refs.current[c]; if (!im) return; lista.forEach((p, i) => im.setMatrixAt(i, m.compose(v.set(...p), q, s))); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); });
  }, [porCor, raio]);
  useFrame(({ clock }) => piscar(clock.elapsedTime));
  return <>{porCor.map((lista, c) => <instancedMesh key={`${c}-${lista.length}`} ref={(el) => { refs.current[c] = el; }} args={[GEO_LAMPADA, materiais()[c], Math.max(1, lista.length)]} frustumCulled={false} />)}</>;
}

// pontos numa espiral em volta de um cone (árvore) ou de um poste
function espiral(cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, voltas: number, n: number): V3[] {
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1), a = t * voltas * Math.PI * 2, r = r0 + (r1 - r0) * t; return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r]; });
}

// ---------- presentes ----------
interface Presente { x: number; z: number; y?: number; w: number; h: number; d?: number; rot?: number; cor: string; fita: string }
function Presentes({ lista }: { lista: Presente[] }) {
  const { corpos, fitas, lacos } = useMemo(() => {
    const corpos: Peca[] = [], fitas: Peca[] = [], lacos: Peca[] = [];
    for (const p of lista) {
      const d = p.d ?? p.w, y = (p.y ?? 0) + p.h / 2, r: V3 = [0, p.rot ?? 0, 0];
      corpos.push({ p: [p.x, y, p.z], s: [p.w, p.h, d], r, cor: p.cor });
      fitas.push({ p: [p.x, y, p.z], s: [p.w * 1.03, p.h * 1.03, Math.min(0.13, d * 0.2)], r, cor: p.fita });
      fitas.push({ p: [p.x, y, p.z], s: [Math.min(0.13, p.w * 0.2), p.h * 1.03, d * 1.03], r, cor: p.fita });
      const k = p.w * 0.85; lacos.push({ p: [p.x, (p.y ?? 0) + p.h + 0.08 * k, p.z], s: [k, k, k], r, cor: p.fita });
    }
    return { corpos, fitas, lacos };
  }, [lista]);
  const g = geos(), m = matCor("fosco");
  return <group><Pecas geo={g.caixa} material={m} pecas={corpos} sombra /><Pecas geo={g.caixa} material={m} pecas={fitas} /><Pecas geo={g.laco} material={m} pecas={lacos} /></group>;
}
const VERMELHO = "#C8102E", OURO = "#E8B33A", PEROLA = "#F5EFE3", PINHO = "#1E7A44", AZUL = "#1F5FBF", UVA = "#7A4FD0";
const PRESENTES_ARVORE: Presente[] = [
  { x: -1.6, z: 1.3, w: 0.8, h: 0.6, cor: VERMELHO, fita: OURO, rot: 0.2 }, { x: 1.4, z: 1.5, w: 0.7, h: 0.75, cor: AZUL, fita: PEROLA, rot: 0.8 },
  { x: 0.3, z: -1.9, w: 0.85, h: 0.55, cor: PINHO, fita: VERMELHO, rot: 1.3 }, { x: -1.1, z: -1.4, w: 0.6, h: 0.5, cor: UVA, fita: OURO, rot: 0.5 },
  { x: 2.0, z: -0.4, w: 0.55, h: 0.45, cor: OURO, fita: VERMELHO, rot: 1.9 }, { x: -2.1, z: -0.1, w: 0.65, h: 0.8, cor: PEROLA, fita: PINHO, rot: 2.4 },
  { x: 0.2, z: 2.1, w: 0.5, h: 0.4, cor: VERMELHO, fita: PEROLA, rot: 0.1 },
];

// ---------- árvore de Natal: camadas de cone, estrela, bolas, pisca-pisca e presentes na base ----------
const CAMADAS: V3[] = [[2.6, 2.4, 1.6], [2.1, 2.1, 3.2], [1.55, 1.8, 4.6], [1.0, 1.5, 5.8]]; // raio, altura, y
const CORES_BOLA = [VERMELHO, OURO, PEROLA, "#B5651D"];
const BOLAS: Peca[] = CAMADAS.flatMap(([r, h, y], k) => Array.from({ length: 9 - k * 2 }, (_, i) => {
  const n = 9 - k * 2, a = (i / n) * Math.PI * 2 + k;
  return { p: [Math.cos(a) * r * 0.78, y - h * 0.32, Math.sin(a) * r * 0.78] as V3, s: [0.17, 0.17, 0.17] as V3, cor: CORES_BOLA[(i + k) % 4] };
}));
export function ArvoreNatal({ position = [0.5, 0, 17.4], escala = 1, presentes = PRESENTES_ARVORE }: { position?: V3; escala?: number; presentes?: Presente[] | null }) {
  const poucos = leve();
  const verde = mat("#1F6B36", { rough: 0.9 }), verde2 = mat("#2A8446", { rough: 0.9 });
  const pisca = useMemo(() => espiral(0, 0, 0.9, 6.4, 2.45, 0.5, 4.5, poucos ? 30 : 46), [poucos]);
  const estrela = useRef<THREE.Mesh>(null);
  garantirHalo();
  useFrame(({ clock }) => { piscar(clock.elapsedTime); if (estrela.current) estrela.current.rotation.y = clock.elapsedTime * 0.6; });
  return (
    <group position={position} scale={escala}>
      {/* tronco e camadas numa malha só (24/11/2026, mapa lento; a árvore também enfeita a entrada de cada loja) */}
      <Estatico>
        <mesh geometry={cilindro(0.28, 0.36, 1.1, 10)} material={mat("#6B4A2B", { rough: 0.95 })} position={[0, 0.55, 0]} castShadow />
        {CAMADAS.map(([r, h, y], i) => <mesh key={i} geometry={coneGeo(r, h)} material={i % 2 ? verde2 : verde} position={[0, y, 0]} castShadow />)}
      </Estatico>
      <mesh ref={estrela} geometry={geos().estrela} material={MAT_ESTRELA} position={[0, 7.1, 0]} scale={0.95} />
      <sprite material={MAT_HALO} position={[0, 7.1, 0]} scale={[3.4, 3.4, 1]} />
      {/* no celular, de longe, a árvore fica com a forma e a estrela; bolas, pisca-pisca e presentes só de perto */}
      <SoDePerto>
        <Pecas geo={GEO_BOLA} material={matCor("brilho")} pecas={BOLAS} />
        <Lampadas pontos={pisca} raio={0.075} />
        {presentes && <Presentes lista={presentes} />}
      </SoDePerto>
    </group>
  );
}
const cones = new Map<string, THREE.ConeGeometry>();
const coneGeo = (r: number, h: number) => { const k = `${r},${h}`; let g = cones.get(k); if (!g) { g = new THREE.ConeGeometry(r, h, 14); cones.set(k, g); } return g; };

// ---------- postes: pisca-pisca enrolado e um laço vermelho virado para a rua ----------
export function LuzesNatalPostes({ itens }: { itens: ItemInstancia[] }) {
  const n = leve() ? 6 : 10;
  const pontos = useMemo(() => itens.flatMap((it) => espiral(it.pos[0], it.pos[2], 1.0, (it.altura ?? 5) - 0.9, 0.16, 0.12, 3, n)), [itens, n]);
  return <Lampadas pontos={pontos} raio={0.06} />;
}
export function LacosPostes({ itens }: { itens: ItemInstancia[] }) {
  // rot do poste olha para o meio do quarteirão: o laço fica do lado de fora, de frente para quem passa na rua
  const pecas = useMemo(() => itens.map((it): Peca => { const r = it.rot ?? 0; return { p: [it.pos[0] - Math.sin(r) * 0.11, (it.altura ?? 5) - 0.72, it.pos[2] - Math.cos(r) * 0.11], s: [1.5, 1.5, 1.5], r: [0, r + Math.PI, 0], cor: VERMELHO }; }), [itens]);
  return <Pecas geo={geos().laco} material={matCor("fosco")} pecas={pecas} />;
}

// ---------- guirlandas nas sedes ----------
// Em cima de cada logo (a da entrada e a do alto da frente): festão de folhas em gomos, com pisca-pisca, um laço em cada
// ponta e entre os gomos, e a coroa redonda de folhas com laço no meio, em cima da placa. A posição e a largura vêm de
// logosDe (as mesmas da placa); a frente local +z da sede vira para o mundo por paraMundoSede.
const VERDES_FOLHA = ["#1F6B36", "#2E8B4A", "#185A2D"];
interface Placa { x: number; topo: number; z: number; w: number; esc: number }
function guirlanda(sd: Sede, pl: Placa, poucos: boolean, folhas: Peca[], lacos: Peca[], luzes: V3[]) {
  const mundo = (lx: number, y: number, lz: number): V3 => { const [x, z] = paraMundoSede(sd, lx, lz); return [x, y, z]; };
  const e = pl.esc, w = pl.w + 0.3 * e, x0 = pl.x - w / 2, gomos = pl.w > 8 ? 4 : 3, queda = 0.2 * e;
  const passo = (poucos ? 0.17 : 0.085) * e, n = Math.ceil(w / passo), cadaLuz = Math.max(1, Math.round(((poucos ? 0.7 : 0.36) * e) / passo));
  for (let i = 0; i <= n; i++) {
    const u = i / n, lx = x0 + u * w, k = (u * gomos) % 1, y = pl.topo - queda * Math.sin(Math.PI * k);
    for (let c = 0; c < (poucos ? 1 : 2); c++) {
      const h = hash(i * 7 + c * 13 + sd.numeroLoja), t = 0.1 * e * (0.8 + h * 0.5);
      folhas.push({ p: mundo(lx + (h - 0.5) * 0.06 * e, y + (c ? 0.05 : -0.03) * e, pl.z + (c ? 0.05 : 0) * e), s: [t, t * 0.8, t], r: [h * 6, h * 11, h * 3], cor: VERDES_FOLHA[(i + c) % 3] });
    }
    if (i % cadaLuz === 0) luzes.push(mundo(lx, y - 0.04 * e, pl.z + 0.1 * e));
  }
  for (let g = 0; g <= gomos; g++) lacos.push({ p: mundo(x0 + (g / gomos) * w, pl.topo + 0.02 * e, pl.z + 0.11 * e), s: [1.9 * e, 1.9 * e, 1.9 * e], r: [0, sd.rot, 0], cor: VERMELHO });
  // a coroa redonda no meio, em cima da placa
  const cy = pl.topo + 0.52 * e, R = 0.42 * e, m = poucos ? 18 : 34;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2, h = hash(i * 3 + sd.numeroLoja + 5), t = 0.13 * e * (0.85 + h * 0.4);
    folhas.push({ p: mundo(pl.x + Math.cos(a) * R, cy + Math.sin(a) * R, pl.z + 0.03 * e), s: [t, t, t * 0.8], r: [h * 5, h * 9, h * 2], cor: VERDES_FOLHA[i % 3] });
    if (!poucos && i % 4 === 0) luzes.push(mundo(pl.x + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 1.05, pl.z + 0.12 * e));
  }
  lacos.push({ p: mundo(pl.x, cy - R - 0.02 * e, pl.z + 0.14 * e), s: [1.7 * e, 1.7 * e, 1.7 * e], r: [0, sd.rot, 0], cor: VERMELHO });
}
// Placas que recebem a guirlanda, em coordenadas da sede (frente +z). Com modelo do catálogo (junção de 20/11/2026): o
// SedeModelo gira o kit 180° e sobe 6 cm; vão o letreiro da entrada (painel de 1,3 m em m.letreiro) e a logo do alto da
// frente (em L.base, na frente da coroa). Sem modelo, as posições antigas de SedeEstilos › logosDe.
const SOBE_SEDE = 0.06;
function placasDaSede(sd: Sede): Placa[] {
  if (sd.modelo) {
    const L = logosModeloSede(sd), lt = L.m.letreiro;
    return [
      { x: -lt.x, topo: lt.y + SOBE_SEDE + 0.65, z: -lt.z + 0.1, w: lt.largura, esc: 1 },
      { x: 0, topo: L.base + SOBE_SEDE + L.frente.h, z: -(L.m.z0 + 0.8) + 0.06, w: L.frente.w, esc: 1.5 },
    ];
  }
  const l = logosDe(sd), prop = sd.propLogo;
  const placas: Placa[] = [{ x: l.portico.pos[0], topo: l.portico.pos[1] + (l.portico.w * prop) / 2, z: l.portico.pos[2] + 0.06, w: l.portico.w, esc: 1 }];
  const a = l.alto.find((x) => x.rotY === 0); // a logo do alto virada para a frente
  if (a) placas.push({ x: a.x, topo: a.chao + 1.4 + a.w * prop, z: a.z + 0.06, w: a.w, esc: 1.5 });
  return placas;
}
export function NatalSedes() {
  const fora = useEscritorio((s) => s.vista === "fora"); // por dentro a torre some: a guirlanda também
  const poucos = leve();
  const d = useMemo(() => {
    const folhas: Peca[] = [], lacos: Peca[] = [], luzes: V3[] = [];
    for (const sd of SEDES) for (const pl of placasDaSede(sd)) guirlanda(sd, pl, poucos, folhas, lacos, luzes);
    return { folhas, lacos, luzes };
  }, [poucos]);
  const g = geos();
  return (
    <group visible={fora}>
      <Pecas geo={g.folha} material={matCor("folha")} pecas={d.folhas} />
      <Pecas geo={g.laco} material={matCor("fosco")} pecas={d.lacos} />
      <Lampadas pontos={d.luzes} raio={0.055} />
    </group>
  );
}

// ---------- fios de luz no calçadão do rio e nas pontes ----------
export function LuzesRioNatal() {
  const poucos = leve();
  const pontos = useMemo(() => {
    const out: V3[] = [];
    // entre postes vizinhos do calçadão, caindo em curva (e na boca de cada ponte, de um poste da cabeceira ao outro)
    const ps = [...postesDoCalcadao()].sort((a, b) => a.pos[0] - b.pos[0]), passo = poucos ? 1.8 : 0.65;
    for (let i = 0; i + 1 < ps.length; i++) {
      const a = ps[i], b = ps[i + 1], L = b.pos[0] - a.pos[0]; if (L < 1 || L > 30) continue;
      const ya = (a.altura ?? 4.4) - 0.35, yb = (b.altura ?? 4.4) - 0.35, n = Math.max(2, Math.round(L / passo)), queda = Math.min(1.1, 0.12 + L * 0.035);
      for (let k = 1; k < n; k++) { const u = k / n; out.push([a.pos[0] + L * u, ya + (yb - ya) * u - queda * 4 * u * (1 - u), a.pos[2] + (b.pos[2] - a.pos[2]) * u]); }
    }
    // em cima dos dois guarda-corpos de cada ponte, acompanhando o arco (no celular, só o calçadão)
    const { z0, z1 } = PONTE_DADOS;
    if (!celular()) for (const px of NORTE.pontes) {
      const d = px === 0 ? PONTE_DADOS.pedra : PONTE_DADOS.madeira, n = Math.round((z0 - z1) / (poucos ? 1.2 : 0.45));
      for (const lado of [-1, 1]) for (let k = 0; k <= n; k++) { const t = k / n; out.push([px + lado * d.meia, 0.12 + d.subida * Math.sin(Math.PI * t) + d.topo + 0.05 - 0.06 * Math.abs(Math.sin((Math.PI * k) / 4)), z0 - t * (z0 - z1)]); }
    }
    return out;
  }, [poucos]);
  return <Lampadas pontos={pontos} raio={0.055} />;
}

// ---------- Praça de Eventos: árvore grande num canteiro da frente e o trenó no outro ----------
// Medidas no desenho da praça (scene/Praca.tsx, frente local -z para a rua): canteiros em x = ±7,8, z = -8,6 (3 x 1,4 m,
// grama a 0,47 m); a feira de sábado usa x = ±7,3, z de -6,8 a 2,2. Os presentes ficam fora do canteiro e da feira.
const PRESENTES_PRACA: Presente[] = [
  { x: 5.75, z: -7.3, w: 0.62, h: 0.5, cor: VERMELHO, fita: OURO, rot: 0.3 }, { x: 6.6, z: -7.25, w: 0.78, h: 0.62, cor: AZUL, fita: PEROLA, rot: -0.2 },
  { x: 7.55, z: -7.3, w: 0.5, h: 0.42, cor: OURO, fita: VERMELHO, rot: 0.7 }, { x: 8.45, z: -7.25, w: 0.72, h: 0.56, cor: PINHO, fita: VERMELHO, rot: 0.1 },
  { x: 9.3, z: -7.45, w: 0.55, h: 0.7, cor: PEROLA, fita: PINHO, rot: -0.5 }, { x: 5.65, z: -8.5, w: 0.68, h: 0.45, cor: UVA, fita: OURO, rot: 0.4 },
  { x: 6.85, z: -9.0, y: 0.47, w: 0.45, h: 0.36, cor: VERMELHO, fita: PEROLA, rot: 0.9 }, { x: 8.85, z: -8.95, y: 0.47, w: 0.5, h: 0.4, cor: OURO, fita: PINHO, rot: -0.3 },
];
export function NatalPraca() {
  const l = LOTE_POR_CHAVE[PRACA_CHAVE];
  if (!l) return null;
  const rot = frenteDoLote(l.k) + Math.PI; // o mesmo giro da praça
  return (
    <group position={[l.centro[0], 0, l.centro[1]]} rotation={[0, rot, 0]}>
      <ArvoreNatal position={[7.8, 0, -8.25]} escala={0.76} presentes={null} />
      <SoDePerto><Presentes lista={PRESENTES_PRACA} /></SoDePerto>
      {/* o canteiro esquerdo divide com a placa do patrocínio (Praca.tsx, no fundo, z -8,0): o trenó fica na frente dela */}
      <Treno position={[-7.8, 0.47, -8.8]} giro={0.04} />
    </group>
  );
}

// trenó vermelho com patins dourados, o saco de presentes atrás e uns presentes no banco (2,2 m de comprimento)
let GEO_TRENO: { corpo: THREE.BufferGeometry; patins: THREE.BufferGeometry; saco: THREE.BufferGeometry; amarra: THREE.BufferGeometry; banco: THREE.BufferGeometry } | null = null;
function geoTreno() {
  if (GEO_TRENO) return GEO_TRENO;
  // perfil do lado (x = comprimento, frente em +x; y = altura): encosto alto atrás, banco e a ponta enrolada na frente
  const s = new THREE.Shape();
  s.moveTo(-0.95, 0.22); s.lineTo(0.62, 0.22); s.quadraticCurveTo(0.95, 0.24, 1.0, 0.5); s.quadraticCurveTo(1.02, 0.78, 0.82, 0.8);
  s.quadraticCurveTo(0.7, 0.8, 0.66, 0.66); s.lineTo(0.25, 0.55); s.lineTo(-0.55, 0.55); s.quadraticCurveTo(-0.62, 1.05, -0.98, 1.08);
  s.quadraticCurveTo(-1.08, 1.06, -1.05, 0.9); s.lineTo(-0.95, 0.22);
  const corpo = new THREE.ExtrudeGeometry(s, { depth: 0.84, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 }); corpo.translate(0, 0, -0.42);
  const partes: THREE.BufferGeometry[] = [];
  for (const z of [-0.4, 0.4]) {
    const curva = new THREE.CatmullRomCurve3([[-1.05, 0.03], [0.7, 0.03], [1.05, 0.12], [1.18, 0.38], [1.08, 0.55], [0.95, 0.5]].map(([x, y]) => new THREE.Vector3(x, y, z)));
    partes.push(new THREE.TubeGeometry(curva, 40, 0.035, 6, false));
    for (const x of [-0.7, -0.05, 0.55]) { const c = new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6); c.translate(x, 0.13, z); partes.push(c); }
  }
  const patins = mergeGeometries(partes.map((p) => p.toNonIndexed()), false)!; partes.forEach((p) => p.dispose());
  const saco = new THREE.SphereGeometry(0.5, 14, 10); saco.scale(0.72, 0.9, 0.68);
  GEO_TRENO = { corpo, patins, saco, amarra: new THREE.TorusGeometry(0.12, 0.03, 6, 14), banco: new THREE.BoxGeometry(0.8, 0.12, 0.8) };
  return GEO_TRENO;
}
const PRESENTES_TRENO: Presente[] = [
  { x: 0.32, z: 0.14, y: 0.56, w: 0.36, h: 0.3, cor: VERMELHO, fita: OURO, rot: 0.3 }, { x: 0.52, z: -0.2, y: 0.56, w: 0.3, h: 0.26, cor: PINHO, fita: PEROLA, rot: -0.4 },
  { x: 0.08, z: -0.22, y: 0.56, w: 0.28, h: 0.4, cor: OURO, fita: VERMELHO, rot: 0.8 },
];
function Treno({ position, giro = 0 }: { position: V3; giro?: number }) {
  const g = geoTreno();
  return (
    <group position={position} rotation={[0, giro, 0]}>
      <Estatico>
        <mesh geometry={g.corpo} material={mat("#B3121F", { rough: 0.45, metal: 0.1 })} castShadow receiveShadow />
        <mesh geometry={g.banco} material={mat("#6E0E18", { rough: 0.75 })} position={[-0.15, 0.61, 0]} />
        <mesh geometry={g.patins} material={mat("#D9A520", { rough: 0.3, metal: 0.8 })} castShadow />
        <mesh geometry={g.saco} material={mat("#A0784C", { rough: 0.95 })} position={[-0.5, 1.0, 0]} castShadow />
        <mesh geometry={g.amarra} material={mat("#D9A520", { rough: 0.3, metal: 0.8 })} position={[-0.5, 1.42, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </Estatico>
      <Presentes lista={PRESENTES_TRENO} />
    </group>
  );
}

// ---------- decoração de Natal no lote da empresa: arvorezinha na entrada e luzinhas em volta do letreiro ----------
const PRESENTES_LOTE: Presente[] = PRESENTES_ARVORE.slice(0, 4);
export function NatalLote({ x = 3.1 }: { x?: number }) {
  return <ArvoreNatal position={[x, 0, -8.35]} escala={0.32} presentes={PRESENTES_LOTE} />;
}
export function NatalLetreiro({ y, z, largura }: { y: number; z: number; largura: number }) {
  const pontos = useMemo(() => {
    const l: V3[] = []; const n = Math.max(8, Math.round(largura / 0.45));
    for (let i = 0; i <= n; i++) { const x = -largura / 2 + (i * largura) / n; l.push([x, y + 0.72, z - 0.12], [x, y - 0.72, z - 0.12]); }
    for (const sx of [-1, 1]) for (let k = 1; k < 3; k++) l.push([sx * (largura / 2 + 0.05), y - 0.72 + k * 0.48, z - 0.12]);
    return l;
  }, [y, z, largura]);
  return <Lampadas pontos={pontos} raio={0.07} />;
}
