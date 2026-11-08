// O mundo do WorkEnd: uma grade de quarteirões, cada um com 4 lotes (2 × 2). Estilo The Sims: as empresas compram
// o chão. A Nuvem ocupa o quarteirão central inteiro (4 lotes); o restaurante drive-thru ocupa o quarteirão a leste.
// Todo o resto está à venda: casinha velha, casinha térrea, sobrado... ou terreno vazio com placa.
// Unidade: metros. O prédio da Nuvem continua centrado na origem (a planta em layout.ts não mudou).
export const LOTE = 20; // lado de um lote
export const QUARTEIRAO = 40; // lado do quarteirão (2 lotes)
export const CALCADA = 2.5; // largura da calçada em volta do quarteirão
export const RUA = 7; // largura da rua (duas mãos)
export const PASSO = QUARTEIRAO + 2 * CALCADA + RUA; // distância entre centros de quarteirões vizinhos (52 m)
export const MEIO_Q = QUARTEIRAO / 2; // 20
export const BORDA_CALCADA = MEIO_Q + CALCADA; // 22,5: onde a calçada termina e a rua começa
export const EIXO_RUA = BORDA_CALCADA + RUA / 2; // 26: eixo da rua a partir do centro do quarteirão

// Tamanho do mundo em quarteirões: índices de -N..N em cada eixo (3 × 3 = 9 quarteirões, 36 lotes)
export const N = 1;
// Limite do chão (grama vai até aqui; o horizonte fica logo depois)
export const MUNDO = { x: N * PASSO + EIXO_RUA + 14, z: N * PASSO + EIXO_RUA + 14 };

export type ModeloCasa = "casaVelha" | "casaTerrea" | "casaSobrado" | "casaColonial" | "casaModerna";
export type Lote =
  | { tipo: "vazio"; arvore?: boolean }
  | { tipo: "casa"; modelo: ModeloCasa; rot?: number; escala?: number };

export interface Quarteirao {
  i: number; // coluna (x)
  j: number; // linha (z)
  ocupante?: "nuvem" | "restaurante"; // quarteirão inteiro
  lotes?: [Lote, Lote, Lote, Lote]; // ordem: noroeste, nordeste, sudoeste, sudeste
}

export const centroQuarteirao = (i: number, j: number): [number, number] => [i * PASSO, j * PASSO];
// k: 0 = NO (-x,-z), 1 = NE (+x,-z), 2 = SO (-x,+z), 3 = SE (+x,+z)
export const centroLote = (i: number, j: number, k: number): [number, number] => {
  const [cx, cz] = centroQuarteirao(i, j);
  return [cx + (k % 2 ? LOTE / 2 : -LOTE / 2), cz + (k >= 2 ? LOTE / 2 : -LOTE / 2)];
};
// Pra onde a casa do lote k deve olhar: pra rua mais próxima (lado de fora do quarteirão).
// Lotes do norte olham pro norte (-z), do sul pro sul (+z). rot 0 = frente pra +z.
export const frenteDoLote = (k: number) => (k >= 2 ? 0 : Math.PI);

// Casas distribuídas pra nunca repetir o mesmo modelo lado a lado; terrenos vazios no meio.
const V = (arvore = false): Lote => ({ tipo: "vazio", arvore });
const C = (modelo: ModeloCasa, escala = 1): Lote => ({ tipo: "casa", modelo, escala });

export const QUARTEIROES: Quarteirao[] = [
  { i: 0, j: 0, ocupante: "nuvem" },
  { i: 1, j: 0, ocupante: "restaurante" },
  { i: -1, j: 0, lotes: [C("casaTerrea"), V(true), C("casaColonial", 1.05), C("casaVelha")] },
  { i: -1, j: -1, lotes: [C("casaSobrado"), C("casaModerna"), V(), C("casaTerrea", 0.95)] },
  { i: 0, j: -1, lotes: [V(true), C("casaVelha", 1.05), C("casaColonial"), V()] },
  { i: 1, j: -1, lotes: [C("casaModerna", 1.05), V(), V(true), C("casaSobrado", 0.95)] },
  { i: -1, j: 1, lotes: [V(), C("casaModerna"), C("casaVelha", 0.95), V(true)] },
  { i: 0, j: 1, lotes: [C("casaColonial", 0.95), V(true), V(), C("casaTerrea", 1.05)] },
  { i: 1, j: 1, lotes: [C("casaVelha"), C("casaSobrado", 1.05), C("casaModerna", 0.95), V()] },
];

// Ruas: linhas (z fixo) e colunas (x fixo) nos eixos entre os quarteirões, cobrindo o mundo inteiro
export const EIXOS_RUA: number[] = [];
for (let n = -N; n <= N + 1; n++) EIXOS_RUA.push(n * PASSO - EIXO_RUA);
export const COMPRIMENTO_RUA = 2 * (N * PASSO + EIXO_RUA) + RUA;

