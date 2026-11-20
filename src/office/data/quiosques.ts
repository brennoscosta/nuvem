// Quiosques (20/11/2026, pedido do dono: "além dos lotes de 4 terrenos, lotes menores para vender quiosques menores, algo
// mais barato, em torno de 47,00"). Pontos pequenos nos lugares de passagem da cidade, com balcão e banquinhos, a logo e as
// cores da empresa. O visitante é atendido no balcão, sem entrar em prédio, pela atendente da empresa (a mesma conversa
// da loja). Mesma regra do lote: reserva de 1 hora, Pix de 30 dias, renovação, um ponto por conta.
//
// Ficam na tabela terreno com chave própria ("quiosque-101"), FORA da lista de lotes (data/mundo.ts › LOTES): o código
// que percorre os lotes (casas, prédios, quintais, numeração) não enxerga os quiosques, do mesmo jeito que não enxerga as
// sedes. A numeração começa em 101 e não colide com os lotes (1 a 36) nem com as sedes (0 e 901 a 903).
//
// Posições escolhidas para não atrapalhar ruas, calçadas, pontes, moradores e pedestres:
//  - praça de eventos: nos cantos de trás, ao lado do palco (longe do palco, do telão, dos postes e das barracas de sábado);
//  - quadra da Nuvem: na grama entre a praça do prédio e a calçada, de frente para a Rua do Comércio, a Rua das Nuvens e
//    a Rua das Palmeiras (os moradores sentam nos bancos do lado sul, que ficou livre);
//  - calçadão do rio: na fileira das árvores, do lado da avenida, entre uma árvore e outra (longe das pontes, dos outdoors
//    N1 e N2 e da linha por onde os moradores andam, z = -85,6);
//  - orla da praia: na faixa de grama entre a avenida da borda e o calçadão da orla, entre os coqueiros e longe das
//    travessias dos moradores e dos outdoors L1, S1 e S2.
// rot: para onde o balcão olha (0 = +z, como frenteDoLote).
import type { Escritorio } from "./escritorio";
import { PRECO_QUIOSQUE } from "./precosTerreno";

export { PRECO_QUIOSQUE };
export type AreaQuiosque = "praca" | "comercio" | "nuvem" | "rio" | "orla";
export type ModeloQuiosque = "toldo" | "chale" | "redondo";
export interface QuiosqueInfo { chave: string; numero: number; area: AreaQuiosque; ponto: string; pos: [number, number]; rot: number; modelo: ModeloQuiosque }

export const NOME_AREA_QUIOSQUE: Record<AreaQuiosque, string> = {
  praca: "Praça de Eventos", comercio: "Rua do Comércio", nuvem: "Praça da Nuvem", rio: "Calçadão do Rio", orla: "Orla da Praia",
};
export const NOME_MODELO_QUIOSQUE: Record<ModeloQuiosque, string> = { toldo: "quiosque com toldo listrado", chale: "quiosque chalé de madeira", redondo: "quiosque redondo de praia" };

const PI = Math.PI;
const q = (numero: number, area: AreaQuiosque, ponto: string, x: number, z: number, rot: number, modelo: ModeloQuiosque): QuiosqueInfo => ({ chave: `quiosque-${numero}`, numero, area, ponto, pos: [x, z], rot, modelo });

