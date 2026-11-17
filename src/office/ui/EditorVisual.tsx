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

// Cartões de opção (penteado, barba, tipo de roupa), cada um com o retrato do personagem já com aquela opção
export function Opcoes<T extends string>({ titulo, opcoes, valor, mudar, colunas = 4 }: { titulo: string; opcoes: { id: T; nome: string; figura: ReactNode }[]; valor: T; mudar: (v: T) => void; colunas?: 3 | 4 }) {
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className={TITULO}>{titulo}</legend>
      <div className={`mt-2 grid gap-2 ${colunas === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {opcoes.map((o) => {
          const sel = o.id === valor;
          return (
            <button key={o.id} type="button" onClick={() => mudar(o.id)} aria-pressed={sel} className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 p-1.5 pb-2 transition-colors ${sel ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-transparent bg-[#F4F6F9] hover:bg-[#EBEEF3]"}`}>
              <span className="overflow-hidden rounded-xl">{o.figura}</span>
              <span className={`w-full truncate text-center text-[11px] font-semibold ${sel ? "text-[#1D4ED8]" : "text-[#3A414C]"}`}>{o.nome}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
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
