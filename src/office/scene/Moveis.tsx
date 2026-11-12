"use client";
// Móveis e equipamentos desenhados em código: mesa com computador, impressora, fax, smartphone, sofá, puffs,
// mesa de reunião, café... As partes fixas vão pro <Estatico> (viram poucas malhas); as que mudam (tela acesa,
// papel saindo da impressora, sirene) ficam separadas e leves.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, COR } from "./geo";
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
