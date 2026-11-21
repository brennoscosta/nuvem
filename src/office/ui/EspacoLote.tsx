"use client";
// Lote em quartos na interface (21/11/2026, data/quartosLote.ts, pedido do dono: "a pessoa pode usar 1/4 dessas áreas e, se
// quiser colocar só um quiosque, a pessoa pode, e fica sobrando 3/4 do terreno para ser usado ainda"):
//  - TamanhoNoLote: na aba Prédio do painel "Montar escritório" (e na troca de prédio), a escolha entre só um quiosque (1/4),
//    prédio médio (2/4, numa metade) e prédio grande (o lote inteiro, como sempre);
//  - EspacoDoLote: no cartão do lote do dono, o lote em 2 × 2 (o norte em cima) com o que cada quarto tem e as ações para
//    CRESCER DEPOIS: pôr mais um quiosque num quarto livre (até 4), o prédio médio numa metade livre, posicionar cada estrutura
//    (modo "Editar posição") e trocar tudo pelo prédio grande. O botão "Usar este espaço" do chão (scene/QuartosLote.tsx)
//    abre aqui o quarto escolhido.
// Preço: nada disso cobra. O lote continua R$ 99/mês (decisão do dono) e trocar o modelo do prédio segue a regra das trocas.
// Quem confere e grava é o servidor (src/server/quartos.ts e src/server/terrenos.ts › salvarEscritorio).
import { create } from "zustand";
import { useState } from "react";
import { useMundo } from "../mundoStore";
import { useEdicao } from "../edicaoStore";
import { LOTE_POR_CHAVE } from "../data/mundo";
import { MODELO, MODELOS_MEDIO, modeloDe, modelosLiberados, cabeEmMeioLote } from "../data/modelos";
import { quartosDoTerreno, anexosDe, prepararQuartos, estruturasDoLote, ID_PREDIO } from "../data/posicaoPredio";
import {
  MAX_QUIOSQUES_LOTE, NOME_METADE, NOME_QUARTO, NOME_TAMANHO, QUARTOS, QUARTOS_DA_METADE, MODELOS_QUIOSQUE_LOTE, comMaisUmQuiosque, comPredioMedio,
  metadesLivres, quartosLivres, soUmQuiosque, tamanhoDoLote, type Quarto, type QuartosLote, type ModeloQuiosqueLote, type TamanhoLote,
} from "../data/quartosLote";
import type { Escritorio } from "../data/escritorio";
import { Icone } from "./Icone";

// o quarto que o dono tocou no chão ("Usar este espaço")
export const useEspacoLote = create<{ chave: string | null; quarto: Quarto | null; escolher: (chave: string, quarto: Quarto) => void; limpar: () => void }>((set) => ({
  chave: null, quarto: null,
  escolher: (chave, quarto) => { set({ chave, quarto }); const m = useMundo.getState(); if (m.loteSelecionado !== chave) m.selecionarLote(chave); },
  limpar: () => set({ chave: null, quarto: null }),
}));

