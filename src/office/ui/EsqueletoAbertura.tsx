"use client";
// Esqueleto da abertura do mapa (WE-15, 21/11/2026). Do primeiro quadro (HTML do servidor, antes do JavaScript) até os
// lotes chegarem (/api/terrenos), a tela não mostra mais o painel de outra loja:
//  - a barra de cima é a do mapa, só com a marca (a barra de verdade entra na hidratação, ui/Painel.tsx › BarraTopo);
//  - se o link pede uma sede (?sede=), um cartão de espera com a logo, o nome e a cor dela (dados fixos de data/sedes.ts);
//  - se pede um lote ou quiosque (?lote=), um cartão neutro: o nome da loja só se sabe com os dados do servidor.
// O cartão de espera some sozinho quando o mapa carrega, no mesmo quadro em que o cartão de verdade abre (mundoStore.ts).
import Link from "next/link";
import { MarcaTopo } from "@/app/workend/_marca";
import { useMundo } from "../mundoStore";
import { useInicioMundo } from "../inicioMundo";
import { sedeDe, sedeDoParametro } from "../data/sedes";
import { LOTE_POR_CHAVE } from "../data/mundo";
import { QUIOSQUE_POR_CHAVE } from "../data/quiosques";
import { PRACA_CHAVE } from "../data/praca";
import { FLUTUANTE, LARGO, ESTREITO } from "./estilo";

export function EsqueletoBarra() {
  return (
    <div data-esqueleto="barra" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3">
      <div className="hud-ilha pointer-events-auto flex shrink-0 items-center gap-3 px-3.5 py-2.5">
        <Link href="/" aria-label="WorkEnd, início" className="py-0.5"><MarcaTopo altura={18} claro /></Link>
      </div>
      <div className="hud-ilha flex items-center gap-1 p-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className="block h-9 w-9 animate-pulse rounded-full bg-white/10" />)}
      </div>
    </div>
  );
}

export function EsqueletoCartao() {
  const { mundo, sede, lote } = useInicioMundo();
  const carregado = useMundo((s) => s.carregado);
  if (!mundo || carregado) return null;
  const sd = sedeDoParametro(sede) ?? sedeDe(lote);
  if (sd) return (
    <div data-esqueleto="cartao" role="status" aria-label={`${sd.nome}: abrindo a sede`} className={`${FLUTUANTE} ${LARGO} flex flex-col overflow-hidden !bg-[#0E1013] !text-white`}>
      <div className="px-4 pb-4 pt-4" style={{ background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${sd.cor} 24%, #0E1013) 0%, #0E1013 60%)` }}>
        <img src={sd.logo} alt={sd.nome} className="h-11 w-auto max-w-[78%] object-contain object-left" />
        <p className="mt-2 text-[13px] leading-snug text-white/75">{sd.resumo}</p>
        <div className="mt-3 h-10 w-full animate-pulse rounded-xl" style={{ background: `color-mix(in srgb, ${sd.cor} 40%, transparent)` }} />
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-3">
        {[0, 1, 2].map((i) => <span key={i} className="block h-11 animate-pulse rounded-xl bg-white/[.06]" />)}
      </div>
      <p className="px-4 pb-3 text-[12px] text-white/50">{sd.nome} · abrindo a sede…</p>
    </div>
  );
  const qk = lote ? QUIOSQUE_POR_CHAVE[lote] : null;
  if (!lote || lote === PRACA_CHAVE || (!LOTE_POR_CHAVE[lote] && !qk)) return null;
  return (
    <div data-esqueleto="cartao" role="status" aria-label={qk ? "Abrindo o quiosque" : "Abrindo o lote"} className={`${FLUTUANTE} ${ESTREITO} !z-10 p-4`}>
      <span className="block h-3 w-16 animate-pulse rounded bg-[#DCE6FB]" />
      <span className="mt-2 block h-5 w-2/3 animate-pulse rounded-md bg-[#E6E9EE]" />
      <span className="mt-2 block h-3 w-1/2 animate-pulse rounded bg-[#EEF0F3]" />
      <span className="mt-4 block h-10 w-full animate-pulse rounded-xl bg-[#EEF0F3]" />
      <span className="mt-2 block h-10 w-full animate-pulse rounded-xl bg-[#F3F4F6]" />
      <p className="mt-3 text-[12px] text-[#5B6472]">{qk ? "Abrindo o quiosque…" : "Abrindo o lote…"}</p>
    </div>
  );
}
