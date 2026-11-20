"use client";
// Sede desenhada com o modelo do catálogo (20/11/2026; pedido do dono: "padronizar visual de prédios de empresas" e a
// bday.fm "tá parecendo um circo, quero que seja um dos 15 prédios padrões"). O prédio é o mesmo do cliente
// (scene/KitPredio.tsx, modo sede: a planta 16 x 13 m da sede), na cor e com a logo de cada sede:
//  - Social RP: torre de vidro; AppZone: prédio corporativo; bday.fm: moderno com varanda; NUVCAM: estúdio com telão;
//  - as áreas do site ficam numa faixa acesa no alto de cada andar, uma placa por área (data/sedes.ts › faixasDaSede);
//  - a logo vai no letreiro da entrada, no alto da frente (com verso) e no lado da rua da esquina.
// O desenho é feito no sistema do kit (frente -z) e gira meia volta para a frente +z da sede (SedeHQ).
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { caixa, mat, plano } from "./geo";
import { leve } from "./qualidade";
import { ceu } from "./CicloDia";
import { PredioKit } from "./KitPredio";
import { TelaoModelo } from "./TelaoModelo";
import { ComFallback } from "./Modelos";
import { JardimSede } from "./SedeEstilos";
import { MODELO } from "../data/modelos";
import { faixasDaSede, logosModeloSede, type FaixaSede, type Sede } from "../data/sedes";

