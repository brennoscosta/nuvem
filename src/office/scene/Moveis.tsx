"use client";
// Móveis e equipamentos desenhados em código: mesa com computador, impressora, fax, smartphone, sofás, puffs,
// sinuca, fliperama, copa, elevador... Tudo leve e reaproveitando geometria/material.
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, COR } from "./geo";
import type { Mesa as MesaDef } from "../data/layout";

export function Mesa({ def, ligada, cor }: { def: MesaDef; ligada: boolean; cor: string }) {
  const grande = def.tipo !== "comum";
  const w = grande ? 1.9 : 1.5, d = grande ? 0.9 : 0.75;
  const tampo = def.tipo === "ceo" || def.tipo === "diretor" ? COR.madeiraEscura : COR.branco;
  return (
    <group position={def.pos} rotation={[0, def.rot, 0]}>
      {/* tampo e pés */}
      <mesh geometry={caixa(w, 0.05, d)} material={mat(tampo, { rough: 0.6 })} position={[0, 0.72, 0]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={caixa(0.06, 0.7, d - 0.1)} material={mat(COR.metal, { metal: 0.3, rough: 0.5 })} position={[s * (w / 2 - 0.08), 0.35, 0]} />
      ))}
      {/* monitor: olha pra cadeira (-z local) */}
      <group position={[0, 0.745, 0.08]}>
        <mesh geometry={caixa(0.3, 0.02, 0.18)} material={mat(COR.grafite)} position={[0, 0.01, 0]} />
        <mesh geometry={cilindro(0.025, 0.025, 0.14, 8)} material={mat(COR.grafite)} position={[0, 0.08, 0]} />
        <mesh geometry={caixa(0.62, 0.38, 0.03)} material={mat(COR.grafite)} position={[0, 0.33, 0]} castShadow />
        <mesh geometry={caixa(0.58, 0.34, 0.005)} material={ligada ? mat("#DCEBFF", { emissive: "#7FB4FF", ei: 1.2 }) : mat(COR.tela)} position={[0, 0.33, -0.018]} />
        {ligada && <Codigo />}
      </group>
      {/* teclado e mouse */}
      <mesh geometry={caixa(0.42, 0.02, 0.14)} material={mat("#E8EAED")} position={[0, 0.755, -0.2]} />
      <mesh geometry={caixa(0.06, 0.025, 0.09)} material={mat("#E8EAED")} position={[0.32, 0.755, -0.2]} />
      {/* smartphone */}
      <mesh geometry={caixa(0.07, 0.01, 0.14)} material={mat(COR.preto, { rough: 0.3 })} position={[-0.45, 0.75, -0.12]} rotation={[0, 0.3, 0]} />
      <mesh geometry={caixa(0.06, 0.004, 0.125)} material={ligada ? mat("#2E86F2", { emissive: "#2E86F2", ei: 0.8 }) : mat("#0B0F17")} position={[-0.45, 0.757, -0.12]} rotation={[0, 0.3, 0]} />
      {/* caneca e planta */}
      <mesh geometry={cilindro(0.04, 0.035, 0.09, 12)} material={mat(cor, { rough: 0.5 })} position={[0.55, 0.79, 0.05]} />
      {grande && <Planta pequena position={[-0.75, 0.745, 0.2]} />}
      {/* cadeira */}
      <Cadeira position={[0, 0, -0.62]} cor={def.tipo === "ceo" ? "#2B2E35" : def.tipo === "comum" ? cor : "#4A4F58"} />
    </group>
  );
}

// "código" rolando na tela
function Codigo() {
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => { if (ref.current) ref.current.position.y = 0.2 + ((st.clock.elapsedTime * 0.08) % 0.16); });
  return (
    <group ref={ref} position={[0, 0.2, -0.022]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={caixa(0.12 + ((i * 7) % 3) * 0.08, 0.012, 0.002)} material={mat("#4C7BD9", { emissive: "#4C7BD9", ei: 0.6 })} position={[-0.2 + ((i * 5) % 4) * 0.04, i * 0.04, 0]} />
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

export function Impressora({ position, rotation = 0, ativa }: { position: [number, number, number]; rotation?: number; ativa: boolean }) {
  const papel = useRef<THREE.Mesh>(null);
  useFrame((st) => { if (papel.current) papel.current.position.z = 0.22 + (ativa ? ((st.clock.elapsedTime * 0.35) % 0.3) : 0); });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(0.6, 0.72, 0.5)} material={mat("#EDEDED")} position={[0, 0.36, 0]} castShadow />
      <mesh geometry={caixa(0.55, 0.3, 0.45)} material={mat("#D4D6DA")} position={[0, 0.87, 0]} castShadow />
      <mesh geometry={caixa(0.4, 0.02, 0.3)} material={mat(COR.grafite)} position={[0, 1.03, 0]} />
      <mesh geometry={caixa(0.14, 0.04, 0.1)} material={mat(ativa ? "#4CAF50" : "#777", { emissive: ativa ? "#4CAF50" : "#000", ei: ativa ? 1 : 0 })} position={[0.15, 1.03, 0.14]} />
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
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} geometry={caixa(0.03, 0.01, 0.03)} material={mat("#9BA0A8")} position={[-0.05 + (i % 3) * 0.045, 0.125, -0.02 + Math.floor(i / 3) * 0.04]} />
      ))}
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

