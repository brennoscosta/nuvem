"use client";
// Móveis e equipamentos desenhados em código: mesa com computador, impressora, fax, smartphone, sofá, puffs,
// mesa de reunião, café... As partes fixas vão pro <Estatico> (viram poucas malhas); as que mudam (tela acesa,
// papel saindo da impressora, sirene) ficam separadas e leves.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, circulo, COR } from "./geo";
import { leve } from "./qualidade";
import { ceu, luzInterna } from "./CicloDia";
import type { Mesa as MesaDef } from "../data/layout";

// ---------- mesa de trabalho ----------
// Parte fixa: tampo, pés, monitor (com a tela apagada), teclado, mouse, celular, caneca e cadeira.
// tampoCor (12/11/2026): o interior personalizável do cliente troca o acabamento das mesas comuns
export function Mesa({ def, cor, tampoCor }: { def: MesaDef; cor: string; tampoCor?: string }) {
  const grande = def.tipo !== "comum";
  const w = grande ? 1.9 : 1.5, d = grande ? 0.9 : 0.75;
  const tampo = def.tipo === "ceo" || def.tipo === "diretor" ? COR.madeiraEscura : tampoCor ?? COR.branco;
  return (
    <group position={def.pos} rotation={[0, def.rot, 0]}>
      <mesh geometry={caixa(w, 0.05, d)} material={mat(tampo, { rough: 0.6 })} position={[0, 0.72, 0]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={caixa(0.06, 0.7, d - 0.1)} material={mat(COR.metal, { metal: 0.3, rough: 0.5 })} position={[s * (w / 2 - 0.08), 0.35, 0]} castShadow />
      ))}
      {/* monitor: olha pra cadeira (-z local) */}
      <group position={[0, 0.745, 0.08]}>
        <mesh geometry={caixa(0.3, 0.02, 0.18)} material={mat(COR.grafite)} position={[0, 0.01, 0]} />
        <mesh geometry={cilindro(0.025, 0.025, 0.14, 8)} material={mat(COR.grafite)} position={[0, 0.08, 0]} />
        <mesh geometry={caixa(0.62, 0.38, 0.03)} material={mat(COR.grafite)} position={[0, 0.33, 0]} castShadow />
        <mesh geometry={caixa(0.58, 0.34, 0.005)} material={mat(COR.tela)} position={[0, 0.33, -0.018]} />
      </group>
      <mesh geometry={caixa(0.42, 0.02, 0.14)} material={mat("#E8EAED")} position={[0, 0.755, -0.2]} />
      <mesh geometry={caixa(0.06, 0.025, 0.09)} material={mat("#E8EAED")} position={[0.32, 0.755, -0.2]} />
      <mesh geometry={caixa(0.07, 0.01, 0.14)} material={mat(COR.preto, { rough: 0.3 })} position={[-0.45, 0.75, -0.12]} rotation={[0, 0.3, 0]} />
      <mesh geometry={cilindro(0.04, 0.035, 0.09, 12)} material={mat(cor, { rough: 0.5 })} position={[0.55, 0.79, 0.05]} />
      {grande && <Planta pequena position={[-0.75, 0.745, 0.2]} />}
      <Cadeira position={[0, 0, -0.62]} cor={def.tipo === "ceo" ? "#2B2E35" : def.tipo === "comum" ? cor : "#4A4F58"} />
    </group>
  );
}

// Tela acesa (agente trabalhando): um retângulo com "código" rolando. Todas as telas acesas dividem o mesmo
// material e a mesma textura, que rola num único useFrame (custo zero por tela além do próprio retângulo).
let materialTelaAcesa: THREE.MeshBasicMaterial | null = null;
function telaAcesa() {
  if (materialTelaAcesa) return materialTelaAcesa;
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#DCEBFF"; x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#4C7BD9";
  for (let i = 0; i < 8; i++) x.fillRect(6 + ((i * 5) % 4) * 4, 4 + i * 8, 14 + ((i * 7) % 3) * 12, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 0.55);
  materialTelaAcesa = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  return materialTelaAcesa;
}
export function TelasAcesas({ mesas }: { mesas: MesaDef[] }) {
  const material = telaAcesa();
  useFrame((st) => { const m = telaAcesa(); if (m.map) m.map.offset.y = (st.clock.elapsedTime * 0.35) % 1; });
  return (
    <group>
      {mesas.map((m) => (
        <group key={m.id} position={m.pos} rotation={[0, m.rot, 0]}>
          <mesh geometry={plano(0.58, 0.34)} material={material} position={[0, 1.075, 0.058]} rotation={[0, Math.PI, 0]} />
        </group>
      ))}
    </group>
  );
}

