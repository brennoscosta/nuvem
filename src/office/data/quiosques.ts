// Quiosques (20/11/2026, pedido do dono: "além dos lotes de 4 terrenos, lotes menores para vender quiosques menores, algo
// mais barato, em torno de 47,00"). Ponto com balcão, toldo, prateleira, a logo e as cores da empresa. O visitante é
// atendido no balcão, sem entrar em prédio, pela atendente da empresa (a mesma conversa da loja). Mesma regra do lote:
// reserva de 1 hora, Pix de 30 dias, renovação, um ponto por conta.
//
// Ficam na tabela terreno com chave própria ("quiosque-101"), FORA da lista de lotes (data/mundo.ts › LOTES): o código
// que percorre os lotes (casas, prédios, quintais, numeração) não enxerga os quiosques, do mesmo jeito que não enxerga as
// sedes. A numeração começa em 101 e não colide com os lotes (1 a 36) nem com as sedes (0 e 901 a 903).
//
// 21/11/2026 (pedido do dono: "não gostei das áreas que foram feitos os quiosques, além de ter feito muito pequenos eles
// ficaram de frente para o local errado"): os 14 saíram dos pontos soltos (cantos da praça, quadra da Nuvem, calçadão do
// rio, orla) e foram todos para a RUA DOS QUIOSQUES DA ORLA: a faixa de grama entre a Avenida Atlântica e o calçadão da
// praia (leste), em três quadras de quiosques lado a lado, com o balcão virado para o calçadão, por onde passam os
// moradores e, desde agora, o visitante (data/caminhos.ts: o calçadão da orla ficou andável). As quadras ficam entre as
// travessias dos moradores (z = ±73,3, ±30,7 e ±21,3) e longe do outdoor L1 (z de 18,8 a 33,2) e dos coqueiros da borda
// (x = 85). Conferência das folgas: testes/editor/folgas.mjs.
// Tamanho de quiosque de verdade: corpo de 4,2 m de frente por 3 m de fundo (balcão, prateleira e a atendente atrás),
// toldo de mais 1,1 m e banquinhos na frente. Cada um tem um terreninho de 6,4 m de frente por 6 m de fundo marcado no chão, onde o dono gira e
// ajusta o quiosque no modo "Editar posição" (data/posicaoPredio.ts).
// pos0 e rot0: a vaga (centro e para onde o balcão olha com giro 0; 0 = +z, como frenteDoLote). pos e rot: onde o quiosque
// está agora (o giro e o ajuste do dono, aplicarPosesQuiosques); quem desenha e desvia usa estes.
import type { Escritorio, Decoracao } from "./escritorio";
import { PRECO_QUIOSQUE, PRECO_ESPACO } from "./precosTerreno";
import { LOTES, frenteDoLote, type LoteInfo } from "./mundo";

export { PRECO_QUIOSQUE, PRECO_ESPACO };
// "lote": 1/4 de um lote da cidade (10 × 10 m) (24/11/2026, ESPACOS abaixo)
export type AreaQuiosque = "orlaNorte" | "orlaCentro" | "orlaSul" | "lote";
export type ModeloQuiosque = "toldo" | "chale" | "redondo";
export interface RetQuiosque { x0: number; x1: number; z0: number; z1: number }
export interface QuiosqueInfo {
  chave: string; numero: number; area: AreaQuiosque; ponto: string; modelo: ModeloQuiosque;
  terreno: RetQuiosque; pos0: [number, number]; rot0: number; // a vaga
  pos: [number, number]; rot: number; // onde está agora (com o giro e o ajuste do dono)
}

export const NOME_AREA_QUIOSQUE: Record<AreaQuiosque, string> = {
  orlaNorte: "Quiosques da Orla · norte", orlaCentro: "Quiosques da Orla · centro", orlaSul: "Quiosques da Orla · sul",
  lote: "1/4 de lote · 10 × 10 m",
};
export const NOME_MODELO_QUIOSQUE: Record<ModeloQuiosque, string> = { toldo: "quiosque com toldo listrado", chale: "quiosque chalé de madeira", redondo: "quiosque redondo de praia" };

