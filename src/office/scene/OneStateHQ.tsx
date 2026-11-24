"use client";
// Sede da Social RP, antes OneState RP (16/11/2026; dados em src/office/data/onestate.ts). Torre de vidro escuro com estrutura
// grafite e frisos dourados (as cores da marca: ouro e prata sobre preto), logo grande no alto (frente e lado),
// pórtico dourado com a logo na entrada e o balão. Cada andar de cada fachada é UMA imagem desenhada na
// hora (salas acesas na cor da área, mesas e a placa com o nome): poucos objetos para o mapa desenhar. A fachada acende
// à noite (brilhoSede, chamado a cada quadro). Tocar no prédio ou no balão abre o cartão com todas as áreas do site.
// 19/11/2026 (pedido do dono): cada sede ocupa só 1 lote de 20 x 20 m. A praça de 40 x 40, o totem e os canteiros do
// quarteirão saíram; no lote ficam o jardim pequeno da frente (SedeEstilos › JardimSede), o pórtico e a entrada. Tudo é
// desenhado em coordenadas do lote (frente +z) e o grupo da sede leva para o lote dela, virado para a rua da frente.
import * as THREE from "three";
import { useRef, useState } from "react";
import { useLoader, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Balao } from "./Lotes";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { ComFallback } from "./Modelos";
import { ceu } from "./CicloDia";
import { leve } from "./qualidade";
import { SEDE } from "../data/onestate";
import { areasDoAndarDe, andaresComAreas, salasNaFace, salasVazias, alturaSede, type Sede, type AreaSede, type FaceSede } from "../data/sedes";
import { abrirSede } from "../ui/CartaoOneState";
import { InteriorSede } from "./OneStateInterior";
import { useEscritorio } from "../store";
import { cameraInfo } from "./CameraMundo";
import { PALETAS, PORTICO, SX, SZ, pisosDe, logosDe, brilhoEstilos, comAlfa, CascaEstilo, TelaoEstudio, JardimSede, type Paleta } from "./SedeEstilos";
import { SedeModelo } from "./SedeModelo";
import { usePoseAoVivo, useFantasma } from "./EditorPosicao";

// 17/11/2026: a mesma torre serve a todas as sedes do cadastro (data/sedes.ts): cor de destaque, logo, áreas e balão de
// cada uma; desde 19/11/2026 é desenhada em coordenadas do lote e levada para o lote de cada sede (SedeHQ).
// 17/11/2026 (tarde): cada sede ganhou o próprio prédio (sede.estilo; cascas em scene/SedeEstilos.tsx). A Social RP segue
// com esta torre ("classica"); a planta térrea e a entrada da frente são as mesmas em todas.
const GRAFITE = "#1E2228";
const S = SEDE.z + SEDE.d / 2, N = SEDE.z - SEDE.d / 2, O = SEDE.x - SEDE.w / 2, L = SEDE.x + SEDE.w / 2; // faces

