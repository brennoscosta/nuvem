"use client";
// Sede da Social RP, antes OneState RP (16/11/2026; dados em src/office/data/onestate.ts). Torre de 6 andares de vidro escuro com estrutura
// grafite e frisos dourados (as cores da marca: ouro e prata sobre preto), logo grande no alto (sul, oeste e norte),
// pórtico dourado com a logo na entrada, praça com totem e o balão. Cada andar de cada fachada é UMA imagem desenhada na
// hora (salas acesas na cor da área, mesas e a placa com o nome): poucos objetos para o mapa desenhar. A fachada acende
// à noite (brilhoSede, chamado a cada quadro). Tocar no prédio ou no balão abre o cartão com todas as áreas do site.
import * as THREE from "three";
import { useLoader, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Balao } from "./Lotes";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { ComFallback } from "./Modelos";
import { ceu } from "./CicloDia";
import { leve } from "./qualidade";
import { SEDE, ALTURA_SEDE, OS_X, OS_Z, areasDoAndar, ANDARES_COM_AREAS, AREAS_ONESTATE, type AreaOneState } from "../data/onestate";
import { abrirOneState } from "../ui/CartaoOneState";
import { InteriorSede } from "./OneStateInterior";
import { useEscritorio } from "../store";

const OURO = "#D4A63A", GRAFITE = "#1E2228", PISO = "#4A4F57";
const PROP_LOGO = 240 / 809; // altura / largura da logo da Social RP (public/socialrp/logo.png)
const S = SEDE.z + SEDE.d / 2, N = SEDE.z - SEDE.d / 2, O = SEDE.x - SEDE.w / 2, L = SEDE.x + SEDE.w / 2; // faces

// ---------- fachadas desenhadas em canvas ----------
const PELES = ["#F1C9A5", "#C98E68", "#8D5A3B", "#F3D2B3", "#6B4029"];
const comAlfa = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
type Tipo = "areas" | "comum" | "saguao";
function pintar(W: number, H: number, salas: (AreaOneState | null)[], tipo: Tipo) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const vidro = g.createLinearGradient(0, 0, 0, H); vidro.addColorStop(0, "#0A0F17"); vidro.addColorStop(1, "#111925");
  g.fillStyle = vidro; g.fillRect(0, 0, W, H);
  const n = salas.length, sw = W / n, topo = tipo === "areas" ? H * 0.27 : H * 0.12;
  for (let k = 0; k < n; k++) {
    const x0 = k * sw, a = salas[k];
    const cor = tipo === "saguao" ? "#FFD78A" : a?.cor ?? "#E9D8B0";
    // a sala acesa por trás do vidro: luz na cor da área, mais forte embaixo
    const luz = g.createLinearGradient(0, topo, 0, H);
    luz.addColorStop(0, comAlfa(cor, tipo === "comum" ? 0.08 : 0.13)); luz.addColorStop(1, comAlfa(cor, tipo === "comum" ? 0.24 : 0.42));
    g.fillStyle = luz; g.fillRect(x0 + 5, topo + 6, sw - 10, H - topo - 16);
    g.fillStyle = comAlfa("#FFF6DA", tipo === "comum" ? 0.55 : 0.9); g.fillRect(x0 + sw * 0.14, topo + 10, sw * 0.72, 3); // luminária
    if (tipo === "saguao") {
      // balcão da recepção e o escudo dourado na parede do fundo
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
    g.fillStyle = "#171B21"; for (let m = 0; m <= 3; m++) g.fillRect(x0 + (sw * m) / 3 - 2, topo, 4, H - topo);
    // placa com o nome da área
    if (tipo === "areas") {
      g.fillStyle = "#07090C"; g.fillRect(x0 + 6, 6, sw - 12, topo - 10);
      g.strokeStyle = OURO; g.lineWidth = 3; g.strokeRect(x0 + 7.5, 7.5, sw - 15, topo - 13);
      if (a) {
        g.fillStyle = a.cor; g.beginPath(); g.arc(x0 + 30, 6 + (topo - 10) / 2, H * 0.035, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#F7E7B4"; g.font = `800 ${Math.round(H * 0.125)}px "Arial Black", Inter, Arial, sans-serif`; g.textBaseline = "middle";
        g.fillText(a.nome.toUpperCase(), x0 + 48, 7 + (topo - 10) / 2, sw - 66);
      }
    } else {
      g.fillStyle = "#14181E"; g.fillRect(0, 0, W, topo - 2); g.fillStyle = comAlfa(OURO, 0.75); g.fillRect(0, topo - 4, W, 2);
    }
  }
  g.fillStyle = "#262B32"; g.fillRect(0, H - 8, W, 8); // laje
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// materiais da fachada (no módulo: a cena só lê; o brilho da noite muda num lugar só)
const FACHADAS = new Map<string, THREE.Material>();
function fachada(chave: string, W: number, H: number, salas: (AreaOneState | null)[], tipo: Tipo) {
  let m = FACHADAS.get(chave);
  if (!m) {
    const t = pintar(W, H, salas, tipo);
    m = leve()
      ? new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: "#FFFFFF", emissiveIntensity: 0.35 })
      : new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#FFFFFF", emissiveIntensity: 0.35, roughness: 0.22, metalness: 0.45 });
    FACHADAS.set(chave, m);
  }
  return m;
}
// de dia o vidro reflete e a luz de dentro é fraca; à noite as salas acendem
function brilhoSede(noite: number) {
  const k = 0.16 + 0.9 * noite;
  for (const m of FACHADAS.values()) (m as THREE.MeshStandardMaterial).emissiveIntensity = k;
}

