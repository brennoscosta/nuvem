"use client";
// Expandir o terreno (20/11/2026, pedido do dono: "opção de poder expandir o terreno da empresa"). No cartão do lote do dono:
// o botão abre a escolha do vizinho, o mapa realça o lote do lado que está livre (scene/RealceExpansao.tsx) e um toque junta
// os dois: reserva o vizinho como lote extra (o lote duplo de 12/11/2026) e já abre o Pix. O prédio cresce e passa a ocupar
// os dois terrenos. Preço em data/precosTerreno.ts: o mesmo do lote (R$ 97/mês desde a WE-19) por lote extra, renovado junto com o principal; no dia da
// compra paga só os dias até o vencimento do principal (proporcional, mínimo R$ 9,90).
import { ESPACOS_DO_LOTE } from "../data/quiosques";
import { useState } from "react";
import { create } from "zustand";
import { useMundo, LOTE_POR_CHAVE, useAgora } from "../mundoStore";
import { vizinhoDoLado, type LoteInfo } from "../data/mundo";
import { PRECO_LOTE_EXTRA, MINIMO_LOTE_EXTRA } from "../data/precosTerreno";
import { ehSede } from "../data/sedes";
import { ehQuiosque } from "../data/quiosques";
import { Icone } from "./Icone";
import { BotaoCobrar } from "./Cobrar";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const DIA = 86_400_000;

// qual lote está escolhendo o vizinho agora (o realce do mapa lê daqui)
export const useExpandir = create<{ principal: string | null; abrir: (chave: string) => void; fechar: () => void }>((set) => ({
  principal: null,
  abrir: (chave) => {
    set({ principal: chave });
    // a câmera vai para a divisa entre o lote e o vizinho
    const l = LOTE_POR_CHAVE[chave], v = l ? vizinhoDoLado(l) : null;
    if (l && v) useMundo.setState({ alvoCamera: [(l.centro[0] + v.centro[0]) / 2, 0.5, l.centro[1]] });
  },
  fechar: () => set({ principal: null }),
}));
// o vizinho que pode ser juntado a este lote (só o do lado, na mesma rua) e se está livre
export function vizinhoParaExpandir(chave: string, terrenos: Record<string, unknown>): { lote: LoteInfo | null; livre: boolean } {
  const l = LOTE_POR_CHAVE[chave]; const v = l ? vizinhoDoLado(l) : null;
  if (!v || v.lote.tipo === "praca") return { lote: null, livre: false };
  // lote dividido em 4 com espaço de outra empresa (24/11/2026) não serve de ampliação
  return { lote: v, livre: !terrenos[v.chave] && !(ESPACOS_DO_LOTE[v.chave] ?? []).some((e) => !!terrenos[e.chave]) };
}
// valor do 1º pagamento (só os dias até o vencimento do principal); o Pix confirma o valor certo no servidor
export function valorProporcional(pagoAte: string | null, agora: number) {
  const dias = pagoAte ? Math.max(1, Math.ceil((new Date(pagoAte).getTime() - agora) / DIA)) : 30;
  return { dias, valor: Math.max(MINIMO_LOTE_EXTRA, Math.round(((PRECO_LOTE_EXTRA * dias) / 30) * 100) / 100) };
}

