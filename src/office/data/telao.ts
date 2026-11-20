// Telão da Praça de Eventos e patrocínio da praça (20/11/2026, pedido do dono: "que a praça tenha um sentido, que gere
// lucro para nós"). Tudo que a praça vende mora aqui, com os preços fáceis de mudar. Compartilhado por servidor
// (cobrança, validação e grade) e cliente (cena 3D, prévia em /app/divulgar e fila do admin).
import { PRECO_OUTDOOR } from "./outdoors";
import { PRECO_BARRACA } from "./praca";
import { PRECO_QUIOSQUE } from "./precosTerreno";

export const PRECO_TELAO_DIA = 19.9; // anúncio de 15 s na rotação do telão, por dia
export const PRECO_EVENTO_DESTAQUE = 49; // evento em destaque: chamada no telão (48 h antes) e balão dourado no mapa
export const PRECO_PATROCINIO = 199; // patrocínio da praça por 30 dias, uma vaga só: placa da praça e telão (e o do Natal)
export const DIAS_PATROCINIO = 30;
export const SEGUNDOS_SLOT = 15; // cada item da grade fica 15 s no telão
export const DIAS_TELAO = [1, 3, 7, 15, 30]; // pacotes de dias do anúncio no telão
export const MAX_ANUNCIOS_DIA = 8; // anúncios pagos na rotação de um mesmo dia (acima disso a rotação fica longa demais)
export const HORAS_DESTAQUE_ANTES = 48;
export const MAX_FRASE_TELAO = 60;
export const MAX_IMAGEM_KB = 1500, MAX_VIDEO_KB = 4000, MAX_VIDEO_S = 15;
export const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];
export const TIPOS_VIDEO = ["video/mp4", "video/webm"];

export type TipoAnuncio = "telao" | "destaque" | "patrocinio";
export type FormatoAnuncio = "modelo" | "imagem" | "video";
export type StatusAnuncio = "aguardando_pagamento" | "em_analise" | "aprovado" | "recusado" | "cancelado" | "estornado";
export const NOME_TIPO: Record<TipoAnuncio, string> = { telao: "Anúncio no telão", destaque: "Evento em destaque", patrocinio: "Patrocínio da praça" };
export const precoAnuncio = (tipo: TipoAnuncio, dias = 1) => (tipo === "telao" ? Math.round(PRECO_TELAO_DIA * dias * 100) / 100 : tipo === "destaque" ? PRECO_EVENTO_DESTAQUE : PRECO_PATROCINIO);
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

// propaganda do próprio WorkEnd: entra na grade quando não há anúncio pago (e a do telão, enquanto sobra vaga)
export interface Casa { id: string; rotulo: string; titulo: string; sub: string; chamada: string; cor: string }
export const CASA: Casa[] = [
  { id: "outdoor", rotulo: "WorkEnd · outdoor", titulo: "A sua marca nos outdoors", sub: `6 outdoors nas avenidas da cidade · ${brl(PRECO_OUTDOOR)} a cada 30 dias`, chamada: "Clique num outdoor para anunciar", cor: "#0A6CFF" },
  { id: "telao", rotulo: "WorkEnd · telão", titulo: "O seu anúncio neste telão", sub: `${SEGUNDOS_SLOT} segundos na rotação por ${brl(PRECO_TELAO_DIA)} por dia`, chamada: "Painel da loja → Divulgar", cor: "#0F766E" },
  // 20/11/2026 (junção): o preço do quiosque (frente terreno) e a carteira de créditos (frente creditos)
  { id: "quiosque", rotulo: "WorkEnd · praça", titulo: `Quiosque na praça: ${brl(PRECO_QUIOSQUE).replace(",00", "")}/mês`, sub: "O seu ponto de venda perto do palco, com a atendente de IA no balcão", chamada: "Clique num quiosque livre da praça", cor: "#B45309" },
  { id: "creditos", rotulo: "WorkEnd · créditos", titulo: "Pague tudo com créditos", sub: "Lote, quiosque, telão e roupas num toque; pacotes com bônus e a indicação vira crédito", chamada: "Pacotes em workend.online/app/creditos", cor: "#7C3AED" },
  { id: "conta", rotulo: "WorkEnd", titulo: "A sua empresa na cidade 3D", sub: `Lote com loja, vitrine e equipe · feira de sábado com barraca a ${brl(PRECO_BARRACA)}`, chamada: "Crie a sua conta: workend.online", cor: "#1D4ED8" },
];

// o que o telão mostra, em fatias de SEGUNDOS_SLOT. "agenda", "semana" e "feira" o cliente desenha com os dados que já tem.
export interface MarcaAnuncio { nome: string; cor: string; logo: string | null; numero: number | null; chave: string | null }
export type ItemGrade =
  | ({ tipo: "anuncio"; id: string; formato: FormatoAnuncio; frase: string; midia: string | null } & MarcaAnuncio)
  | ({ tipo: "destaque"; id: string; eventoId: string; titulo: string; frase: string; inicio: string; fim: string; formato: FormatoAnuncio; midia: string | null } & MarcaAnuncio)
  | { tipo: "agenda" } | { tipo: "semana" } | { tipo: "feira" } | { tipo: "patrocinio" } | { tipo: "casa"; id: string };
export interface Patrocinio extends MarcaAnuncio { id: string; frase: string; ate: string }
export interface GradeTelao { itens: ItemGrade[]; patrocinio: Patrocinio | null; destaques: { eventoId: string; titulo: string; inicio: string; fim: string; nome: string }[]; agora: string }

// item da grade no instante t (todo mundo vê o mesmo anúncio ao mesmo tempo); com evento ao vivo, o palco volta entre um e outro
export function itemDoMomento<T>(itens: T[], agora: number, fixo?: number | null): { item: T | null; indice: number; restaMs: number } {
  if (!itens.length) return { item: null, indice: -1, restaMs: SEGUNDOS_SLOT * 1000 };
  const ms = SEGUNDOS_SLOT * 1000, i = fixo != null && fixo >= 0 ? fixo % itens.length : Math.floor(agora / ms) % itens.length;
  return { item: itens[i], indice: i, restaMs: ms - (agora % ms) };
}
