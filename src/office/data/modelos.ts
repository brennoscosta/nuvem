// Catálogo dos 15 modelos padrão de prédio (20/11/2026, pedido do dono: "padronizar visual de prédios de empresas, criar
// modelos padrões para serem usados para não fazerem de forma diferente exclusiva" e "um dos 15 prédios padrões para a
// pessoa escolher, cada prédio tem um modelo e valor diferente"). Toda empresa (as sedes também, data/sedes.ts › modelo)
// usa um destes modelos; muda a cor da marca, a logo e os ajustes da aba Fachada.
// Cada modelo é desenhado em código pelo kit (scene/KitPredio.tsx, tipo `base`); as medidas ficam em data/predios.ts.
// Preço: compra única, fica com a empresa enquanto o lote estiver ativo (o lote que vence perde as compras).
// A cobrança fica numa função só (src/server/modelos.ts › cobrarModelo), para trocar pelos Créditos WorkEnd depois.
import type { KitId } from "./predios";

// ---- tabela de preços (R$, compra única). Mude aqui: o painel, o servidor e o Pix leem desta tabela ----
export const PRECO_MODELO = {
  escritorio: 0, loja: 0, cafe: 0,
  mercadinho: 69, loft: 69,
  corporativo: 79, clinica: 79, escola: 79,
  varanda: 89, galpao: 89,
  galeria: 99, estudio: 99,
  auditorio: 129, torre: 149,
  sede: 199,
} as const;

export type IdModelo = keyof typeof PRECO_MODELO;
export type CategoriaModelo = "escritorio" | "comercio" | "midia" | "alimentacao" | "servicos" | "grande";
export const CATEGORIAS_MODELO: { id: CategoriaModelo; nome: string }[] = [
  { id: "escritorio", nome: "Escritório" }, { id: "comercio", nome: "Comércio" }, { id: "midia", nome: "Mídia" },
  { id: "alimentacao", nome: "Alimentação" }, { id: "servicos", nome: "Serviços" }, { id: "grande", nome: "Grande" },
];
// uso: o que o modelo combina com o que o WorkEnd já faz (vitrine e pedidos, agenda, eventos, telão)
export type UsoModelo = "equipe" | "vitrine" | "pedidos" | "agenda" | "eventos" | "telao";
export const USOS: Record<UsoModelo, string> = {
  equipe: "Equipe de IA e recepção", vitrine: "Vitrine com os produtos", pedidos: "Vitrine e pedidos com Pix", agenda: "Agenda de horários",
  eventos: "Eventos na fachada", telao: "Telão com a marca e as lives",
};
export interface ModeloPadrao {
  id: IdModelo; nome: string; categoria: CategoriaModelo; descricao: string; preco: number;
  lotes: 1 | 2; // os grandes ocupam o lote e a ampliação do lado (lote duplo)
  base: KitId; // tipo do kit que desenha o modelo
  cores: string; // o que a empresa troca de cor (a cor da marca e a pintura da aba Fachada)
  logo: string; // onde vai a logo
  uso: UsoModelo;
}
const M = (id: IdModelo, nome: string, categoria: CategoriaModelo, base: KitId, uso: UsoModelo, descricao: string, cores: string, logo: string, lotes: 1 | 2 = 1): ModeloPadrao =>
  ({ id, nome, categoria, base, uso, descricao, cores, logo, lotes, preco: PRECO_MODELO[id] });

