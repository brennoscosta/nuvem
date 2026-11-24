// Preços da frente "terreno" (20/11/2026), num lugar só para o dono mudar sem caçar no código. Servem ao servidor (cotação
// e Pix) e à tela (cartões).
//  - Lote (WE-19, 22/11/2026, decisão do dono "Escada 0 → 47 → 97"): R$ 97 por mês, antes R$ 99. É a ÚNICA constante do
//    preço do lote: o servidor (src/server/terrenos.ts reexporta PRECO_LOTE), a cotação, o Pix, a renovação, o pagamento
//    automático (assinaturas.ts troca o valor no Mercado Pago no ciclo), os e-mails, a página inicial, /planos, o painel e
//    o tutorial leem daqui. Quem já tem lote passa a renovar por este valor na próxima renovação (é redução).
//  - Lote extra (expandir o terreno): o dono de um lote ativo junta o vizinho do lado e o prédio passa a ocupar os dois.
//    Custa o mesmo que um lote por mês e é renovado JUNTO com o principal (um Pix só). No dia da compra paga só os dias
//    que faltam até o vencimento do principal (proporcional), para os dois vencerem no mesmo dia.
//  - Quiosque: ponto pequeno e mais barato nos lugares de passagem (data/quiosques.ts), só com a atendente.
export const PRECO_LOTE = 97; // R$ por lote por mês
export const PRECO_LOTE_EXTRA = PRECO_LOTE; // R$ por mês por lote juntado: o mesmo que o lote
export const MINIMO_LOTE_EXTRA = 9.9; // o pagamento proporcional do 1º dia nunca fica abaixo disto
export const PRECO_QUIOSQUE = 47; // R$ por mês
// 1/4 de lote (24/11/2026, pedido do dono: "valor 49,90", "quero esse quadrado dividido por 4"): R$ por mês. Cada lote
// de 20 × 20 m se divide em 4 espaços de 10 × 10 m, para 4 clientes diferentes (data/quiosques.ts › ESPACOS).
export const PRECO_ESPACO = 49.9;
// preço curto para os textos ("R$ 97", "R$ 1.500"; com centavos, "R$ 97,50")
export const precoCurto = (v: number) => `R$ ${v.toLocaleString("pt-BR", Number.isInteger(v) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
