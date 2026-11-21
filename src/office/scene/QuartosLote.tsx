"use client";
// Lote em quartos na cena (21/11/2026, data/quartosLote.ts): os quartos livres marcados no chão com um tracejado branco (uma
// malha só por lote) e, para o dono com o cartão do lote aberto, o botão "Usar este espaço" no meio de cada quarto livre
// (as opções abrem no cartão: ui/EspacoLote.tsx). Os quiosques do lote ficam em scene/Quiosques.tsx › QuiosquesDosLotes.
// Coordenadas do grupo do lote (centro do lote, eixos do mundo: os quartos são noroeste, nordeste, sudoeste e sudeste).
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import { useMundo } from "../mundoStore";
import { useEdicao } from "../edicaoStore";
import { LOTE } from "../data/mundo";
import { quartosLivres, type QuartosLote, type Quarto } from "../data/quartosLote";
import { useEspacoLote } from "../ui/EspacoLote";

const MAT = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
const RECUO = 0.75, TRACO = 0.9, VAO = 0.55, ESP = 0.14; // m
const cx = (q: Quarto) => (q % 2 ? LOTE / 4 : -LOTE / 4), cz = (q: Quarto) => (q >= 2 ? LOTE / 4 : -LOTE / 4);
function tracejado(livres: Quarto[]) {
  const pos: number[] = [], y = 0.075;
  const seg = (ax: number, az: number, bx: number, bz: number) => {
    const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = (-uz * ESP) / 2, nz = (ux * ESP) / 2;
    for (let s = 0; s < L; s += TRACO + VAO) {
      const e = Math.min(L, s + TRACO), p0x = ax + ux * s, p0z = az + uz * s, p1x = ax + ux * e, p1z = az + uz * e;
      pos.push(p0x - nx, y, p0z - nz, p1x - nx, y, p1z - nz, p1x + nx, y, p1z + nz, p0x - nx, y, p0z - nz, p1x + nx, y, p1z + nz, p0x + nx, y, p0z + nz);
    }
  };
  for (const q of livres) {
    const h = LOTE / 4 - RECUO, x0 = cx(q) - h, x1 = cx(q) + h, z0 = cz(q) - h, z1 = cz(q) + h;
    seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export function QuartosLivres({ chave, q }: { chave: string; q: QuartosLote }) {
  const livres = useMemo(() => quartosLivres(q), [q]);
  const geo = useMemo(() => (livres.length ? tracejado(livres) : null), [livres]);
  useEffect(() => () => geo?.dispose(), [geo]);
  // o botão só para o dono (ou sócio), com o cartão deste lote aberto e fora do modo de edição e do painel de montar
  const dono = useMundo((s) => s.meus.includes(chave) || (!!s.usuario && s.terrenos[chave]?.usuarioId === s.usuario.id));
  const aberto = useMundo((s) => s.loteSelecionado === chave && !s.painelEscritorio && !s.painelEmpresa);
  const editando = useEdicao((s) => !!s.chave);
  if (!geo) return null;
  return (
    <group>
      <mesh geometry={geo} material={MAT} renderOrder={2} />
      {dono && aberto && !editando && livres.map((x) => (
        <Html key={x} position={[cx(x), 0.5, cz(x)]} center zIndexRange={[8, 0]}>
          <button type="button" data-guia="usar-espaco" data-quarto={x} onClick={(ev) => { ev.stopPropagation(); useEspacoLote.getState().escolher(chave, x); }}
            className="w-max select-none rounded-full bg-[#1D4ED8] px-3 py-1.5 text-[12.5px] font-bold text-white shadow-lg ring-2 ring-white hover:bg-[#1a44c2]">Usar este espaço</button>
        </Html>
      ))}
    </group>
  );
}
