"use client";
// Bordas do mapa (v63, 12/11/2026, pedido do dono: "a parte que fica nas laterais do mapa, quero algo melhor, mais
// original e realista"). Saíram os quatro painéis pintados. Agora a cidade fica num lugar de verdade:
//  - leste e sul: orla com calçadão, areia e mar de verdade (Praia.tsx e Mar.tsx);
//  - oeste: serra verde com mata e o vale de onde o rio desce (Serra.tsx);
//  - norte, depois do parque: a cidade continua em várias fileiras de prédios que somem na névoa (aqui);
//  - céu: nuvens em duas camadas que acompanham dia, noite, chuva e neblina (Nuvens.tsx).
// A névoa do CicloDia apaga a distância, então não existe "parede" nem borda à vista.
import { cronometrar } from "./medirGeracao";
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MUNDO, NORTE } from "../data/mundo";
import { leve } from "./qualidade";
import { ceu } from "./CicloDia";
import { Mar } from "./Mar";
import { Serra, alturaTerreno, criarArvoretas, VERDES_MATA, type Arvoreta } from "./Serra";
import { Praia } from "./Praia";
import { Nuvens } from "./Nuvens";

// ---------- a cidade que continua ao norte ----------
// 6 tipos de prédio (cada um com a sua geometria, para as janelas não esticarem), instanciados em fileiras cada vez mais
// espaçadas e mais altas para o fundo (o "centro" da cidade grande fica longe). A fachada é uma textura de janelas; outra
// textura diz quais janelas acendem à noite (sempre as mesmas: sem sorteio na tela).
const TIPOS = [{ w: 12, h: 20, d: 12 }, { w: 16, h: 32, d: 14 }, { w: 10, h: 48, d: 10 }, { w: 20, h: 15, d: 16 }, { w: 14, h: 64, d: 14 }, { w: 9, h: 27, d: 9 }];
const ANDAR = 3.4, VAO = 3.2; // altura de um andar e largura de uma janela + parede (m)
function texturaFachada(acesas: boolean) {
  const W = 128, H = 128, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  let s = acesas ? 31 : 17; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = acesas ? "#000" : "#A9B3C1"; g.fillRect(0, 0, W, H);
  // 8 × 8 janelas por ladrilho (cada ladrilho = 4 vãos × 4 andares, duas janelas por vão e por andar)
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
    const x = a * 16 + 3, y = b * 16 + 4, w = 10, h = 8;
    if (acesas) { if (r() < 0.3) { g.fillStyle = r() < 0.8 ? "#F6C47E" : "#CFE6FF"; g.globalAlpha = 0.55 + r() * 0.45; g.fillRect(x, y, w, h); g.globalAlpha = 1; } }
    else { g.fillStyle = r() < 0.5 ? "#55677E" : "#61738A"; g.fillRect(x, y, w, h); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x, y, w, 2); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function geoPredio(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) { uv.setXY(i, 0.02, 0.02); continue; } // telhado liso
    const larg = nx > 0.5 ? d : w; uv.setXY(i, (uv.getX(i) * larg) / (VAO * 4), (uv.getY(i) * h) / (ANDAR * 4));
  }
  return g;
}
const GEOS = TIPOS.map((t) => geoPredio(t.w, t.h, t.d));
let MAT_PREDIO: THREE.MeshStandardMaterial | null = null;
function materialPredio() {
  if (MAT_PREDIO) return MAT_PREDIO;
  MAT_PREDIO = new THREE.MeshStandardMaterial({ map: texturaFachada(false), emissiveMap: texturaFachada(true), emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.7, metalness: 0.15 });
  return MAT_PREDIO;
}
interface Pred { tipo: number; x: number; z: number; rot: number; cor: number; esc: number; y: number }
// fachadas: branco, areia, bege, terracota clara, cinza-claro, verde-água e vidro azulado (a textura de janelas é tingida)
const FACHADAS = ["#F4F1EA", "#EADCC0", "#E3CFAE", "#E8B99A", "#D9DEE4", "#BFE0D8", "#A9C6E8", "#F2E2C9"].map((h) => new THREE.Color(h));
function posicoesPredios(poucos: boolean): Pred[] {
  const out: Pred[] = []; let s = 91; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // depois da faixa de mata do parque: fileiras cada vez mais espaçadas; a leste para antes da areia, a oeste antes da serra
  let k = 0;
  for (let z = NORTE.fim - 30; z > -600; z -= 22 + k * 3.2, k++) {
    const passo = (poucos ? 30 : 21) + k * 1.6, fundo = Math.min(1, (NORTE.fim - 30 - z) / 320);
    const xMin = -MUNDO.x + 8 - fundo * 60; // perto do parque o canto noroeste fica para a mata e a serra
    for (let x = xMin + r() * 8; x < 74; x += passo + r() * passo * 0.5) {
      const zz = z + (r() - 0.5) * 8, y = alturaTerreno(x, zz);
      if (y > 9 && z > -380) continue; // encosta da serra: sem prédio
      // primeiras fileiras: prédios baixos (tipos 0, 3 e 5, encolhidos); torres só ao fundo (o centro da cidade grande)
      const tipo = fundo < 0.3 ? [0, 3, 5][Math.floor(r() * 3)] : Math.floor(r() * TIPOS.length);
      const esc = fundo < 0.3 ? 0.55 + r() * 0.35 + fundo : 0.8 + r() * 0.4 + fundo * 0.35;
      out.push({ tipo, x, z: zz, rot: Math.floor(r() * 4) * (Math.PI / 2), cor: Math.floor(r() * FACHADAS.length), esc, y: Math.max(-0.6, y - 0.6) });
    }
  }
  return out;
}
function criarCidade(poucos: boolean) {
  const lista = posicoesPredios(poucos), mat = materialPredio();
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  return TIPOS.map((_, k) => {
    const meus = lista.filter((x) => x.tipo === k);
    const im = new THREE.InstancedMesh(GEOS[k], mat, Math.max(1, meus.length));
    meus.forEach((b, i) => {
      e.set(0, b.rot, 0); q.setFromEuler(e);
      im.setMatrixAt(i, M.compose(p.set(b.x, b.y, b.z), q, sc.set(b.esc, b.esc, b.esc)));
      im.setColorAt(i, c.copy(FACHADAS[b.cor]).multiplyScalar(1.12)); // a textura é cinza: a cor tinge a fachada
    });
    im.count = meus.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = false;
    return im;
  });
}
// faixa de mata entre o parque e a cidade do norte (ninguém vê o parque "grudado" nos prédios)
function faixaNorte(poucos: boolean): Arvoreta[] {
  let s = 313; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const out: Arvoreta[] = [];
  for (let i = 0; i < (poucos ? 70 : 190); i++) {
    const x = -MUNDO.x - 4 + r() * (MUNDO.x + 78), z = NORTE.fim - 1.5 - r() * 22;
    out.push({ x, z, y: alturaTerreno(x, z), raio: 1.6 + r() * 1.6, cor: VERDES_MATA[Math.floor(r() * VERDES_MATA.length)].clone().multiplyScalar(0.9 + r() * 0.2), tronco: true });
  }
  return out;
}
function CidadeNorte() {
  const poucos = leve();
  const malhas = useMemo(() => cronometrar("horizonte", () => [...criarCidade(poucos), ...criarArvoretas(faixaNorte(poucos))]), [poucos]);
  // janelas acendem à noite
  useFrame(() => { if (MAT_PREDIO) MAT_PREDIO.emissiveIntensity = (Math.max(0, ceu.noite - 0.2) / 0.8) * 0.95; });
  return <group>{malhas.map((im, k) => <primitive key={k} object={im} />)}</group>;
}

export function Horizonte() {
  return (
    <group>
      <Mar />
      <Serra />
      <Praia />
      <CidadeNorte />
      <Nuvens />
    </group>
  );
}
