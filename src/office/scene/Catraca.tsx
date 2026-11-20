"use client";
// Catraca da recepção (20/11/2026, pedido do dono: "quero que quando a pessoa entre em uma das empresas e seja visitante
// tenha acesso apenas à recepcionista"). Vidro baixo com corrimão de inox e um portão de duas folhas de vidro entre dois
// postes; a luz no alto dos postes fica vermelha para o visitante e verde para quem pode passar (dono, sócio ou visitante
// que a recepção encaminhou para um setor), e as folhas abrem para o lado de dentro. Posições: data/plantaSede.ts ›
// catracasDaSede e data/escritorio.ts › catracasCliente; o que barra o personagem fica em data/plantaInterna.ts.
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, mat } from "./geo";
import { usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import type { Catraca } from "../data/plantaSede";

const ALT = 0.95; // altura do vidro
const ABRE = (Math.PI / 2) * 0.92;

// dentro: para que lado do z fica a parte restrita (as folhas abrem para lá): -1 na sede, +1 nas lojas
export function Catracas({ chave, lista, dentro }: { chave: string; lista: Catraca[]; dentro: 1 | -1 }) {
  const dono = useMundo((s) => s.meus.includes(chave));
  const abertas = usePersonagem((s) => (s.predio?.chave === chave ? (s.predio.liberado?.acesso.catracas ?? []).join(",") : ""));
  const ids = abertas.split(",");
  return <group>{lista.map((c) => <UmaCatraca key={c.id} c={c} aberta={dono || ids.includes(c.id)} dentro={dentro} />)}</group>;
}

function UmaCatraca({ c, aberta, dentro }: { c: Catraca; aberta: boolean; dentro: 1 | -1 }) {
  const esq = useRef<THREE.Group>(null), dir = useRef<THREE.Group>(null);
  const folha = (c.g1 - c.g0) / 2 - 0.03;
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 5);
    if (esq.current) esq.current.rotation.y += ((aberta ? -dentro * ABRE : 0) - esq.current.rotation.y) * k;
    if (dir.current) dir.current.rotation.y += ((aberta ? dentro * ABRE : 0) - dir.current.rotation.y) * k;
  });
  const vidro = mat("#CFEAF5", { rough: 0.08, metal: 0.1, opacity: 0.38 }), inox = mat("#B9C0C8", { rough: 0.28, metal: 0.85 });
  const luz = aberta ? mat("#16A34A", { emissive: "#22C55E", ei: 1.3 }) : mat("#DC2626", { emissive: "#EF4444", ei: 1.1 });
  const lados: [number, number][] = [];
  if (c.g0 - 0.16 - c.x0 > 0.05) lados.push([c.x0, c.g0 - 0.16]);
  if (c.x1 - (c.g1 + 0.16) > 0.05) lados.push([c.g1 + 0.16, c.x1]);
  return (
    <group position={[0, 0, c.z]}>
      {lados.map(([a, b]) => (
        <group key={a}>
          <mesh geometry={caixa(+(b - a).toFixed(3), ALT, 0.03)} material={vidro} position={[(a + b) / 2, 0.08 + ALT / 2, 0]} />
          <mesh geometry={caixa(+(b - a).toFixed(3), 0.04, 0.06)} material={inox} position={[(a + b) / 2, 0.08 + ALT + 0.02, 0]} />
          <mesh geometry={caixa(+(b - a).toFixed(3), 0.08, 0.06)} material={inox} position={[(a + b) / 2, 0.04, 0]} />
        </group>
      ))}
      {/* postes do portão, com a luz no alto */}
      {[c.g0 - 0.08, c.g1 + 0.08].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh geometry={caixa(0.16, 1.02, 0.3)} material={inox} position={[0, 0.51, 0]} castShadow />
          <mesh geometry={caixa(0.12, 0.03, 0.22)} material={luz} position={[0, 1.035, 0]} />
        </group>
      ))}
      {/* folhas de vidro: presas nos postes, abrem para dentro */}
      <group ref={esq} position={[c.g0, 0, 0]}>
        <mesh geometry={caixa(+folha.toFixed(3), 0.72, 0.03)} material={vidro} position={[folha / 2, 0.58, 0]} />
        <mesh geometry={caixa(+folha.toFixed(3), 0.03, 0.04)} material={inox} position={[folha / 2, 0.95, 0]} />
      </group>
      <group ref={dir} position={[c.g1, 0, 0]}>
        <mesh geometry={caixa(+folha.toFixed(3), 0.72, 0.03)} material={vidro} position={[-folha / 2, 0.58, 0]} />
        <mesh geometry={caixa(+folha.toFixed(3), 0.03, 0.04)} material={inox} position={[-folha / 2, 0.95, 0]} />
      </group>
    </group>
  );
}
