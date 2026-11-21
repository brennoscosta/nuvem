"use client";
// Meu escritório › Pagamento automático (WE-09, 21/11/2026): o mesmo estado do cartão do lote (src/office/ui/Assinatura.tsx),
// com o cancelamento e a troca do cartão. É o destino do link dos avisos (/app#assinatura). Sem as chaves do Mercado Pago
// e sem assinatura, o bloco não aparece.
import { AssinaturaDoLote } from "@/office/ui/Assinatura";

export function AssinaturaPainel({ chave, pagoAte, linkPix }: { chave: string; pagoAte: string | null; linkPix: string }) {
  return (
    <AssinaturaDoLote chave={chave} pagoAte={pagoAte} painel linkPix={linkPix} moldura={(x) => (
      <section className="faixa pn-bloco" id="assinatura" data-painel-assinatura>
        <h2 className="text-[1.35rem]">Pagamento automático</h2>
        <div className="mt-2 max-w-[560px]">{x}</div>
      </section>
    )} />
  );
}