// ---------- fachadas desenhadas em canvas ----------
const PELES = ["#F1C9A5", "#C98E68", "#8D5A3B", "#F3D2B3", "#6B4029"];
type Tipo = "areas" | "comum" | "saguao";
const caixaRedonda = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
// nome da área: numa sala estreita a letra diminui (até 70%) antes de ser apertada na largura, para continuar legível
function escrever(g: CanvasRenderingContext2D, texto: string, x: number, y: number, max: number, px: number) {
  const fonte = (p: number) => `800 ${Math.round(p)}px "Arial Black", Inter, Arial, sans-serif`;
  g.font = fonte(px);
  const w = g.measureText(texto).width;
  if (w > max) g.font = fonte(Math.max(px * 0.7, (px * max) / w));
  g.fillText(texto, x, y, max);
}
// a placa com o nome da área no alto da sala, no jeito de cada estilo (a clássica é a original, com moldura dourada)
function placa(g: CanvasRenderingContext2D, P: Paleta, x0: number, sw: number, H: number, topo: number, a: AreaSede | null, OURO: string, CLARA: string, ESCURA: string) {
  const px = H * 0.125, cy = 7 + (topo - 10) / 2;
  g.textBaseline = "middle";
  if (P.placa === "app") {
    // AppZone: faixa escura com sublinhado na cor da marca e um ícone de aplicativo na cor da área
    g.fillStyle = P.faixa; g.fillRect(x0 + 6, 6, sw - 12, topo - 10);
    g.fillStyle = OURO; g.fillRect(x0 + 6, topo - 7, sw - 12, 3);
    if (a) {
      const s = H * 0.1; g.fillStyle = a.cor; caixaRedonda(g, x0 + 16, cy - s / 2, s, s, 5); g.fill();
      g.fillStyle = P.texto ?? CLARA; escrever(g, a.nome.toUpperCase(), x0 + 26 + s, cy, sw - 44 - s, px);
    }
    return;
  }
  if (P.placa === "pilula") {
    // bday.fm: etiqueta branca arredondada, como as de presente
    g.fillStyle = P.faixa; g.fillRect(x0, 0, sw, topo - 2);
    if (!a) return;
    g.fillStyle = "#FFFFFF"; caixaRedonda(g, x0 + 10, 9, sw - 20, topo - 17, (topo - 17) / 2); g.fill();
    g.fillStyle = a.cor; g.beginPath(); g.arc(x0 + 34, cy, H * 0.035, 0, Math.PI * 2); g.fill();
    g.fillStyle = ESCURA; escrever(g, a.nome.toUpperCase(), x0 + 50, cy, sw - 74, px);
    return;
  }
  if (P.placa === "estudio") {
    // NUVCAM: placa preta de estúdio com a tarja vermelha e o ponto da área, como luz de gravação
    g.fillStyle = "#07070A"; g.fillRect(x0 + 6, 6, sw - 12, topo - 10);
    g.fillStyle = OURO; g.fillRect(x0 + 6, 6, 7, topo - 10);
    if (a) {
      g.strokeStyle = a.cor; g.lineWidth = 3; g.beginPath(); g.arc(x0 + 36, cy, H * 0.042, 0, Math.PI * 2); g.stroke();
      g.fillStyle = a.cor; g.beginPath(); g.arc(x0 + 36, cy, H * 0.024, 0, Math.PI * 2); g.fill();
      g.fillStyle = P.texto ?? CLARA; escrever(g, a.nome.toUpperCase(), x0 + 54, cy, sw - 72, px);
    }
    return;
  }
  // clássica (Social RP)
  g.fillStyle = "#07090C"; g.fillRect(x0 + 6, 6, sw - 12, topo - 10);
  g.strokeStyle = OURO; g.lineWidth = 3; g.strokeRect(x0 + 7.5, 7.5, sw - 15, topo - 13);
  if (a) {
    g.fillStyle = a.cor; g.beginPath(); g.arc(x0 + 30, cy - 1, H * 0.035, 0, Math.PI * 2); g.fill();
    g.fillStyle = CLARA; escrever(g, a.nome.toUpperCase(), x0 + 48, cy, sw - 66, px);
  }
}
function pintar(W: number, H: number, salas: (AreaSede | null)[], tipo: Tipo, OURO: string, CLARA: string, ESCURA: string, P: Paleta) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const vidro = g.createLinearGradient(0, 0, 0, H); vidro.addColorStop(0, P.vidro[0]); vidro.addColorStop(1, P.vidro[1]);
  g.fillStyle = vidro; g.fillRect(0, 0, W, H);
  const n = salas.length, sw = W / n, topo = tipo === "areas" ? H * 0.27 : H * 0.12;
  for (let k = 0; k < n; k++) {
    const x0 = k * sw, a = salas[k];
    const cor = tipo === "saguao" ? P.saguao : a?.cor ?? "#E9D8B0";
    // a sala acesa por trás do vidro: luz na cor da área, mais forte embaixo
    const luz = g.createLinearGradient(0, topo, 0, H);
    luz.addColorStop(0, comAlfa(cor, tipo === "comum" ? 0.08 : 0.13)); luz.addColorStop(1, comAlfa(cor, tipo === "comum" ? 0.24 : 0.42));
    g.fillStyle = luz; g.fillRect(x0 + 5, topo + 6, sw - 10, H - topo - 16);
    g.fillStyle = comAlfa("#FFF6DA", tipo === "comum" ? 0.55 : 0.9); g.fillRect(x0 + sw * 0.14, topo + 10, sw * 0.72, 3); // luminária
    if (tipo === "saguao") {
      // balcão da recepção e o escudo na cor da marca na parede do fundo
      g.fillStyle = "rgba(10,12,16,.8)"; g.fillRect(x0 + sw * 0.2, H * 0.68, sw * 0.6, H * 0.14);
      g.fillStyle = comAlfa(OURO, 0.9); g.fillRect(x0 + sw * 0.2, H * 0.68, sw * 0.6, 3);
    } else {
      // mesas com monitores e cadeiras
      for (let d = 0; d < 3; d++) {
        const dx = x0 + sw * (0.16 + d * 0.25);
        g.fillStyle = "rgba(6,8,12,.78)"; g.fillRect(dx, H * 0.74, sw * 0.17, H * 0.05); g.fillRect(dx + sw * 0.06, H * 0.62, sw * 0.05, H * 0.11);
        g.fillStyle = comAlfa(cor, 0.85); g.fillRect(dx + sw * 0.065, H * 0.635, sw * 0.04, H * 0.06);
        // o agente na mesa: tronco com a camisa na cor da área e a cabeça
        const px = dx + sw * 0.135, pele = PELES[(k * 3 + d) % PELES.length];
        g.fillStyle = comAlfa(cor, 0.95); g.beginPath(); g.roundRect?.(px - sw * 0.025, H * 0.655, sw * 0.05, H * 0.09, 4); g.fill();
        g.fillStyle = pele; g.beginPath(); g.arc(px, H * 0.62, H * 0.032, 0, Math.PI * 2); g.fill();
      }
    }
    // montantes do caixilho
    g.fillStyle = P.montante; for (let m = 0; m <= P.montantes; m++) g.fillRect(x0 + (sw * m) / P.montantes - P.largMontante / 2, topo, P.largMontante, H - topo);
    // placa com o nome da área
    if (tipo === "areas") { g.save(); g.translate(0, H * (P.placaY ?? 0)); placa(g, P, x0, sw, H, topo, a, OURO, CLARA, ESCURA); g.restore(); }
    else { g.fillStyle = P.faixa; g.fillRect(0, 0, W, topo - 2); g.fillStyle = comAlfa(OURO, 0.75); g.fillRect(0, topo - 4, W, 2); }
  }
  g.fillStyle = P.laje; g.fillRect(0, H - 8, W, 8); // laje
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// materiais da fachada (no módulo: a cena só lê; o brilho da noite muda num lugar só)
const FACHADAS = new Map<string, THREE.Material>();
function fachada(sede: Sede, chave: string, W: number, H: number, salas: (AreaSede | null)[], tipo: Tipo) {
  const k = `${sede.id}:${chave}`;
  let m = FACHADAS.get(k);
  if (!m) {
    const t = pintar(W, H, salas, tipo, sede.cor, sede.corClara, sede.escura, PALETAS[sede.estilo]);
    m = leve()
      ? new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: "#FFFFFF", emissiveIntensity: 0.35 })
      : new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#FFFFFF", emissiveIntensity: 0.35, roughness: 0.22, metalness: 0.45 });
    FACHADAS.set(k, m);
  }
  return m;
}
// de dia o vidro reflete e a luz de dentro é fraca; à noite as salas acendem
function brilhoSede(noite: number) {
  const k = 0.16 + 0.9 * noite;
  for (const m of FACHADAS.values()) (m as THREE.MeshStandardMaterial).emissiveIntensity = k;
}
// as 4 sedes chamam a cada quadro; o ajuste roda uma vez só por quadro
let ultimoBrilho = -1;
function brilho(t: number) { if (t === ultimoBrilho) return; ultimoBrilho = t; brilhoSede(ceu.noite); brilhoEstilos(ceu.noite, t); }

