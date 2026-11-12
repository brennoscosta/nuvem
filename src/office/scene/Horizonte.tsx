"use client";
// Horizonte fechado: quatro painéis grandes nas bordas do mundo com arte panorâmica (praia ao sul e leste,
// cidade ao norte e oeste) e palmeiras na faixa de areia pra dar profundidade quando a câmera gira.
// As artes (geradas no Higgsfield, 07/11) ficam no site em JPG leve: public/horizonte.
// 12/11/2026: o mundo cresceu para o norte (rio e Parque da Cidade): o painel da cidade foi para depois do parque, os
// painéis dos lados ficaram mais compridos, a areia abre para a foz do rio e entrou um contorno de prédios em 3D
// (instanciado) na frente dos painéis da cidade, com janelas que acendem à noite.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { cilindro, caixa, esfera, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { Estatico } from "./Estatico";
import { MUNDO, NORTE } from "../data/mundo";
import { leve } from "./qualidade";
import { registrarHorizonte, ceu } from "./CicloDia";

const R = MUNDO.x + 6; // distância dos painéis ao centro (leste e oeste)
const RZ = MUNDO.z + 6; // painel sul
const RN = -(NORTE.fim - 6); // painel norte (depois do parque)
const LARG = 2 * R + 20; // largura dos painéis norte e sul (sobra nos cantos)
const REPETE = 2; // a arte repete 2x na largura (foi gerada pra emendar)
const ALT = (LARG / REPETE) * (9 / 16); // altura mantém a proporção 16:9 de cada repetição
const Y0 = -0.6;
// painéis dos lados: do norte (RN) ao sul (RZ), com a mesma altura dos outros (a arte repete mais vezes)
const LARG_LADO = RN + RZ + 20, Z_LADO = (RZ - RN) / 2, REPETE_LADO = (LARG_LADO / LARG) * REPETE;
const RIO = NORTE.rio;

function Painel({ textura, position, rotation, largura = LARG }: { textura: THREE.Texture; position: [number, number, number]; rotation: number; largura?: number }) {
  // registrado no ciclo de dia e noite: a foto escurece à noite
  const m = useMemo(() => { const mm = new THREE.MeshBasicMaterial({ map: textura, fog: false, toneMapped: false }); registrarHorizonte(mm); return mm; }, [textura]);
  return <mesh geometry={plano(largura, ALT)} material={m} position={position} rotation={[0, rotation, 0]} />;
}

function Palmeira({ position, escala = 1 }: { position: [number, number, number]; escala?: number }) {
  return (
    <group position={position} scale={escala}>
      <mesh geometry={cilindro(0.18, 0.3, 7, 8)} material={mat("#9A7B52", { rough: 0.95 })} position={[0, 3.5, 0]} rotation={[0, 0, 0.06]} castShadow />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} geometry={caixa(4.2, 0.12, 0.9)} material={mat(i % 2 ? "#3E9B5B" : "#58B06A")} position={[Math.cos((i / 6) * Math.PI * 2) * 1.9, 7.1 - (i % 2) * 0.2, Math.sin((i / 6) * Math.PI * 2) * 1.9]} rotation={[0.25 * Math.sin((i / 6) * Math.PI * 2), -(i / 6) * Math.PI * 2, -0.35]} />
      ))}
      <mesh geometry={esfera(0.5, 8)} material={mat("#6B4F2A")} position={[0, 6.9, 0]} />
    </group>
  );
}

