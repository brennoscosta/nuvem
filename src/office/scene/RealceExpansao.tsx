"use client";
// Realce do vizinho livre enquanto o dono escolhe expandir o terreno (20/11/2026, ui/ExpandirTerreno.tsx): contorno verde
// que pulsa no lote do lado e a etiqueta "Lote N livre", que também junta com um toque. Ocupado: contorno cinza.
import * as THREE from "three";
import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { caixa } from "./geo";
import { LOTE } from "../data/mundo";
import { useMundo } from "../mundoStore";
import { useExpandir, vizinhoParaExpandir, juntarVizinho } from "../ui/ExpandirTerreno";

const MAT_VERDE = new THREE.MeshStandardMaterial({ color: "#22C55E", emissive: "#22C55E", emissiveIntensity: 0.8, transparent: true, opacity: 0.95 });
const MAT_CHAO = new THREE.MeshBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.16, depthWrite: false });
const MAT_CINZA = new THREE.MeshStandardMaterial({ color: "#9AA3AE", emissive: "#9AA3AE", emissiveIntensity: 0.25 });

export function RealceExpansao() {
  const principal = useExpandir((s) => s.principal);
  const terrenos = useMundo((s) => s.terrenos);
  const [enviando, setEnviando] = useState(false);
  useFrame(({ clock }) => { const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2); MAT_VERDE.emissiveIntensity = 0.45 + p * 0.9; MAT_CHAO.opacity = 0.1 + p * 0.14; });
  if (!principal) return null;
  const { lote: v, livre } = vizinhoParaExpandir(principal, terrenos);
  if (!v) return null;
  const m = LOTE / 2 - 0.5, c = LOTE - 1;
  const mat = livre ? MAT_VERDE : MAT_CINZA;
  return (
    <group position={[v.centro[0], 0, v.centro[1]]}>
      {[[0, -m, c, 0.4], [0, m, c, 0.4], [-m, 0, 0.4, c], [m, 0, 0.4, c]].map(([x, z, w, d], i) => <mesh key={i} geometry={caixa(w, 0.14, d)} material={mat} position={[x, 0.1, z]} />)}
      {livre && <mesh geometry={caixa(c, 0.02, c)} material={MAT_CHAO} position={[0, 0.07, 0]} />}
      <Html position={[0, 3.2, 0]} center zIndexRange={[8, 0]}>
        {livre ? (
          <button type="button" disabled={enviando} onClick={async () => { setEnviando(true); try { const e = await juntarVizinho(v.chave); if (e) window.alert(e); } finally { setEnviando(false); } }}
            className="w-max select-none rounded-full bg-[#16A34A] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-xl ring-2 ring-white disabled:opacity-60">{enviando ? "Juntando…" : `Lote ${v.numero} livre · juntar ao seu`}</button>
        ) : <div className="w-max select-none rounded-full bg-[#5B6472] px-3 py-1 text-[12px] font-bold text-white shadow-lg">Lote {v.numero} · ocupado</div>}
      </Html>
    </group>
  );
}
