"use client";
// Quarteirão do restaurante drive-thru (40 x 40 m, a leste da Nuvem). Sem marca ainda: a empresa que comprar
// o lote coloca o nome. Prédio = modelo do Higgsfield (por fora); estacionamento, faixa do drive-thru, totem,
// mesinhas e jardim em código. Por dentro (balcão, cozinha, mesas pros funcionários) entra quando tiver equipe.
import { useMemo } from "react";
import { Balao } from "./Lotes";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, anel, COR } from "./geo";
import { ComFallback, Modelo, ModeloInstanciado } from "./Modelos";
import { Estatico } from "./Estatico";
import { Cadeira, Planta, Sofa } from "./Moveis";
import { useEscritorio } from "../store";
import { centroQuarteirao, MEIO_Q } from "../data/mundo";
import { LANCH, BALCAO_X, COZINHA_X0, FAIXA_SUL_Z, DRIVE_X1, PORTA, JANELA_DRIVE, LUGARES_LANCHONETE } from "../data/lanchonete";

const [CX, CZ] = centroQuarteirao(1, 0);
// prédio: 17,4 m de frente (olhando pro oeste, pra Nuvem) x 14,3 m de fundo; altura 8,5 m
const PREDIO = { x: CX + 6, z: CZ - 5, altura: 8.5, frente: Math.PI }; // frente do GLB é +x → gira pra -x
const ASFALTO = "#4A4E55", FAIXA = "#F2EFE6";

function Seta({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0.006, z]} rotation={[0, rot, 0]}>
      <mesh geometry={plano(0.3, 1.6)} material={mat(FAIXA)} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={cilindro(0, 0.5, 0.01, 3)} material={mat(FAIXA)} position={[0, 0, 1.0]} rotation={[0, Math.PI / 6, 0]} />
    </group>
  );
}

function Vaga({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, 0.004, z]} rotation={[0, rot, 0]}>
      {[-1.3, 1.3].map((dx) => <mesh key={dx} geometry={plano(0.12, 5)} material={mat(FAIXA)} rotation={[-Math.PI / 2, 0, 0]} position={[dx, 0, 0]} />)}
    </group>
  );
}

function Mesinha({ x, z, cor }: { x: number; z: number; cor: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={cilindro(0.5, 0.5, 0.05, 14)} material={mat("#F7F7F5")} position={[0, 0.72, 0]} castShadow />
      <mesh geometry={cilindro(0.04, 0.06, 0.72, 8)} material={mat("#3A3F47", { metal: 0.4, rough: 0.5 })} position={[0, 0.36, 0]} />
      <mesh geometry={cilindro(0.025, 0.025, 2.2, 6)} material={mat("#3A3F47")} position={[0, 1.4, 0]} />
      <mesh geometry={cilindro(0, 1.3, 0.45, 10)} material={mat(cor)} position={[0, 2.6, 0]} castShadow />
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <mesh key={a} geometry={cilindro(0.22, 0.22, 0.06, 10)} material={mat("#F7F7F5")} position={[Math.sin(a) * 0.85, 0.45, Math.cos(a) * 0.85]} />
      ))}
    </group>
  );
}

function Totem({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.4, 6.5, 0.4)} material={mat("#3A3F47", { rough: 0.6 })} position={[0, 3.25, 0]} castShadow />
      <mesh geometry={caixa(2.6, 1.8, 0.35)} material={mat("#C62828", { rough: 0.5 })} position={[0, 7.1, 0]} castShadow />
      <mesh geometry={plano(2.3, 1.45)} material={mat("#FFFFFF", { emissive: "#FFFFFF", ei: 0.35 })} position={[0, 7.1, 0.18]} />
      <mesh geometry={plano(2.3, 1.45)} material={mat("#FFFFFF", { emissive: "#FFFFFF", ei: 0.35 })} position={[0, 7.1, -0.18]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={caixa(2.6, 0.7, 0.35)} material={mat("#1F2227", { rough: 0.6 })} position={[0, 5.8, 0]} />
    </group>
  );
}

