"use client";
// Escolha do prédio pelo catálogo de 15 modelos padrão (20/11/2026, data/modelos.ts). Fica na aba Prédio do painel
// "Montar escritório": filtro por categoria, a foto de cada modelo (public/escritorios/modelo-<id>.jpg), o preço e o
// que ele combina com o WorkEnd. Tocar num modelo mostra no mapa na hora (rascunho); o modelo pago se compra aqui mesmo,
// com créditos, Pix ou os dois (botão único ui/Cobrar.tsx; src/server/modelos.ts › cobrarModelo), e já entra no lote quando
// o pagamento confirma.
import { useState } from "react";
import { BotaoCobrar } from "./Cobrar";

import { CATEGORIAS_MODELO, MODELOS, MODELO, USOS, brlModelo, modeloDe, modelosLiberados, type CategoriaModelo, type IdModelo } from "../data/modelos";
import { LAYOUT, type Escritorio } from "../data/escritorio";

function Foto({ id, layout }: { id: string; layout?: string }) {
  const [src, setSrc] = useState(`/escritorios/modelo-${id}.jpg`);
  const [falhou, setFalhou] = useState(false);
  if (falhou) return <span className="h-16 w-20 shrink-0 rounded-lg bg-[#E9ECF1]" aria-hidden />;
  return <img src={src} alt="" loading="lazy" onError={() => (layout && src !== `/escritorios/${layout}.jpg` ? setSrc(`/escritorios/${layout}.jpg`) : setFalhou(true))} className="h-16 w-20 shrink-0 rounded-lg bg-[#E9ECF1] object-cover" />;
}

export function CatalogoModelos({ e, set, salvo, duplo, comprar, pagando, erro }: {
  e: Escritorio; set: (e: Escritorio) => void; salvo: Escritorio | null; duplo: boolean;
  comprar: (id: IdModelo, creditos: boolean) => void; pagando: boolean; erro: string | null;
}) {
  const [cat, setCat] = useState<CategoriaModelo | null>(null);
  const atual = modeloDe(e), doLote = salvo ? modeloDe(salvo) : null;
  const liberados = modelosLiberados(salvo ?? e);
  const lista = MODELOS.filter((m) => !cat || m.categoria === cat);
  const antigo = !doLote && salvo ? salvo.layout : null; // prédio de antes do catálogo (fora dele)
  const escolher = (id: IdModelo) => set({ ...e, modelo: id, layout: MODELO[id].base });
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between"><div className="text-sm font-bold">Modelos de prédio</div><div className="text-[11px] text-[#5B6472]">{MODELOS.length} modelos · {MODELOS.filter((m) => m.preco === 0).length} grátis</div></div>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-[12px] font-semibold" role="tablist" aria-label="Categorias de prédio">
        {[{ id: null, nome: "Todos" }, ...CATEGORIAS_MODELO].map((c) => (
          <button key={c.nome} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id as CategoriaModelo | null)} className={`shrink-0 rounded-full border px-2.5 py-1 ${cat === c.id ? "border-[#1D4ED8] bg-[#1D4ED8] text-white" : "border-black/10 bg-white text-[#3A414D] hover:bg-black/[0.03]"}`}>{c.nome}</button>
        ))}
      </div>
      {antigo && (
        <div className={`flex items-center gap-3 rounded-xl border-2 p-2 ${e.layout === antigo ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-dashed border-black/15"}`}>
          <Foto id={antigo} layout={antigo} />
          <div className="min-w-0 flex-1"><div className="text-sm font-bold">{LAYOUT[antigo as keyof typeof LAYOUT]?.nome ?? "Prédio atual"}</div><div className="text-[11px] leading-snug text-[#5B6472]">Seu prédio de antes do catálogo. Ele continua seu, mas não volta depois de trocado.</div></div>
          {e.layout !== antigo && <button type="button" onClick={() => set({ ...e, layout: salvo!.layout, modelo: undefined })} className="rounded-lg bg-[#F1F3F6] px-2 py-1 text-[11px] font-semibold">Voltar</button>}
        </div>
      )}
      {lista.map((m) => {
        const ativo = atual === m.id, seu = liberados.has(m.id), noLote = doLote === m.id, falta2 = m.lotes === 2 && !duplo;
        const etiqueta = noLote ? "No seu lote" : m.preco === 0 ? "Grátis" : seu ? "Comprado" : brlModelo(m.preco);
        return (
          <div key={m.id} className={`rounded-xl border-2 ${ativo ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-black/10 hover:bg-black/[0.02]"}`}>
            <button type="button" onClick={() => escolher(m.id)} aria-pressed={ativo} data-modelo={m.id} className="flex w-full items-center gap-3 p-2 text-left">
              <Foto id={m.id} layout={m.base} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">{m.nome}{m.lotes === 2 && <span className="rounded-full bg-[#FFF4D6] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5A00]">2 lotes</span>}</span>
                <span className="block text-[11px] font-semibold text-[#1D4ED8]">{CATEGORIAS_MODELO.find((c) => c.id === m.categoria)?.nome} · {USOS[m.uso]}</span>
                <span className="block text-[11px] leading-snug text-[#5B6472]">{m.descricao}</span>
              </span>
              <span className={`shrink-0 self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${noLote ? "bg-[#1D4ED8] text-white" : seu ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F3F6] text-[#1D2128]"}`}>{etiqueta}</span>
            </button>
            {ativo && (
              <div className="space-y-1.5 border-t border-black/5 px-3 pb-2.5 pt-2 text-[11px] text-[#3A414D]">
                <div><b>Cores:</b> {m.cores}. <b>Logo:</b> {m.logo}.</div>
                {falta2 && <div className="rounded-lg bg-[#FFF4D6] px-2 py-1.5 text-[#7A5A00]">Este modelo ocupa dois lotes. Amplie o seu lote para o vizinho do lado (botão “Ampliar” no cartão do lote) para poder usar.</div>}
                {!seu && !falta2 && (
                  <BotaoCobrar classe="" valor={m.preco} rotuloPix={`Comprar por ${brlModelo(m.preco)} no Pix`} rotuloCreditos="Comprar o modelo" pagando={pagando} onPagar={(c) => comprar(m.id, c)} />
                )}
                {!seu && !falta2 && <div className="text-[#5B6472]">Compra única: o modelo fica com a sua empresa enquanto o lote estiver ativo, e a troca para ele já vem junto.</div>}
                {seu && !noLote && !falta2 && <div className="text-[#5B6472]">É seu. Salve o escritório para trocar o prédio (conta como uma troca).</div>}
                {erro && <div className="font-semibold text-[#E2575B]">{erro}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