export function Cadeira({ position, cor }: { position: [number, number, number]; cor: string }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.03, 0.03, 0.3, 8)} material={mat(COR.metal, { metal: 0.3, rough: 0.5 })} position={[0, 0.2, 0]} />
      <mesh geometry={cilindro(0.22, 0.22, 0.03, 12)} material={mat(COR.grafite)} position={[0, 0.06, 0]} />
      <mesh geometry={caixa(0.42, 0.07, 0.42)} material={mat(cor, { rough: 0.7 })} position={[0, 0.38, 0]} castShadow />
      <mesh geometry={caixa(0.4, 0.42, 0.06)} material={mat(cor, { rough: 0.7 })} position={[0, 0.62, -0.19]} castShadow />
    </group>
  );
}

// ---------- impressora ----------
export function Impressora({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(0.6, 0.72, 0.5)} material={mat("#EDEDED")} position={[0, 0.36, 0]} castShadow />
      <mesh geometry={caixa(0.55, 0.3, 0.45)} material={mat("#D4D6DA")} position={[0, 0.87, 0]} castShadow />
      <mesh geometry={caixa(0.4, 0.02, 0.3)} material={mat(COR.grafite)} position={[0, 1.03, 0]} />
      <mesh geometry={caixa(0.14, 0.04, 0.1)} material={mat("#777")} position={[0.15, 1.03, 0.14]} />
    </group>
  );
}
// Impressora imprimindo (setor com alguém trabalhando): luz verde + folha saindo
export function ImpressoraAtiva({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const papel = useRef<THREE.Mesh>(null);
  useFrame((st) => { if (papel.current) papel.current.position.z = 0.22 + ((st.clock.elapsedTime * 0.35) % 0.3); });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(0.145, 0.045, 0.105)} material={mat("#4CAF50", { emissive: "#4CAF50", ei: 1 })} position={[0.15, 1.032, 0.14]} />
      <mesh ref={papel} geometry={caixa(0.3, 0.004, 0.3)} material={mat("#FFFFFF")} position={[0, 0.74, 0.22]} />
    </group>
  );
}

export function Fax({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(0.42, 0.12, 0.3)} material={mat("#E3E3E0")} position={[0, 0.06, 0]} castShadow />
      <mesh geometry={caixa(0.3, 0.1, 0.1)} material={mat("#C9CBCF")} position={[0, 0.15, -0.08]} />
      <mesh geometry={caixa(0.09, 0.04, 0.2)} material={mat(COR.grafite)} position={[-0.16, 0.13, 0.03]} />
      <mesh geometry={caixa(0.3, 0.003, 0.24)} material={mat("#FFFFFF")} position={[0.03, 0.125, 0.16]} rotation={[-0.35, 0, 0]} />
    </group>
  );
}

export function Telefone({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={caixa(0.2, 0.06, 0.16)} material={mat("#2E3238")} position={[0, 0.03, 0]} />
      <mesh geometry={caixa(0.05, 0.04, 0.2)} material={mat("#2E3238")} position={[-0.09, 0.08, 0]} />
    </group>
  );
}

export function Planta({ position, pequena }: { position: [number, number, number]; pequena?: boolean }) {
  const s = pequena ? 0.35 : 1;
  return (
    <group position={position} scale={s}>
      <mesh geometry={cilindro(0.18, 0.14, 0.3, 12)} material={mat(COR.vaso)} position={[0, 0.15, 0]} castShadow />
      <mesh geometry={esfera(0.3, 12)} material={mat(COR.planta)} position={[0, 0.5, 0]} scale={[1, 1.2, 1]} castShadow />
      <mesh geometry={esfera(0.22, 10)} material={mat("#58B06A")} position={[0.15, 0.7, 0.1]} />
      <mesh geometry={esfera(0.2, 10)} material={mat("#2F8A4C")} position={[-0.18, 0.62, -0.08]} />
    </group>
  );
}

