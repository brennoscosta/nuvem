"use client";
// Gráfico do painel de resultados (12/11/2026): uma métrica por vez (visitas, conversas, candidaturas, cliques,
// agendamentos), barras por dia ancoradas na base, dica ao passar o dedo/mouse e a mesma série em tabela.
import { useEffect, useRef, useState } from "react";

export interface Metrica { id: string; nome: string; total: number; anterior: number; cor: string; serie: { dia: string; n: number }[]; explica: string }

const diaCurto = (d: string) => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; };
const semana = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
function Variacao({ total, anterior }: { total: number; anterior: number }) {
  if (!anterior && !total) return <span className="text-[12px] text-[var(--tinta-2)]">sem movimento ainda</span>;
  if (!anterior) return <span className="text-[12px] font-semibold text-[#166534]">novo no período</span>;
  const p = Math.round(((total - anterior) / anterior) * 100);
  if (p === 0) return <span className="text-[12px] text-[var(--tinta-2)]">igual ao período anterior</span>;
  return <span className={`text-[12px] font-semibold ${p > 0 ? "text-[#166534]" : "text-[#B42318]"}`}>{p > 0 ? "▲" : "▼"} {Math.abs(p)}% <span className="font-normal text-[var(--tinta-2)]">vs. período anterior</span></span>;
}

export function GraficoResultados({ metricas, dias }: { metricas: Metrica[]; dias: number }) {
  const [sel, setSel] = useState(metricas[0]?.id ?? "");
  const [tabela, setTabela] = useState(false);
  const [foco, setFoco] = useState<number | null>(null);
  // o desenho usa a largura real (no celular as letras não encolhem junto com o gráfico)
  const [W, setW] = useState(720);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const m = metricas.find((x) => x.id === sel) ?? metricas[0];
  if (!m) return null;
  const max = Math.max(1, ...m.serie.map((x) => x.n));
  // escala "redonda" para a grade: 1, 2, 5, 10, 20, 50…
  const passo = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((p) => max / p <= 4) ?? 1000;
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const H = W < 520 ? 190 : 230, esq = 30, base = H - 22, alto = base - 10;
  const larg = (W - esq) / m.serie.length, barra = Math.max(2, larg - 2);
  const marcas = Array.from({ length: Math.floor(topo / passo) + 1 }, (_, i) => i * passo);
  const rotuloCada = Math.max(dias <= 7 ? 1 : 5, Math.ceil(46 / larg / 5) * 5 || 1);
  const f = foco != null ? m.serie[foco] : null;
  return (
    <div>
      {/* troca de métrica: o número grande de cada uma, a escolhida fica com a cor dela */}
      <div className="sem-barra -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Métrica do gráfico">
        {metricas.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === m.id} onClick={() => { setSel(x.id); setFoco(null); }}
            className={`min-w-[9.5rem] shrink-0 rounded-2xl border px-4 py-3 text-left transition-colors ${x.id === m.id ? "border-transparent text-white" : "border-[var(--linha)] bg-white hover:bg-[var(--cinza)]"}`}
            style={x.id === m.id ? { background: x.cor } : undefined}>
            <div className={`text-[12px] font-semibold uppercase tracking-wide ${x.id === m.id ? "text-white/80" : "text-[var(--tinta-2)]"}`}>{x.nome}</div>
            <div className="mt-0.5 text-[1.9rem] font-bold leading-none tabular-nums">{x.total.toLocaleString("pt-BR")}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--linha)] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div><h2 className="!text-[1.2rem] !leading-tight">{m.nome} por dia</h2><p className="text-[13px] text-[var(--tinta-2)]">{m.explica}</p></div>
          <Variacao total={m.total} anterior={m.anterior} />
        </div>
        <div ref={caixa} className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full" role="img" aria-label={`${m.nome} por dia nos últimos ${dias} dias: total ${m.total}`} onMouseLeave={() => setFoco(null)}>
            {marcas.map((v) => { const y = base - (v / topo) * alto; return (
              <g key={v}><line x1={esq} x2={W} y1={y} y2={y} stroke="#E6E8EC" strokeWidth={1} /><text x={esq - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#6B7380">{v}</text></g>
            ); })}
            {m.serie.map((x, i) => {
              const h = x.n ? Math.max(5, (x.n / topo) * alto) : 0, bx = esq + i * larg + 1, r = Math.min(4, barra / 2);
              return (
                <g key={`${m.id}-${x.dia}`} onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)}>
                  {/* área de toque maior que a barra */}
                  <rect x={esq + i * larg} y={0} width={larg} height={base} fill="transparent" />
                  {h > 0 && <path className="barra-cresce" style={{ animationDelay: `${Math.min(i * 12, 400)}ms` }} d={`M${bx},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${Math.max(0, barra - 2 * r)} q${r},0 ${r},${r} v${h - r} z`} fill={m.cor} opacity={foco == null || foco === i ? 1 : 0.45} />}
                  {i % rotuloCada === 0 && <text x={bx + barra / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#6B7380">{diaCurto(x.dia)}</text>}
                </g>
              );
            })}
            <line x1={esq} x2={W} y1={base} y2={base} stroke="#C9CED6" strokeWidth={1} />
          </svg>
          {f && foco != null && (
            <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl bg-[#1D2128] px-3 py-1.5 text-[12px] text-white shadow-lg" style={{ left: `${((esq + foco * larg + larg / 2) / W) * 100}%` }}>
              <b className="tabular-nums">{f.n.toLocaleString("pt-BR")}</b> · {semana(f.dia)}, {diaCurto(f.dia)}
            </div>
          )}
        </div>
        <button onClick={() => setTabela((t) => !t)} className="mt-2 text-[13px] font-semibold text-[var(--azul)] hover:underline">{tabela ? "Esconder a tabela" : "Ver em tabela"}</button>
        {tabela && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--linha)]">
            <table className="w-full text-[14px]"><thead className="sticky top-0 bg-[var(--cinza)] text-left"><tr><th className="px-3 py-1.5 font-semibold">Dia</th><th className="px-3 py-1.5 text-right font-semibold">{m.nome}</th></tr></thead>
              <tbody>{[...m.serie].reverse().map((x) => <tr key={x.dia} className="border-t border-[var(--linha)]"><td className="px-3 py-1">{semana(x.dia)}, {diaCurto(x.dia)}</td><td className="px-3 py-1 text-right tabular-nums">{x.n}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// "Indique um vizinho": copiar o link e mandar pelo WhatsApp
export function CompartilharIndicacao({ link, codigo }: { link: string; codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Abri a minha loja no WorkEnd, a cidade 3D das empresas. Pelo meu link você tem 10% no 1º mês do seu lote: ${link}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt("Copie o seu link:", link); } };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <code className="min-w-0 max-w-full truncate rounded-xl bg-white px-3 py-2 text-[14px] text-[var(--tinta)]">{link}</code>
      <button onClick={copiar} className="btn btn-azul !py-2">{copiado ? "Copiado ✓" : "Copiar link"}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="btn btn-linha !py-2">Mandar no WhatsApp</a>
      <span className="text-[13px] text-[var(--tinta-2)]">ou passe o código <b className="tracking-wider text-[var(--tinta)]">{codigo}</b></span>
    </div>
  );
}