// cada andar de cada face é um plano com a sua pintura; andares e faces sem nome de área (andares de cima e as faces
// viradas para os lotes vizinhos) dividem a mesma pintura (uma textura por tamanho), e o Estatico junta os planos iguais
// numa malha só. As áreas ficam na frente e no lado da rua (data/sedes.ts › salasNaFace e sede.lado)
const PX_M = 1024 / SEDE.w; // px por metro, na largura e na altura (o andar tem SEDE.andar × PX_M px de altura)
const PX_ANDAR = Math.round(SEDE.andar * PX_M);
function Fachadas({ sede }: { sede: Sede }) {
  const H = SEDE.andar, nAreas = andaresComAreas(sede), VAZIO = salasVazias(sede), por = salasNaFace(sede); // andares sem área: o mesmo ritmo de janelas
  return (
    <group>
      {pisosDe(sede).map((p) => {
        const f = p.f, salas = f >= 1 && f <= nAreas ? areasDoAndarDe(sede, f) : VAZIO;
        const ws = p.x1 - p.x0 - 2 * p.canto, wl = p.z1 - p.z0 - 2 * p.canto, pxS = Math.round(ws * PX_M), pxL = Math.round(wl * PX_M);
        const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, y = f * H + H / 2;
        const comumS = fachada(sede, `comum${por.sul}:${pxS}`, pxS, PX_ANDAR, VAZIO.sul, "comum"), comumL = fachada(sede, `comum${por.oeste}:${pxL}`, pxL, PX_ANDAR, VAZIO.oeste, "comum");
        // o saguão (térreo) aparece na frente e no lado da rua; uma face com pelo menos uma área tem a pintura própria
        const pintura = (face: FaceSede, px: number, comum: THREE.Material) => {
          const tipo: Tipo = f === 0 ? (face === "sul" || face === sede.lado ? "saguao" : "comum") : salas[face].some(Boolean) ? "areas" : "comum";
          return tipo === "comum" ? comum : fachada(sede, `${face}${f}`, px, PX_ANDAR, salas[face], tipo);
        };
        return (
          <group key={f}>
            <mesh geometry={plano(ws, H)} material={pintura("sul", pxS, comumS)} position={[cx, y, p.z1 + 0.02]} />
            <mesh geometry={plano(wl, H)} material={pintura("oeste", pxL, comumL)} position={[p.x0 - 0.02, y, cz]} rotation={[0, -Math.PI / 2, 0]} />
            <mesh geometry={plano(ws, H)} material={pintura("norte", pxS, comumS)} position={[cx, y, p.z0 - 0.02]} rotation={[0, Math.PI, 0]} />
            <mesh geometry={plano(wl, H)} material={pintura("leste", pxL, comumL)} position={[p.x1 + 0.02, y, cz]} rotation={[0, Math.PI / 2, 0]} />
          </group>
        );
      })}
    </group>
  );
}