export function Sofa({ position, rotation = 0, cor, largura = 1.8 }: { position: [number, number, number]; rotation?: number; cor: string; largura?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(largura, 0.4, 0.8)} material={mat(cor, { rough: 0.9 })} position={[0, 0.2, 0]} castShadow receiveShadow />
      <mesh geometry={caixa(largura, 0.45, 0.22)} material={mat(cor, { rough: 0.9 })} position={[0, 0.55, -0.3]} castShadow />
      {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.2, 0.3, 0.8)} material={mat(cor, { rough: 0.9 })} position={[s * (largura / 2 - 0.1), 0.52, 0]} />)}
    </group>
  );
}

export function Puff({ position, cor, r = 0.32 }: { position: [number, number, number]; cor: string; r?: number }) {
  return <mesh geometry={cilindro(r, r * 1.05, 0.4, 14)} material={mat(cor, { rough: 0.95 })} position={[position[0], 0.2, position[2]]} castShadow receiveShadow />;
}

export function MesaBaixa({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.45, 0.45, 0.04, 20)} material={mat(COR.branco, { rough: 0.5 })} position={[0, 0.4, 0]} castShadow />
      <mesh geometry={cilindro(0.04, 0.04, 0.38, 8)} material={mat(COR.metal, { metal: 0.3 })} position={[0, 0.2, 0]} />
    </group>
  );
}

// Mesa redonda de reunião (fica na sala do CEO) com 6 cadeiras coloridas
export function MesaReuniao({ position, raio = 1.1, raioCadeiras = 1.55 }: { position: [number, number, number]; raio?: number; raioCadeiras?: number }) {
  const cores = ["#FF5252", "#FFD600", "#40C4FF", "#69F0AE", "#B388FF", "#FFAB40"];
  return (
    <group position={position}>
      <mesh geometry={cilindro(raio, raio, 0.06, 28)} material={mat(COR.madeira, { rough: 0.5 })} position={[0, 0.74, 0]} castShadow receiveShadow />
      <mesh geometry={cilindro(0.12, 0.3, 0.72, 12)} material={mat(COR.grafite)} position={[0, 0.36, 0]} />
      {cores.map((c, i) => {
        const a = (i / cores.length) * Math.PI * 2;
        // a cadeira olha pro centro da mesa
        return <group key={i} position={[Math.cos(a) * raioCadeiras, 0, Math.sin(a) * raioCadeiras]} rotation={[0, Math.atan2(-Math.cos(a), -Math.sin(a)), 0]}><Cadeira position={[0, 0, 0]} cor={c} /></group>;
      })}
    </group>
  );
}

// Cantinho do café: balcão baixo, máquina, xícaras e frutas
export function Cafe({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(1.6, 0.9, 0.55)} material={mat("#3CB371", { rough: 0.6 })} position={[0, 0.45, 0]} castShadow />
      <mesh geometry={caixa(1.7, 0.06, 0.62)} material={mat("#F2F2EE", { rough: 0.4 })} position={[0, 0.93, 0]} />
      <mesh geometry={caixa(0.38, 0.48, 0.36)} material={mat("#2E3238", { rough: 0.4 })} position={[-0.4, 1.2, -0.04]} />
      <mesh geometry={cilindro(0.05, 0.04, 0.08, 10)} material={mat("#FFFFFF")} position={[-0.4, 1.0, 0.1]} />
      <mesh geometry={cilindro(0.05, 0.04, 0.08, 10)} material={mat("#FFFFFF")} position={[0.1, 1.0, 0.08]} />
      <mesh geometry={esfera(0.08, 10)} material={mat("#FF7043")} position={[0.45, 1.03, 0]} />
      <mesh geometry={esfera(0.07, 10)} material={mat("#8BC34A")} position={[0.6, 1.02, -0.06]} />
    </group>
  );
}

// Balcão da recepção (a cadeira da recepcionista fica atrás, 0,62 m, igual às mesas)
export function Balcao({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Cadeira position={[0, 0, -0.62]} cor="#4A4F58" />
      <mesh geometry={caixa(3.0, 1.05, 0.7)} material={mat(COR.madeira, { rough: 0.5 })} position={[0, 0.52, 0]} castShadow />
      <mesh geometry={caixa(3.1, 0.06, 0.8)} material={mat(COR.branco, { rough: 0.4 })} position={[0, 1.08, 0]} />
      <Fax position={[-1.0, 1.11, 0]} rotation={0.2} />
      <Telefone position={[0.3, 1.11, 0.05]} />
      <mesh geometry={caixa(0.5, 0.35, 0.03)} material={mat(COR.grafite)} position={[1.0, 1.3, -0.1]} />
      <mesh geometry={caixa(0.46, 0.31, 0.01)} material={mat("#DCEBFF", { emissive: "#7FB4FF", ei: 0.8 })} position={[1.0, 1.3, -0.08]} />
    </group>
  );
}

