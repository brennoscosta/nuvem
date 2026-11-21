// Passaporte da cidade, pedidos dos moradores e caça aos presentes de Natal (20/11/2026, frente "visitante"; pedido do
// dono: "temos que pensar em formas que seja prazerosa para a pessoa que vai consumir os serviços do workend, porque
// precisamos que as pessoas possam ter desejos para acessar o workend").
//  - Passaporte: um carimbo por loja ou sede, ganho ao ser atendido na recepção (src/server/passaporte.ts). Marcos dão
//    roupas e acessórios que NÃO estão à venda (data/acessorios.ts › ganho) e insígnias no perfil público.
//  - Pedidos dos moradores: até 2 por dia por pessoa, apontando para uma loja ativa; cumpre no atendimento da recepção.
//  - Caça de Natal (só na época, data/natal.ts): 3 presentes por dia, os mesmos para todo mundo, nas calçadas, no
//    calçadão, na orla e nas praças (nunca dentro de um quarteirão); NATAL_META presentes dão o Gorro de Natal.
// Puro (sem React nem three.js): o mapa, as telas e o servidor usam o mesmo arquivo.
import { PASSO, N, MEIO_CALCADA } from "./mundo";
import { livre } from "./caminhos";
import { QUIOSQUES } from "./quiosques";
import { caixasDaCidade, type Caixa } from "./obstaculos";
import { LUGARES, MORADORES, type Morador } from "./moradores";

// ---------- marcos (fáceis de mudar) ----------
// O dono sugeriu 5, 15 e 30; a cidade tem 6 lugares com recepção hoje (4 sedes e 2 lojas), então 3 e 6 já dão para
// alcançar e 15 fica para quando a cidade crescer. `bonus` é crédito de bônus (R$), uma vez por conta (server/passaporte.ts).
export interface Marco { n: number; id: string; insignia: string; frase: string; item: string; bonus: number; cor: string }
// Bônus em créditos (R$) do visto Viajante (6 carimbos): DESLIGADO na v95 (21/11/2026). Com o personagem grátis, criar
// várias contas para ganhar o bônus ficaria fácil, e o dono não aprovou crédito automático. O visto continua dando a peça
// exclusiva e a insígnia. Para ligar, é só mudar este número (ex.: 2 = R$ 2,00, uma vez por conta, com o teto mensal
// BONUS_TETO_MES de server/passaporte.ts); as telas só falam do bônus quando ele é maior que zero.
export const BONUS_VISTO = 0;
export const MARCOS: Marco[] = [
  { n: 3, id: "turista", insignia: "Turista da cidade", frase: "Foi atendido em 3 lugares da cidade", item: "cordao-passaporte", bonus: 0, cor: "#1D4ED8" },
  { n: 6, id: "viajante", insignia: "Viajante", frase: "Carimbou 6 lugares da cidade", item: "chapeu-explorador", bonus: BONUS_VISTO, cor: "#A16207" },
  { n: 15, id: "desbravador", insignia: "Desbravador", frase: "Carimbou 15 lugares da cidade", item: "mochila-expedicao", bonus: 0, cor: "#166534" },
];
export const MARCO_POR_ID: Record<string, Marco> = Object.fromEntries(MARCOS.map((m) => [m.id, m]));
export const proximoMarco = (total: number) => MARCOS.find((m) => m.n > total) ?? null;

// ---------- Natal ----------
export const NATAL_POR_DIA = 3;
export const NATAL_META = 12; // presentes para ganhar o Gorro de Natal (3 por dia: pelo menos 4 dias de visita)
export const NATAL_ITEM = "gorro-natal";
export const insigniaNatal = (temporada: number) => ({ id: `natal-${temporada}`, insignia: `Caçador de presentes ${temporada}`, frase: `Achou ${NATAL_META} presentes no Natal de ${temporada}`, cor: "#B91C1C" });
export const RAIO_PRESENTE = 2.4; // m: perto assim, o presente é seu

// dia e temporada pelo horário de Brasília (UTC-3 o ano todo desde 2019)
export function diaBR(agoraMs = Date.now()) { return new Date(agoraMs - 3 * 3600_000).toISOString().slice(0, 10); }
export function temporadaNatal(agoraMs = Date.now()) { const [a, m] = diaBR(agoraMs).split("-").map(Number); return m >= 11 ? a : a - 1; }

