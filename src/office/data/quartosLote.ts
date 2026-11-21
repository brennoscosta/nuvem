// Lote em quartos (21/11/2026, pedido do dono: "Quando comprarem um terreno desse, a pessoa pode usar 1/4 dessas áreas e,
// se quiser colocar só um quiosque, a pessoa pode, e fica sobrando 3/4 do terreno para ser usado ainda"). O lote de
// 20 × 20 m se divide em 4 quartos de 10 × 10 m (2 × 2); os quartos livres servem para CRESCER DEPOIS, sem comprar outro
// lote (o lote continua R$ 99/mês). Três tamanhos:
//  - quiosque: 1 quarto, com o desenho dos quiosques da orla (data/quiosques.ts) e a atendente no balcão; até 4 por lote;
//  - prédio médio: 2 quartos, uma das metades (norte, sul, leste ou oeste), com os modelos que cabem em meio lote
//    (data/modelos.ts › MODELOS_MEDIO) e a planta de dentro compacta (data/escritorio.ts › PREDIO_MEDIO);
//  - prédio grande: o lote inteiro, como sempre.
// Fica em escritorio.decor.quartos (jsonb, sem migração). Sem o campo, o lote é de prédio grande, como todos os lotes de
// antes (as sedes também). No lote duplo os quartos não valem: o prédio grande ocupa os dois terrenos, como hoje (o
// servidor apaga os quartos quando o lote extra é pago: src/server/terrenos.ts › ativarTerreno).
// O prédio médio é o prédio do escritório de sempre (layout e modelo do escritório, giro em decor.giro). Um prédio só por
// lote, porque a empresa tem uma planta de dentro só; a outra metade aceita até dois quiosques.
// Quem confere as posições (dentro do quarto, a porta e o balcão com passagem até a calçada) é data/posicaoPredio.ts.
// Tudo aqui é função pura (sem three.js, sem React).
import type { Giro, Lado } from "./posicaoPredio";

export type Quarto = 0 | 1 | 2 | 3; // 0 = noroeste, 1 = nordeste, 2 = sudoeste, 3 = sudeste (eixos do mundo, como o k do lote)
export type Metade = Lado; // n = quartos 0 e 1, s = 2 e 3, o = 0 e 2, l = 1 e 3
export type ModeloQuiosqueLote = "toldo" | "chale" | "redondo"; // os três desenhos dos quiosques da orla
export interface QuiosqueLote { id: string; quarto: Quarto; giro: Giro; modelo: ModeloQuiosqueLote }
export interface QuartosLote { predio: { metade: Metade } | null; quiosques: QuiosqueLote[] }
export type TamanhoLote = "quiosque" | "medio" | "grande";

export const MAX_QUIOSQUES_LOTE = 4;
export const LADO_QUARTO = 10; // m (metade do lado do lote)
export const QUARTOS: Quarto[] = [0, 1, 2, 3];
export const METADES: Metade[] = ["n", "s", "o", "l"];
export const QUARTOS_DA_METADE: Record<Metade, [Quarto, Quarto]> = { n: [0, 1], s: [2, 3], o: [0, 2], l: [1, 3] };
export const NOME_QUARTO: Record<Quarto, string> = { 0: "noroeste", 1: "nordeste", 2: "sudoeste", 3: "sudeste" };
export const NOME_METADE: Record<Metade, string> = { n: "norte", s: "sul", o: "oeste", l: "leste" };
export const NOME_TAMANHO: Record<TamanhoLote, string> = { quiosque: "Só um quiosque", medio: "Prédio médio", grande: "Prédio grande" };
export const MODELOS_QUIOSQUE_LOTE: { id: ModeloQuiosqueLote; nome: string }[] = [
  { id: "toldo", nome: "Toldo listrado" }, { id: "chale", nome: "Chalé de madeira" }, { id: "redondo", nome: "Redondo de praia" },
];
const OPOSTA: Record<Metade, Metade> = { n: "s", s: "n", o: "l", l: "o" };

const ehQuarto = (v: unknown): v is Quarto => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3;
const giroOk = (g: unknown): Giro => ([0, 1, 2, 3].includes(Number(g)) ? (Number(g) as Giro) : 0);
export function novoIdQuiosque(q: QuartosLote | null | undefined): string {
  for (let i = 1; i < 99; i++) if (!q?.quiosques.some((k) => k.id === `q${i}`)) return `q${i}`;
  return `q${Date.now() % 100000}`;
}