// ---------- estrutura (juntada num objeto só pelo Estatico) ----------
// parte "fora": a torre clássica e o pórtico (somem na vista por dentro). As outras sedes trocam a parte "fora" pela casca
// do próprio estilo (CascaEstilo). O chão do lote e o jardim da frente (iguais em todas, nas cores de cada estilo) ficam
// sempre à mostra: SedeEstilos › JardimSede.
function Estrutura({ sede }: { sede: Sede }) {
  const OURO = sede.cor, H = alturaSede(sede), mG = mat(GRAFITE, { rough: 0.55, metal: 0.4 }), mOuro = mat(OURO, { rough: 0.3, metal: 0.85, emissive: OURO, ei: 0.25 });
  const mCaminho = mat("#6B7079", { rough: 0.8 });
  const lajes = Array.from({ length: sede.andares + 1 }, (_, f) => f * SEDE.andar).filter((y) => y > 0);
  return (
    <group>
      <JardimSede sede={sede} parte="fora" />
      {/* núcleo escuro atrás das fachadas, lajes com friso dourado e pilares de canto */}
      <mesh geometry={caixa(SEDE.w - 0.1, H, SEDE.d - 0.1)} material={mat("#0B0F15", { rough: 0.6 })} position={[SEDE.x, H / 2, SEDE.z]} castShadow receiveShadow />
      {lajes.map((y) => (
        <group key={y}>
          <mesh geometry={caixa(SEDE.w + 0.5, 0.34, SEDE.d + 0.5)} material={mG} position={[SEDE.x, y, SEDE.z]} castShadow />
          <mesh geometry={caixa(SEDE.w + 0.54, 0.07, 0.06)} material={mOuro} position={[SEDE.x, y - 0.1, S + 0.27]} />
          <mesh geometry={caixa(0.06, 0.07, SEDE.d + 0.54)} material={mOuro} position={[O - 0.27, y - 0.1, SEDE.z]} />
        </group>
      ))}
      {[[O, S], [L, S], [O, N], [L, N]].map(([x, z], i) => <mesh key={`p${i}`} geometry={caixa(0.75, H + 0.4, 0.75)} material={mG} position={[x, (H + 0.4) / 2, z]} castShadow />)}
      {/* coroa: platibanda, faixa dourada acesa e máquinas no telhado */}
      <mesh geometry={caixa(SEDE.w + 0.7, 1.3, SEDE.d + 0.7)} material={mG} position={[SEDE.x, H + 0.65, SEDE.z]} castShadow />
      <mesh geometry={caixa(SEDE.w + 0.74, 0.14, SEDE.d + 0.74)} material={mat(OURO, { rough: 0.3, metal: 0.6, emissive: OURO, ei: 0.9 })} position={[SEDE.x, H + 0.2, SEDE.z]} />
      <mesh geometry={caixa(5, 1.8, 3.4)} material={mat("#3A3F47", { rough: 0.7 })} position={[SEDE.x + 6 * SX, H + 1.5, SEDE.z - 3.5 * SZ]} castShadow />
      <mesh geometry={caixa(3.2, 1.2, 2.6)} material={mat("#4A4F57", { rough: 0.7 })} position={[SEDE.x - 6.5 * SX, H + 1.2, SEDE.z - 4 * SZ]} castShadow />
      <mesh geometry={cilindro(0.09, 0.14, 7, 8)} material={mG} position={[L - 1.8, H + 4.6, N + 1.8]} />
      <mesh geometry={esfera(0.22, 10)} material={mat("#FF3B3B", { emissive: "#FF3B3B", ei: 2 })} position={[L - 1.8, H + 8.2, N + 1.8]} />
      {/* pórtico dourado da entrada (frente) e degraus: a altura acompanha o pé-direito (PORTICO, SedeEstilos) */}
      <mesh geometry={caixa(9, 0.18, 2.4)} material={mCaminho} position={[SEDE.x, 0.09, S + 1.2]} receiveShadow />
      {[-3.5, 3.5].map((dx) => <mesh key={dx} geometry={caixa(0.6, PORTICO.vao, 0.6)} material={mOuro} position={[SEDE.x + dx, PORTICO.vao / 2, S + 2.1]} castShadow />)}
      <mesh geometry={caixa(7.8, 0.6, 2.6)} material={mOuro} position={[SEDE.x, PORTICO.vao, S + 1.25]} castShadow />
      <mesh geometry={caixa(7.4, 2.5, 0.2)} material={mat("#07090C", { rough: 0.5 })} position={[SEDE.x, PORTICO.placa, S + 2.45]} castShadow />
    </group>
  );
}

