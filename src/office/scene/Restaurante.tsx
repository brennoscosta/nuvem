"use client";
// Quarteirão do restaurante drive-thru (40 x 40 m, a leste da Nuvem). Sem marca ainda: a empresa que comprar
// o lote coloca o nome. Prédio = modelo do Higgsfield (por fora); estacionamento, faixa do drive-thru, totem,
// mesinhas e jardim em código. Por dentro (balcão, cozinha, mesas pros funcionários) entra quando tiver equipe.
import { useMemo } from "react";
import { caixa, cilindro, esfera, mat, plano, anel } from "./geo";
import { ComFallback, Modelo, ModeloInstanciado } from "./Modelos";
import { Estatico } from "./Estatico";
import { centroQuarteirao, MEIO_Q } from "../data/mundo";

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

export function Restaurante() {
  // carros estacionados (modelos do Higgsfield): dois nas vagas e um na janela do drive-thru
  const estacionados = useMemo(() => ({
    sedan: [{ pos: [CX - 15.2, 0, CZ - 9] as [number, number, number], rot: 0, altura: 1.45 }, { pos: [CX + 9, 0, CZ + 15.2] as [number, number, number], rot: Math.PI / 2, altura: 1.45 }],
    hatch: [{ pos: [CX - 15.2, 0, CZ + 1] as [number, number, number], rot: Math.PI, altura: 1.5 }, { pos: [CX - 1, 0, CZ + 15.2] as [number, number, number], rot: -Math.PI / 2, altura: 1.5 }],
    suv: [{ pos: [CX + 3, 0, CZ + 6.5] as [number, number, number], rot: Math.PI, altura: 1.7 }, { pos: [CX - 15.2, 0, CZ - 4] as [number, number, number], rot: Math.PI, altura: 1.7 }],
  }), []);
  return (
    <group>
      <Estatico><RestauranteFixo /></Estatico>
      <ComFallback fallback={<PredioProcedural />}>
        <Modelo nome="restaurante" position={[PREDIO.x, 0, PREDIO.z]} rotation={PREDIO.frente} altura={PREDIO.altura} />
      </ComFallback>
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