function Fachadas() {
  const H = SEDE.andar, yDe = (f: number) => f * H + H / 2;
  const pxF = 1024, pxL = Math.round((1024 * SEDE.d) / SEDE.w), pxA = 192;
  const andares = Array.from({ length: SEDE.andares }, (_, f) => f);
  return (
    <group>
      {andares.map((f) => {
        const temAreas = f >= 1 && f <= ANDARES_COM_AREAS;
        const { frente, lado } = temAreas ? areasDoAndar(f) : { frente: [null, null, null], lado: [null, null] };
        const tipoF: Tipo = f === 0 ? "saguao" : temAreas ? "areas" : "comum";
        const tipoL: Tipo = f === 0 ? "saguao" : temAreas && lado.some(Boolean) ? "areas" : "comum";
        return (
          <group key={f}>
            <mesh geometry={plano(SEDE.w, H)} material={fachada(`s${f}`, pxF, pxA, frente, tipoF)} position={[SEDE.x, yDe(f), S + 0.02]} />
            <mesh geometry={plano(SEDE.d, H)} material={fachada(`o${f}`, pxL, pxA, lado, tipoL)} position={[O - 0.02, yDe(f), SEDE.z]} rotation={[0, -Math.PI / 2, 0]} />
            <mesh geometry={plano(SEDE.w, H)} material={fachada("comumN", pxF, pxA, [null, null, null], "comum")} position={[SEDE.x, yDe(f), N - 0.02]} rotation={[0, Math.PI, 0]} />
            <mesh geometry={plano(SEDE.d, H)} material={fachada("comumL", pxL, pxA, [null, null], "comum")} position={[L + 0.02, yDe(f), SEDE.z]} rotation={[0, Math.PI / 2, 0]} />
          </group>
        );
      })}
    </group>
  );
}