// onde a faixa fica em cada tipo: altura dentro do andar (da laje para cima) e quanto sai da parede
type Onde = { y: (andar: number) => number; sai: number };
function ondeFaixa(base: string, frente: boolean): Onde {
  if (base === "torre") return { y: () => 0.43, sai: 0.14 }; // no peitoril opaco de cada andar
  if (base === "comercial") return frente ? { y: () => 0.47, sai: 0.58 } : { y: (h) => h - 0.36, sai: 0.06 }; // na frente, à frente dos brises
  return { y: (h) => h - 0.44, sai: 0.06 }; // varanda e estúdio: no alto do andar, acima das portas e janelas
}
const comAlfa = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function pintarFaixa(f: FaixaSede, largura: number, cor: string) {
  const PX = 128, W = Math.round(largura * PX), H = 64, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!, n = f.salas.length, sw = W / n;
  g.fillStyle = "#0C0F14"; g.fillRect(0, 0, W, H);
  f.salas.forEach((a, k) => {
    const x0 = k * sw;
    g.fillStyle = "#151A22"; g.fillRect(x0 + 4, 4, sw - 8, H - 8);
    if (!a) return;
    const luz = g.createLinearGradient(x0, 0, x0 + sw, 0); luz.addColorStop(0, comAlfa(a.cor, 0.32)); luz.addColorStop(1, comAlfa(a.cor, 0.06));
    g.fillStyle = luz; g.fillRect(x0 + 4, 4, sw - 8, H - 8);
    g.fillStyle = a.cor; g.beginPath(); g.arc(x0 + 26, H / 2, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#FFFFFF"; g.textBaseline = "middle"; g.textAlign = "left";
    let px = 30; const t = a.nome.toUpperCase(); g.font = `800 ${px}px Inter, Arial, sans-serif`;
    while (g.measureText(t).width > sw - 56 && px > 16) { px -= 2; g.font = `800 ${px}px Inter, Arial, sans-serif`; }
    g.fillText(t, x0 + 44, H / 2 + 1, sw - 54);
  });
  g.fillStyle = cor; g.fillRect(0, H - 5, W, 5); // filete na cor da marca
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
// materiais das faixas (acendem à noite; um laço por quadro só muda o número do brilho)
const MATS = new Map<string, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>();
function materialFaixa(chave: string, f: FaixaSede, largura: number, cor: string) {
  let m = MATS.get(chave);
  if (!m) {
    const t = pintarFaixa(f, largura, cor), o = { map: t, emissiveMap: t, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.3 };
    m = leve() ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial({ ...o, roughness: 0.4, metalness: 0.1 });
    MATS.set(chave, m);
  }
  return m;
}
let ultimoQuadro = -1;
function brilhoFaixas(t: number) { if (t === ultimoQuadro) return; ultimoQuadro = t; const k = 0.3 + 0.75 * ceu.noite; for (const m of MATS.values()) m.emissiveIntensity = k; }

function Faixas({ sede }: { sede: Sede }) {
  const { m } = logosModeloSede(sede), base = MODELO[sede.modelo].base, d = m.z1 - m.z0, cz = (m.z0 + m.z1) / 2;
  useFrame(({ clock }) => brilhoFaixas(clock.elapsedTime));
  const faixas = useMemo(() => faixasDaSede(sede), [sede]);
  return (
    <group>
      {faixas.map((f) => {
        const frente = f.face === "sul", lado = f.face === "oeste" || f.face === "leste", larg = (lado ? d : m.w) - 0.5, o = ondeFaixa(base, frente);
        const yAndar = m.terreo + (f.andar - 1) * m.andar + (base === "escola" ? 0.45 : 0), y = yAndar + o.y(m.andar);
        // sede (frente +z) → kit (frente -z): sul = frente do kit, norte = fundos, oeste = +x do kit, leste = -x
        const pos: [number, number, number] = f.face === "sul" ? [0, y, m.z0 - o.sai] : f.face === "norte" ? [0, y, m.z1 + o.sai] : f.face === "oeste" ? [m.w / 2 + o.sai, y, cz] : [-m.w / 2 - o.sai, y, cz];
        const rot = f.face === "sul" ? Math.PI : f.face === "norte" ? 0 : f.face === "oeste" ? Math.PI / 2 : -Math.PI / 2;
        return <mesh key={`${f.face}${f.andar}`} geometry={plano(larg, 0.5)} material={materialFaixa(`${sede.id}:${f.face}:${f.andar}`, f, larg, sede.cor)} position={pos} rotation={[0, rot, 0]} />;
      })}
    </group>
  );
}

// a logo clara num plano (material declarado aqui, como em OneStateHQ › useLogos: a textura do carregador não é mexida)
function PlacaLogo({ tex, w, h, ...g }: { tex: THREE.Texture; w: number; h: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <mesh {...g}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} map-colorSpace={THREE.SRGBColorSpace} map-anisotropy={4} transparent alphaTest={0.08} toneMapped={false} />
    </mesh>
  );
}
function Logos({ sede }: { sede: Sede }) {
  const tex = useLoader(THREE.TextureLoader, sede.logo);
  const L = logosModeloSede(sede), { m } = L, lt = m.letreiro, cz = (m.z0 + m.z1) / 2;
  const mPainel = mat("#12151A", { rough: 0.6 }), mPoste = mat("#2B2F36", { metal: 0.4, rough: 0.5 });
  const wE = Math.min(lt.largura * 0.84, 1.05 / sede.propLogo), hE = wE * sede.propLogo;
  // lado da rua: oeste da sede = +x do kit
  const xl = sede.lado === "oeste" ? m.w / 2 - 0.7 : -(m.w / 2 - 0.7), rl = sede.lado === "oeste" ? Math.PI / 2 : -Math.PI / 2;
  return (
    <group>
      {/* letreiro da entrada: painel escuro com a logo clara */}
      <group position={[lt.x, lt.y, lt.z]}>
        <mesh geometry={caixa(lt.largura, 1.3, 0.16)} material={mPainel} castShadow />
        <mesh geometry={caixa(lt.largura, 0.07, 0.2)} material={mat(sede.cor, { emissive: sede.cor, ei: 0.6 })} position={[0, -0.6, 0]} />
        <PlacaLogo tex={tex} w={wE} h={hE} position={[0, 0.03, -0.09]} rotation={[0, Math.PI, 0]} />
      </group>
      {/* no alto da frente (com verso) e no lado da esquina, em postes */}
      <group position={[0, L.base, m.z0 + 0.8]}>
        <PlacaLogo tex={tex} w={L.frente.w} h={L.frente.h} position={[0, L.frente.h / 2, 0]} rotation={[0, Math.PI, 0]} />
        <PlacaLogo tex={tex} w={L.frente.w} h={L.frente.h} position={[0, L.frente.h / 2, 0.05]} />
        {[-L.frente.w * 0.36, L.frente.w * 0.36].map((x) => <mesh key={x} geometry={caixa(0.14, L.base - L.topo + 0.6, 0.14)} material={mPoste} position={[x, -(L.base - L.topo) / 2 + 0.3, 0.12]} />)}
      </group>
      <group position={[xl, L.base, cz + 0.6]} rotation={[0, rl, 0]}>
        <PlacaLogo tex={tex} w={L.lado.w} h={L.lado.h} position={[0, L.lado.h / 2, 0]} />
        {[-L.lado.w * 0.34, L.lado.w * 0.34].map((x) => <mesh key={x} geometry={caixa(0.14, L.base - L.topo + 0.6, 0.14)} material={mPoste} position={[x, -(L.base - L.topo) / 2 + 0.3, -0.12]} />)}
      </group>
    </group>
  );
}

export function SedeModelo({ sede }: { sede: Sede }) {
  const M = MODELO[sede.modelo], { m } = logosModeloSede(sede);
  return (
    <group>
      <JardimSede sede={sede} parte="fora" />
      {/* 6 cm para cima: o prédio fica em cima do gramado do lote da sede (0,06 m; SedeEstilos › JardimSede), nada afundado */}
      <group rotation={[0, Math.PI, 0]} position={[0, 0.06, 0]}>
        <PredioKit id={M.base} andares={sede.andares} duplo={false} material="original" corFachada={sede.cor} corMarca={sede.cor} semente={sede.chave} plana={false} sede />
        <Faixas sede={sede} />
        <ComFallback fallback={null}><Logos sede={sede} /></ComFallback>
        {m.telao && <TelaoModelo nome={sede.nome} cor={sede.cor} logo={sede.logo} telao={m.telao} rodape={sede.dominio} />}
      </group>
    </group>
  );
}
