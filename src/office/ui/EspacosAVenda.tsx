"use client";
// O lote dividido em 4 no cartão do lote (24/11/2026, pedido do dono: "um 20x20 quando tocar em cima mostra possibilidade
// de terrenos menores... um 20x20 pode ter 4 lojas de diferentes clientes" e "quero esse quadrado dividido por 4"). Os 4
// espaços de 10 × 10 m aparecem como o lote é: A e B na frente (rua embaixo), C e D no fundo (data/quiosques.ts › ESPACOS).
// Tocar num espaço livre abre o cartão dele (ui/Quiosque.tsx), com a reserva, o Pix e a renovação de sempre do quiosque, a
// R$ 49,90. Lote com algum espaço alugado não aluga inteiro (o cartão do lote esconde a compra do lote inteiro: ui/Lote.tsx
// › espacosOcupados) e o servidor confere (src/server/terrenos.ts › conferirEspacosDoLote).
import { useMundo } from "../mundoStore";
import { ESPACOS_DO_LOTE, LETRA_ESPACO, PRECO_ESPACO, TAMANHO_ESPACO } from "../data/quiosques";
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
  if (espacos.length !== 4) return null;
  const ocupados = espacosOcupados(chaveLote, terrenos);
  // o desenho do lote visto de cima com a rua embaixo: o fundo (C, D) em cima, a frente (A, B) embaixo
  const ordem = [espacos[2], espacos[3], espacos[0], espacos[1]];
  return (
    <div className="mt-3 rounded-2xl border border-[#D9DEE6] px-3 py-2.5" data-testid="espacos-lote">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{ocupados ? "Lote dividido em 4" : "Ou só 1/4 do lote"}</span>
        <span className="text-sm font-semibold">{brl(PRECO_ESPACO)}/mês</span>
      </div>
      <div className="mt-0.5 text-xs text-[#5B6472]">
        {ocupados
          ? `Este lote está dividido em 4 espaços de ${TAMANHO_ESPACO}, cada um de uma empresa. Escolha um espaço livre.`
          : `O lote se divide em 4 espaços de ${TAMANHO_ESPACO}, para 4 empresas. O seu ganha um balcão com a sua marca e a atendente de IA.`}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {ordem.map((e) => {
          const p = espacos.indexOf(e), t = terrenos[e.chave];
          return (
            <button
              key={e.chave}
              onClick={() => selecionarLote(e.chave)}
              className={`flex flex-col items-center rounded-xl px-1 py-2 text-[11px] font-semibold ${t ? "bg-[#F1F3F6] text-[#5B6472]" : "bg-[#EAF0FE] text-[#1D4ED8] hover:bg-[#DCE6FD]"}`}
              title={t ? `Espaço ${LETRA_ESPACO[p]}: ${t.empresaNome}` : `Espaço ${LETRA_ESPACO[p]}: livre`}
            >
              <span className="text-[13px] font-bold">{LETRA_ESPACO[p]} · {p < 2 ? "frente" : "fundo"}</span>
              <span className="w-full truncate text-center">{t ? t.empresaNome : "Livre"}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#8A93A1]">rua</div>
      {!ocupados && <div className="mt-1 flex items-center gap-1 text-[11px] text-[#5B6472]"><Icone nome="quiosque" tamanho={13} />O espaço aparece no mapa quando é reservado.</div>}
    </div>
  );
}