// Sirene de aprovação do dono: só brilho (sem luz pontual, que pesa em todos os materiais da cena)
export function Sirene({ ligada, position }: { ligada: boolean; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null);
  const halo = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const matLuz = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E53935", emissive: "#FF1744", emissiveIntensity: 0, transparent: true, opacity: 0.9 }), []);
  const matHalo = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FF1744", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  useFrame((st) => {
    const on = ligada ? 0.5 + Math.abs(Math.sin(st.clock.elapsedTime * 8)) : 0;
    if (ref.current) ref.current.material.emissiveIntensity = on * 2;
    if (halo.current) { halo.current.material.opacity = on * 0.35; halo.current.visible = ligada; }
  });
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.22, 0.26, 0.1, 16)} material={mat(COR.grafite)} position={[0, 0.05, 0]} />
      <mesh ref={ref} geometry={cilindro(0.12, 0.17, 0.3, 16)} material={matLuz} position={[0, 0.25, 0]} />
      <mesh ref={halo} geometry={esfera(0.5, 12)} material={matHalo} position={[0, 0.3, 0]} visible={false} />
    </group>
  );
}

export function Quadro({ position, rotation = 0, largura = 2, cor = "#FFFFFF" }: { position: [number, number, number]; rotation?: number; largura?: number; cor?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={plano(largura, 1.1)} material={mat(cor, { rough: 0.4 })} />
      {[0, 1, 2].map((i) => <mesh key={i} geometry={caixa(largura * (0.3 + (i % 2) * 0.25), 0.03, 0.005)} material={mat(["#4F7DF3", "#EC6B8D", "#22A86B"][i])} position={[-largura * 0.2 + i * 0.15, 0.3 - i * 0.22, 0.004]} />)}
    </group>
  );
}

// =====================================================================================================================
// Decoração (17/11/2026, pedido do dono: "essa empresa precisa ficar mais bonita, precisa de mais decoração e móveis").
// Tudo estático (vai pro <Estatico>): estante, tapete, poltrona, luminária de chão, mesa lateral com abajur, bebedouro,
// quadro de arte, painel com a logo, ficus, floreira, mesa alta com banquetas, gaveteiro e lousa. Poucos triângulos e os
// materiais de geo.ts; as cúpulas das luminárias dividem um material só que acende mais à noite (LuzDasLuminarias).
// =====================================================================================================================
type V3 = [number, number, number];

// cúpula das luminárias e do abajur: um material só para todas, atualizado num único useFrame
let matCupula: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | null = null;
function cupula() {
  if (!matCupula) {
    const comum = { color: "#FFF3DC", emissive: "#FFC56B", emissiveIntensity: 0.35 };
    matCupula = leve() ? new THREE.MeshLambertMaterial(comum) : new THREE.MeshStandardMaterial({ ...comum, roughness: 0.85 });
  }
  return matCupula;
}
// de dia uma luz suave; à noite (ou com a luz por dentro acesa à noite) brilha de verdade
export function LuzDasLuminarias() {
  useFrame(() => { cupula().emissiveIntensity = 0.3 + 1.6 * ceu.noite * (0.6 + 0.4 * luzInterna.k); });
  return null;
}

