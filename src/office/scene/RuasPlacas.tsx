"use client";
// Ruas com nome (12/11/2026): placa azul de rua (como as do Brasil) no poste de uma esquina de cada cruzamento, uma placa
// para cada rua que se cruza. Os nomes vêm de /api/workend/ruas (padrão do mapa ou o nome dado por uma empresa fundadora).
import * as THREE from "three";
import { useMemo, useSyncExternalStore } from "react";
import { caixa, mat } from "./geo";
import { EIXOS_RUA, RUAS, RUA_POR_ID, BORDA_CALCADA, EIXO_RUA, QUARTEIROES, PASSO } from "../data/mundo";

// ---------- nomes das ruas (compartilhado: placas, mini-mapa e o cartão de dar nome) ----------
export interface EstadoRuas { nomes: Record<string, string>; donos: Record<string, string | null>; dadas: Record<string, boolean>; eu: { fundador: boolean; podeNomear: boolean; minha: string | null } | null; carregado: boolean }
const PADRAO: EstadoRuas = { nomes: Object.fromEntries(RUAS.map((r) => [r.id, r.padrao])), donos: {}, dadas: {}, eu: null, carregado: false };
let estado = PADRAO;
const ouvintes = new Set<() => void>();
let buscando: Promise<void> | null = null;
export function recarregarRuas() {
  buscando = fetch("/api/workend/ruas", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    estado = { nomes: Object.fromEntries((j.ruas as { id: string; nome: string }[]).map((r) => [r.id, r.nome])), donos: Object.fromEntries((j.ruas as { id: string; dono: string | null }[]).map((r) => [r.id, r.dono])), dadas: Object.fromEntries((j.ruas as { id: string; dada: boolean }[]).map((r) => [r.id, !!r.dada])), eu: j.eu ?? null, carregado: true };
    ouvintes.forEach((f) => f());
  }).catch(() => {}).finally(() => { buscando = null; });
  return buscando;
}
function assinar(cb: () => void) { ouvintes.add(cb); if (!estado.carregado && !buscando) void recarregarRuas(); return () => { ouvintes.delete(cb); }; }
export const useRuas = () => useSyncExternalStore(assinar, () => estado, () => PADRAO);

// ---------- placas ----------
const TEX = new Map<string, THREE.CanvasTexture>();
function texturaPlaca(nome: string) {
  if (TEX.has(nome) || typeof document === "undefined") return TEX.get(nome) ?? null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 120; const g = c.getContext("2d")!;
  g.fillStyle = "#1B4E9B"; g.fillRect(0, 0, 512, 120);
  g.strokeStyle = "#FFFFFF"; g.lineWidth = 6; g.strokeRect(9, 9, 494, 102);
  // tipo pequeno em cima, nome grande embaixo (como nas placas de rua brasileiras)
  const [tipo, ...resto] = nome.split(" ");
  g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "600 24px Inter, Arial, sans-serif"; g.fillText(tipo.toUpperCase(), 256, 34);
  g.font = "800 44px Inter, Arial, sans-serif"; g.fillText(resto.join(" "), 256, 76, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  TEX.set(nome, t); return t;
}
const MAT = new Map<string, THREE.MeshBasicMaterial>();
function materialPlaca(nome: string) {
  let m = MAT.get(nome); if (m) return m;
  const t = texturaPlaca(nome); if (!t) return null;
  m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); MAT.set(nome, m); return m;
}
const GEO_PLACA = new THREE.PlaneGeometry(1.5, 0.36);

// Em cada cruzamento, a placa fica no canto de um quarteirão que existe (o poste da esquina, BORDA_CALCADA - 0,5 do centro)
interface Esquina { x: number; z: number; ruaX: string; ruaZ: string; sx: number; sz: number }
function esquinas(): Esquina[] {
  const tem = new Set(QUARTEIROES.map((q) => `${q.i},${q.j}`));
  const out: Esquina[] = [];
  const a = BORDA_CALCADA - 0.5, d = EIXO_RUA - a; // do eixo da rua até o poste da esquina
  for (const x of EIXOS_RUA) for (const z of EIXOS_RUA) {
    // quarteirões em volta do cruzamento: o de sudeste primeiro (x+, z+), depois os outros
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const i = Math.round((x + sx * EIXO_RUA) / PASSO), j = Math.round((z + sz * EIXO_RUA) / PASSO);
      if (!tem.has(`${i},${j}`)) continue;
      out.push({ x: x + sx * d, z: z + sz * d, ruaX: `x${x}`, ruaZ: `z${z}`, sx, sz });
      break;
    }
  }
  return out;
}

export function PlacasDeRua() {
  const { nomes } = useRuas();
  const lista = useMemo(() => esquinas(), []);
  const ferro = mat("#2B2F36", { metal: 0.4, rough: 0.5 });
  return (
    <group>
      {lista.map((e) => {
        const nx = nomes[e.ruaX] ?? RUA_POR_ID[e.ruaX]?.padrao ?? "", nz = nomes[e.ruaZ] ?? RUA_POR_ID[e.ruaZ]?.padrao ?? "";
        const mx = materialPlaca(nx), mz = materialPlaca(nz);
        // presas no poste da esquina, em L, viradas para dentro da calçada (nada fica sobre a pista, onde passa o ônibus)
        const o = 0.86;
        return (
          <group key={`${e.x},${e.z}`} position={[e.x, 0, e.z]}>
            {/* rua de norte a sul (x fixo): a placa corre ao longo de z, lida de leste e de oeste */}
            {mx && <group position={[0, 3.35, e.sz * o]} rotation={[0, Math.PI / 2, 0]}>
              <mesh geometry={caixa(1.56, 0.42, 0.04)} material={ferro} />
              <mesh geometry={GEO_PLACA} material={mx} position={[0, 0, 0.025]} />
              <mesh geometry={GEO_PLACA} material={mx} position={[0, 0, -0.025]} rotation={[0, Math.PI, 0]} />
            </group>}
            {/* rua de leste a oeste (z fixo): a placa corre ao longo de x, um pouco acima */}
            {mz && <group position={[e.sx * o, 3.8, 0]}>
              <mesh geometry={caixa(1.56, 0.42, 0.04)} material={ferro} />
              <mesh geometry={GEO_PLACA} material={mz} position={[0, 0, 0.025]} />
              <mesh geometry={GEO_PLACA} material={mz} position={[0, 0, -0.025]} rotation={[0, Math.PI, 0]} />
            </group>}
          </group>
        );
      })}
    </group>
  );
}
