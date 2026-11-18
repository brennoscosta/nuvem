"use client";
// Vendas por dia (17/11/2026, "Quanto a sua equipe trouxe"): uma série só, as vendas confirmadas em R$ pelo dia do
// pagamento. Barras finas com a ponta arredondada (4 px) saindo da base, grade discreta, legenda, o valor ao passar o
// mouse ou tocar na barra e a mesma série em tabela. O texto fica sempre na cor do texto; só a barra usa a cor das vendas.
import { useEffect, useRef, useState } from "react";

export const COR_VENDAS = "#6D28D9";
type Dia = { dia: string; centavos: number; pedidos: number };

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// rótulos curtos do eixo e da maior barra: R$ 0, R$ 500, R$ 1,5 mil
const curto = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`);
const diaCurto = (d: string) => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; };
const semana = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
// grade em números redondos (1, 2, 5, 10, 20, 50… reais), no máximo 4 faixas
const PASSOS = Array.from({ length: 27 }, (_, i) => [1, 2, 5][i % 3] * 10 ** Math.floor(i / 3));

export function GraficoVendas({ serie, quando }: { serie: Dia[]; quando: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  // o desenho usa a largura real da caixa (no celular as letras não encolhem junto com o gráfico)
  const [W, setW] = useState(640);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const n = Math.max(1, serie.length);
  const maxR = Math.max(1, ...serie.map((x) => x.centavos / 100));
  const passo = PASSOS.find((p) => maxR / p <= 4) ?? PASSOS[PASSOS.length - 1];
  const topo = Math.max(passo, Math.ceil(maxR / passo) * passo);
  const marcas = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const celular = W < 520;
  const H = celular ? 190 : 230, esq = celular ? 58 : 66, dir = 4, base = H - 24, alto = base - 18;
  const larg = (W - esq - dir) / n, barra = Math.max(3, Math.min(16, larg * 0.6));
  const cada = n <= 7 ? 1 : Math.max(5, Math.ceil(46 / larg / 5) * 5);
  const total = serie.reduce((a, x) => a + x.centavos, 0);
  const iMax = serie.reduce((m, x, i) => (x.centavos > (serie[m]?.centavos ?? 0) ? i : m), 0);
  const f = foco != null ? serie[foco] : null;
  const xDe = (i: number) => esq + i * larg + larg / 2;
  const altura = (c: number) => (c ? Math.max(4, (c / 100 / topo) * alto) : 0);

  // rótulo direto só na maior barra (quando nada está em foco), sem sair da caixa
  const xm = xDe(iMax), ancora = xm > W - 36 ? "end" : xm < esq + 30 ? "start" : "middle";
  const xRot = ancora === "end" ? W - dir : ancora === "start" ? esq : xm;

  return (
    <div>
      <p className="rs-legenda"><span><i style={{ background: COR_VENDAS }} aria-hidden="true" />Vendas confirmadas (R$ por dia)</span></p>
      <div ref={caixa} className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full" role="img" aria-label={`Vendas confirmadas por dia, ${quando}: total de ${reais(total)}`} onPointerLeave={() => setFoco(null)}>
          {marcas.map((v) => { const y = base - (v / topo) * alto; return (
            <g key={v}><line x1={esq} x2={W - dir} y1={y} y2={y} stroke="#E6E8EC" strokeWidth={1} /><text x={esq - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#5A6472">{curto(v)}</text></g>
          ); })}
          {serie.map((x, i) => {
            const h = altura(x.centavos), cx = xDe(i), bx = cx - barra / 2, r = Math.min(4, barra / 2, h);
            return (
              <g key={x.dia}>
                {/* área de toque: a coluna inteira do dia, maior que a barra */}
                <rect x={esq + i * larg} y={0} width={larg} height={base + 4} fill="transparent" onPointerEnter={() => setFoco(i)} onClick={() => setFoco(i)} />
                {h > 0 && <path className="barra-cresce" pointerEvents="none" style={{ animationDelay: `${Math.min(i * 12, 360)}ms` }}
                  d={`M${bx},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${Math.max(0, barra - 2 * r)} q${r},0 ${r},${r} v${h - r} z`} fill={COR_VENDAS} opacity={foco == null || foco === i ? 1 : 0.4} />}
                {i % cada === 0 && <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fill="#5A6472">{diaCurto(x.dia)}</text>}
              </g>
            );
          })}
          <line x1={esq} x2={W - dir} y1={base} y2={base} stroke="#C3CCD7" strokeWidth={1} />
          {foco == null && total > 0 && <text x={xRot} y={base - altura(serie[iMax].centavos) - 6} textAnchor={ancora} fontSize={12} fontWeight={600} fill="#1D2128">{curto(serie[iMax].centavos / 100)}</text>}
        </svg>
        {f && foco != null && (
          // a dica fica ao lado da barra (à direita na metade esquerda, à esquerda na outra), sem cobrir a barra
          <div className="rs-dica" style={xDe(foco) < W / 2 ? { left: `${xDe(foco) + barra / 2 + 8}px` } : { left: `${xDe(foco) - barra / 2 - 8}px`, transform: "translateX(-100%)" }}>
            <b>{reais(f.centavos)}</b>
            <span>{f.pedidos ? plural(f.pedidos, "pedido pago", "pedidos pagos") : "nenhuma venda"} · {semana(f.dia)}, {diaCurto(f.dia)}</span>
          </div>
        )}
      </div>
      <button onClick={() => setTabela((t) => !t)} className="mt-2 text-[13px] font-semibold text-[var(--azul)] hover:underline">{tabela ? "Esconder a tabela" : "Ver em tabela"}</button>
      {tabela && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--linha)]">
          <table className="w-full text-[14px]">
            <thead className="sticky top-0 bg-[var(--cinza)] text-left"><tr><th className="px-3 py-1.5 font-semibold">Dia</th><th className="px-3 py-1.5 text-right font-semibold">Pedidos pagos</th><th className="px-3 py-1.5 text-right font-semibold">Vendas</th></tr></thead>
            <tbody>{[...serie].reverse().map((x) => <tr key={x.dia} className="border-t border-[var(--linha)]"><td className="px-3 py-1">{semana(x.dia)}, {diaCurto(x.dia)}</td><td className="px-3 py-1 text-right tabular-nums">{x.pedidos}</td><td className="px-3 py-1 text-right tabular-nums">{reais(x.centavos)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