// tapete com cantos arredondados (forma em cache por tamanho)
const formas = new Map<string, THREE.ShapeGeometry>();
function retanguloArredondado(w: number, d: number, r: number) {
  const k = `${w.toFixed(2)},${d.toFixed(2)},${r}`; let g = formas.get(k);
  if (!g) {
    const x = -w / 2, y = -d / 2, sh = new THREE.Shape();
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    g = new THREE.ShapeGeometry(sh, 3); formas.set(k, g);
  }
  return g;
}
export function Tapete({ position, largura, profundidade, cor, borda, altura = 0.125 }: { position: [number, number]; largura: number; profundidade: number; cor: string; borda?: string; altura?: number }) {
  const r = Math.min(0.35, largura / 6, profundidade / 6);
  return (
    <group position={[position[0], altura, position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      {borda && <mesh geometry={retanguloArredondado(largura, profundidade, r)} material={mat(borda, { rough: 1 })} receiveShadow />}
      <mesh geometry={retanguloArredondado(borda ? largura - 0.24 : largura, borda ? profundidade - 0.24 : profundidade, Math.max(0.05, r - 0.08))} material={mat(cor, { rough: 1 })} position={[0, 0, 0.004]} receiveShadow />
    </group>
  );
}

// estante com livros (a frente olha para +z local)
const CORES_LIVRO = ["#C0392B", "#2E86C1", "#F4D03F", "#27AE60", "#8E44AD", "#E67E22", "#ECF0F1", "#34495E", "#D35400", "#16A085"];
export function Estante({ position, rotation = 0, largura = 1.3, altura = 1.7, madeira = COR.madeiraEscura }: { position: V3; rotation?: number; largura?: number; altura?: number; madeira?: string }) {
  const prof = 0.34, prateleiras = 4, vao = (altura - 0.08) / prateleiras;
  const livros = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const semente = Math.abs(Math.round(position[0] * 7 + position[2] * 13));
    const porPrat = leve() ? 4 : 8;
    for (let p = 0; p < prateleiras; p++) {
      let x = -largura / 2 + 0.07;
      for (let k = 0; k < porPrat && x < largura / 2 - 0.12; k++) {
        const n = (semente + p * 31 + k * 17) % 97;
        const w = 0.05 + (n % 4) * 0.018, h = vao * (0.55 + (n % 5) * 0.07);
        if (n % 9 === 0) { x += 0.1; continue; } // um vão de vez em quando
        out.push({ x: x + w / 2, y: 0.06 + p * vao + h / 2, w, h, c: CORES_LIVRO[n % CORES_LIVRO.length] });
        x += w + 0.008;
      }
    }
    return out;
  }, [position, largura, vao]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1, 1].map((sx) => <mesh key={sx} geometry={caixa(0.04, altura, prof)} material={mat(madeira, { rough: 0.7 })} position={[sx * (largura / 2 - 0.02), altura / 2, 0]} castShadow />)}
      <mesh geometry={caixa(largura, altura, 0.02)} material={mat(madeira, { rough: 0.8 })} position={[0, altura / 2, -prof / 2 + 0.01]} />
      {Array.from({ length: prateleiras + 1 }, (_, p) => <mesh key={p} geometry={caixa(largura - 0.04, 0.035, prof)} material={mat(madeira, { rough: 0.7 })} position={[0, 0.02 + p * vao, 0]} />)}
      {livros.map((l, i) => <mesh key={i} geometry={caixa(+l.w.toFixed(3), +l.h.toFixed(3), prof * 0.78)} material={mat(l.c, { rough: 0.8 })} position={[l.x, l.y, 0.01]} />)}
    </group>
  );
}

// poltrona (o assento olha para +z local)
export function Poltrona({ position, rotation = 0, cor }: { position: V3; rotation?: number; cor: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[[-0.3, -0.26], [0.3, -0.26], [-0.3, 0.26], [0.3, 0.26]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.025, 0.02, 0.14, 6)} material={mat(COR.madeiraEscura)} position={[x, 0.07, z]} />)}
      <mesh geometry={caixa(0.78, 0.2, 0.7)} material={mat(cor, { rough: 0.95 })} position={[0, 0.24, 0]} castShadow receiveShadow />
      <mesh geometry={caixa(0.62, 0.12, 0.55)} material={mat(cor, { rough: 0.95 })} position={[0, 0.39, 0.05]} />
      <mesh geometry={caixa(0.78, 0.5, 0.16)} material={mat(cor, { rough: 0.95 })} position={[0, 0.55, -0.28]} castShadow />
      {[-1, 1].map((sx) => <mesh key={sx} geometry={caixa(0.12, 0.3, 0.66)} material={mat(cor, { rough: 0.95 })} position={[sx * 0.36, 0.45, 0]} />)}
    </group>
  );
}

// luminária de chão: base, haste e cúpula que acende
export function LuminariaChao({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.16, 0.18, 0.04, 14)} material={mat(COR.grafite, { metal: 0.4, rough: 0.4 })} position={[0, 0.02, 0]} />
      <mesh geometry={cilindro(0.015, 0.015, 1.45, 6)} material={mat(COR.grafite, { metal: 0.4, rough: 0.4 })} position={[0, 0.74, 0]} />
      <mesh geometry={cilindro(0.17, 0.25, 0.3, 14)} material={cupula()} position={[0, 1.5, 0]} />
    </group>
  );
}

