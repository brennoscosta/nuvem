// Outdoors do mapa (12/11/2026): vagas fixas nas avenidas da borda, entre as árvores, viradas para dentro da cidade.
// Compartilhado por servidor (preço, validação) e cliente (cena e cartão).
export interface VagaOutdoor { id: string; nome: string; pos: [number, number]; rot: number }
const D = 87.5; // um pouco além da avenida da borda (eixo em 78)
export const OUTDOORS: VagaOutdoor[] = [
  { id: "N1", nome: "Avenida Norte · oeste", pos: [-44, -D], rot: 0 },
  { id: "N2", nome: "Avenida Norte · leste", pos: [26, -D], rot: 0 },
  { id: "O1", nome: "Avenida Oeste", pos: [-D, -2], rot: Math.PI / 2 },
  { id: "L1", nome: "Avenida da Praia · leste", pos: [D, 26], rot: -Math.PI / 2 },
  { id: "S1", nome: "Avenida da Praia · sul", pos: [-2, D], rot: Math.PI },
  { id: "S2", nome: "Avenida da Praia · sudoeste", pos: [-44, D], rot: Math.PI },
];
export const OUTDOOR_POR_ID: Record<string, VagaOutdoor> = Object.fromEntries(OUTDOORS.map((o) => [o.id, o]));
export const PRECO_OUTDOOR = 29.9; // R$ por 30 dias
export const DIAS_OUTDOOR = 30;
export const MAX_FRASE_OUTDOOR = 42;
export interface OutdoorPublico {
  slot: string; status: "livre" | "reservado" | "ativo"; pagoAte: string | null; meu: boolean;
  frase: string; empresa: { nome: string; cor: string; nicho: string; numero: number | null; chave: string | null; logo: string | null } | null;
}