export const QUIOSQUES: QuiosqueInfo[] = [
  q(101, "praca", "canto da praça, de frente para a Rua do Comércio", 18.6, 47.8, PI / 2, "toldo"),
  // 102 e 109 são chalés: a frente curta fica longe do poste da praça e da linha dos moradores no calçadão (testes/terreno/folgas.mjs)
  q(102, "praca", "ao lado do palco, de frente para a plateia", 1.6, 47.8, PI, "chale"),
  q(103, "comercio", "quadra da Nuvem, na Rua do Comércio", 18.2, -6.5, PI / 2, "toldo"),
  q(104, "comercio", "quadra da Nuvem, na Rua do Comércio", 18.2, 7.5, PI / 2, "toldo"),
  q(105, "nuvem", "praça da Nuvem, na Rua das Nuvens", -4.5, -18.2, PI, "chale"),
  q(106, "nuvem", "praça da Nuvem, na Rua das Palmeiras", -18.2, 9, -PI / 2, "chale"),
  q(107, "rio", "calçadão do rio, a oeste", -62, -83.4, PI, "chale"),
  q(108, "rio", "calçadão do rio, perto da ponte de pedra", -14, -83.4, PI, "chale"),
  q(109, "rio", "calçadão do rio, perto da ponte de pedra", 10, -83.4, PI, "chale"),
  q(110, "rio", "calçadão do rio, a leste", 46, -83.4, PI, "chale"),
  q(111, "orla", "orla leste, na Avenida Atlântica", 88.3, -2, -PI / 2, "redondo"),
  q(112, "orla", "orla leste, na Avenida Atlântica", 88.3, 54, -PI / 2, "redondo"),
  q(113, "orla", "orla sul, na Avenida da Praia", -16, 88.3, PI, "redondo"),
  q(114, "orla", "orla sul, na Avenida da Praia", 54, 88.3, PI, "redondo"),
];
export const QUIOSQUE_POR_CHAVE: Record<string, QuiosqueInfo> = Object.fromEntries(QUIOSQUES.map((x) => [x.chave, x]));
export const QUIOSQUE_POR_NUMERO: Record<number, QuiosqueInfo> = Object.fromEntries(QUIOSQUES.map((x) => [x.numero, x]));
export const ehQuiosque = (chave: string | null | undefined): boolean => !!chave && chave.startsWith("quiosque-");

// medidas do quiosque (todas as variações cabem nesta caixa): 2,8 m de frente, 2,3 m de fundo; o balcão fica na frente (+z local)
export const QUIOSQUE_LARGURA = 2.8, QUIOSQUE_FUNDO = 2.3;
// do local (lx, lz) do quiosque para o mundo (mesma conta do rotation.y do three.js)
export function paraMundoQuiosque(k: QuiosqueInfo, lx: number, lz: number): [number, number] {
  const s = Math.sin(k.rot), c = Math.cos(k.rot);
  return [k.pos[0] + lx * c + lz * s, k.pos[1] - lx * s + lz * c];
}
// onde o visitante fica para ser atendido (na frente do balcão, depois dos banquinhos)
export const balcaoDoQuiosque = (k: QuiosqueInfo): [number, number] => paraMundoQuiosque(k, 0, QUIOSQUE_FUNDO / 2 + 1.35);
// o ponto (x, z) está dentro de algum quiosque? (o personagem desvia; os banquinhos ficam de fora, dá para encostar no balcão)
export function quiosqueNoPonto(x: number, z: number, folga = 0): QuiosqueInfo | null {
  for (const k of QUIOSQUES) {
    const dx = x - k.pos[0], dz = z - k.pos[1];
    if (dx * dx + dz * dz > 12) continue;
    const s = Math.sin(k.rot), c = Math.cos(k.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c; // inversa de paraMundoQuiosque
    if (Math.abs(lx) <= QUIOSQUE_LARGURA / 2 + folga && lz >= -QUIOSQUE_FUNDO / 2 - folga && lz <= QUIOSQUE_FUNDO / 2 + 0.25 + folga) return k;
  }
  return null;
}
export const descricaoQuiosque = (k: QuiosqueInfo) => `${NOME_AREA_QUIOSQUE[k.area]} · ${k.ponto}`;

// O quiosque vem só com a atendente (a frente "creditos" vende os outros agentes à parte; o lote vem com CEO e recepcionista)
export function equipeDoQuiosque(e: Escritorio): Escritorio {
  const atendente = e.equipe.filter((m) => m.papel === "atendente").slice(0, 1);
  return { ...e, setores: e.setores.slice(0, 1).map((s) => ({ ...s, mesas: 1 })), equipe: atendente.length ? atendente : e.equipe.slice(0, 1) };
}