// ---------- sorteio que não muda (mesma entrada, mesmo resultado no servidor e no navegador) ----------
export function hashTexto(t: string) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function embaralhar<T>(l: T[], r: () => number) { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- onde os presentes podem ficar ----------
// Calçadas: no meio da calçada de cada lado dos 9 quarteirões, longe das esquinas (faixas e semáforos) e do meio do lado
// (portas). Lugares conhecidos: os pontos onde os moradores param (calçadão, orla, praças, Vila dos Criativos, Rua do
// Comércio), um pouco ao lado.
// Conferência contra os obstáculos NUM PONTO SÓ, na hora (esconderijoLivre): o livre() dos caminhos (dentro de quarteirão
// e corpo de quiosque), nenhum terreninho de quiosque a menos de 1,2 m e nenhuma caixa de chão de data/obstaculos.ts (prédio da Nuvem,
// lanchonete, sedes, casas) a menos de 0,8 m. Nada aqui guarda a posição de quiosque ou prédio: se os quiosques
// (data/quiosques.ts) ou os prédios mudarem de lugar, a lista se refaz pelos dados novos na próxima subida do servidor.
export interface Esconderijo { x: number; z: number; marco: boolean }
let ESCONDERIJOS: Esconderijo[] | null = null;
let CAIXAS_CHAO: Caixa[] | null = null;
export function esconderijoLivre(x: number, z: number) {
  // o terreninho do quiosque inteiro, com 1,2 m de folga: o quiosque pode estar em qualquer ponto dele (modo "Editar posição")
  if (!livre(x, z) || QUIOSQUES.some((k) => x > k.terreno.x0 - 1.2 && x < k.terreno.x1 + 1.2 && z > k.terreno.z0 - 1.2 && z < k.terreno.z1 + 1.2)) return false;
  CAIXAS_CHAO ??= caixasDaCidade({}).filter((c) => c.y0 < 1.5);
  const f = 0.8;
  return !CAIXAS_CHAO.some((c) => x > c.x0 - f && x < c.x1 + f && z > c.z0 - f && z < c.z1 + f);
}
export function esconderijos(): Esconderijo[] {
  if (ESCONDERIJOS) return ESCONDERIJOS;
  const out: Esconderijo[] = [];
  const d = MEIO_CALCADA - 0.3;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const cx = i * PASSO, cz = j * PASSO;
    for (const t of [-14.5, -5.5, 5.5, 14.5]) {
      out.push({ x: cx + t, z: cz - d, marco: false }, { x: cx + t, z: cz + d, marco: false }, { x: cx - d, z: cz + t, marco: false }, { x: cx + d, z: cz + t, marco: false });
    }
  }
  const ao = (id: string, dx: number, dz: number) => (LUGARES[id]?.pontos ?? []).forEach(([x, z]) => out.push({ x: x + dx, z: z + dz, marco: true }));
  ao("calcadao", 2, 0); ao("orla-leste", 0, 2); ao("orla-sul", 2, 0); ao("bancos-nuvem", 1.5, 0); ao("vila", 2, 0); ao("comercio", 0, -2);
  ESCONDERIJOS = out.filter((p) => esconderijoLivre(p.x, p.z));
  return ESCONDERIJOS;
}

export interface Presente { idx: number; x: number; z: number; caixa: string; fita: string }
const CORES_PRESENTE: [string, string][] = [["#C8102E", "#F2C14E"], ["#1F7A3A", "#E9EDF1"], ["#F4F1EA", "#C8102E"], ["#1E3A8A", "#F2C14E"]];
const guardados = new Map<string, Presente[]>();
// os presentes do dia: um num lugar conhecido e os outros em calçadas, longe uns dos outros (35 m ou mais)
export function presentesDoDia(dia: string): Presente[] {
  const pronto = guardados.get(dia); if (pronto) return pronto;
  const r = sorteador(hashTexto(`natal:${dia}`));
  const todos = embaralhar(esconderijos(), r);
  const escolhidos: Esconderijo[] = [];
  const longe = (p: Esconderijo) => escolhidos.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 35);
  const primeiro = todos.find((p) => p.marco); if (primeiro) escolhidos.push(primeiro);
  for (const p of todos) { if (escolhidos.length >= NATAL_POR_DIA) break; if (!escolhidos.includes(p) && longe(p)) escolhidos.push(p); }
  const cores = embaralhar(CORES_PRESENTE, r);
  const lista = escolhidos.map((p, idx) => ({ idx, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, caixa: cores[idx % cores.length][0], fita: cores[idx % cores.length][1] }));
  if (guardados.size > 20) guardados.clear();
  guardados.set(dia, lista);
  return lista;
}