// ---------- estrutura (juntada num objeto só pelo Estatico) ----------
// parte "sempre": piso da praça e totem; parte "fora": a torre e a decoração (somem na vista por dentro)
function Estrutura({ parte }: { parte: "sempre" | "fora" }) {
  const H = ALTURA_SEDE, mG = mat(GRAFITE, { rough: 0.55, metal: 0.4 }), mOuro = mat(OURO, { rough: 0.3, metal: 0.85, emissive: OURO, ei: 0.25 });
  const mPiso = mat(PISO, { rough: 0.92 }), mCaminho = mat("#6B7079", { rough: 0.8 }), mVerde = mat("#3E7D4A"), mTerra = mat("#5A4632");
  const lajes = Array.from({ length: SEDE.andares + 1 }, (_, f) => f * SEDE.andar).filter((y) => y > 0);
  if (parte === "sempre") return (
    <group>
      <mesh geometry={caixa(40, 0.08, 40)} material={mPiso} position={[OS_X, 0.04, OS_Z]} receiveShadow />
      {/* totem da praça (canto sudoeste) */}
      <mesh geometry={caixa(2.2, 7.4, 0.6)} material={mG} position={[OS_X - 15.5, 3.7, OS_Z + 16.5]} castShadow />
      {[-1.12, 1.12].map((dx) => <mesh key={dx} geometry={caixa(0.08, 7.4, 0.64)} material={mOuro} position={[OS_X - 15.5 + dx, 3.7, OS_Z + 16.5]} />)}
    </group>
  );
  return (
    <group>
      {/* praça: caminho de entrada com frisos dourados, canteiros e bancos */}
      <mesh geometry={caixa(7, 0.09, 20 - (S - OS_Z) + 0.5)} material={mCaminho} position={[SEDE.x, 0.05, (S + OS_Z + 20) / 2]} receiveShadow />
      {[-3.6, 3.6].map((dx) => <mesh key={dx} geometry={caixa(0.22, 0.1, 20 - (S - OS_Z) + 0.5)} material={mOuro} position={[SEDE.x + dx, 0.06, (S + OS_Z + 20) / 2]} />)}
      {[[-12, 13], [12, 13], [-15.5, -2], [15.5, -2]].map(([dx, dz], i) => (
        <group key={i} position={[OS_X + dx, 0, OS_Z + dz]}>
          <mesh geometry={caixa(i < 2 ? 9 : 2.6, 0.6, i < 2 ? 2.6 : 12)} material={mG} position={[0, 0.3, 0]} castShadow />
          <mesh geometry={caixa(i < 2 ? 8.6 : 2.2, 0.1, i < 2 ? 2.2 : 11.6)} material={mTerra} position={[0, 0.61, 0]} />
          {Array.from({ length: 5 }, (_, k) => <mesh key={k} geometry={esfera(0.55, 10)} material={mVerde} position={i < 2 ? [-3.4 + k * 1.7, 0.95, 0] : [0, 0.95, -4.6 + k * 2.3]} />)}
        </group>
      ))}
      {[[-8, 9.4], [8, 9.4]].map(([dx, dz], i) => (
        <group key={`b${i}`} position={[OS_X + dx, 0, OS_Z + dz]}>
          <mesh geometry={caixa(3, 0.12, 0.7)} material={mat("#8E6B4A", { rough: 0.7 })} position={[0, 0.48, 0]} castShadow />
          {[-1.2, 1.2].map((x) => <mesh key={x} geometry={caixa(0.12, 0.45, 0.6)} material={mG} position={[x, 0.22, 0]} />)}
        </group>
      ))}
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
      <mesh geometry={caixa(5, 1.8, 3.4)} material={mat("#3A3F47", { rough: 0.7 })} position={[SEDE.x + 6, H + 1.5, SEDE.z - 3.5]} castShadow />
      <mesh geometry={caixa(3.2, 1.2, 2.6)} material={mat("#4A4F57", { rough: 0.7 })} position={[SEDE.x - 6.5, H + 1.2, SEDE.z - 4]} castShadow />
      <mesh geometry={cilindro(0.09, 0.14, 7, 8)} material={mG} position={[L - 1.8, H + 4.6, N + 1.8]} />
      <mesh geometry={esfera(0.22, 10)} material={mat("#FF3B3B", { emissive: "#FF3B3B", ei: 2 })} position={[L - 1.8, H + 8.2, N + 1.8]} />
      {/* pórtico dourado da entrada (frente sul) e degraus */}
      <mesh geometry={caixa(9, 0.18, 2.4)} material={mCaminho} position={[SEDE.x, 0.09, S + 1.2]} receiveShadow />
      {[-3.5, 3.5].map((dx) => <mesh key={dx} geometry={caixa(0.6, 4.8, 0.6)} material={mOuro} position={[SEDE.x + dx, 2.4, S + 2.1]} castShadow />)}
      <mesh geometry={caixa(7.8, 0.6, 2.6)} material={mOuro} position={[SEDE.x, 4.8, S + 1.25]} castShadow />
      <mesh geometry={caixa(7.4, 2.5, 0.2)} material={mat("#07090C", { rough: 0.5 })} position={[SEDE.x, 6.35, S + 2.45]} castShadow />
    </group>
  );
}

