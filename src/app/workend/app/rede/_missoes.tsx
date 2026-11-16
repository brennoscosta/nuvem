"use client";
// Minha rede › Missões de visitante (12/11/2026): progresso de cada missão (src/server/cidade.ts, minhasMissoes) e os
// selos conquistados, que aparecem no perfil do personagem para quem clicar nele no mapa.
import { useEffect, useState } from "react";
import { PRACA_CHAVE } from "@/office/data/praca";
import { Icone, ICONE_MISSAO } from "@/office/ui/Icone";

type Missao = { id: string; nome: string; desc: string; meta: number; selo: string; cor: string; feito: number; completa: boolean };
// onde cumprir cada missão (negócio e avaliação acontecem nesta própria tela)
const ONDE: Record<string, [string, string] | null> = {
  explorador: ["/mundo", "Abrir o mapa"], papo: ["/encontrar?tipo=empresas", "Achar uma loja"], amigos: ["/mundo", "Conhecer gente no mapa"],
  negociante: null, avaliador: null, candidato: ["/encontrar?tipo=vagas", "Ver vagas abertas"], feirante: [`/mundo?lote=${encodeURIComponent(PRACA_CHAVE)}`, "Ir à praça"],
};

export function PainelMissoes() {
  const [lista, setLista] = useState<Missao[] | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/workend/missoes", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then((j) => vivo && setLista(Array.isArray(j) ? j : [])).catch(() => vivo && setLista([]));
    return () => { vivo = false; };
  }, []);
  if (!lista || !lista.length) return null;
  const ganhos = lista.filter((m) => m.completa);
  return (
    <section className="rd-missoes">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2>{ganhos.length ? `${ganhos.length} de ${lista.length} selos conquistados` : "Ganhe selos andando pela cidade"}</h2>
          <p>Missões de visitante: visite lojas, converse, faça amigos e feche negócios. Cada missão cumprida vira um selo no perfil do seu personagem: quem clicar em você no mapa vê.</p>
        </div>
        {ganhos.length > 0 && (
          <div className="flex -space-x-2" aria-label="Selos conquistados">
            {ganhos.map((m) => <span key={m.id} title={m.nome} className="selo-ganho grid h-11 w-11 place-items-center rounded-full border-2 border-white text-white shadow-md" style={{ background: m.cor }}><Icone nome={ICONE_MISSAO[m.id] ?? "selo"} tamanho={20} /></span>)}
          </div>
        )}
      </div>
      <ol className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {lista.map((m, i) => {
          const pct = Math.min(100, (m.feito / m.meta) * 100), onde = ONDE[m.id];
          return (
            <li key={m.id} className="flex items-center gap-3">
              <span className={`rd-selo ${m.completa ? "selo-ganho rd-selo-ganho" : ""}`} style={{ ["--cor" as string]: m.cor, ["--i" as string]: i }}><Icone nome={ICONE_MISSAO[m.id] ?? "selo"} tamanho={24} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="truncate">{m.nome}</b>
                  <span className={`shrink-0 text-[12px] font-bold ${m.completa ? "" : "text-[var(--tinta-2)]"}`} style={m.completa ? { color: m.cor } : undefined}>{m.completa ? "Selo conquistado" : `${m.feito} de ${m.meta}`}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-dim)]">
                  <div className="missao-barra h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: m.cor, animationDelay: `${i * 70}ms`, opacity: pct ? 1 : 0.35 }} />
                </div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-[13px] text-[var(--tinta-2)]">
                  <span>{m.desc}</span>
                  {!m.completa && onde && <a href={onde[0]} className="rd-missao-link">{onde[1]}<Icone nome="seta" tamanho={14} /></a>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
