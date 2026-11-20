"use client";
// Peças do editor de visual do personagem (16/11/2026): paleta de cores com cor livre, cartões de opção com retrato e
// interruptor. Usadas no painel "Meu personagem" (ui/Personagem.tsx).
import { useId, type ReactNode } from "react";
import { Icone } from "./Icone";

const claro = (hex: string) => { const n = parseInt(hex.slice(1), 16) || 0; return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170; };
const TITULO = "text-[13px] font-semibold text-[#1D2128]";

// Paleta: bolinhas com as cores sugeridas + uma bolinha de cor livre (abre o seletor do aparelho). `nenhum` acrescenta
// a opção "sem cor" no começo (valor "").
export function Cores({ titulo, cores, valor, mudar, nenhum }: { titulo: string; cores: string[]; valor: string; mudar: (c: string) => void; nenhum?: string }) {
  const id = useId();
  const v = (valor ?? "").toUpperCase();
  const livre = !!v && !cores.some((c) => c.toUpperCase() === v);
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className={`flex w-full items-center justify-between ${TITULO}`}>{titulo}<span className="text-[11px] font-normal text-[#8A93A3]">{v ? v : nenhum}</span></legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {nenhum !== undefined && (
          <button type="button" onClick={() => mudar("")} aria-pressed={!v} title={nenhum} aria-label={nenhum} className={`grid h-8 w-8 place-items-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_#D5DAE1] ${!v ? "ring-2 ring-[#1D4ED8] ring-offset-2" : ""}`}>
            <span className="h-[2px] w-5 rotate-45 rounded bg-[#B8BFC9]" />
          </button>
        )}
        {cores.map((c) => {
          const sel = c.toUpperCase() === v;
          return (
            <button key={c} type="button" onClick={() => mudar(c)} aria-pressed={sel} aria-label={`Cor ${c}`} title={c} className={`grid h-8 w-8 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)] transition-transform hover:scale-110 ${sel ? "ring-2 ring-[#1D4ED8] ring-offset-2" : ""}`} style={{ background: c }}>
              {sel && <Icone nome="check" tamanho={16} traco={2.6} className={claro(c) ? "text-[#1D2128]" : "text-white"} />}
            </button>
          );
        })}
        <label htmlFor={id} title="Escolher outra cor" className={`relative grid h-8 w-8 cursor-pointer place-items-center rounded-full ${livre ? "ring-2 ring-[#1D4ED8] ring-offset-2" : ""}`} style={{ background: livre ? v : "conic-gradient(#EF4444,#F59E0B,#FACC15,#22C55E,#06B6D4,#3B82F6,#8B5CF6,#EC4899,#EF4444)" }}>
          <span className={`grid h-5 w-5 place-items-center rounded-full ${livre ? "" : "bg-white"}`}><Icone nome="contaGotas" tamanho={13} className={livre && !claro(v) ? "text-white" : "text-[#1D2128]"} /></span>
          <input id={id} type="color" aria-label={`${titulo}: outra cor`} value={/^#[0-9A-F]{6}$/.test(v) ? v.toLowerCase() : "#888888"} onChange={(e) => mudar(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </fieldset>
  );
}

// Cartões de opção (penteado, barba, tipo de roupa), cada um com o retrato do personagem já com aquela opção.
// 20/11/2026: `selo` marca o item pago (preço com cadeado ou "seu") no canto do cartão; `dica` aparece abaixo da lista.
export type Opcao<T extends string> = { id: T; nome: string; figura: ReactNode; selo?: ReactNode };
export function Opcoes<T extends string>({ titulo, opcoes, valor, mudar, colunas = 4, dica }: { titulo: string; opcoes: Opcao<T>[]; valor: T; mudar: (v: T) => void; colunas?: 3 | 4 | 5; dica?: ReactNode }) {
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className={TITULO}>{titulo}</legend>
      <div className={`mt-2 grid gap-2 ${colunas === 3 ? "grid-cols-3" : colunas === 5 ? "grid-cols-4 min-[420px]:grid-cols-5" : "grid-cols-4"}`}>
        {opcoes.map((o) => {
          const sel = o.id === valor;
          return (
            <button key={o.id} type="button" onClick={() => mudar(o.id)} aria-pressed={sel} data-opcao={o.id} className={`relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 p-1.5 pb-2 transition-colors ${sel ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-transparent bg-[#F4F6F9] hover:bg-[#EBEEF3]"}`}>
              <span className="overflow-hidden rounded-xl">{o.figura}</span>
              <span className={`w-full truncate text-center text-[11px] font-semibold ${sel ? "text-[#1D4ED8]" : "text-[#3A414C]"}`}>{o.nome}</span>
              {o.selo && <span className="pointer-events-none absolute right-1 top-1">{o.selo}</span>}
            </button>
          );
        })}
      </div>
      {dica && <div className="mt-2 text-[11px] text-[#5B6472]">{dica}</div>}
    </fieldset>
  );
}

// Selo do item pago no cartão: preço com cadeado (ainda não comprou) ou "seu"
export function SeloPago({ preco, tem }: { preco: string; tem: boolean }) {
  return tem
    ? <span className="rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[9px] font-bold text-white">seu</span>
    : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1D2128] px-1.5 py-0.5 text-[9px] font-bold text-white"><Icone nome="cadeado" tamanho={10} traco={2.4} />{preco}</span>;
}