// mesa lateral redonda, com abajur
export function MesaLateral({ position, abajur = true }: { position: V3; abajur?: boolean }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.24, 0.24, 0.03, 16)} material={mat(COR.madeira, { rough: 0.5 })} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={cilindro(0.025, 0.025, 0.54, 6)} material={mat(COR.grafite)} position={[0, 0.27, 0]} />
      <mesh geometry={cilindro(0.14, 0.14, 0.02, 12)} material={mat(COR.grafite)} position={[0, 0.01, 0]} />
      {abajur && (
        <>
          <mesh geometry={esfera(0.07, 8)} material={mat("#D9C4A3", { rough: 0.4 })} position={[0, 0.62, 0]} />
          <mesh geometry={cilindro(0.012, 0.012, 0.18, 6)} material={mat(COR.grafite)} position={[0, 0.74, 0]} />
          <mesh geometry={cilindro(0.09, 0.13, 0.16, 12)} material={cupula()} position={[0, 0.88, 0]} />
        </>
      )}
    </group>
  );
}

// bebedouro com galão
export function Bebedouro({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(0.34, 0.95, 0.34)} material={mat("#F2F4F7", { rough: 0.5 })} position={[0, 0.475, 0]} castShadow />
      <mesh geometry={caixa(0.2, 0.05, 0.02)} material={mat(COR.grafite)} position={[0, 0.78, 0.17]} />
      {[-0.05, 0.05].map((x) => <mesh key={x} geometry={caixa(0.03, 0.04, 0.04)} material={mat(x < 0 ? "#2E86C1" : "#C0392B")} position={[x, 0.72, 0.18]} />)}
      <mesh geometry={cilindro(0.15, 0.15, 0.36, 14)} material={mat("#7FC1EA", { rough: 0.25 })} position={[0, 1.13, 0]} />
      <mesh geometry={cilindro(0.06, 0.15, 0.06, 14)} material={mat("#7FC1EA", { rough: 0.25 })} position={[0, 1.34, 0]} />
    </group>
  );
}

// quadro de arte abstrata (moldura fina, tela clara e 3 formas de cor); a tela olha para +z local
const PALETAS_ARTE = [["#E76F51", "#2A9D8F", "#E9C46A"], ["#264653", "#F4A261", "#E76F51"], ["#6D597A", "#B56576", "#EAAC8B"], ["#1D3557", "#E63946", "#A8DADC"], ["#3A86FF", "#FFBE0B", "#FB5607"]];
export function QuadroArte({ position, rotation = 0, largura = 0.9, altura = 0.62, paleta = 0 }: { position: V3; rotation?: number; largura?: number; altura?: number; paleta?: number }) {
  const [a, b, c] = PALETAS_ARTE[Math.abs(paleta) % PALETAS_ARTE.length];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(largura + 0.06, altura + 0.06, 0.03)} material={mat("#2B2F36", { rough: 0.6 })} />
      <mesh geometry={plano(largura, altura)} material={mat("#F6F1E7", { rough: 0.9 })} position={[0, 0, 0.017]} />
      <mesh geometry={circulo(altura * 0.28, 18)} material={mat(a, { rough: 0.9 })} position={[-largura * 0.18, altura * 0.08, 0.019]} />
      <mesh geometry={plano(largura * 0.42, altura * 0.34)} material={mat(b, { rough: 0.9 })} position={[largura * 0.16, -altura * 0.16, 0.021]} />
      <mesh geometry={plano(largura * 0.08, altura * 0.7)} material={mat(c, { rough: 0.9 })} position={[largura * 0.34, altura * 0.05, 0.022]} />
    </group>
  );
}