// ---------- a logo do OneState: no alto, no pórtico e no totem ----------
function useLogos() {
  const [logo, icone] = useLoader(THREE.TextureLoader, ["/socialrp/logo.png", "/socialrp/icone.png"]);
  const placa = (t: THREE.Texture, w: number, h: number) => [
    <planeGeometry key="g" args={[w, h]} />,
    <meshBasicMaterial key="m" map={t} map-colorSpace={THREE.SRGBColorSpace} map-anisotropy={4} transparent alphaTest={0.08} toneMapped={false} />,
  ];
  return { logo, icone, placa };
}
function Logos({ fora }: { fora: boolean }) {
  const { logo, icone, placa } = useLogos();
  const H = ALTURA_SEDE, wS = 15, hS = wS * PROP_LOGO, yS = H + 1.4 + hS / 2, wO = 11, hO = wO * PROP_LOGO;
  const mPoste = mat(GRAFITE, { rough: 0.5, metal: 0.4 });
  return (
    <group>
      <group visible={fora}>
      {/* no alto: frente (sul) com verso para o norte, e o lado oeste */}
      <group position={[SEDE.x, 0, S - 0.9]}>
        <mesh position={[0, yS, 0]}>{placa(logo, wS, hS)}</mesh>
        <mesh position={[0, yS, -0.06]} rotation={[0, Math.PI, 0]}>{placa(logo, wS, hS)}</mesh>
        {[-5.5, 0, 5.5].map((dx) => <mesh key={dx} geometry={caixa(0.16, 1.6, 0.16)} material={mPoste} position={[dx, H + 1.6, -0.12]} />)}
      </group>
      <group position={[O + 0.9, 0, SEDE.z - 1]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, H + 1.4 + hO / 2, 0]}>{placa(logo, wO, hO)}</mesh>
        {[-4, 4].map((dx) => <mesh key={dx} geometry={caixa(0.16, 1.6, 0.16)} material={mPoste} position={[dx, H + 1.6, -0.12]} />)}
      </group>
      {/* no pórtico da entrada */}
      <mesh position={[SEDE.x, 6.35, S + 2.56]}>{placa(logo, 7, 7 * PROP_LOGO)}</mesh>
      </group>
      {/* no totem, dos dois lados */}
      <mesh position={[OS_X - 15.5, 5.6, OS_Z + 16.81]}>{placa(icone, 1.9, 1.9)}</mesh>
      <mesh position={[OS_X - 15.5, 5.6, OS_Z + 16.19]} rotation={[0, Math.PI, 0]}>{placa(icone, 1.9, 1.9)}</mesh>
      <mesh position={[OS_X - 15.5, 3.4, OS_Z + 16.81]}>{placa(logo, 2, 2 * PROP_LOGO)}</mesh>
      <mesh position={[OS_X - 15.5, 3.4, OS_Z + 16.19]} rotation={[0, Math.PI, 0]}>{placa(logo, 2, 2 * PROP_LOGO)}</mesh>
    </group>
  );
}

const cursor = (v: string) => () => { document.body.style.cursor = v; };
export function OneStateHQ() {
  useFrame(() => brilhoSede(ceu.noite));
  // vista por dentro (o mesmo botão que abre as lojas): a torre some e aparece a planta com a equipe (OneStateInterior)
  const fora = useEscritorio((s) => s.vista === "fora");
  // o clique do prédio só vale por fora: por dentro a torre fica invisível, mas o raio ainda bate no teto dela e o clique
  // abria o cartão no lugar da conversa com a pessoa tocada (16/11/2026). Por dentro, o cartão abre pelo balão.
  const clique = fora ? { onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); abrirOneState(); }, onPointerOver: cursor("pointer"), onPointerOut: cursor("") } : {};
  return (
    <group {...clique}>
      <Estatico><Estrutura parte="sempre" /></Estatico>
      <Estatico visivel={fora}><Estrutura parte="fora" /></Estatico>
      <group visible={fora}><Fachadas /></group>
      <ComFallback fallback={null}><Logos fora={fora} /></ComFallback>
      {!fora && <InteriorSede />}
      <Balao position={[SEDE.x, ALTURA_SEDE + 10.5, SEDE.z]} nome="Social RP" cor="#14110A" logo="/socialrp/icone.png" subtitulo={`Roleplay · ${AREAS_ONESTATE.length} áreas`} onClick={abrirOneState} />
    </group>
  );
}