// ---------- a logo da sede: no alto e na entrada (posições de cada estilo em SedeEstilos › logosDe) ----------
function useLogos(sede: Sede) {
  const logo = useLoader(THREE.TextureLoader, sede.logo);
  const placa = (t: THREE.Texture, w: number, h: number) => [
    <planeGeometry key="g" args={[w, h]} />,
    <meshBasicMaterial key="m" map={t} map-colorSpace={THREE.SRGBColorSpace} map-anisotropy={4} transparent alphaTest={0.08} toneMapped={false} />,
  ];
  return { logo, placa };
}
function Logos({ fora, sede }: { fora: boolean; sede: Sede }) {
  const { logo, placa } = useLogos(sede);
  const PROP_LOGO = sede.propLogo, pos = logosDe(sede);
  const mPoste = mat(GRAFITE, { rough: 0.5, metal: 0.4 });
  return (
    <group>
      <group visible={fora}>
      {/* no alto: frente com verso para o fundo, e o lado da rua da esquina (SedeEstilos › logosDe) */}
      {pos.alto.map((a, i) => {
        const h = a.w * PROP_LOGO, y = a.chao + 1.4 + h / 2;
        return (
          <group key={i} position={[a.x, 0, a.z]} rotation={[0, a.rotY, 0]}>
            <mesh position={[0, y, 0]}>{placa(logo, a.w, h)}</mesh>
            {a.verso && <mesh position={[0, y, -0.06]} rotation={[0, Math.PI, 0]}>{placa(logo, a.w, h)}</mesh>}
            {a.postes.map((dx) => <mesh key={dx} geometry={caixa(0.16, 1.6, 0.16)} material={mPoste} position={[dx, a.chao + 1.6, -0.12]} />)}
          </group>
        );
      })}
      {/* na entrada */}
      <mesh position={pos.portico.pos}>{placa(logo, pos.portico.w, pos.portico.w * PROP_LOGO)}</mesh>
      </group>
    </group>
  );
}