export function Sinuca({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(2.3, 0.2, 1.3)} material={mat(COR.madeiraEscura, { rough: 0.6 })} position={[0, 0.78, 0]} castShadow />
      <mesh geometry={caixa(2.05, 0.03, 1.05)} material={mat("#1E8E4E", { rough: 1 })} position={[0, 0.89, 0]} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} geometry={caixa(0.16, 0.76, 0.16)} material={mat(COR.madeiraEscura)} position={[x * 1.0, 0.38, z * 0.5]} />
      ))}
      {["#FFFFFF", "#E53935", "#FDD835", "#1E88E5", "#8E24AA", "#FB8C00", "#111111"].map((c, i) => (
        <mesh key={c} geometry={esfera(0.045, 10)} material={mat(c, { rough: 0.3 })} position={[-0.6 + i * 0.18 + (i % 2) * 0.05, 0.95, (i % 3) * 0.15 - 0.15]} />
      ))}
      <mesh geometry={cilindro(0.012, 0.02, 1.4, 6)} material={mat("#C9A063")} position={[0.4, 0.93, 0.3]} rotation={[0, 0.4, Math.PI / 2]} />
    </group>
  );
}

export function Fliperama({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const tela = useRef<THREE.Mesh>(null);
  useFrame((st) => { if (tela.current) (tela.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(st.clock.elapsedTime * 6) * 0.25; });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(0.8, 1.9, 0.8)} material={mat("#2962FF", { rough: 0.5 })} position={[0, 0.95, 0]} castShadow />
      <mesh geometry={caixa(0.82, 0.35, 0.5)} material={mat("#E91E63", { rough: 0.5 })} position={[0, 1.7, 0.2]} />
      <mesh ref={tela} geometry={caixa(0.6, 0.45, 0.02)} material={new THREE.MeshStandardMaterial({ color: "#1B1B1B", emissive: "#2BD2FF", emissiveIntensity: 1 })} position={[0, 1.3, 0.41]} rotation={[-0.25, 0, 0]} />
      <mesh geometry={caixa(0.78, 0.08, 0.5)} material={mat("#111")} position={[0, 1.02, 0.35]} />
      <mesh geometry={esfera(0.03, 8)} material={mat("#F44336", { rough: 0.3 })} position={[-0.2, 1.1, 0.5]} />
      <mesh geometry={esfera(0.03, 8)} material={mat("#FFEB3B", { rough: 0.3 })} position={[0.1, 1.08, 0.5]} />
      <mesh geometry={esfera(0.03, 8)} material={mat("#4CAF50", { rough: 0.3 })} position={[0.22, 1.08, 0.5]} />
    </group>
  );
}

export function Copa() {
  // balcão verde em L, geladeira, máquina de café, mesa com banquetas
  return (
    <group>
      <mesh geometry={caixa(3.6, 0.9, 0.7)} material={mat("#3CB371", { rough: 0.6 })} position={[8.5, 0.45, 8.5]} castShadow />
      <mesh geometry={caixa(3.7, 0.06, 0.8)} material={mat("#F2F2EE", { rough: 0.4 })} position={[8.5, 0.93, 8.5]} />
      <mesh geometry={caixa(0.9, 1.9, 0.8)} material={mat("#E8E8E8", { rough: 0.4, metal: 0.1 })} position={[6.7, 0.95, 8.4]} castShadow />
      <mesh geometry={caixa(0.85, 0.02, 0.02)} material={mat(COR.metal)} position={[6.7, 1.2, 8.0]} />
      {/* máquina de café */}
      <mesh geometry={caixa(0.4, 0.5, 0.4)} material={mat("#2E3238", { rough: 0.4 })} position={[9.6, 1.21, 8.5]} />
      <mesh geometry={cilindro(0.05, 0.04, 0.08, 10)} material={mat("#FFFFFF")} position={[9.6, 1.0, 8.3]} />
      {/* frutas */}
      <mesh geometry={esfera(0.08, 10)} material={mat("#FF7043")} position={[7.6, 1.03, 8.5]} />
      <mesh geometry={esfera(0.07, 10)} material={mat("#8BC34A")} position={[7.75, 1.02, 8.4]} />
      {/* mesa alta e banquetas */}
      <mesh geometry={cilindro(0.5, 0.5, 0.05, 20)} material={mat(COR.branco, { rough: 0.5 })} position={[8.5, 1.05, 5.2]} castShadow />
      <mesh geometry={cilindro(0.05, 0.05, 1.0, 8)} material={mat(COR.metal, { metal: 0.3 })} position={[8.5, 0.5, 5.2]} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return <mesh key={i} geometry={cilindro(0.18, 0.18, 0.08, 12)} material={mat(["#FF5252", "#FFD600", "#40C4FF", "#69F0AE"][i], { rough: 0.6 })} position={[8.5 + Math.cos(a) * 0.9, 0.7, 5.2 + Math.sin(a) * 0.9]} />;
      })}
      <Planta position={[10.5, 0, 8.3]} />
    </group>
  );
}

