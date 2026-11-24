"use client";
// Ruas com nome (12/11/2026): placa azul de rua (como as do Brasil) no poste de uma esquina de cada cruzamento, uma placa
// para cada rua que se cruza. Os nomes vêm de /api/workend/ruas (padrão do mapa ou o nome dado por uma empresa fundadora).
import * as THREE from "three";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { caixa, mat } from "./geo";
import { juntarPecas, matriz, montarAtlas, type Peca } from "./atlas";
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
// 24/11/2026 (mapa lento): todos os nomes numa textura só e todas as placas em duas malhas (faces e ferro); antes eram uma
// textura por rua e três desenhos por placa (scene/atlas.ts)
const CELULA_W = 512, CELULA_H = 120;
function desenharPlaca(g: CanvasRenderingContext2D, nome: string) {
  g.fillStyle = "#1B4E9B"; g.fillRect(0, 0, CELULA_W, CELULA_H);
  g.strokeStyle = "#FFFFFF"; g.lineWidth = 6; g.strokeRect(9, 9, 494, 102);
  // tipo pequeno em cima, nome grande embaixo (como nas placas de rua brasileiras)
  const [tipo, ...resto] = nome.split(" ");
  g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "600 24px Inter, Arial, sans-serif"; g.fillText(tipo.toUpperCase(), 256, 34);
  g.font = "800 44px Inter, Arial, sans-serif"; g.fillText(resto.join(" "), 256, 76, 470);
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
  const nomeDe = (id: string) => nomes[id] ?? RUA_POR_ID[id]?.padrao ?? "";
  const chaveNomes = lista.map((e) => `${nomeDe(e.ruaX)}|${nomeDe(e.ruaZ)}`).join(";");
  const montado = useMemo(() => {
    const unicos = [...new Set(lista.flatMap((e) => [nomeDe(e.ruaX), nomeDe(e.ruaZ)]).filter(Boolean))];
    const celula = new Map(unicos.map((n, i) => [n, i]));
    const atlas = montarAtlas(unicos.length, CELULA_W, CELULA_H, (g, i) => desenharPlaca(g, unicos[i]));
    if (!atlas) return null;
    const faces: Peca[] = [], ferros: Peca[] = [];
    // presas no poste da esquina, em L, viradas para dentro da calçada (nada fica sobre a pista, onde passa o ônibus)
    const o = 0.86, caixaFerro = caixa(1.56, 0.42, 0.04);
    for (const e of lista) {
      const placas: [string, THREE.Matrix4][] = [
        // rua de norte a sul (x fixo): a placa corre ao longo de z, lida de leste e de oeste
        [nomeDe(e.ruaX), matriz([e.x, 3.35, e.z + e.sz * o], Math.PI / 2)],
        // rua de leste a oeste (z fixo): a placa corre ao longo de x, um pouco acima
        [nomeDe(e.ruaZ), matriz([e.x + e.sx * o, 3.8, e.z], 0)],
      ];
      for (const [nome, m] of placas) {
        if (!nome) continue;
        ferros.push({ geo: caixaFerro, m });
        faces.push({ geo: GEO_PLACA, m: matriz([0, 0, 0.025], 0, m), celula: celula.get(nome) });
        faces.push({ geo: GEO_PLACA, m: matriz([0, 0, -0.025], Math.PI, m), celula: celula.get(nome) });
      }
    }
    return { atlas, faces: juntarPecas(faces, atlas), ferro: juntarPecas(ferros), material: new THREE.MeshBasicMaterial({ map: atlas.textura, toneMapped: false }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveNomes, lista]);
  useEffect(() => () => { if (!montado) return; montado.atlas.textura.dispose(); montado.material.dispose(); montado.faces?.dispose(); montado.ferro?.dispose(); }, [montado]);
  if (!montado) return null;
  return (
    <group>
      {montado.ferro && <mesh geometry={montado.ferro} material={ferro} />}
      {montado.faces && <mesh geometry={montado.faces} material={montado.material} />}
    </group>
  );
}