// painel com a logo da empresa (a textura é carregada uma vez por endereço); sem logo, painel na cor da marca com faixas
const texturasLogo = new Map<string, THREE.MeshBasicMaterial>();
function materialLogo(url: string) {
  let m = texturasLogo.get(url);
  if (!m) {
    const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }); texturasLogo.set(url, m);
  }
  return m;
}
export function PainelLogo({ position, rotation = 0, largura = 1.6, altura = 1.5, cor, fundo = "#1F2630", logo, moldura = "#D4A63A", pe = true }: { position: V3; rotation?: number; largura?: number; altura?: number; cor: string; fundo?: string; logo: string | null; moldura?: string; pe?: boolean }) {
  const lado = Math.min(largura, altura) * 0.66;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {pe && <mesh geometry={caixa(largura * 0.7, 0.08, 0.4)} material={mat(COR.grafite)} position={[0, 0.04, 0]} />}
      <mesh geometry={caixa(largura, altura, 0.12)} material={mat(fundo, { rough: 0.6 })} position={[0, (pe ? 0.08 : 0) + altura / 2, 0]} castShadow />
      {/* moldura dourada fina na frente */}
      {[-1, 1].map((sy) => <mesh key={sy} geometry={caixa(largura, 0.04, 0.02)} material={mat(moldura, { rough: 0.35, metal: 0.6 })} position={[0, (pe ? 0.08 : 0) + altura / 2 + sy * (altura / 2 - 0.02), 0.07]} />)}
      {[-1, 1].map((sx) => <mesh key={sx} geometry={caixa(0.04, altura, 0.02)} material={mat(moldura, { rough: 0.35, metal: 0.6 })} position={[sx * (largura / 2 - 0.02), (pe ? 0.08 : 0) + altura / 2, 0.07]} />)}
      {logo
        ? <mesh geometry={plano(lado, lado)} material={materialLogo(logo)} position={[0, (pe ? 0.08 : 0) + altura / 2 + 0.03, 0.065]} />
        : [0.18, 0, -0.18].map((dy, i) => <mesh key={i} geometry={caixa(largura * (0.62 - i * 0.12), 0.07, 0.02)} material={mat(cor, { emissive: cor, ei: 0.25 })} position={[0, (pe ? 0.08 : 0) + altura / 2 + dy, 0.07]} />)}
    </group>
  );
}

// vaso grande com árvore (ficus)
export function Ficus({ position, escala = 1 }: { position: V3; escala?: number }) {
  const seg = leve() ? 7 : 9;
  return (
    <group position={position} scale={escala}>
      <mesh geometry={cilindro(0.26, 0.2, 0.46, 12)} material={mat("#3A3F47", { rough: 0.6 })} position={[0, 0.23, 0]} castShadow />
      <mesh geometry={cilindro(0.24, 0.24, 0.03, 12)} material={mat("#5B4632")} position={[0, 0.45, 0]} />
      <mesh geometry={cilindro(0.03, 0.045, 0.9, 6)} material={mat("#6B4A2F")} position={[0, 0.9, 0]} />
      <mesh geometry={esfera(0.38, seg)} material={mat("#2F7D46")} position={[0, 1.55, 0]} scale={[1, 1.15, 1]} castShadow />
      <mesh geometry={esfera(0.28, seg)} material={mat("#3E9B5B")} position={[0.24, 1.35, 0.1]} castShadow />
      <mesh geometry={esfera(0.26, seg)} material={mat("#256B3B")} position={[-0.22, 1.3, -0.08]} />
      <mesh geometry={esfera(0.22, seg)} material={mat("#58B06A")} position={[0.05, 1.86, 0.08]} />
    </group>
  );
}

// floreira comprida (divisória de plantas), ao longo do x local
export function Floreira({ position, rotation = 0, comprimento = 2.2, flores = true }: { position: V3; rotation?: number; comprimento?: number; flores?: boolean }) {
  const n = Math.max(2, Math.round(comprimento / 0.45));
  const cores = ["#F25F5C", "#FFE066", "#F7A1C4", "#FFFFFF"];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(comprimento, 0.42, 0.34)} material={mat("#8C7A66", { rough: 0.9 })} position={[0, 0.21, 0]} castShadow />
      <mesh geometry={caixa(comprimento - 0.06, 0.03, 0.28)} material={mat("#4E3B2A")} position={[0, 0.42, 0]} />
      {Array.from({ length: n }, (_, i) => {
        const x = -comprimento / 2 + (i + 0.5) * (comprimento / n);
        return <mesh key={i} geometry={esfera(0.2, 7)} material={mat(i % 2 ? "#3E9B5B" : "#2F7D46")} position={[x, 0.55 + (i % 3) * 0.04, 0]} scale={[1, 0.8, 0.8]} />;
      })}
      {flores && Array.from({ length: n }, (_, i) => <mesh key={`f${i}`} geometry={esfera(0.05, 6)} material={mat(cores[i % cores.length])} position={[-comprimento / 2 + (i + 0.3) * (comprimento / n), 0.72, (i % 2 ? 0.06 : -0.05)]} />)}
    </group>
  );
}