// Limpa o que veio do navegador: metade e quartos válidos, sem quarto repetido, no máximo 4 quiosques. Sem nada no lote,
// volta a ser o prédio grande (null).
export function limparQuartos(x: unknown): QuartosLote | null {
  if (!x || typeof x !== "object") return null;
  const o = x as { predio?: unknown; quiosques?: unknown };
  const pm = o.predio && typeof o.predio === "object" ? (o.predio as { metade?: unknown }).metade : null;
  const predio = typeof pm === "string" && (METADES as string[]).includes(pm) ? { metade: pm as Metade } : null;
  const usados = new Set<Quarto>(predio ? QUARTOS_DA_METADE[predio.metade] : []);
  const quiosques: QuiosqueLote[] = [];
  for (const k of Array.isArray(o.quiosques) ? o.quiosques.slice(0, 8) : []) {
    if (quiosques.length >= MAX_QUIOSQUES_LOTE || !k || typeof k !== "object") continue;
    const r = k as Record<string, unknown>, quarto = Number(r.quarto);
    if (!ehQuarto(quarto) || usados.has(quarto)) continue;
    const parcial: QuartosLote = { predio, quiosques };
    const id = typeof r.id === "string" && /^q[0-9]{1,5}$/.test(r.id) && !quiosques.some((q) => q.id === r.id) ? r.id : novoIdQuiosque(parcial);
    const modelo = MODELOS_QUIOSQUE_LOTE.some((m) => m.id === r.modelo) ? (r.modelo as ModeloQuiosqueLote) : "toldo";
    quiosques.push({ id, quarto, giro: giroOk(r.giro), modelo });
    usados.add(quarto);
  }
  if (!predio && !quiosques.length) return null;
  return { predio, quiosques };
}

export const tamanhoDoLote = (q: QuartosLote | null | undefined): TamanhoLote => (!q ? "grande" : q.predio ? "medio" : "quiosque");
export function quartosOcupados(q: QuartosLote | null | undefined): Set<Quarto> {
  if (!q) return new Set(QUARTOS);
  const s = new Set<Quarto>(q.predio ? QUARTOS_DA_METADE[q.predio.metade] : []);
  for (const k of q.quiosques) s.add(k.quarto);
  return s;
}
export const quartosLivres = (q: QuartosLote | null | undefined): Quarto[] => { const o = quartosOcupados(q); return QUARTOS.filter((x) => !o.has(x)); };
export const metadesLivres = (q: QuartosLote | null | undefined): Metade[] => { const o = quartosOcupados(q); return METADES.filter((m) => QUARTOS_DA_METADE[m].every((x) => !o.has(x))); };
export const metadeDoQuarto = (q: Quarto, m: Metade) => QUARTOS_DA_METADE[m].includes(q);

// preferências (k do lote, data/mundo.ts: todo lote é de esquina). O quarto da esquina dá para as duas ruas; depois o da
// rua da frente, o da rua do lado e o de dentro. Para o prédio médio: a metade da rua da frente, a da rua do lado e as outras.
export const ordemQuartos = (k: number): Quarto[] => [k, k ^ 1, k ^ 2, k ^ 3] as Quarto[];
export function ordemMetades(k: number): Metade[] {
  const frente: Metade = k >= 2 ? "s" : "n", lado: Metade = k % 2 ? "l" : "o";
  return [frente, lado, OPOSTA[lado], OPOSTA[frente]];
}
// o lote só com um quiosque, no quarto da esquina (o giro certo é escolhido por data/posicaoPredio.ts › acomodarQuartos)
export const soUmQuiosque = (k: number, modelo: ModeloQuiosqueLote = "toldo"): QuartosLote => ({ predio: null, quiosques: [{ id: "q1", quarto: ordemQuartos(k)[0], giro: 0, modelo }] });
// o prédio médio na primeira metade livre (os quiosques que já estão na outra metade ficam)
export function comPredioMedio(q: QuartosLote | null | undefined, k: number, metade?: Metade): QuartosLote | null {
  const livres = metadesLivres(q ?? { predio: null, quiosques: [] });
  const m = metade && livres.includes(metade) ? metade : ordemMetades(k).find((x) => livres.includes(x));
  if (!m) return null;
  return { predio: { metade: m }, quiosques: (q?.quiosques ?? []).filter((x) => !metadeDoQuarto(x.quarto, m)) };
}
export function comMaisUmQuiosque(q: QuartosLote, k: number, quarto?: Quarto, modelo: ModeloQuiosqueLote = "toldo"): QuartosLote | null {
  if (q.quiosques.length >= MAX_QUIOSQUES_LOTE) return null;
  const livres = quartosLivres(q);
  const alvo = quarto != null && livres.includes(quarto) ? quarto : ordemQuartos(k).find((x) => livres.includes(x));
  if (alvo == null) return null;
  return { predio: q.predio, quiosques: [...q.quiosques, { id: novoIdQuiosque(q), quarto: alvo, giro: 0, modelo }] };
}