// ---------- carimbos ----------
// Cada lugar tem o seu desenho de carimbo, sempre o mesmo (pela chave do lote): formato, giro, borda e força da tinta.
export type FormaCarimbo = "redondo" | "oval" | "retangulo" | "hexagono" | "escudo" | "serrilhado";
const FORMAS: FormaCarimbo[] = ["redondo", "retangulo", "oval", "hexagono", "escudo", "serrilhado"];
export function estiloDoCarimbo(chave: string) {
  const h = hashTexto(`carimbo:${chave}`);
  return { forma: FORMAS[h % FORMAS.length], giro: ((h >>> 4) % 27) - 13, dupla: ((h >>> 9) & 1) === 1, tinta: 0.8 + ((h >>> 11) % 15) / 100, dx: ((h >>> 15) % 11) - 5, dy: ((h >>> 19) % 9) - 4 };
}
// número do passaporte (só desenho: não é documento nem dado pessoal): WE + 7 letras e números tirados da conta
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function numeroPassaporte(usuarioId: string) {
  let h = hashTexto(`passaporte:${usuarioId}`), s = "";
  for (let i = 0; i < 7; i++) { s += ALFA[h % ALFA.length]; h = Math.floor(h / ALFA.length) || hashTexto(s + usuarioId); }
  return `WE${s}`;
}
// a linha de baixo da página de identificação, como nos passaportes de verdade (só letras, números e "<")
export function linhaMaquina(nome: string, numero: string, emitido: string) {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]+/g, "<").replace(/^<+|<+$/g, "") || "VISITANTE";
  const l1 = `P<WRK${n}`.padEnd(44, "<").slice(0, 44);
  const l2 = `${numero}<<WRK${emitido.replace(/-/g, "").slice(2)}<<<CIDADE<WORKEND`.padEnd(44, "<").slice(0, 44);
  return [l1, l2];
}

// ---------- pedidos dos moradores ----------
export const PEDIDOS_POR_DIA = 2;
// quem tem pedido para esta pessoa hoje: 2 moradores, sorteados pela conta e pelo dia (só os que aparecem no celular)
export function moradoresComPedido(usuarioId: string, dia: string): Morador[] {
  const r = sorteador(hashTexto(`pedido:${usuarioId}:${dia}`));
  return embaralhar(MORADORES.filter((m) => m.celular), r).slice(0, PEDIDOS_POR_DIA);
}
export interface LojaDoPedido { nome: string; nicho: string; atendente: string | null }
const primeiro = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";
// o pedido em roteiro (sem IA), pelo tipo da loja; `cupom` é o desconto do passaporte, se a loja tiver
export function textoDoPedido(m: Pick<Morador, "genero" | "id">, l: LojaDoPedido, cupom: string | null, sorte: number): string {
  const at = primeiro(l.atendente);
  const nome = l.nome;
  const comida = l.nicho === "alimentacao" || /padaria|p[aã]o|bolo|doce|caf[eé]|lanche|pizza|restaurante|marmita|a[cç]a[ií]|sorvete/i.test(nome);
  const opcoes = comida
    ? [`A ${nome} acabou de tirar fornada nova. Passa lá e fala com a recepção por mim? Sentir o cheirinho já vale a visita.`, `Me disseram que a ${nome} está com coisa gostosa saindo agora. Dá um pulo lá e fala com ${at || "a recepção"}?`]
    : l.nicho === "tecnologia"
      ? [`O pessoal da ${nome} está mostrando novidade. Passa lá, fala com ${at || "a recepção"} e depois me conta o que viu?`, `Você já entrou na ${nome}? Faz um favor: vai lá e pergunta na recepção o que eles fazem. Eu fiquei curios${m.genero === "f" ? "a" : "o"}.`]
      : l.nicho === "conteudo" || l.nicho === "eventos"
        ? [`Tem coisa acontecendo na ${nome}. Passa na recepção e vê o que é? Depois me conta.`, `A ${nome} vive cheia de ideia. Vai lá falar com ${at || "a recepção"} e me diz se vale a pena.`]
        : [`Você já conhece ${at ? `a ${at}, da recepção da ${nome}` : `a recepção da ${nome}`}? Gente boa demais. Passa lá e diz que fui eu que mandei.`, `Faz um favor? Passa na ${nome} e fala com a recepção. Eles gostam de ver gente nova por lá.`];
  const base = opcoes[Math.floor(sorte * opcoes.length) % opcoes.length];
  return cupom ? `${base} E quem chega com o passaporte ganha ${cupom}.` : base;
}
export function textoDoObrigado(m: Pick<Morador, "genero" | "bordao">, loja: string, nome: string | null) {
  const voce = nome ? `, ${nome}` : m.bordao === "meu bem" ? ", meu bem" : "";
  return `Você foi na ${loja}! Eles me contaram. Obrigad${m.genero === "f" ? "a" : "o"}${voce}: rua com movimento é rua feliz.`;
}