// grava a divisão nova do lote (o servidor confere tudo de novo) e recarrega o mapa
export async function gravarQuartos(chave: string, quartos: QuartosLote | null): Promise<string | null> {
  try {
    const r = await fetch(`/api/terrenos/${encodeURIComponent(chave)}/quartos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quartos }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? "Não deu para mudar o lote agora. Tente de novo.";
    await useMundo.getState().carregar();
    return null;
  } catch { return "Sem conexão. Tente de novo."; }
}
const nomeQuiosque = (q: QuartosLote, id: string) => (q.quiosques.length > 1 ? `Quiosque ${q.quiosques.findIndex((k) => k.id === id) + 1}` : "Quiosque");

// o lote em 2 × 2, com a rua marcada nos lados que dão para ela
function MapaQuartos({ q, k, pedido, onLivre }: { q: QuartosLote; k: number; pedido: Quarto | null; onLivre: (x: Quarto) => void }) {
  const ruaN = k < 2, ruaS = k >= 2, ruaO = k % 2 === 0, ruaL = k % 2 === 1;
  const rua = "bg-[#3A414D] text-[9px] font-bold uppercase tracking-wide text-white/80 grid place-items-center";
  const medio: Quarto[] = q.predio ? QUARTOS_DA_METADE[q.predio.metade] : [];
  const area = (x: Quarto) => ({ gridColumn: (x % 2) + 1, gridRow: (x >= 2 ? 1 : 0) + 1 });
  return (
    <div className="mx-auto mt-2 grid w-full max-w-[15rem] grid-cols-[14px_1fr_14px] grid-rows-[14px_auto_14px] gap-0.5" aria-label="Os quatro quartos do lote">
      <div className={`col-start-2 row-start-1 rounded-t ${ruaN ? rua : ""}`}>{ruaN ? "rua" : ""}</div>
      <div className={`col-start-1 row-start-2 rounded-l ${ruaO ? rua : ""}`}>{ruaO ? <span className="-rotate-90">rua</span> : ""}</div>
      <div className="col-start-2 row-start-2 grid aspect-square grid-cols-2 grid-rows-2 gap-1 rounded-xl bg-[#DCEBD3] p-1">
        {q.predio && (
          <div className="flex items-center justify-center rounded-lg bg-[#1D4ED8] px-1 text-center text-[11px] font-bold leading-tight text-white"
            style={q.predio.metade === "n" || q.predio.metade === "s" ? { gridColumn: "1 / span 2", gridRow: q.predio.metade === "n" ? 1 : 2 } : { gridRow: "1 / span 2", gridColumn: q.predio.metade === "o" ? 1 : 2 }}>
            <span><Icone nome="escritorio" tamanho={15} className="mx-auto mb-0.5 block" />Prédio médio</span>
          </div>
        )}
        {QUARTOS.filter((x) => !medio.includes(x)).map((x) => {
          const kq = q.quiosques.find((z) => z.quarto === x);
          if (kq) return <div key={x} style={area(x)} className="flex items-center justify-center rounded-lg bg-[#0F766E] px-1 text-center text-[11px] font-bold leading-tight text-white"><span><Icone nome="quiosque" tamanho={15} className="mx-auto mb-0.5 block" />{nomeQuiosque(q, kq.id)}</span></div>;
          return (
            <button key={x} type="button" data-quarto-livre={x} onClick={() => onLivre(x)} style={area(x)}
              className={`grid place-items-center rounded-lg border-2 border-dashed text-[11px] font-semibold leading-tight ${pedido === x ? "border-[#1D4ED8] bg-[#EEF3FF] text-[#1D4ED8]" : "border-white/90 text-[#3A5A2F] hover:bg-white/40"}`}>
              <span><Icone nome="mais" tamanho={14} className="mx-auto block" />Livre</span>
            </button>
          );
        })}
      </div>
      <div className={`col-start-3 row-start-2 rounded-r ${ruaL ? rua : ""}`}>{ruaL ? <span className="rotate-90">rua</span> : ""}</div>
      <div className={`col-start-2 row-start-3 rounded-b ${ruaS ? rua : ""}`}>{ruaS ? "rua" : ""}</div>
    </div>
  );
}

// ---------- no cartão do lote (dono, lote em quartos) ----------
export function EspacoDoLote({ chave }: { chave: string }) {
  const t = useMundo((s) => s.terrenos[chave]);
  const terrenos = useMundo((s) => s.terrenos);
  const pedido = useEspacoLote((s) => (s.chave === chave ? s.quarto : null));
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null), [confirma, setConfirma] = useState(false);
  const e = t?.escritorio ?? null, l = LOTE_POR_CHAVE[chave];
  const q = e && t ? quartosDoTerreno(t, anexosDe(terrenos)[chave] ?? null) : null;
  if (!e || !q || !l) return null;
  const livres = quartosLivres(q), metades = metadesLivres(q), ests = estruturasDoLote(q, e);
  const mudar = async (novo: QuartosLote | null, novos: string[] = []) => {
    if (ocupado) return;
    setErro(null); setOcupado(true);
    // quem chega já vem de frente para a rua (o servidor confere de novo e acerta o giro se não houver passagem)
    const pronto = novo ? prepararQuartos(chave, { ...e, decor: { ...e.decor!, quartos: novo } }, novos).decor?.quartos ?? novo : null;
    const r = await gravarQuartos(chave, pronto);
    setOcupado(false); setConfirma(false);
    if (r) setErro(r); else useEspacoLote.getState().limpar();
  };
  const metadeDo = (x: Quarto | null) => (x == null ? undefined : metades.find((m) => QUARTOS_DA_METADE[m].includes(x)));
  const maisQuiosque = (x?: Quarto) => { const n = comMaisUmQuiosque(q, l.k, x); if (n) void mudar(n, [n.quiosques[n.quiosques.length - 1].id]); };
  const predioMedio = (x?: Quarto) => { const n = comPredioMedio(q, l.k, metadeDo(x ?? null)); if (n) void mudar(n, [ID_PREDIO]); };
  const podeQuiosque = livres.length > 0 && q.quiosques.length < MAX_QUIOSQUES_LOTE, podeMedio = !q.predio && metades.length > 0;
  const modeloMedio = cabeEmMeioLote(modeloDe(e)) ? MODELO[modeloDe(e)!].nome : MODELO.escritorio.nome;
  const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold disabled:opacity-50";
  return (
    <div data-guia="espaco-lote" className="mt-2 rounded-2xl bg-[#F6F7F9] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-bold text-[#1D2128]">Espaço do lote</div>
        <div className="text-[11px] text-[#5B6472]">{livres.length === 0 ? "lote todo usado" : `${livres.length} de 4 quartos livres`}</div>
      </div>
      <MapaQuartos q={q} k={l.k} pedido={pedido} onLivre={(x) => useEspacoLote.getState().escolher(chave, x)} />
      {pedido != null && livres.includes(pedido) && (
        <div className="mt-2 rounded-xl bg-[#EEF3FF] p-2.5 text-[12px] text-[#1D2128]" data-quarto-escolhido={pedido}>
          <div className="font-bold text-[#1D4ED8]">Quarto {NOME_QUARTO[pedido]} livre</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {podeQuiosque && <button type="button" disabled={ocupado} onClick={() => maisQuiosque(pedido)} className={`${btn} bg-[#0F766E] text-white`}><Icone nome="quiosque" tamanho={15} />Pôr quiosque aqui</button>}
            {podeMedio && metadeDo(pedido) && <button type="button" disabled={ocupado} onClick={() => predioMedio(pedido)} className={`${btn} bg-[#1D4ED8] text-white`}><Icone nome="escritorio" tamanho={15} />Prédio médio na metade {NOME_METADE[metadeDo(pedido)!]}</button>}
            <button type="button" onClick={() => useEspacoLote.getState().limpar()} className={`${btn} bg-white text-[#5B6472]`}>Agora não</button>
          </div>
        </div>
      )}
      <ul className="mt-2 space-y-1.5">
        {ests.map((s) => {
          const kq = q.quiosques.find((x) => x.id === s.id);
          return (
            <li key={s.id} data-estrutura={s.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/5">
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white ${s.tamanho === "medio" ? "bg-[#1D4ED8]" : "bg-[#0F766E]"}`}><Icone nome={s.tamanho === "medio" ? "escritorio" : "quiosque"} tamanho={15} /></span>
                <div className="min-w-0 flex-1 text-[12px] leading-tight">
                  <div className="font-bold">{s.tamanho === "medio" ? `Prédio médio · ${MODELO[modeloDe(e) ?? "escritorio"]?.nome ?? ""}` : nomeQuiosque(q, s.id)}</div>
                  <div className="text-[#5B6472]">{s.tamanho === "medio" ? `metade ${NOME_METADE[q.predio!.metade]}` : `quarto ${NOME_QUARTO[kq!.quarto]}`}</div>
                </div>
                <button type="button" data-posicionar={s.id} onClick={() => { const r = useEdicao.getState().abrir(chave, s.id); if (r) setErro(r); }} className="rounded-lg bg-[#EEF3FF] px-2 py-1.5 text-[11.5px] font-bold text-[#1D4ED8]" title="Girar e trocar de quarto"><Icone nome="posicao" tamanho={14} className="mr-0.5 inline align-[-2px]" />Posicionar</button>
                {ests.length > 1 && kq && <button type="button" disabled={ocupado} onClick={() => void mudar({ ...q, quiosques: q.quiosques.filter((x) => x.id !== s.id) })} className="rounded-lg px-1.5 py-1.5 text-[#8A2A2A] hover:bg-[#FDE8E8]" title="Tirar este quiosque"><Icone nome="fechar" tamanho={14} /><span className="sr-only">Tirar este quiosque</span></button>}
              </div>
              {kq && (
                <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Desenho do quiosque">
                  {MODELOS_QUIOSQUE_LOTE.map((m) => <button key={m.id} type="button" disabled={ocupado} aria-pressed={kq.modelo === m.id} onClick={() => { if (kq.modelo !== m.id) void mudar({ ...q, quiosques: q.quiosques.map((x) => (x.id === kq.id ? { ...x, modelo: m.id as ModeloQuiosqueLote } : x)) }); }} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kq.modelo === m.id ? "bg-[#0F766E] text-white" : "bg-[#F1F3F6] text-[#3A414D]"}`}>{m.nome}</button>)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 grid gap-1.5">
        {podeQuiosque && pedido == null && <button type="button" data-acao="mais-quiosque" disabled={ocupado} onClick={() => maisQuiosque()} className={`${btn} bg-[#0F766E] text-white`}><Icone nome="quiosque" tamanho={16} />Pôr mais um quiosque</button>}
        {podeMedio && pedido == null && <button type="button" data-acao="predio-medio" disabled={ocupado} onClick={() => predioMedio()} className={`${btn} bg-[#1D4ED8] text-white`}><Icone nome="escritorio" tamanho={16} />Pôr um prédio médio na metade livre</button>}
        {confirma ? (
          <div className="rounded-xl bg-[#FFF4D6] p-2 text-[12px] text-[#7A5A00]">
            O prédio grande ocupa o lote inteiro: {q.quiosques.length ? `${q.quiosques.length === 1 ? "o quiosque sai" : `os ${q.quiosques.length} quiosques saem`}` : "o prédio médio cresce"}. A equipe e a marca continuam.
            <div className="mt-1.5 flex gap-1.5"><button type="button" data-acao="confirmar-grande" disabled={ocupado} onClick={() => void mudar(null)} className={`${btn} flex-1 bg-[#1D2128] text-white`}>Trocar pelo prédio grande</button><button type="button" onClick={() => setConfirma(false)} className={`${btn} bg-white text-[#5B6472]`}>Voltar</button></div>
          </div>
        ) : <button type="button" data-acao="predio-grande" disabled={ocupado} onClick={() => setConfirma(true)} className={`${btn} bg-white text-[#1D2128] ring-1 ring-black/10`}><Icone nome="predios" tamanho={16} />Trocar tudo por um prédio grande</button>}
      </div>
      {podeMedio && <div className="mt-1.5 text-[11px] leading-snug text-[#5B6472]">O prédio médio entra como {modeloMedio}; os modelos que cabem em meio lote ficam em Montar escritório › Prédio.</div>}
      <div className="mt-1 text-[11px] leading-snug text-[#5B6472]">Usar os quartos livres não custa nada: o lote continua no mesmo valor por mês.</div>
      {ocupado && <div className="mt-1 text-[11.5px] font-semibold text-[#1D4ED8]">Arrumando o lote…</div>}
      {erro && <div className="mt-1 text-[12px] font-semibold text-[#E2575B]">{erro}</div>}
    </div>
  );
}

// ---------- na aba Prédio do "Montar escritório" ----------
const OPCOES: { id: TamanhoLote; quartos: string; desc: string }[] = [
  { id: "quiosque", quartos: "1/4", desc: "Um quiosque num quarto. Sobram 3/4 para crescer depois." },
  { id: "medio", quartos: "2/4", desc: "Meio lote, numa das metades. A outra metade fica livre." },
  { id: "grande", quartos: "4/4", desc: "O lote inteiro, como sempre." },
];
export function TamanhoNoLote({ chave, e, set, duplo }: { chave: string; e: Escritorio; set: (e: Escritorio) => void; duplo: boolean }) {
  const salvo = useMundo((s) => s.terrenos[chave]?.escritorio ?? null);
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  if (duplo) return <div className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-[11px] text-[#5B6472]">No lote duplo o prédio grande ocupa os dois terrenos.</div>;
  const q = e.decor?.quartos ?? null, atual = tamanhoDoLote(q);
  const escolher = (t: TamanhoLote) => {
    if (t === atual) return;
    const d = e.decor!;
    if (t === "grande") { set({ ...e, decor: { ...d, quartos: null } }); return; }
    if (t === "quiosque") { set(prepararQuartos(chave, { ...e, decor: { ...d, quartos: soUmQuiosque(l.k, q?.quiosques[0]?.modelo) } }, ["q1"])); return; }
    // prédio médio: na metade da rua da frente (os quiosques que já estão na outra metade ficam); se o modelo não cabe em meio
    // lote, entra o primeiro modelo médio que já é da empresa (o escritório básico é grátis)
    const n = comPredioMedio(q && !q.predio ? q : null, l.k); if (!n) return;
    let novo: Escritorio = { ...e, decor: { ...d, quartos: n } };
    if (!cabeEmMeioLote(modeloDe(e))) { const lib = modelosLiberados(salvo ?? e), m = MODELOS_MEDIO.find((x) => lib.has(x)) ?? "escritorio"; novo = { ...novo, modelo: m, layout: MODELO[m].base }; }
    set(prepararQuartos(chave, novo, [ID_PREDIO, ...n.quiosques.map((x) => x.id)]));
  };
  return (
    <div data-guia="tamanho-lote" className="rounded-xl border border-black/10 bg-white p-2.5">
      <div className="text-[12px] font-bold text-[#5B6472]">Quanto do lote usar</div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tamanho no lote">
        {OPCOES.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={atual === o.id} data-tamanho={o.id} onClick={() => escolher(o.id)}
            className={`rounded-xl border-2 px-1.5 py-2 text-center ${atual === o.id ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-black/10 hover:bg-black/[0.02]"}`}>
            <Icone nome={o.id === "quiosque" ? "quiosque" : o.id === "medio" ? "escritorio" : "predios"} tamanho={18} className={`mx-auto block ${atual === o.id ? "text-[#1D4ED8]" : "text-[#3A414D]"}`} />
            <span className="mt-0.5 block text-[12px] font-bold leading-tight">{NOME_TAMANHO[o.id]}</span>
            <span className="block text-[10.5px] font-semibold text-[#5B6472]">{o.quartos} do lote</span>
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[11px] leading-snug text-[#5B6472]">{OPCOES.find((o) => o.id === atual)?.desc} {atual !== "grande" ? "Depois, pelo cartão do lote, você põe mais quiosques ou um prédio médio nos quartos livres, sem pagar a mais." : ""}</div>
      {atual === "medio" && <div className="mt-1 text-[11px] leading-snug text-[#5B6472]">Cabem em meio lote: {MODELOS_MEDIO.map((x) => MODELO[x].nome).join(", ")}.</div>}
    </div>
  );
}
// desenho dos quiosques (no lote só com quiosques, no lugar do catálogo de prédios)
export function EstiloDosQuiosques({ e, set }: { e: Escritorio; set: (e: Escritorio) => void }) {
  const q = e.decor?.quartos; if (!q || q.predio) return null;
  return (
    <div className="rounded-xl border border-black/10 bg-white p-2.5">
      <div className="text-[12px] font-bold text-[#5B6472]">Desenho do quiosque</div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {MODELOS_QUIOSQUE_LOTE.map((m) => {
          const ativo = q.quiosques.every((k) => k.modelo === m.id);
          return <button key={m.id} type="button" aria-pressed={ativo} onClick={() => set({ ...e, decor: { ...e.decor!, quartos: { ...q, quiosques: q.quiosques.map((k) => ({ ...k, modelo: m.id })) } } })} className={`rounded-xl border-2 px-1.5 py-2 text-[12px] font-bold ${ativo ? "border-[#0F766E] bg-[#E3F6EA] text-[#0F766E]" : "border-black/10"}`}>{m.nome}</button>;
        })}
      </div>
      <div className="mt-1.5 text-[11px] leading-snug text-[#5B6472]">O quiosque leva o nome, a logo e a cor da marca, e a atendente da empresa atende no balcão. O prédio com recepção por dentro fica no tamanho médio ou grande.</div>
    </div>
  );
}