// Juntar o vizinho: reserva como lote extra, seleciona o lote extra no mapa e cobra pelo caminho único (créditos, Pix ou os
// dois: mercadopago.ts › cobrar, tipo "expansao")
export async function juntarVizinho(vizinho: string, creditos = false): Promise<string | null> {
  const r = await fetch(`/api/terrenos/${encodeURIComponent(vizinho)}/anexo`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return j.erro ?? `Erro ${r.status}`;
  const m = useMundo.getState();
  await m.carregar(); m.selecionarLote(vizinho); useExpandir.getState().fechar();
  if (useMundo.getState().pagamentoLigado || creditos) return useMundo.getState().pagar(1, "lote", creditos);
  return null;
}

// Bloco do cartão do lote do dono (lote ativo, nem sede nem quiosque)
export function ExpandirTerreno({ chave }: { chave: string }) {
  const terrenos = useMundo((s) => s.terrenos);
  const desvio = useMundo((s) => s.desvioRelogio);
  const selecionarLote = useMundo((s) => s.selecionarLote);
  const pagamentoLigado = useMundo((s) => s.pagamentoLigado);
  const aberto = useExpandir((s) => s.principal === chave);
  const agora = useAgora(); // relógio de 30 em 30 s (nada de Date.now() durante o desenho)
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const t = terrenos[chave];
  if (!t || t.status !== "ativo" || t.anexoDe || ehSede(chave) || ehQuiosque(chave)) return null;
  const anexo = Object.values(terrenos).find((x) => x.anexoDe === chave) ?? null;
  if (anexo) return (
    <button type="button" onClick={() => selecionarLote(anexo.chave)} className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-[#EEF3FF] px-3 py-2 text-left text-xs text-[#1D4ED8]">
      <span className="inline-flex items-center gap-1.5"><Icone nome="juntar" tamanho={16} /><span><b>Terreno expandido</b> com o Lote {LOTE_POR_CHAVE[anexo.chave]?.numero} · {anexo.status === "ativo" ? "renova junto com este lote" : "reservado, falta pagar"}</span></span>
      <Icone nome="seta" tamanho={14} />
    </button>
  );
  const { lote: v, livre } = vizinhoParaExpandir(chave, terrenos);
  const { dias, valor } = valorProporcional(t.pagoAte, (agora || (t.pagoAte ? new Date(t.pagoAte).getTime() - 30 * DIA : 0)) + desvio);
  const juntar = async (creditos: boolean) => { if (!v) return; setEnviando(true); setErro(null); try { const e = await juntarVizinho(v.chave, creditos); if (e) setErro(e); } finally { setEnviando(false); } };
  if (!aberto) return (
    <button type="button" onClick={() => useExpandir.getState().abrir(chave)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#1D4ED8]/45 bg-white px-3 py-2.5 text-sm font-bold text-[#1D4ED8] hover:bg-[#EEF3FF]">
      <Icone nome="juntar" tamanho={17} />Expandir terreno
    </button>
  );
  return (
    <div className="mt-2 rounded-2xl border border-[#1D4ED8]/25 bg-[#F7F9FF] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-[#1D2128]">Expandir o terreno</div>
        <button type="button" onClick={() => useExpandir.getState().fechar()} className="rounded-full px-1.5 text-[#5B6472] hover:bg-black/5" aria-label="Fechar"><Icone nome="fechar" tamanho={15} /></button>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-[#4B5563]">Junte o lote do lado ao seu: o prédio cresce e passa a ocupar os dois terrenos, com a fachada mais larga da rua. O número da sua loja continua o mesmo.</p>
      {v ? (
        <div className={`mt-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${livre ? "bg-[#EAF7EE] ring-1 ring-[#16A34A]/40" : "bg-[#F1F3F6]"}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[12px] font-black ${livre ? "bg-[#16A34A] text-white" : "bg-white text-[#5B6472]"}`}>{v.numero}</span>
          <div className="min-w-0 text-xs">
            <div className="font-bold text-[#1D2128]">Lote {v.numero} · do lado, na mesma rua</div>
            <div className={livre ? "font-semibold text-[#166534]" : "text-[#5B6472]"}>{livre ? "Livre · realçado em verde no mapa" : "Ocupado por outra empresa"}</div>
          </div>
        </div>
      ) : <div className="mt-2 rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs text-[#5B6472]">Do lado deste lote fica uma sede ou a praça: não há vizinho para juntar.</div>}
      {v && livre && (
        <>
          <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-[#1D2128] ring-1 ring-black/5">
            <div className="flex items-center justify-between"><span className="text-[#5B6472]">Lote extra</span><b>{brl(PRECO_LOTE_EXTRA)}/mês</b></div>
            <div className="mt-1 text-[11px] leading-snug text-[#5B6472]">Renova junto com o seu lote, num pagamento só (créditos ou Pix). Hoje você paga só os {dias} dia{dias === 1 ? "" : "s"} até o vencimento{t.pagoAte ? ` (${dataBR(t.pagoAte)})` : ""}: <b className="text-[#1D2128]">{brl(valor)}</b>.</div>
          </div>
          <BotaoCobrar valor={valor} rotuloPix={`Juntar o Lote ${v.numero} · ${brl(valor)} no Pix`} rotuloCreditos={`Juntar o Lote ${v.numero}`} pagando={enviando} pixLigado={pagamentoLigado} onPagar={(c) => void juntar(c)} />
          <div className="mt-1 text-center text-[10.5px] text-[#5B6472]">A reserva do lote extra vale 1 hora até o pagamento.</div>
        </>
      )}
      {erro && <div className="mt-2 text-xs font-semibold text-[#B42318]">{erro}</div>}
    </div>
  );
}
