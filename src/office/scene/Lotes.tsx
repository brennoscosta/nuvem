"use client";
// Lotes à venda: casinhas (modelos do Higgsfield, instanciados por modelo) e terrenos vazios, todos com a placa
// "À VENDA" na frente. As placas são juntadas num <Estatico> (uma textura compartilhada → um draw call).
import * as THREE from "three";
import { useMemo } from "react";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { Estatico } from "./Estatico";
import { QUARTEIROES, centroLote, frenteDoLote, LOTE, type ModeloCasa } from "../data/mundo";

// Altura real (m) e pra onde o modelo olha (rotação que leva a frente do GLB pro +z)
const CASA: Record<ModeloCasa, { altura: number; frente: number }> = {
  casaVelha: { altura: 5.2, frente: -Math.PI / 2 },
  casaTerrea: { altura: 5.0, frente: -Math.PI / 2 },
  casaSobrado: { altura: 7.6, frente: -Math.PI / 2 },
  casaColonial: { altura: 7.8, frente: -Math.PI / 2 },
  casaModerna: { altura: 4.6, frente: -Math.PI / 2 },
};

type Casa = { modelo: ModeloCasa; pos: [number, number, number]; rot: number; escala: number };
type Terreno = { pos: [number, number, number]; rot: number; arvore: boolean };

function listar() {
  const casas: Casa[] = [], terrenos: Terreno[] = [], placas: { pos: [number, number, number]; rot: number }[] = [];
  for (const q of QUARTEIROES) {
    if (!q.lotes) continue;
    q.lotes.forEach((l, k) => {
      const [x, z] = centroLote(q.i, q.j, k);
      const rot = frenteDoLote(k);
      const frente = k >= 2 ? 1 : -1; // lado da rua
      // placa perto da calçada, num canto do lote
      placas.push({ pos: [x + (k % 2 ? 6.5 : -6.5), 0, z + frente * (LOTE / 2 - 1.6)], rot });
      if (l.tipo === "casa") casas.push({ modelo: l.modelo, pos: [x, 0, z - frente * 1.2], rot, escala: l.escala ?? 1 });
      else terrenos.push({ pos: [x, 0, z], rot, arvore: !!l.arvore });
    });
  }
  return { casas, terrenos, placas };
}

// Placa "À VENDA": textura desenhada uma vez (canvas) e compartilhada por todas
let texPlaca: THREE.CanvasTexture | null = null;
function texturaPlaca() {
  if (texPlaca) return texPlaca;
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#1D4ED8"; g.fillRect(0, 0, 512, 54);
  g.fillStyle = "#FFFFFF"; g.font = "bold 30px Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("WORKEND", 256, 28);
  g.fillStyle = "#0F172A"; g.font = "bold 96px Inter, Arial, sans-serif"; g.fillText("À VENDA", 256, 140);
  g.fillStyle = "#475569"; g.font = "28px Inter, Arial, sans-serif"; g.fillText("compre seu chão e monte sua empresa", 256, 218);
  texPlaca = new THREE.CanvasTexture(c); texPlaca.colorSpace = THREE.SRGBColorSpace; texPlaca.anisotropy = 4;
  return texPlaca;
}
let matPlaca: THREE.MeshBasicMaterial | null = null;
const materialPlaca = () => matPlaca ?? (matPlaca = new THREE.MeshBasicMaterial({ map: texturaPlaca(), toneMapped: false }));

function Placa({ pos, rot }: { pos: [number, number, number]; rot: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      {[-0.7, 0.7].map((x) => <mesh key={x} geometry={caixa(0.08, 1.9, 0.08)} material={mat("#6B4F2A", { rough: 0.9 })} position={[x, 0.95, 0]} castShadow />)}
      <mesh geometry={caixa(1.9, 1.0, 0.06)} material={mat("#F7F7F5")} position={[0, 1.5, 0]} castShadow />
      <mesh geometry={plano(1.8, 0.9)} material={materialPlaca()} position={[0, 1.5, 0.035]} />
    </group>
  );
}

// Terreno vazio: grama mais clara com mato baixo; às vezes uma árvore grande (instanciada em Mundo)
function Terreno({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh geometry={plano(LOTE - 1.5, LOTE - 1.5)} material={mat("#8CC978", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow />
      {[[-5, -4], [4, -6], [6, 3], [-3, 6], [1, 1]].map(([x, z], i) => (
        <mesh key={i} geometry={esfera(0.5 + (i % 3) * 0.15, 7)} material={mat(i % 2 ? "#6FB15F" : "#9ACD6B")} position={[x, 0.2, z]} scale={[1, 0.5, 1]} />
      ))}
    </group>
  );
}

// Caminho da calçada até a porta da casa e um canteiro na frente
function Jardim({ pos, rot }: { pos: [number, number, number]; rot: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh geometry={plano(1.4, 6)} material={mat("#D9D5CC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[1.2, -0.01, 6.5]} receiveShadow />
      <mesh geometry={cilindro(0.9, 1.1, 0.25, 12)} material={mat("#5C4634", { rough: 1 })} position={[-5.5, 0.12, 6.5]} />
      <mesh geometry={esfera(0.7, 8)} material={mat("#EC6B8D")} position={[-5.5, 0.6, 6.5]} />
    </group>
  );
}

export function Lotes() {
  const { casas, terrenos, placas, porModelo } = useMemo(() => {
    const r = listar();
    const m = new Map<ModeloCasa, ItemInstancia[]>();
    for (const c of r.casas) {
      const info = CASA[c.modelo];
      const lista = m.get(c.modelo) ?? []; m.set(c.modelo, lista);
      lista.push({ pos: c.pos, rot: c.rot + info.frente, altura: info.altura * c.escala });
    }
    return { ...r, porModelo: [...m.entries()] };
  }, []);
  return (
    <group>
      <Estatico>
        {terrenos.map((t, i) => <Terreno key={i} pos={t.pos} />)}
        {casas.map((c, i) => <Jardim key={i} pos={c.pos} rot={c.rot} />)}
        {placas.map((p, i) => <Placa key={i} pos={p.pos} rot={p.rot} />)}
      </Estatico>
      {porModelo.map(([modelo, itens]) => (
        <ComFallback key={modelo} fallback={<Estatico>{itens.map((it, i) => <CasaProcedural key={i} pos={it.pos} rot={it.rot ?? 0} altura={it.altura ?? 5} />)}</Estatico>}>
          <ModeloInstanciado nome={modelo} itens={itens} />
        </ComFallback>
      ))}
    </group>
  );
}

// Se o GLB faltar: caixinha com telhado
function CasaProcedural({ pos, rot, altura }: { pos: [number, number, number]; rot: number; altura: number }) {
  const h = altura * 0.6;
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh geometry={caixa(8, h, 7)} material={mat("#EADFC8")} position={[0, h / 2, 0]} castShadow />
      <mesh geometry={cilindro(0, 6.2, altura * 0.4, 4)} material={mat("#B5552F")} position={[0, h + altura * 0.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
    </group>
  );
}