export function MesaReuniao() {
  const cores = ["#FF5252", "#FFD600", "#40C4FF", "#69F0AE", "#B388FF", "#FFAB40"];
  return (
    <group position={[9.5, 0, -5.2]}>
      <mesh geometry={cilindro(1.4, 1.4, 0.06, 28)} material={mat(COR.madeira, { rough: 0.5 })} position={[0, 0.74, 0]} castShadow />
      <mesh geometry={cilindro(0.12, 0.3, 0.72, 12)} material={mat(COR.grafite)} position={[0, 0.36, 0]} />
      {cores.map((c, i) => {
        const a = (i / cores.length) * Math.PI * 2;
        return <Cadeira key={i} position={[Math.cos(a) * 2.0, 0, Math.sin(a) * 2.0]} cor={c} />;
      })}
      {/* TV na parede do fundo */}
      <mesh geometry={caixa(2.2, 1.25, 0.06)} material={mat(COR.preto, { rough: 0.3 })} position={[0, 1.9, -3.7]} />
      <mesh geometry={caixa(2.1, 1.15, 0.01)} material={mat("#CFE6FF", { emissive: "#7FB4FF", ei: 0.7 })} position={[0, 1.9, -3.66]} />
    </group>
  );
}

export function Elevador() {
  return (
    <group position={[-17.98, 0, -5.5]}>
      <mesh geometry={caixa(0.1, 2.4, 1.9)} material={mat("#B7BDC6", { metal: 0.6, rough: 0.3 })} position={[0, 1.2, 0]} />
      <mesh geometry={caixa(0.04, 2.2, 0.8)} material={mat("#9AA3AD", { metal: 0.7, rough: 0.25 })} position={[0.08, 1.1, -0.42]} />
      <mesh geometry={caixa(0.04, 2.2, 0.8)} material={mat("#9AA3AD", { metal: 0.7, rough: 0.25 })} position={[0.08, 1.1, 0.42]} />
      <mesh geometry={caixa(0.03, 0.12, 0.5)} material={mat("#F44336", { emissive: "#F44336", ei: 1 })} position={[0.12, 2.55, 0]} />
    </group>
  );
}

export function Balcao() {
  return (
    <group position={[-13.5, 0, -7.2]}>
      {/* cadeira da recepcionista (atrás do balcão, mesma convenção da mesa: 0,62 m atrás) */}
      <Cadeira position={[0, 0, -0.62]} cor="#4A4F58" />
      <mesh geometry={caixa(3.2, 1.05, 0.7)} material={mat(COR.madeira, { rough: 0.5 })} position={[0, 0.52, 0]} castShadow />
      <mesh geometry={caixa(3.3, 0.06, 0.8)} material={mat(COR.branco, { rough: 0.4 })} position={[0, 1.08, 0]} />
      <Fax position={[-1.1, 1.11, 0]} rotation={0.2} />
      <Telefone position={[0.3, 1.11, 0.05]} />
      <mesh geometry={caixa(0.5, 0.35, 0.03)} material={mat(COR.grafite)} position={[1.1, 1.3, -0.1]} />
      <mesh geometry={caixa(0.46, 0.31, 0.01)} material={mat("#DCEBFF", { emissive: "#7FB4FF", ei: 0.8 })} position={[1.1, 1.3, -0.08]} />
    </group>
  );
}

export function Sirene({ ligada, position }: { ligada: boolean; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const luz = useRef<THREE.PointLight>(null);
  useFrame((st) => {
    const on = ligada ? 0.5 + Math.abs(Math.sin(st.clock.elapsedTime * 8)) : 0;
    if (ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = on * 2;
    if (luz.current) luz.current.intensity = on * 20;
  });
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.22, 0.26, 0.1, 16)} material={mat(COR.grafite)} position={[0, 0.05, 0]} />
      <mesh ref={ref} geometry={cilindro(0.12, 0.17, 0.3, 16)} material={new THREE.MeshStandardMaterial({ color: "#E53935", emissive: "#FF1744", emissiveIntensity: 0, transparent: true, opacity: 0.9 })} position={[0, 0.25, 0]} />
      <pointLight ref={luz} color="#FF1744" intensity={0} distance={9} position={[0, 0.4, 0]} />
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