export const MODELOS: ModeloPadrao[] = [
  // escritório
  M("escritorio", "Escritório básico", "escritorio", "basico", "equipe", "Dois andares de salas, recepção de vidro e marquise na porta.", "Pintura da fachada e a faixa da marquise", "Letreiro em cima da marquise"),
  M("corporativo", "Prédio corporativo", "escritorio", "comercial", "equipe", "Três a cinco andares com recepção atrás da colunata e brises de alumínio.", "Revestimento da fachada", "Letreiro na marquise da entrada"),
  M("loft", "Loft de tijolinho", "escritorio", "coworking", "equipe", "Tijolo aparente, janelões de ferro, escada externa e jardim vertical. Bom para coworking e agência.", "Revestimento e a marquise de aço", "Letreiro sobre a porta"),
  M("varanda", "Moderno com varanda", "escritorio", "varanda", "equipe", "Térreo de vidro e varandas de vidro com deck de madeira em cada andar.", "Pintura das paredes e a fita de luz das varandas", "Letreiro embaixo da primeira varanda"),
  M("torre", "Torre de vidro", "escritorio", "torre", "equipe", "Pele de vidro espelhado, saguão alto e de seis a doze andares.", "Vidro e a coroa acesa na cor da marca", "Letreiro na marquise e no alto"),
  // comércio
  M("loja", "Loja de rua", "comercio", "esquina", "vitrine", "Vitrine em L com a porta no canto e sobreloja com sacadinhas.", "Pintura da fachada", "Letreiro na marquise"),
  M("mercadinho", "Mercadinho com bancas", "comercio", "mercado", "pedidos", "Portas de enrolar abertas, toldo e bancas de frutas na calçada.", "Toldo e faixas na cor da marca", "Letreiro na platibanda"),
  M("galeria", "Galeria e showroom", "comercio", "galeria", "vitrine", "Vitrine de pé-direito duplo numa moldura branca, com peças em pedestais.", "Moldura e a luz da vitrine", "Letreiro no alto da moldura"),
  M("galpao", "Galpão de entregas", "comercio", "logistico", "pedidos", "Doca com caminhão, portão de enrolar e escritório na frente. Para loja online e ponto de retirada.", "Faixa e o caminhão na cor da marca", "Letreiro no escritório da frente"),
  // mídia
  M("estudio", "Estúdio de vídeo e lives", "midia", "estudio", "telao", "Caixa escura com telão de LED na fachada, luz de no ar e entrada de estúdio.", "Frisos acesos e o telão", "No telão e no letreiro da entrada"),
  M("auditorio", "Auditório de eventos", "midia", "auditorio", "eventos", "Salão alto com foyer de vidro e marquise de cinema na entrada.", "Marquise e a fita de luz", "Letreiro na marquise de cinema"),
  // alimentação
  M("cafe", "Café com mesinhas", "alimentacao", "cafeteria", "pedidos", "Telhado de barro, varanda com pérgola, mesinhas e varal de luzes.", "Pintura e o toldo", "Letreiro na viga da pérgola"),
  // serviços
  M("clinica", "Clínica e consultório", "servicos", "consultorio", "agenda", "Toda clara, com rampa de acesso, jardim e brises nas janelas.", "Pintura e a faixa da fachada", "Letreiro na marquise branca"),
  M("escola", "Escola de cursos", "servicos", "escola", "agenda", "Salas com faixas coloridas, escadaria, marquise e bicicletário.", "Faixas das janelas na cor da marca", "Letreiro na marquise da escadaria"),
  // grande
  M("sede", "Sede corporativa", "grande", "torre", "equipe", "Torre larga de vidro nos dois lotes (o seu e a ampliação do lado), com saguão e coroa acesa.", "Vidro e a coroa acesa na cor da marca", "Letreiro na marquise e no alto", 2),
];
export const MODELO: Record<IdModelo, ModeloPadrao> = Object.fromEntries(MODELOS.map((m) => [m.id, m])) as Record<IdModelo, ModeloPadrao>;
export const ehModelo = (id: unknown): id is IdModelo => typeof id === "string" && id in PRECO_MODELO;
export const MODELO_INICIAL: IdModelo = "escritorio"; // quem monta a empresa começa com o escritório básico (grátis)
export const MODELOS_GRATIS = MODELOS.filter((m) => m.preco === 0).map((m) => m.id);
// Prédio médio (21/11/2026, lote em quartos, data/quartosLote.ts, pedido do dono: "os modelos de prédio atuais que
// couberem em meio lote passam a ocupar 2/4"). Nenhum modelo cabia em 20 × 10 m do jeito que é; estes cabem com a fundura
// reduzida (data/predios.ts › PLANTA_MEDIO), com a mesma fachada. Ficam só no lote inteiro os de frente funda (a pérgola do
// café, as bancas do mercadinho, a marquise do auditório, a escadaria da escola, a rampa da clínica, a doca do galpão) e a
// sede de dois lotes. O preço de cada modelo não muda. Conferência: testes/quartos/unidade.mjs.
export const MODELOS_MEDIO: IdModelo[] = ["escritorio", "loja", "corporativo", "loft", "varanda", "torre", "galeria", "estudio"];
export const cabeEmMeioLote = (id: IdModelo | null | undefined): boolean => !!id && MODELOS_MEDIO.includes(id);

// Para o que já existia antes do catálogo: o tipo de prédio (layout) diz o modelo. Os 6 prédios antigos (GLB) e o
// galpão industrial não estão no catálogo: quem já tem continua com ele, e ele não volta depois de trocar.
const DO_LAYOUT: Partial<Record<string, IdModelo>> = {
  basico: "escritorio", comercial: "corporativo", coworking: "loft", varanda: "varanda", torre: "torre", esquina: "loja", mercado: "mercadinho",
  galeria: "galeria", logistico: "galpao", estudio: "estudio", auditorio: "auditorio", cafeteria: "cafe", consultorio: "clinica", escola: "escola",
};
interface ComModelo { layout: string; modelo?: string | null; modelosComprados?: string[] }
export const modeloDe = (e: ComModelo): IdModelo | null => (ehModelo(e.modelo) ? e.modelo : DO_LAYOUT[e.layout] ?? null);
// modelos que a empresa pode usar sem pagar: os grátis, os que comprou e o prédio que já tinha antes do catálogo
export function modelosLiberados(e: ComModelo): Set<IdModelo> {
  const s = new Set<IdModelo>(MODELOS_GRATIS);
  for (const id of e.modelosComprados ?? []) if (ehModelo(id)) s.add(id);
  const atual = modeloDe(e); if (atual) s.add(atual);
  return s;
}
export const temModelo = (e: ComModelo, id: IdModelo) => modelosLiberados(e).has(id);
export const brlModelo = (n: number) => (n === 0 ? "Grátis" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