function Canteiro({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(w, 0.25, d)} material={mat("#D8D3CA", { rough: 0.9 })} position={[0, 0.12, 0]} receiveShadow />
      <mesh geometry={caixa(w - 0.3, 0.12, d - 0.3)} material={mat("#6FB15F", { rough: 1 })} position={[0, 0.28, 0]} />
      {Array.from({ length: Math.max(1, Math.round(Math.max(w, d) / 1.6)) }).map((_, i) => (
        <mesh key={i} geometry={esfera(0.42, 8)} material={mat(i % 2 ? "#3E9B5B" : "#58B06A")} position={w > d ? [-w / 2 + 0.9 + i * 1.6, 0.6, 0] : [0, 0.6, -d / 2 + 0.9 + i * 1.6]} castShadow />
      ))}
    </group>
  );
}

function RestauranteFixo() {
  const Q = MEIO_Q;
  const px = PREDIO.x, pz = PREDIO.z;
  return (
    <group>
      {/* grama do quarteirão + asfalto do pátio (estacionamento e drive-thru) */}
      <mesh geometry={plano(Q * 2, Q * 2)} material={mat("#7CBF6A", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[CX, -0.03, CZ]} receiveShadow />
      <mesh geometry={plano(Q * 2 - 3, Q * 2 - 3)} material={mat(ASFALTO, { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[CX, -0.01, CZ]} receiveShadow />
      {/* base do prédio (calçada) */}
      <mesh geometry={caixa(19.5, 0.2, 16.5)} material={mat("#D9D5CC", { rough: 0.95 })} position={[px, -0.1 + 0.02, pz]} receiveShadow />
      {/* vagas: fileira oeste (de frente pra rua da Nuvem) e fileira sul */}
      {[-14, -9, -4, 1].map((dz) => <Vaga key={"o" + dz} x={CX - 15.2} z={CZ + dz} rot={Math.PI / 2} />)}
      {[-6, -1, 4, 9, 14].map((dx) => <Vaga key={"s" + dx} x={CX + dx} z={CZ + 15.2} />)}
      {/* faixa do drive-thru: contorna o prédio pelo sul (janela sob a cobertura), leste e norte, e sai pelo oeste */}
      {[[CX - 10, CZ + 6.5], [CX + 2, CZ + 6.5], [CX + 14, CZ + 6.5]].map(([x, z], i) => <Seta key={"s" + i} x={x} z={z} rot={-Math.PI / 2} />)}
      {[[CX + 17.2, CZ - 10], [CX + 17.2, CZ + 1]].map(([x, z], i) => <Seta key={"l" + i} x={x} z={z} rot={0} />)}
      {[[CX + 10, CZ - 16.5], [CX - 4, CZ - 16.5], [CX - 14, CZ - 16.5]].map(([x, z], i) => <Seta key={"n" + i} x={x} z={z} rot={Math.PI / 2} />)}
      {/* linha tracejada da faixa */}
      {Array.from({ length: 9 }).map((_, i) => <mesh key={"t" + i} geometry={plano(2, 0.14)} material={mat(FAIXA)} rotation={[-Math.PI / 2, 0, 0]} position={[CX - 12 + i * 3.4, 0.005, CZ + 8.3]} />)}
      {/* canteiros e jardim */}
      <Canteiro x={CX - 11} z={CZ - 12} w={7} d={1.4} />
      <Canteiro x={CX - 11} z={CZ + 1} w={7} d={1.4} />
      <Canteiro x={CX + 18.2} z={CZ - 5} w={1.4} d={14} />
      <Canteiro x={CX - 18.2} z={CZ - 6} w={1.4} d={10} />
      {/* ilha verde entre a faixa do drive-thru e as vagas do sul */}
      <Canteiro x={CX + 5} z={CZ + 10.6} w={22} d={1.3} />
      {/* área das mesinhas (piso claro) na frente da entrada */}
      <mesh geometry={plano(7, 10)} material={mat("#E6E2D8", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[px - 13.5, 0.0, pz - 1]} receiveShadow />
      <Mesinha x={px - 13.5} z={pz - 4} cor="#C62828" />
      <Mesinha x={px - 13.5} z={pz + 1} cor="#FDD835" />
      <Mesinha x={px - 15.5} z={pz - 1.5} cor="#C62828" />
      {/* totem no canto sudoeste (perto do cruzamento) */}
      <Totem x={CX - 17} z={CZ + 17.5} />
      {/* lixeira e placa baixa de altura máxima do drive-thru */}
      <mesh geometry={cilindro(0.35, 0.3, 0.9, 10)} material={mat("#3A3F47")} position={[px - 10, 0.45, pz + 4.5]} castShadow />
      <mesh geometry={caixa(0.08, 2.6, 0.08)} material={mat("#3A3F47")} position={[CX - 12, 1.3, CZ + 10.5]} />
      <mesh geometry={caixa(1.6, 0.5, 0.06)} material={mat("#FDD835")} position={[CX - 12, 2.4, CZ + 10.5]} />
      <mesh geometry={anel(0.3, 0.4, 16)} material={mat("#C62828")} position={[CX - 12, 1.7, CZ + 10.53]} />
    </group>
  );
}

// ---------- por dentro ----------
const ALT = 1.15; // paredes baixas (corte), igual ao escritório da Nuvem
const VERMELHO = "#C62828", AMARELO = "#FDD835";
function ParedeL({ de, ate, altura = ALT, cor = "#F4F1EB" }: { de: [number, number]; ate: [number, number]; altura?: number; cor?: string }) {
  const dx = ate[0] - de[0], dz = ate[1] - de[1]; const len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  return <mesh geometry={caixa(0.14, altura, len)} material={mat(cor, { rough: 0.9 })} position={[(de[0] + ate[0]) / 2, altura / 2, (de[1] + ate[1]) / 2]} rotation={[0, ang, 0]} castShadow receiveShadow />;
}
function MesaSalao({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.9, 0.05, 0.9)} material={mat("#E8D9B8", { rough: 0.6 })} position={[0, 0.74, 0]} castShadow />
      <mesh geometry={cilindro(0.05, 0.14, 0.72, 10)} material={mat(COR.grafite)} position={[0, 0.36, 0]} />
      {[[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].map(([dx, dz], i) => (
        <group key={i}>
          <mesh geometry={cilindro(0.2, 0.2, 0.05, 12)} material={mat(VERMELHO, { rough: 0.7 })} position={[dx, 0.46, dz]} castShadow />
          <mesh geometry={cilindro(0.03, 0.03, 0.44, 8)} material={mat(COR.metal, { metal: 0.3 })} position={[dx, 0.22, dz]} />
        </group>
      ))}
    </group>
  );
}
function Inox({ x, z, w, d, h = 0.9, rot = 0 }: { x: number; z: number; w: number; d: number; h?: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={caixa(w, h, d)} material={mat("#B9C0C8", { metal: 0.5, rough: 0.35 })} position={[0, h / 2, 0]} castShadow />
      <mesh geometry={caixa(w + 0.04, 0.04, d + 0.04)} material={mat("#D9DEE3", { metal: 0.6, rough: 0.25 })} position={[0, h + 0.02, 0]} />
    </group>
  );
}
function LanchoneteFixa() {
  const { x0, x1, z0, z1 } = LANCH;
  const zs = FAIXA_SUL_Z;
  return (
    <group>
      {/* pisos: salão (ladrilho claro), cozinha (cinza), faixa sul */}
      <mesh geometry={plano(BALCAO_X - x0, zs - z0)} material={mat("#EDE4D3", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + BALCAO_X) / 2, 0.001, (z0 + zs) / 2]} receiveShadow />
      <mesh geometry={plano(x1 - BALCAO_X, zs - z0)} material={mat("#D3D7DC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[(BALCAO_X + x1) / 2, 0.001, (z0 + zs) / 2]} receiveShadow />
      <mesh geometry={plano(x1 - x0, z1 - zs)} material={mat("#E3E6EA", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.001, (zs + z1) / 2]} receiveShadow />
      {/* tapete vermelho da entrada */}
      <mesh geometry={plano(2.2, 1.4)} material={mat(VERMELHO, { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[x0 + 1.3, 0.004, PORTA.z]} />

      {/* paredes externas (com a porta a oeste e a janela do drive-thru ao sul) */}
      <ParedeL de={[x0, z0]} ate={[x1, z0]} />
      <ParedeL de={[x1, z0]} ate={[x1, z1]} />
      <ParedeL de={[x0, z0]} ate={[x0, PORTA.z - PORTA.largura / 2]} />
      <ParedeL de={[x0, PORTA.z + PORTA.largura / 2]} ate={[x0, z1]} />
      <ParedeL de={[x0, z1]} ate={[JANELA_DRIVE.x - JANELA_DRIVE.largura / 2, z1]} />
      <ParedeL de={[JANELA_DRIVE.x + JANELA_DRIVE.largura / 2, z1]} ate={[x1, z1]} />
      {/* porta dupla de vidro */}
      <mesh geometry={caixa(0.06, 2.2, PORTA.largura)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.35 })} position={[x0, 1.1, PORTA.z]} />
      <mesh geometry={caixa(0.1, 2.3, 0.06)} material={mat(COR.preto)} position={[x0, 1.15, PORTA.z]} />
      {/* janela do drive-thru (balcão de entrega + vidro) */}
      <mesh geometry={caixa(JANELA_DRIVE.largura, 0.08, 0.5)} material={mat("#D9DEE3", { metal: 0.5, rough: 0.3 })} position={[JANELA_DRIVE.x, 0.95, z1 + 0.05]} />
      <mesh geometry={caixa(JANELA_DRIVE.largura, 0.9, 0.05)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.35 })} position={[JANELA_DRIVE.x, 1.45, z1]} />

      {/* divisórias: faixa sul (drive + escritório) e entre o posto do drive e o escritório */}
      <ParedeL de={[x0, zs]} ate={[JANELA_DRIVE.x - 2.2, zs]} />
      <ParedeL de={[JANELA_DRIVE.x - 0.4, zs]} ate={[x1, zs]} />
      <ParedeL de={[DRIVE_X1, zs]} ate={[DRIVE_X1, z1 - 1.0]} />
      {/* balcão de atendimento: frente vermelha, tampo branco, dois caixas */}
      <mesh geometry={caixa(0.7, 1.0, zs - z0 - 1.6)} material={mat(VERMELHO, { rough: 0.6 })} position={[BALCAO_X, 0.5, (z0 + zs) / 2 - 0.3]} castShadow />
      <mesh geometry={caixa(0.9, 0.06, zs - z0 - 1.5)} material={mat("#F7F7F5", { rough: 0.4 })} position={[BALCAO_X, 1.03, (z0 + zs) / 2 - 0.3]} />
      {LUGARES_LANCHONETE.filter((l) => l.id.startsWith("caixa")).map((l) => (
        <group key={l.id} position={[BALCAO_X - 0.05, 1.06, l.pos[2]]}>
          <mesh geometry={caixa(0.3, 0.3, 0.04)} material={mat(COR.grafite)} position={[0, 0.2, 0]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={caixa(0.26, 0.26, 0.01)} material={mat("#DCEBFF", { emissive: "#7FB4FF", ei: 0.6 })} position={[-0.025, 0.2, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      ))}
      {/* parede baixa atrás do balcão com o painel do cardápio (amarelo/branco/amarelo) e passagem pra cozinha */}
      <ParedeL de={[COZINHA_X0, z0]} ate={[COZINHA_X0, zs - 2.2]} cor="#2A2E35" />
      {[0, 1, 2].map((i) => <mesh key={i} geometry={plano(1.5, 0.55)} material={mat(i === 1 ? "#FFFFFF" : AMARELO, { emissive: i === 1 ? "#FFFFFF" : AMARELO, ei: 0.25 })} position={[COZINHA_X0 - 0.08, 0.78, z0 + 1.0 + i * 1.7]} rotation={[0, -Math.PI / 2, 0]} />)}

      {/* cozinha: chapa e fritadeira na parede leste, bancada de montagem no meio, geladeira e pia no fundo */}
      <Inox x={x1 - 0.55} z={z0 + 2.4} w={1.0} d={2.0} />
      <mesh geometry={caixa(0.8, 0.04, 1.7)} material={mat("#2A2E35", { metal: 0.6, rough: 0.3 })} position={[x1 - 0.55, 0.94, z0 + 2.4]} />
      <Inox x={x1 - 0.55} z={z0 + 4.4} w={1.0} d={1.2} />
      {[-0.25, 0.25].map((d) => <mesh key={d} geometry={caixa(0.5, 0.25, 0.45)} material={mat("#3A3F47", { metal: 0.4 })} position={[x1 - 0.55, 1.05, z0 + 4.4 + d]} />)}
      <Inox x={COZINHA_X0 + 2.2} z={z0 + 5.4} w={2.6} d={0.9} />
      {[0, 1, 2, 3].map((i) => <mesh key={i} geometry={caixa(0.4, 0.12, 0.3)} material={mat(["#FDD835", "#4CAF50", "#C62828", "#F5DEB3"][i])} position={[COZINHA_X0 + 1.3 + i * 0.6, 0.98, z0 + 5.3]} />)}
      <mesh geometry={caixa(1.2, ALT, 0.7)} material={mat("#E6E9ED", { metal: 0.3, rough: 0.4 })} position={[x1 - 0.75, ALT / 2, z0 + 7.2]} castShadow />
      <Inox x={COZINHA_X0 + 1.0} z={z0 + 0.6} w={1.6} d={0.7} />
      <mesh geometry={caixa(0.6, 0.12, 0.4)} material={mat("#9AA3AD", { metal: 0.6 })} position={[COZINHA_X0 + 1.0, 0.86, z0 + 0.6]} />

      {/* salão: sofás vermelhos na vitrine oeste com mesinhas, e mesas de quatro lugares no meio */}
      {[z0 + 1.6, z0 + 4.2, z0 + 6.8].map((z) => (
        <group key={z}>
          <Sofa position={[x0 + 1.0, 0, z]} rotation={Math.PI / 2} cor={VERMELHO} largura={1.8} />
          <mesh geometry={caixa(0.8, 0.05, 1.3)} material={mat("#E8D9B8", { rough: 0.6 })} position={[x0 + 2.0, 0.74, z]} castShadow />
          <mesh geometry={caixa(0.08, 0.72, 0.08)} material={mat(COR.grafite)} position={[x0 + 2.0, 0.36, z]} />
          <Sofa position={[x0 + 3.0, 0, z]} rotation={-Math.PI / 2} cor={VERMELHO} largura={1.8} />
        </group>
      ))}
      {[[x0 + 5.6, z0 + 2.0], [x0 + 7.6, z0 + 2.0], [x0 + 5.6, z0 + 5.0], [x0 + 7.6, z0 + 5.0], [x0 + 5.6, z0 + 8.0], [x0 + 7.6, z0 + 8.0]].map(([x, z], i) => <MesaSalao key={i} x={x} z={z} />)}
      <Planta position={[x0 + 0.6, 0, z0 + 0.6]} />
      <Planta position={[x0 + 0.6, 0, zs - 0.6]} />
      <mesh geometry={cilindro(0.3, 0.26, 0.9, 10)} material={mat("#3A3F47")} position={[BALCAO_X - 1.0, 0.45, zs - 1.0]} castShadow />
      {/* totem de autoatendimento perto da porta */}
      <mesh geometry={caixa(0.5, 1.15, 0.3)} material={mat(VERMELHO, { rough: 0.5 })} position={[x0 + 1.6, ALT / 2, PORTA.z + 2.2]} castShadow />
      <mesh geometry={plano(0.4, 0.5)} material={mat("#DCEBFF", { emissive: "#7FB4FF", ei: 0.6 })} position={[x0 + 1.6, 0.8, PORTA.z + 2.36]} />

      {/* posto do drive-thru: bancada sob a janela, bandejas; escritório do gerente: mesa, computador, armário */}
      <Inox x={JANELA_DRIVE.x} z={z1 - 0.5} w={3.2} d={0.7} />
      <mesh geometry={caixa(0.45, 0.06, 0.35)} material={mat(VERMELHO)} position={[JANELA_DRIVE.x - 1.0, 0.95, z1 - 0.5]} />
      <mesh geometry={caixa(0.45, 0.06, 0.35)} material={mat(AMARELO)} position={[JANELA_DRIVE.x + 1.0, 0.95, z1 - 0.5]} />
      <mesh geometry={caixa(1.6, 0.05, 0.8)} material={mat(COR.madeiraEscura, { rough: 0.6 })} position={[DRIVE_X1 + 1.9, 0.72, zs + 0.9]} castShadow />
      {[-0.7, 0.7].map((dx) => <mesh key={dx} geometry={caixa(0.06, 0.7, 0.7)} material={mat(COR.metal, { metal: 0.3 })} position={[DRIVE_X1 + 1.9 + dx, 0.35, zs + 0.9]} />)}
      <mesh geometry={caixa(0.55, 0.34, 0.03)} material={mat(COR.grafite)} position={[DRIVE_X1 + 1.9, 1.0, zs + 1.05]} />
      <mesh geometry={caixa(0.9, ALT, 0.45)} material={mat("#CDD3D9", { rough: 0.7 })} position={[x1 - 0.6, ALT / 2, z1 - 0.4]} castShadow />
      <Planta pequena position={[DRIVE_X1 + 0.4, 0, z1 - 0.5]} />
      {/* cadeiras nos lugares da equipe (vazias até ela existir) */}
      {LUGARES_LANCHONETE.map((l) => <group key={l.id} position={l.pos} rotation={[0, l.rot, 0]}><Cadeira position={[0, 0, 0]} cor={l.id === "gerente" ? "#2B2E35" : VERMELHO} /></group>)}
    </group>
  );
}

// Letreiros com a logo "Burgers" (public/lanchonete/logo.png, fundo transparente). A frente olha pro oeste (pra Nuvem).
const PROP_LOGO = 309 / 512; // altura / largura da imagem
function useMaterialLogo() {
  const logo = useLoader(THREE.TextureLoader, "/lanchonete/logo.png");
  // devolve geometria + material pra pôr dentro de um <mesh> (não é componente, é só um pedaço de JSX)
  const placa = (w: number, h: number) => [
    <planeGeometry key="g" args={[w, h]} />,
    <meshBasicMaterial key="m" map={logo} map-colorSpace={THREE.SRGBColorSpace} map-anisotropy={4} transparent alphaTest={0.1} side={THREE.DoubleSide} toneMapped={false} />,
  ];
  return placa;
}
// No prédio (só na vista por fora): placa de pé em cima, na beira da frente; e chapadas na parte de cima das paredes
// oeste (frente), sul (em cima da marquise do drive-thru) e norte.
function LetreirosPredio() {
  const placa = useMaterialLogo();
  const [cx, cz] = LANCH.centro;
  const wTopo = 7.2, hTopo = wTopo * PROP_LOGO, yTopo = LANCH.altura + 0.6 + hTopo / 2;
  const w = 4.2, h = w * PROP_LOGO, y = 6.2;
  return (
    <group>
      <group position={[LANCH.x0 + 1.6, 0, cz]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, yTopo, 0]} castShadow>{placa(wTopo, hTopo)}</mesh>
        {[-wTopo / 2 + 0.9, wTopo / 2 - 0.9].map((dx) => <mesh key={dx} geometry={caixa(0.14, 0.9, 0.14)} material={mat("#3A3F47", { metal: 0.4, rough: 0.5 })} position={[dx, LANCH.altura + 0.3, -0.1]} />)}
      </group>
      <mesh position={[LANCH.x0 - 0.22, y, cz]} rotation={[0, -Math.PI / 2, 0]}>{placa(w, h)}</mesh>
      <mesh position={[JANELA_DRIVE.x - 0.6, y + 0.2, LANCH.z1 + 0.22]}>{placa(w, h)}</mesh>
      <mesh position={[cx, y + 0.2, LANCH.z0 - 0.22]} rotation={[0, Math.PI, 0]}>{placa(w, h)}</mesh>
    </group>
  );
}
// No totem da entrada (sempre visível): a logo nos dois painéis brancos
function LetreiroTotem({ x, z }: { x: number; z: number }) {
  const placa = useMaterialLogo();
  const w = 2.1, h = w * PROP_LOGO;
  return (
    <group position={[x, 7.1, z]}>
      <mesh position={[0, 0, 0.2]}>{placa(w, h)}</mesh>
      <mesh position={[0, 0, -0.2]} rotation={[0, Math.PI, 0]}>{placa(w, h)}</mesh>
    </group>
  );
}

export function Restaurante() {
  const fora = useEscritorio((s) => s.vista === "fora");
  // carros estacionados (modelos do Higgsfield): dois nas vagas e um na janela do drive-thru
  const estacionados = useMemo(() => ({
    sedan: [{ pos: [CX - 15.2, 0, CZ - 9] as [number, number, number], rot: 0, altura: 1.45 }, { pos: [CX + 9, 0, CZ + 15.2] as [number, number, number], rot: Math.PI / 2, altura: 1.45 }],
    hatch: [{ pos: [CX - 15.2, 0, CZ + 1] as [number, number, number], rot: Math.PI, altura: 1.5 }, { pos: [CX - 1, 0, CZ + 15.2] as [number, number, number], rot: -Math.PI / 2, altura: 1.5 }],
    suv: [{ pos: [CX + 3, 0, CZ + 6.5] as [number, number, number], rot: Math.PI, altura: 1.7 }, { pos: [CX - 15.2, 0, CZ - 4] as [number, number, number], rot: Math.PI, altura: 1.7 }],
  }), []);
  return (
    <group>
      <Estatico><RestauranteFixo /></Estatico>
      {/* por fora: o prédio do Higgsfield; por dentro: a planta aberta (balcão, cozinha, salão, drive-thru, escritório) */}
      <group visible={fora}>
        <ComFallback fallback={<PredioProcedural />}>
          <Modelo nome="restaurante" position={[PREDIO.x, 0, PREDIO.z]} rotation={PREDIO.frente} altura={PREDIO.altura} />
        </ComFallback>
        <ComFallback fallback={null}><LetreirosPredio /></ComFallback>
      </group>
      <ComFallback fallback={null}><LetreiroTotem x={CX - 17} z={CZ + 17.5} /></ComFallback>
      <Balao position={[LANCH.centro[0], LANCH.altura + 5, LANCH.centro[1]]} nome="Burgers" cor="#4A2A1A" logo="/lanchonete/logo.png" subtitulo="Alimentação" />
      <Estatico visivel={!fora}><LanchoneteFixa /></Estatico>
      <ComFallback fallback={null}>
        <ModeloInstanciado nome="carroSedan" itens={estacionados.sedan} />
        <ModeloInstanciado nome="carroHatch" itens={estacionados.hatch} />
        <ModeloInstanciado nome="carroSuv" itens={estacionados.suv} />
      </ComFallback>
    </group>
  );
}

function PredioProcedural() {
  return (
    <group position={[PREDIO.x, 0, PREDIO.z]}>
      <mesh geometry={caixa(17.4, 8.5, 14.3)} material={mat("#3A3F47")} position={[0, 4.25, 0]} castShadow />
      <mesh geometry={caixa(17.8, 0.5, 14.7)} material={mat("#F7F7F5")} position={[0, 8.5, 0]} />
    </group>
  );
}
