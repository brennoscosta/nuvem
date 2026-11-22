"use client";
// Botão único de cobrança (20/11/2026, frente "creditos"). Cada tela passa o preço e o que fazer no clique:
//  - saldo que cobre o preço: "Pagar com créditos" (e, discreto, "Prefiro pagar no Pix");
//  - saldo curto: "Usar X créditos + R$ Y no Pix" (os créditos ficam reservados até o Pix ser pago);
//  - sem saldo: o Pix de sempre, com o atalho para os pacotes de créditos.
// onPagar(true) manda { creditos: true } para a rota do produto; o servidor (mercadopago.ts › cobrar) decide o resto.
import { useEffect } from "react";
import { useCreditos, fmtCreditos } from "../creditosStore";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// dados: atributos data-* que vão no botão principal (os testes e as telas acham o botão por eles)
// WE-16 (22/11/2026): saldoInicial = o saldo que a página trouxe do servidor; vale só até o saldo da conta carregar aqui
// (sem ele, a tela que já sai pronta mostrava o botão do Pix e trocava para o de créditos depois)
export function BotaoCobrar({ valor, rotuloPix, rotuloCreditos = "Pagar com créditos", pagando, onPagar, pixLigado = true, compacto = false, classe = "mt-2", dados, saldoInicial = null }: {
  valor: number; rotuloPix: string; rotuloCreditos?: string; pagando: boolean; onPagar: (creditos: boolean) => void; pixLigado?: boolean; compacto?: boolean; classe?: string; dados?: Record<`data-${string}`, string>; saldoInicial?: number | null;
}) {
  const saldo = useCreditos((s) => s.saldo);
  const carregado = useCreditos((s) => s.carregado);
  const carregar = useCreditos((s) => s.carregar);
  useEffect(() => { if (!carregado) void carregar(); }, [carregado, carregar]);
  const total = saldo?.total ?? (carregado ? 0 : saldoInicial ?? 0);
  const tudo = valor > 0 && total >= valor;
  const resto = Math.round((valor - total) * 100) / 100;
  const botao = `w-full rounded-xl px-3 font-bold text-white disabled:opacity-50 ${compacto ? "py-2 text-xs" : "py-2.5 text-sm"}`;
  if (tudo) return (
    <div className={classe} data-cobranca="creditos">
      <button type="button" {...dados} onClick={() => onPagar(true)} disabled={pagando} className={`${botao} bg-[#1D4ED8] hover:bg-[#1E40AF]`}>{pagando ? "Pagando…" : `${rotuloCreditos} · ${fmtCreditos(valor)} créditos`}</button>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#5B6472]">
        <span>Saldo: {fmtCreditos(total)} créditos</span>
        {pixLigado && <button type="button" onClick={() => onPagar(false)} disabled={pagando} className="font-semibold text-[#166534] hover:underline">Prefiro pagar no Pix</button>}
      </div>
    </div>
  );
  if (!pixLigado) return <div className={`${classe} rounded-xl bg-[#F1F3F6] px-3 py-2 text-center text-xs text-[#5B6472]`}>Pagamento em instantes: estamos ligando o Mercado Pago.{total > 0 ? ` Seu saldo (${fmtCreditos(total)} créditos) ainda não cobre este valor.` : ""}</div>;
  if (total > 0) return (
    <div className={classe} data-cobranca="misto">
      <button type="button" {...dados} onClick={() => onPagar(true)} disabled={pagando} className={`${botao} bg-[#16A34A] hover:bg-[#15803D]`}>{pagando ? "Gerando o Pix…" : `Usar ${fmtCreditos(total)} créditos + ${brl(resto)} no Pix`}</button>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#5B6472]">
        <span>Preço: {brl(valor)}</span>
        <button type="button" onClick={() => onPagar(false)} disabled={pagando} className="font-semibold text-[#166534] hover:underline">Pagar tudo no Pix</button>
      </div>
    </div>
  );
  return (
    <div className={classe} data-cobranca="pix">
      <button type="button" {...dados} onClick={() => onPagar(false)} disabled={pagando} className={`${botao} bg-[#16A34A] hover:bg-[#15803D]`}>{pagando ? "Gerando o Pix…" : rotuloPix}</button>
      {saldo && <a href="/app/creditos" className="mt-1 block text-center text-[11px] font-semibold text-[#1D4ED8] hover:underline">Prefere pagar com créditos? Ver os pacotes</a>}
    </div>
  );
}