// medidas do quiosque (as três variações cabem nesta caixa): 4,2 m de frente e 3 m de fundo; o balcão fica na frente (+z local)
export const QUIOSQUE_LARGURA = 4.2, QUIOSQUE_FUNDO = 3.0;
export const TOLDO_Q = 1.1; // quanto o toldo passa da frente
export const BALCAO_Z = QUIOSQUE_FUNDO / 2 + 1.6; // onde o cliente fica, na frente do balcão, depois dos banquinhos
export const LADO_TERRENO_Q = 6.4; // terreninho de 6,4 m ao longo da rua dos quiosques por 6 m de fundo
// o que o quiosque ocupa no chão (deque, toldo e banquinhos) e o corpo (deque e balcão), locais
export const pegadaQuiosque = () => ({ x0: -QUIOSQUE_LARGURA / 2 - 0.2, x1: QUIOSQUE_LARGURA / 2 + 0.2, z0: -QUIOSQUE_FUNDO / 2 - 0.2, z1: QUIOSQUE_FUNDO / 2 + TOLDO_Q + 0.15 });
export const corpoQuiosque = () => ({ x0: -QUIOSQUE_LARGURA / 2 - 0.2, x1: QUIOSQUE_LARGURA / 2 + 0.2, z0: -QUIOSQUE_FUNDO / 2 - 0.2, z1: QUIOSQUE_FUNDO / 2 + 0.25 });

// a rua dos quiosques: faixa de grama da orla leste, de x = 86 (a 1 m dos coqueiros da borda, em x = 85) até a ciclovia
// (x = 92); terreninhos de 6,4 m com 1,1 m de passagem entre eles
const X0_FAIXA = 86.0, X1_FAIXA = 92.0;
const X_VAGA = 88.3; // centro do quiosque com o balcão para o calçadão: o fundo a 0,6 m da beira de trás, o cliente a 0,6 m da ciclovia
const R = Math.PI / 2; // balcão para +x (o calçadão da praia)
const q = (numero: number, area: AreaQuiosque, ponto: string, zc: number, modelo: ModeloQuiosque): QuiosqueInfo => {
  const terreno = { x0: X0_FAIXA, x1: X1_FAIXA, z0: zc - LADO_TERRENO_Q / 2, z1: zc + LADO_TERRENO_Q / 2 };
  return { chave: `quiosque-${numero}`, numero, area, ponto, modelo, terreno, pos0: [X_VAGA, zc], rot0: R, pos: [X_VAGA, zc], rot: R };
};
const N = "na Rua dos Quiosques da Orla, quadra norte, de frente para o calçadão da praia";
const C = "na Rua dos Quiosques da Orla, quadra do centro, de frente para o calçadão da praia";
const S = "na Rua dos Quiosques da Orla, quadra sul, de frente para o calçadão da praia";
export const QUIOSQUES: QuiosqueInfo[] = [
  // quadra norte: entre as travessias de z = -73,3 e -30,7
  q(101, "orlaNorte", N, -67, "toldo"), q(102, "orlaNorte", N, -59.5, "chale"), q(103, "orlaNorte", N, -52, "redondo"),
  q(104, "orlaNorte", N, -44.5, "toldo"), q(105, "orlaNorte", N, -37, "chale"),
  // quadra do centro: entre a travessia de z = -21,3 e o outdoor L1
  q(106, "orlaCentro", C, -16.25, "redondo"), q(107, "orlaCentro", C, -8.75, "toldo"), q(108, "orlaCentro", C, -1.25, "chale"),
  q(109, "orlaCentro", C, 6.25, "redondo"), q(110, "orlaCentro", C, 13.75, "toldo"),
  // quadra sul: entre o outdoor L1 e a travessia de z = 73,3
  q(111, "orlaSul", S, 42, "chale"), q(112, "orlaSul", S, 49.5, "redondo"), q(113, "orlaSul", S, 57, "toldo"), q(114, "orlaSul", S, 64.5, "chale"),
];

