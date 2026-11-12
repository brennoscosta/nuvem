"use client";
// Volume de cada camada do som ambiente pela cena (12/11/2026): trânsito mais alto perto das ruas e perto do chão,
// pássaros de dia e sem chuva, chuva quando chove e a música da praça pela distância da câmera até o palco.
// Montar dentro do <Mundo> (scene/Mundo.tsx). Não toca nada sozinho: o som só sai com o botão ligado (ui/Som).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { definirVolumes } from "../som";
import { clima } from "../clima";
import { ceu } from "./CicloDia";
import { EIXOS_RUA, LOTE_POR_CHAVE } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";

const lim = (v: number) => Math.max(0, Math.min(1, v));
const PRACA = LOTE_POR_CHAVE[PRACA_CHAVE]?.centro ?? [0, 0];
export function SomCena() {
  const n = useRef(0);
  useFrame(({ camera }) => {
    if ((n.current++ % 12) !== 0) return; // ~5 vezes por segundo
    const { x, y, z } = camera.position;
    const dRua = Math.min(...EIXOS_RUA.map((e) => Math.min(Math.abs(x - e), Math.abs(z - e))));
    const perto = lim(1 - (y - 8) / 110) * 0.75 + 0.25; // lá do alto tudo fica mais baixo
    const noite = ceu.noite;
    const dPraca = Math.hypot(x - PRACA[0], z - PRACA[1]) + Math.max(0, y - 12) * 0.5;
    definirVolumes({
      transito: (0.3 + 0.7 * lim(1 - dRua / 32)) * perto * (1 - noite * 0.35),
      passaros: (1 - noite) * (1 - lim(clima.chuva * 1.6)) * (0.45 + 0.55 * perto),
      chuva: lim(clima.chuva * 1.15),
      praca: Math.pow(lim(1 - dPraca / 80), 1.5) * (1 - lim(clima.chuva * 0.8) * 0.5),
    });
  });
  return null;
}