// Figuras das peças que não aparecem no retrato (parte de baixo e sapatos), na cor escolhida. Grade de 48.
const esc = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16) || 0; const c = (s: number) => Math.round(((n >> s) & 255) * (1 - k)); return `rgb(${c(16)},${c(8)},${c(0)})`; };
export function FiguraPeca({ tipo, cor, tamanho = 54 }: { tipo: string; cor: string; tamanho?: number }) {
  const borda = esc(cor, 0.25), pele = "#E7B48C";
  const corpo: Record<string, ReactNode> = {
    calca: <path d="M15 8h18l2 34h-7l-4-24-4 24h-7z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" />,
    jeans: <><path d="M15 8h18l2 34h-7l-4-24-4 24h-7z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" /><path d="M15.6 12.5h16.8M18 8.4v4M30 8.4v4" stroke="#E9C46A" strokeWidth="0.9" strokeDasharray="1.4 1.2" fill="none" /><path d="M13.4 38.6h7.4M27.2 38.6h7.4" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="2.2" /></>,
    bermuda: <><path d="M15 8h18l2 18h-8l-3-9-3 9h-8z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" /><path d="M14.2 27h7.2l-.6 14h-5.2zM26.6 27h7.2l-.8 14h-5.2z" fill={pele} /></>,
    saia: <><path d="M17 8h14l6 22H11z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" /><path d="M17 30h5l-.4 12h-4.2zM26 30h5l-.4 12h-4.2z" fill={pele} /></>,
    vestido: <path d="M19 5h10l1 7 6 30H12l6-30z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" />,
    tenis: <><path d="M7 30c0-6 4-10 9-10l6 4c4 2 10 3 15 4 4 1 5 3 5 6v2H7z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" /><path d="M6 35h37v3H6z" fill="#FFFFFF" stroke="#C9CDD3" strokeWidth="1" /><path d="M18 25l3 2M21 23.5l3 2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" /></>,
    social: <><path d="M6 32c0-4 3-7 7-7h6c4 3 12 4 18 5 4 .6 6 2 6 4v2H6z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" /><path d="M5 36h39v2.4H5zM6 36h6v4H6z" fill="#17191D" /><path d="M30 29.4c3 .5 6 1 8 1.8" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.2" fill="none" strokeLinecap="round" /></>,
    sandalia: <><path d="M9 28c2-4 8-5 14-4l14 4c4 1 6 3 6 6H8z" fill={pele} /><path d="M6 34h38v3H6z" fill={cor} stroke={borda} strokeWidth="1" /><path d="M24 24l-2 10M33 27l-2 7M12 26l1 8" stroke={cor} strokeWidth="2.6" strokeLinecap="round" /></>,
    tenisGrife: <><path d="M9 30V14c0-2 1.5-3 3.4-3h6.6c1 3 1 6 0 9l3 3c4 2 9 3 14 4 4 1 6 3 6 6v2H9z" fill={cor} stroke={borda} strokeWidth="1.2" strokeLinejoin="round" /><path d="M8 35h37v3.4H8z" fill="#FFFFFF" stroke="#C9CDD3" strokeWidth="1" /><path d="M14 27c6-2 12-1 18 1.6M10 12h9.6" stroke="#D4A63A" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  };
  return <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} aria-hidden focusable="false" style={{ display: "block", background: "#FFFFFF" }}>{corpo[tipo] ?? null}</svg>;
}

// Silhueta para altura e biotipo: mesma figura, mais alta/baixa ou mais larga/fina
export function Silhueta({ altura = 1, largura = 1, cor, tamanho = 54 }: { altura?: number; largura?: number; cor: string; tamanho?: number }) {
  const h = 36 * altura, topo = 45 - h, w = 13 * largura;
  return (
    <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} aria-hidden focusable="false" style={{ display: "block", background: "#FFFFFF" }}>
      <path d="M4 45.5h40" stroke="#D5DAE1" strokeWidth="1" />
      <circle cx="24" cy={topo + h * 0.12} r={h * 0.12} fill="#C98E68" />
      <rect x={24 - w / 2} y={topo + h * 0.26} width={w} height={h * 0.38} rx={w * 0.32} fill={cor} />
      <rect x={24 - w * 0.38} y={topo + h * 0.6} width={w * 0.32} height={h * 0.4} rx={w * 0.14} fill="#2C3E50" />
      <rect x={24 + w * 0.06} y={topo + h * 0.6} width={w * 0.32} height={h * 0.4} rx={w * 0.14} fill="#2C3E50" />
    </svg>
  );
}

// Interruptor de liga/desliga com texto
export function Interruptor({ ligado, mudar, children }: { ligado: boolean; mudar: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => mudar(!ligado)} className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-[#F4F6F9] px-3 py-2.5 text-left text-[13px]">
      <span className="min-w-0 flex-1">{children}</span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${ligado ? "bg-[#1D4ED8]" : "bg-[#C9CFD8]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${ligado ? "left-[18px]" : "left-0.5"}`} /></span>
    </button>
  );
}