const cursor = (v: string) => () => { document.body.style.cursor = v; };
// ?sedesAntes=1 (conferência, 20/11/2026): desenha as cascas de antes do catálogo (a bday.fm no estilo "festa"), para as
// fotos de antes e depois
const SEDES_ANTES = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("sedesAntes");
const comoAntes = (s: Sede): Sede => ({ ...s, estilo: s.id === "bday" ? "festa" : s.estilo, modelo: undefined as unknown as Sede["modelo"] });
export function SedeHQ({ sede: s0 }: { sede: Sede }) {
  const sede = SEDES_ANTES ? comoAntes(s0) : s0;
  useFrame(({ clock }) => brilho(clock.elapsedTime));
  // modo "Editar posição" pela conta admin (21/11/2026): a sede segue o rascunho e vira fantasma; a chave nunca muda
  const lote = useRef<THREE.Group>(null);
  usePoseAoVivo(lote, sede.chave, [sede.x, sede.z, sede.rot], (p) => [p.centro[0], p.centro[1], p.rot]);
  useFantasma(lote, sede.chave);
  // vista por dentro (o mesmo botão que abre as lojas): a torre some e aparece a planta com a equipe (OneStateInterior)
  const fora = useEscritorio((s) => s.vista === "fora");
  const abrir = () => abrirSede(sede.id);
  // o clique do prédio só vale por fora: por dentro a torre fica invisível, mas o raio ainda bate no teto dela e o clique
  // abria o cartão no lugar da conversa com a pessoa tocada (16/11/2026). Por dentro, o cartão abre pelo balão.
  const clique = fora ? { onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); abrir(); }, onPointerOver: cursor("pointer"), onPointerOut: cursor("") } : {};
  const tipo = sede.tipo.charAt(0).toUpperCase() + sede.tipo.slice(1);
  // por dentro, só a sede perto da câmera monta a equipe (são 4 sedes com dezenas de agentes cada)
  const [perto, setPerto] = useState(false);
  const quadro = useRef(0);
  useFrame(({ camera, clock }) => {
    // confere a cada meio segundo (por tempo: em aparelho lento, contar quadros demorava demais)
    if (clock.elapsedTime - quadro.current < 0.5) return;
    quadro.current = clock.elapsedTime;
    // o ponto para onde a câmera olha (CameraMundo); antes de ela começar, a posição da câmera
    const [x, z] = cameraInfo.pronto ? [cameraInfo.x, cameraInfo.z] : [camera.position.x, camera.position.z];
    const p = Math.hypot(x - sede.x, z - sede.z) < 48;
    if (p !== perto) setPerto(p);
  });
  // o lote da sede (data/sedes.ts: centro e giro para a rua da frente); dentro dele tudo é desenhado com a frente para +z
  return (
    <group ref={lote} position={[sede.x, 0, sede.z]} rotation={[0, sede.rot, 0]}>
      <group {...clique}>
        <Estatico><JardimSede sede={sede} /></Estatico>
        {/* 20/11/2026: o prédio é um modelo do catálogo (data/modelos.ts), na cor e com a logo da sede (scene/SedeModelo.tsx).
            A casca própria de cada estilo (abaixo) só fica para uma sede sem modelo */}
        {sede.modelo ? <group visible={fora}><SedeModelo sede={sede} /></group> : (
          <>
            <Estatico visivel={fora}>
              {sede.estilo === "classica" ? <Estrutura sede={sede} /> : <CascaEstilo sede={sede} />}
              <Fachadas sede={sede} />
            </Estatico>
            <ComFallback fallback={null}><Logos fora={fora} sede={sede} /></ComFallback>
            {sede.estilo === "estudio" && <group visible={fora}><ComFallback fallback={null}><TelaoEstudio sede={sede} /></ComFallback></group>}
          </>
        )}
        {!fora && perto && <InteriorSede sede={sede} />}
        <Balao position={[SEDE.x, alturaSede(sede) + 10.5, SEDE.z]} nome={sede.nome} cor={sede.escura} logo={sede.icone} subtitulo={`${tipo} · ${sede.areas.length} áreas`} onClick={abrir} />
      </group>
    </group>
  );
}
// compatibilidade: a sede da Social RP sozinha