// Lotes à venda, numerados de forma estável (Lote 1, 2, 3…) na ordem da planta
export interface LoteInfo { chave: string; numero: number; i: number; j: number; k: number; lote: Lote; centro: [number, number] }
export const LOTES: LoteInfo[] = [];
for (const q of QUARTEIROES) q.lotes?.forEach((lote, k) => LOTES.push({ chave: `${q.i},${q.j},${k}`, numero: LOTES.length + 1, i: q.i, j: q.j, k, lote, centro: centroLote(q.i, q.j, k) }));
export const LOTE_POR_CHAVE: Record<string, LoteInfo> = Object.fromEntries(LOTES.map((l) => [l.chave, l]));

export const NOME_CONSTRUCAO: Record<string, string> = {
  vazio: "terreno vazio", casaVelha: "casinha antiga pra reformar", casaTerrea: "casinha térrea", casaSobrado: "sobrado moderno", casaColonial: "sobrado colonial", casaModerna: "casa moderna",
};
export const descricaoLote = (l: LoteInfo) => (l.lote.tipo === "vazio" ? (l.lote.arvore ? "terreno vazio com uma árvore" : "terreno vazio") : NOME_CONSTRUCAO[l.lote.modelo]);

// Nicho da empresa (vai no balão em cima do lote). O dono escolhe ao montar a marca.
export const NICHOS: { id: string; nome: string }[] = [
  { id: "negocios", nome: "Negócios" }, { id: "tecnologia", nome: "Tecnologia" }, { id: "conteudo", nome: "Conteúdo" }, { id: "cursos", nome: "Cursos" },
  { id: "treinamentos", nome: "Treinamentos" }, { id: "marketing", nome: "Marketing" }, { id: "consultoria", nome: "Consultoria" }, { id: "servicos", nome: "Serviços" },
  { id: "varejo", nome: "Loja & Varejo" }, { id: "alimentacao", nome: "Alimentação" }, { id: "saude", nome: "Saúde & Bem-estar" }, { id: "beleza", nome: "Beleza" },
  { id: "educacao", nome: "Educação" }, { id: "financas", nome: "Finanças" }, { id: "juridico", nome: "Jurídico" }, { id: "imoveis", nome: "Imóveis" },
  { id: "casa", nome: "Casa & Reforma" }, { id: "eventos", nome: "Eventos" }, { id: "turismo", nome: "Turismo" }, { id: "automotivo", nome: "Automotivo" },
];
export const nomeNicho = (id: string | null | undefined) => NICHOS.find((n) => n.id === id)?.nome ?? "Negócios";
export const nichoValido = (id: unknown) => (typeof id === "string" && NICHOS.some((n) => n.id === id) ? id : "negocios");

// Calçadas: pra um personagem "andar como pedestre", projetamos um ponto no meio da calçada mais próxima
// (as calçadas contornam cada quarteirão a BORDA_CALCADA - 1,2 do centro) e sorteamos um destino ao longo dela.
export const MEIO_CALCADA = BORDA_CALCADA - 1.2; // 21,3
export function pontoNaCalcada(x: number, z: number): [number, number] {
  const i = Math.round(x / PASSO), j = Math.round(z / PASSO);
  const cx = i * PASSO, cz = j * PASSO, dx = x - cx, dz = z - cz;
  const B = MEIO_CALCADA;
  // encosta na borda do quarteirão mais perto (norte/sul ou leste/oeste)
  if (Math.abs(dx) > Math.abs(dz)) return [cx + Math.sign(dx || 1) * B, cz + Math.max(-B, Math.min(B, dz))];
  return [cx + Math.max(-B, Math.min(B, dx)), cz + Math.sign(dz || 1) * B];
}
// próximo passeio: anda uns metros pela mesma calçada (vira a esquina quando chega no fim)
export function passeioNaCalcada(x: number, z: number, sorte = Math.random()): [number, number] {
  const [px, pz] = pontoNaCalcada(x, z);
  const i = Math.round(px / PASSO), j = Math.round(pz / PASSO);
  const cx = i * PASSO, cz = j * PASSO, B = MEIO_CALCADA;
  const naVertical = Math.abs(Math.abs(px - cx) - B) < 0.01; // estou numa calçada leste/oeste (anda em z)
  const passo = 6 + sorte * 10, sentido = sorte > 0.5 ? 1 : -1;
  if (naVertical) { const nz = Math.max(cz - B, Math.min(cz + B, pz + sentido * passo)); return [px, nz]; }
  const nx = Math.max(cx - B, Math.min(cx + B, px + sentido * passo)); return [nx, pz];
}
