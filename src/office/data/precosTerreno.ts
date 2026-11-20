// Preços da frente "terreno" (20/11/2026), num lugar só para o dono mudar sem caçar no código. Servem ao servidor (cotação
// e Pix) e à tela (cartões). O lote comum continua em src/server/terrenos.ts (PRECO_LOTE = R$ 99).
//  - Lote extra (expandir o terreno): o dono de um lote ativo junta o vizinho do lado e o prédio passa a ocupar os dois.
//    Custa o mesmo que um lote por mês e é renovado JUNTO com o principal (um Pix só). No dia da compra paga só os dias
//    que faltam até o vencimento do principal (proporcional), para os dois vencerem no mesmo dia.
//  - Quiosque: ponto pequeno e mais barato nos lugares de passagem (data/quiosques.ts), só com a atendente.
export const PRECO_LOTE_EXTRA = 99; // R$ por mês por lote juntado
export const MINIMO_LOTE_EXTRA = 9.9; // o pagamento proporcional do 1º dia nunca fica abaixo disto
export const PRECO_QUIOSQUE = 47; // R$ por mês
