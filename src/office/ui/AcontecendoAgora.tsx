"use client";
// "Acontecendo agora" (20/11/2026, frente "visitante"): uma linha discreta na cidade com o que está rolando (evento na
// Praça de Eventos, loja com cupom do passaporte, loja nova, presentes de Natal). Mostra um item; tocar abre os outros.
// Sem rodízio automático (nada de carrossel). Dados de /api/workend/passaporte/agora, a cada minuto.
import { useEffect, useRef, useState } from "react";
import { useMundo } from "../mundoStore";
import { Icone, type NomeIcone } from "./Icone";

type Item = { tipo: "evento" | "cupom" | "natal" | "loja"; texto: string; chave?: string | null; numero?: number | null };
const ICONE: Record<Item["tipo"], NomeIcone> = { evento: "agenda", cupom: "cupom", natal: "presente", loja: "predios" };

export function AcontecendoAgora() {
  const [itens, setItens] = useState<Item[]>([]);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    const buscar = () => fetch("/api/workend/passaporte/agora", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j?.itens) setItens(j.itens as Item[]); }).catch(() => {});
    void buscar(); const t = setInterval(buscar, 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("pointerdown", fora); return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);
  // o Natal já tem o contador próprio; aqui ele só entra se não houver mais nada
  const lista = itens.some((i) => i.tipo !== "natal") ? itens.filter((i) => i.tipo !== "natal") : itens;
  if (!lista.length) return null;
  const primeiro = lista[0];
  const ver = (i: Item) => { if (i.chave) { setAberto(false); useMundo.getState().selecionarLote(i.chave); } };
  return (
    <div ref={caixa} className="pointer-events-auto relative min-w-0 max-w-[min(360px,calc(100vw-1rem))]" data-guia="acontecendo-agora">
      <button type="button" onClick={() => (lista.length > 1 ? setAberto(!aberto) : ver(primeiro))} aria-expanded={lista.length > 1 ? aberto : undefined} className="hud-ilha flex w-full min-w-0 items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-left text-[12px] font-semibold text-white">
        <span className="shrink-0 rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.12em]">Agora</span>
        <span className="min-w-0 truncate" data-teste="agora-primeiro">{primeiro.texto}</span>
        {lista.length > 1 && <span className="shrink-0 text-white/60">+{lista.length - 1}</span>}
      </button>
      {aberto && (
        <ul className="absolute left-0 top-full z-30 mt-1.5 w-[min(340px,calc(100vw-1rem))] space-y-1 rounded-2xl bg-[#0E1013]/95 p-2 text-white shadow-2xl ring-1 ring-white/10">
          {lista.map((i, k) => (
            <li key={k}>
              <button type="button" onClick={() => ver(i)} disabled={!i.chave} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[12.5px] hover:bg-white/10 disabled:hover:bg-transparent">
                <Icone nome={ICONE[i.tipo]} tamanho={16} className="shrink-0 text-white/70" /><span className="min-w-0 flex-1">{i.texto}</span>{i.chave && <span className="shrink-0 text-[11px] font-bold text-[#93C5FD]">Ver</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
