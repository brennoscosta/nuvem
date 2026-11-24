"use client";
// Espaços de 5 × 5 m no cartão do lote (24/11/2026, pedido do dono: "um 20x20 quando tocar em cima mostra possibilidade de
// terrenos menores 5x5 m, um 20x20 pode ter 4 lojas de diferentes clientes"). Os 4 espaços ficam na frente do lote, lado a
// lado (data/quiosques.ts › ESPACOS). Tocar num espaço livre abre o cartão dele (ui/Quiosque.tsx), com a reserva, o Pix e a
// renovação de sempre do quiosque, a R$ 49,90. Lote com algum espaço alugado não aluga inteiro (o cartão do lote esconde a
// compra do lote inteiro: ui/Lote.tsx › espacosOcupados) e o servidor confere (src/server/terrenos.ts › conferirEspacosDoLote).
import { useMundo } from "../mundoStore";
import { ESPACOS_DO_LOTE, LETRA_ESPACO, PRECO_ESPACO } from "../data/quiosques";
import { Icone } from "./Icone";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// quantos espaços do lote já têm empresa (reservados ou alugados)
export function espacosOcupados(chaveLote: string, terrenos: Record<string, unknown>) {
  return (ESPACOS_DO_LOTE[chaveLote] ?? []).filter((e) => !!terrenos[e.chave]).length;
}

export function EspacosAVenda({ chaveLote }: { chaveLote: string }) {
  const terrenos = useMundo((s) => s.terrenos);
  const selecionarLote = useMundo((s) => s.selecionarLote);
  const espacos = ESPACOS_DO_LOTE[chaveLote] ?? [];
  if (!espacos.length) return null;
  const ocupados = espacosOcupados(chaveLote, terrenos);
  return (
    <div className="mt-3 rounded-2xl border border-[#D9DEE6] px-3 py-2.5" data-testid="espacos-lote">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{ocupados ? "Espaços de 5 × 5 m" : "Ou só um espaço de 5 × 5 m"}</span>
        <span className="text-sm font-semibold">{brl(PRECO_ESPACO)}/mês</span>
      </div>
      <div className="mt-0.5 text-xs text-[#5B6472]">
        {ocupados
          ? "Este lote está dividido em 4 espaços na frente, cada um de uma empresa. Escolha um espaço livre."
          : "Um balcão com a sua marca e a atendente de IA, de frente para a calçada. Cada lote tem 4 espaços, para 4 empresas."}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {espacos.map((e, i) => {
          const t = terrenos[e.chave];
          return (
            <button
              key={e.chave}
              onClick={() => selecionarLote(e.chave)}
              className={`flex flex-col items-center rounded-xl px-1 py-1.5 text-[11px] font-semibold ${t ? "bg-[#F1F3F6] text-[#5B6472]" : "bg-[#EAF0FE] text-[#1D4ED8] hover:bg-[#DCE6FD]"}`}
              title={t ? `Espaço ${LETRA_ESPACO[i]}: ${t.empresaNome}` : `Espaço ${LETRA_ESPACO[i]}: livre`}
            >
              <span className="text-[13px] font-bold">{LETRA_ESPACO[i]}</span>
              <span className="w-full truncate text-center">{t ? t.empresaNome : "Livre"}</span>
            </button>
          );
        })}
      </div>
      {!ocupados && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#5B6472]"><Icone nome="quiosque" tamanho={13} />O espaço aparece no mapa quando é reservado.</div>}
    </div>
  );
}
