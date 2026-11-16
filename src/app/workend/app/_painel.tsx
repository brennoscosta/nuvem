"use client";
// Peças com movimento do painel Meu escritório (16/11/2026): número que conta, contagem da reserva, copiar o link de
// indicação e o catálogo de especialistas por setor (no lugar da lista enorme de 39 cartões).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const semMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// número que sobe de 0 até o valor (o servidor já manda o valor final: sem JavaScript, aparece certo)
export function Contador({ valor, prefixo = "", casas = 0 }: { valor: number; prefixo?: string; casas?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || semMovimento() || valor <= 0) return;
    const fmt = (n: number) => prefixo + n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    const dur = 900, t0 = performance.now(); let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(casas ? valor * e : Math.round(valor * e));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(raf); el.textContent = fmt(valor); };
  }, [valor, prefixo, casas]);
  return <span ref={ref}>{prefixo}{valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}</span>;
}

// quanto falta para a reserva do lote cair (mm:ss)
export function ContagemReserva({ restaMs }: { restaMs: number }) {
  const [resta, setResta] = useState(restaMs);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setResta(Math.max(0, restaMs - (performance.now() - t0))), 1000);
    return () => clearInterval(id);
  }, [restaMs]);
  if (resta <= 0) return <span className="pn-contagem pn-contagem-fim">A reserva venceu. Escolha o lote de novo no mapa.</span>;
  const m = Math.floor(resta / 60000), s = Math.floor((resta % 60000) / 1000);
  return <span className="pn-contagem"><b>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</b> para pagar e garantir o endereço</span>;
}

export function CopiarLink({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn btn-azul !py-2.5 text-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(`https://${texto}`); setOk(true); setTimeout(() => setOk(false), 2200); } catch { /* sem permissão: o link está visível para copiar à mão */ }
    }}>{ok ? "Link copiado" : "Copiar meu link"}</button>
  );
}

// ---------------- catálogo de especialistas ----------------
type Setor = { id: string; nome: string; cor: string; entrega: string };
type Especialista = { id: string; nome: string; foto: string; setor: string; cor: string; cargo: string; faz: string; skills: string[] };

export function Catalogo({ setores, especialistas, contratados, link, rotulo }: { setores: Setor[]; especialistas: Especialista[]; contratados: string[]; link: string; rotulo: string }) {
  const [atual, setAtual] = useState(setores[0]?.id ?? "");
  const setor = setores.find((s) => s.id === atual) ?? setores[0];
  const lista = especialistas.filter((e) => e.setor === setor?.id);
  const naEquipe = new Set(contratados);
  const qtd = (id: string) => especialistas.filter((e) => e.setor === id && naEquipe.has(e.id)).length;
  if (!setor) return null;
  return (
    <div className="pn-catalogo" style={{ ["--cor" as string]: setor.cor }}>
      <div className="pn-abas sem-barra" role="tablist" aria-label="Setores">
        {setores.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === setor.id} onClick={() => setAtual(s.id)} className="pn-aba" style={{ ["--cor" as string]: s.cor }}>
            <i aria-hidden="true" />{s.nome}{qtd(s.id) > 0 && <span className="pn-aba-n" aria-label={`${qtd(s.id)} na sua equipe`}>{qtd(s.id)}</span>}
          </button>
        ))}
      </div>
      <p className="pn-entrega"><b>{setor.nome}:</b> {setor.entrega}.</p>
      <ul className="pn-esp-lista" key={setor.id}>
        {lista.map((e, i) => {
          const tem = naEquipe.has(e.id);
          return (
            <li key={e.id} className="pn-esp" style={{ ["--i" as string]: i }}>
              <div className="pn-esp-foto"><img src={e.foto} alt={`Retrato de ${e.nome}`} width={96} height={96} loading="lazy" decoding="async" /></div>
              <div className="min-w-0">
                <div className="pn-esp-nome">{e.nome}</div>
                <div className="pn-esp-cargo">{e.cargo}</div>
              </div>
              <p className="pn-esp-faz">{e.faz}</p>
              <ul className="pn-esp-skills">{e.skills.slice(0, 3).map((k) => <li key={k}>{k}</li>)}</ul>
              {tem ? <span className="pn-esp-tem"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>Já está na sua equipe</span>
                : <Link href={link} className="pn-esp-btn">{rotulo}</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