// ---------- contorno de prédios (3D baixo custo) ----------
// 5 tipos de prédio, cada um com a sua geometria (as janelas não esticam), instanciados ao longo do norte e do oeste.
// A fachada é uma textura de janelas; outra textura diz quais janelas acendem à noite (sempre as mesmas: sem sorteio na tela).
// rasos de propósito (4,5 m): ficam entre o fim do chão e o painel, só a frente aparece
const TIPOS = [{ w: 9, h: 22, d: 4.5 }, { w: 12, h: 34, d: 4.5 }, { w: 7, h: 46, d: 4.5 }, { w: 14, h: 18, d: 4.5 }, { w: 10, h: 58, d: 4.5 }];
const ENCOSTO = 6 - 2.25 - 0.6; // do painel até o centro do prédio (a frente fica 0,6 m antes do fim do chão)
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
interface Pred { tipo: number; x: number; z: number; rot: number; tom: number }
function posicoesPredios(): Pred[] {
  const out: Pred[] = []; let s = 91; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const passo = leve() ? 15 : 10;
  // norte: atrás do parque, entre o fim do chão e o painel
  for (let x = -R + 4; x <= R - 4; x += passo + r() * 4) out.push({ tipo: Math.floor(r() * TIPOS.length), x, z: -RN + ENCOSTO + r() * 0.4, rot: 0, tom: r() });
  // oeste: depois da última fileira de árvores; mais baixos (tipos 0, 1 e 3) e com folga na altura do rio
  for (let z = NORTE.fim + 8; z <= RZ - 10; z += passo + 2 + r() * 5) { if (z > RIO.z1 - 3 && z < NORTE.calcadao.z0 + 4) continue; out.push({ tipo: [0, 1, 3][Math.floor(r() * 3)], x: -R + ENCOSTO + r() * 0.4, z, rot: Math.PI / 2, tom: r() }); }
  return out;
}
const MAT_PREDIO: { m: THREE.MeshStandardMaterial | null } = { m: null };
function materialPredio() {
  if (MAT_PREDIO.m) return MAT_PREDIO.m;
  if (typeof document === "undefined") return new THREE.MeshStandardMaterial({ color: "#7D8796" });
  MAT_PREDIO.m = new THREE.MeshStandardMaterial({ map: texturaFachada(false), emissiveMap: texturaFachada(true), emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.7, metalness: 0.15 });
  return MAT_PREDIO.m;
}
function Skyline() {
  const lista = useMemo(() => posicoesPredios(), []);
  const geos = useMemo(() => TIPOS.map((t) => geoPredio(t.w, t.h, t.d)), []);
  const material = useMemo(() => materialPredio(), []);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    TIPOS.forEach((_, k) => {
      const im = refs.current[k]; if (!im) return; const meus = lista.filter((p) => p.tipo === k);
      meus.forEach((p, i) => { q.setFromEuler(new THREE.Euler(0, p.rot, 0)); im.setMatrixAt(i, M.compose(new THREE.Vector3(p.x, Y0, p.z), q, um)); im.setColorAt(i, c.setHSL(0.57 + p.tom * 0.06, 0.08 + p.tom * 0.08, 0.82 + p.tom * 0.14)); });
      im.count = meus.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
    });
  }, [lista]);
  useFrame(() => { if (MAT_PREDIO.m) MAT_PREDIO.m.emissiveIntensity = Math.max(0, ceu.noite - 0.2) / 0.8 * 0.95; });
  return <group>{geos.map((g, k) => <instancedMesh key={k} ref={(im) => { refs.current[k] = im; }} args={[g, material, lista.length]} frustumCulled={false} />)}</group>;
}

export function Horizonte() {
  const [praia, cidade] = useLoader(THREE.TextureLoader, ["/horizonte/praia.jpg", "/horizonte/cidade.jpg"]);
  useMemo(() => { for (const t of [praia, cidade]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; t.repeat.set(REPETE, 1); } }, [praia, cidade]);
  // os painéis dos lados repetem mais vezes a arte (são mais compridos): cópias da textura com outra repetição
  const [praiaLado, cidadeLado] = useMemo(() => [praia, cidade].map((t) => { const c = t.clone(); c.repeat.set(REPETE_LADO, 1); c.needsUpdate = true; return c; }), [praia, cidade]);
  const palmeiras = useMemo(() => {
    const lista: [number, number, number][] = [];
    const passo = leve() ? 16 : 11;
    for (let x = -R + 8; x <= R - 6; x += passo) lista.push([x + ((x * 7) % 5) - 2, 0, RZ - 7 - ((x * 3) % 4)]);
    for (let z = -RN + 10; z <= RZ - 10; z += passo) { if (z > RIO.z1 - 4 && z < RIO.z0 + 4) continue; lista.push([R - 7 - ((z * 5) % 4), 0, z + ((z * 3) % 5) - 2]); }
    return lista;
  }, []);
  const palmeirasInst: ItemInstancia[] = useMemo(() => palmeiras.map((p, i) => ({ pos: p, rot: (i * 2.1) % (Math.PI * 2), altura: 7 + (i % 3) * 1.2 })), [palmeiras]);
  // faixa de areia do leste em dois pedaços: o rio passa no meio e chega ao mar
  const areiaSul = RZ - RIO.z0, areiaNorte = RIO.z1 - -RN;
  return (
    <group>
      <Painel textura={praia} position={[0, Y0 + ALT / 2, RZ]} rotation={Math.PI} />
      <Painel textura={praiaLado} position={[R, Y0 + ALT / 2, Z_LADO]} rotation={-Math.PI / 2} largura={LARG_LADO} />
      <Painel textura={cidade} position={[0, Y0 + ALT / 2, -RN]} rotation={0} />
      <Painel textura={cidadeLado} position={[-R, Y0 + ALT / 2, Z_LADO]} rotation={Math.PI / 2} largura={LARG_LADO} />
      {/* faixa de areia junto aos painéis da praia */}
      <Estatico>
        <mesh geometry={plano(LARG, 12)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, RZ - 6]} />
        <mesh geometry={plano(12, areiaSul)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[R - 6, -0.04, RIO.z0 + areiaSul / 2]} />
        <mesh geometry={plano(12, areiaNorte)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[R - 6, -0.04, RIO.z1 - areiaNorte / 2]} />
      </Estatico>
      <ComFallback fallback={<Estatico>{palmeiras.map((p, i) => <Palmeira key={i} position={p} escala={0.9 + (i % 3) * 0.15} />)}</Estatico>}>
        <ModeloInstanciado nome="palmeira" itens={palmeirasInst} sombra={false} />
      </ComFallback>
      <Skyline />
    </group>
  );
}