// mesa alta redonda com banquetas
// lugares: onde ficam as banquetas, em relação ao centro da mesa (x, z)
export function MesaAlta({ position, lugares = [[-0.6, 0.12], [0.6, 0.12]] }: { position: V3; lugares?: [number, number][] }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.36, 0.36, 0.04, 18)} material={mat(COR.madeira, { rough: 0.45 })} position={[0, 1.05, 0]} castShadow />
      <mesh geometry={cilindro(0.04, 0.04, 1.03, 8)} material={mat(COR.grafite, { metal: 0.4 })} position={[0, 0.52, 0]} />
      <mesh geometry={cilindro(0.22, 0.24, 0.03, 14)} material={mat(COR.grafite)} position={[0, 0.015, 0]} />
      {lugares.map(([x, z], i) => {
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh geometry={cilindro(0.17, 0.17, 0.06, 12)} material={mat("#2B2F36", { rough: 0.7 })} position={[0, 0.76, 0]} />
            <mesh geometry={cilindro(0.025, 0.025, 0.74, 6)} material={mat(COR.metal, { metal: 0.4 })} position={[0, 0.37, 0]} />
            <mesh geometry={cilindro(0.15, 0.15, 0.02, 10)} material={mat(COR.metal, { metal: 0.4 })} position={[0, 0.32, 0]} />
          </group>
        );
      })}
    </group>
  );
}

// gaveteiro / armário baixo (a frente olha para +z local)
export function Gaveteiro({ position, rotation = 0, largura = 1.1, madeira = "#E7E2D8" }: { position: V3; rotation?: number; largura?: number; madeira?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(largura, 0.72, 0.45)} material={mat(madeira, { rough: 0.6 })} position={[0, 0.36, 0]} castShadow receiveShadow />
      {[0.18, 0.4, 0.62].map((y) => <mesh key={y} geometry={caixa(largura - 0.08, 0.008, 0.01)} material={mat("#8F877A")} position={[0, y, 0.226]} />)}
      {[0.29, 0.51].map((y) => <mesh key={y} geometry={caixa(0.18, 0.025, 0.02)} material={mat(COR.grafite, { metal: 0.5 })} position={[0, y, 0.235]} />)}
      <mesh geometry={esfera(0.07, 8)} material={mat("#3E9B5B")} position={[largura * 0.32, 0.79, 0]} />
      <mesh geometry={cilindro(0.05, 0.04, 0.08, 8)} material={mat(COR.vaso)} position={[largura * 0.32, 0.74, 0]} />
    </group>
  );
}

// lousa branca num suporte com rodinhas, com rabiscos coloridos (a face olha para +z local)
export function Lousa({ position, rotation = 0, largura = 1.3 }: { position: V3; rotation?: number; largura?: number }) {
  const rabiscos: [number, number, number, number, string][] = [[-0.3, 0.25, 0.5, 0.05, "#2E86C1"], [0.1, 0.12, 0.7, -0.08, "#C0392B"], [-0.15, -0.05, 0.6, 0.02, "#27AE60"], [0.25, -0.2, 0.35, 0.12, "#2B2F36"], [-0.35, -0.22, 0.25, -0.1, "#2E86C1"]];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1, 1].map((sx) => <mesh key={sx} geometry={cilindro(0.02, 0.02, 1.5, 6)} material={mat(COR.metal, { metal: 0.5 })} position={[sx * (largura / 2 + 0.02), 0.75, 0]} />)}
      {[-1, 1].map((sx) => <mesh key={`p${sx}`} geometry={caixa(0.06, 0.03, 0.5)} material={mat(COR.grafite)} position={[sx * (largura / 2 + 0.02), 0.04, 0]} />)}
      <mesh geometry={caixa(largura, 0.85, 0.04)} material={mat("#C9CED6", { metal: 0.3, rough: 0.4 })} position={[0, 1.08, 0]} castShadow />
      <mesh geometry={plano(largura - 0.06, 0.79)} material={mat("#FBFBF9", { rough: 0.3 })} position={[0, 1.08, 0.022]} />
      {rabiscos.map(([x, y, w, r, c], i) => <mesh key={i} geometry={caixa(w * largura * 0.6, 0.018, 0.004)} material={mat(c)} position={[x * largura * 0.8, 1.08 + y, 0.026]} rotation={[0, 0, r]} />)}
      <mesh geometry={caixa(largura * 0.6, 0.03, 0.08)} material={mat(COR.metal, { metal: 0.4 })} position={[0, 0.64, 0.05]} />
    </group>
  );
}