// ---------- espaços nos lotes: o lote dividido em 4 (24/11/2026) ----------
// Pedido do dono: "o cliente que vai locar o lote pode selecionar 20x20 m, também quero agora a possibilidade [menor],
// valor 49,90... um 20x20 pode ter 4 lojas de diferentes clientes" e, corrigindo a primeira versão (4 espaços de 5 × 5 m na
// frente, "ficou muito pequeno para os clientes por 49,90"): "quero esse quadrado dividido por 4". O lote de 20 × 20 m
// vira 4 quadrados de 10 × 10 m (2 × 2): A e B na frente, de frente para a calçada; C e D no fundo, atrás de A e B, com o
// balcão virado para um corredor de pedra que sai da calçada e passa no meio do lote (CORREDOR_DO_LOTE). Cada espaço é um
// quiosque (o mesmo desenho, a atendente no balcão, a mesma reserva, o Pix e a renovação), com chave própria e preço
// próprio (PRECO_ESPACO). Regra: lote alugado inteiro não aluga espaço, e lote com espaço alugado não aluga inteiro
// (src/server/terrenos.ts › conferirEspacosDoLote). Só aparecem no mapa depois de reservados (scene/Quiosques.tsx).
// Número: 200 + (número do lote − 1) × 4 + a posição (A = 1, B = 2, C = 3, D = 4). A e C ficam à esquerda de quem olha o
// lote da calçada; B e D, à direita.
export const LADO_ESPACO = 10; // m (o quadrado de 10 × 10 m, 1/4 do lote)
export const TAMANHO_ESPACO = "10 × 10 m";
export const LETRA_ESPACO = ["A", "B", "C", "D"] as const;
export const LARGURA_CORREDOR = 2; // m, no meio do lote, da calçada até o fundo dos espaços C e D
const PRIMEIRO_ESPACO = 201;
const numeroEspaco = (l: LoteInfo, p: number) => PRIMEIRO_ESPACO - 1 + (l.numero - 1) * 4 + p + 1;
// A e B: o quiosque na frente do quadrado, a 7,2 m do centro do lote (a frente fica a 10 m), com os banquinhos dentro da
// divisa e o cliente em pé na calçada. C e D: o quiosque encostado no corredor, com o balcão virado para ele.
const FRENTE_ESPACO = 7.2, FRENTE_QUIOSQUE = 2.8; // do centro do quiosque até a frente dos banquinhos
function espacosDe(l: LoteInfo): QuiosqueInfo[] {
  const [cx, cz] = l.centro, s = l.k >= 2 ? 1 : -1, rua = frenteDoLote(l.k);
  return [0, 1, 2, 3].map((p) => {
    const lado = p % 2 === 0 ? -1 : 1, frente = p < 2; // esquerda/direita de quem olha da calçada; frente/fundo
    const xq = cx + s * lado * 5, zq = cz + (frente ? s * 5 : -s * 5); // centro do quadrado
    let pos: [number, number], rot: number;
    if (frente) { pos = [xq, cz + s * FRENTE_ESPACO]; rot = rua; }
    else {
      // de frente para o corredor (no x do centro do lote): a frente do quiosque (os banquinhos) encosta nele
      const paraCorredor = -s * lado; // +1: o corredor fica a +x do quiosque
      pos = [cx - paraCorredor * (LARGURA_CORREDOR / 2 + FRENTE_QUIOSQUE), zq];
      rot = paraCorredor > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    return {
      chave: `quiosque-${numeroEspaco(l, p)}`, numero: numeroEspaco(l, p), area: "lote" as const,
      ponto: `no Lote ${l.numero}, espaço ${LETRA_ESPACO[p]} (${frente ? "na frente, de frente para a rua" : "no fundo, de frente para o corredor do lote"})`,
      modelo: (["toldo", "chale", "redondo", "toldo"] as const)[p],
      terreno: { x0: xq - LADO_ESPACO / 2, x1: xq + LADO_ESPACO / 2, z0: zq - LADO_ESPACO / 2, z1: zq + LADO_ESPACO / 2 },
      pos0: pos, rot0: rot, pos: [pos[0], pos[1]] as [number, number], rot,
    };
  });
}
// o corredor de pedra no meio do lote, da calçada até o fundo dos espaços C e D (desenhado quando C ou D tem empresa)
export function corredorDoLote(l: LoteInfo) {
  const [cx, cz] = l.centro, s = l.k >= 2 ? 1 : -1, zA = cz + s * 10, zB = cz - s * 9;
  return { x0: cx - LARGURA_CORREDOR / 2, x1: cx + LARGURA_CORREDOR / 2, z0: Math.min(zA, zB), z1: Math.max(zA, zB) };
}
export const ehEspacoDoFundo = (k: QuiosqueInfo) => k.area === "lote" && (k.numero - PRIMEIRO_ESPACO) % 4 >= 2;
export const ESPACOS: QuiosqueInfo[] = LOTES.filter((l) => l.lote.tipo !== "praca").flatMap(espacosDe);
export const ehEspaco = (chave: string | null | undefined) => !!chave && ESPACOS.some((e) => e.chave === chave);
// os 4 espaços de um lote (pela chave do lote) e o lote de um espaço
export const ESPACOS_DO_LOTE: Record<string, QuiosqueInfo[]> = {};
export const LOTE_DO_ESPACO: Record<string, string> = {};
for (const l of LOTES) if (l.lote.tipo !== "praca") {
  ESPACOS_DO_LOTE[l.chave] = ESPACOS.filter((e) => e.numero > numeroEspaco(l, -1) && e.numero <= numeroEspaco(l, 3));
  for (const e of ESPACOS_DO_LOTE[l.chave]) LOTE_DO_ESPACO[e.chave] = l.chave;
}
// "Espaço B do Lote 12" (e "Quiosque 105" na orla)
export function rotuloQuiosque(k: QuiosqueInfo): string {
  if (k.area !== "lote") return `Quiosque ${k.numero}`;
  const lote = LOTES.find((l) => l.chave === LOTE_DO_ESPACO[k.chave]);
  return `Espaço ${LETRA_ESPACO[(k.numero - PRIMEIRO_ESPACO) % 4]} do Lote ${lote?.numero ?? ""}`.trim();
}
export const precoDoQuiosque = (chave: string | null | undefined) => (ehEspaco(chave) ? PRECO_ESPACO : PRECO_QUIOSQUE);

// os quiosques da orla e os espaços dos lotes, para quem acha um ponto pela chave ou pelo número (o servidor, a página da loja)
export const TODOS_QUIOSQUES: QuiosqueInfo[] = [...QUIOSQUES, ...ESPACOS];
export const QUIOSQUE_POR_CHAVE: Record<string, QuiosqueInfo> = Object.fromEntries(TODOS_QUIOSQUES.map((x) => [x.chave, x]));
export const QUIOSQUE_POR_NUMERO: Record<number, QuiosqueInfo> = Object.fromEntries(TODOS_QUIOSQUES.map((x) => [x.numero, x]));
export const ehQuiosque = (chave: string | null | undefined): boolean => !!chave && chave.startsWith("quiosque-");

// do local (lx, lz) do quiosque para o mundo (mesma conta do rotation.y do three.js), na posição de agora
export function paraMundoQuiosque(k: Pick<QuiosqueInfo, "pos" | "rot">, lx: number, lz: number): [number, number] {
  const s = Math.sin(k.rot), c = Math.cos(k.rot);
  return [k.pos[0] + lx * c + lz * s, k.pos[1] - lx * s + lz * c];
}
// onde o visitante fica para ser atendido (na frente do balcão, depois dos banquinhos)
export const balcaoDoQuiosque = (k: Pick<QuiosqueInfo, "pos" | "rot">): [number, number] => paraMundoQuiosque(k, 0, BALCAO_Z);
// o ponto (x, z) está dentro de algum quiosque? (o personagem desvia; os banquinhos ficam de fora, dá para encostar no balcão)
export function quiosqueNoPonto(x: number, z: number, folga = 0): QuiosqueInfo | null {
  for (const k of QUIOSQUES) {
    const dx = x - k.pos[0], dz = z - k.pos[1];
    if (dx * dx + dz * dz > 16) continue;
    const s = Math.sin(k.rot), c = Math.cos(k.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c; // inversa de paraMundoQuiosque
    if (Math.abs(lx) <= QUIOSQUE_LARGURA / 2 + 0.15 + folga && lz >= -QUIOSQUE_FUNDO / 2 - 0.2 - folga && lz <= QUIOSQUE_FUNDO / 2 + 0.25 + folga) return k;
  }
  return null;
}
// o terreninho do quiosque no ponto (x, z), com o quiosque dentro ou não
export const terreninhoNoPonto = (x: number, z: number): QuiosqueInfo | null => QUIOSQUES.find((k) => x >= k.terreno.x0 && x <= k.terreno.x1 && z >= k.terreno.z0 && z <= k.terreno.z1) ?? null;
export const descricaoQuiosque = (k: QuiosqueInfo) => `${k.area === "lote" ? rotuloQuiosque(k) : NOME_AREA_QUIOSQUE[k.area]} · ${k.ponto}`;

// Giro e ajuste do dono (decor.giro e decor.desloc, data/posicaoPredio.ts): leva cada quiosque para onde o dono deixou.
// Chamado quando os terrenos chegam ou mudam (mundoStore); devolve true se algum mudou de lugar (o caminho é refeito).
export function aplicarPosesQuiosques(terrenos: Record<string, { chave: string; escritorio: Escritorio | null } | undefined>, poseDe: (chave: string) => { centro: [number, number]; rot: number } | null): boolean {
  let mudou = false;
  for (const k of TODOS_QUIOSQUES) {
    const t = terrenos[k.chave], p = t ? poseDe(k.chave) : null;
    const pos: [number, number] = p ? [p.centro[0], p.centro[1]] : [k.pos0[0], k.pos0[1]], rot = p ? p.rot : k.rot0;
    if (pos[0] !== k.pos[0] || pos[1] !== k.pos[1] || Math.abs(rot - k.rot) > 1e-9) { k.pos = pos; k.rot = rot; mudou = true; }
  }
  return mudou;
}
export type { Decoracao };

// O quiosque vem só com a atendente (a frente "creditos" vende os outros agentes à parte; o lote vem com CEO e recepcionista)
export function equipeDoQuiosque(e: Escritorio): Escritorio {
  const atendente = e.equipe.filter((m) => m.papel === "atendente").slice(0, 1);
  return { ...e, setores: e.setores.slice(0, 1).map((s) => ({ ...s, mesas: 1 })), equipe: atendente.length ? atendente : e.equipe.slice(0, 1) };
}
