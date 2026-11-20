// Planta das sedes por dentro (16/11/2026): as salas no térreo, separadas da cena 3D para o cartão da sede
// (src/office/ui/CartaoOneState.tsx) poder levar a câmera até a sala de um departamento sem carregar o three.js.
// 19/11/2026 (pedido do dono: cada sede num lote só, "interior compacto dentro do lote"): de 34 x 30 m para 19,2 x 14,4 m,
// em coordenadas do LOTE (origem no centro do lote de 20 x 20 m, frente com a porta da rua para +z; data/sedes.ts ›
// paraMundoSede leva para o mundo). A fachada da frente é a mesma da torre (data/onestate.ts › Z_FRENTE_SEDE).
//  - corredor leste-oeste de 1,6 m; 6 salas de 3,2 x 6,4 m na fileira norte (fundo) e 4 na fileira sul;
//  - no meio da fileira sul, um bloco de 6,4 m: a recepção na frente (porta da rua no meio), o hall com o café atrás dela,
//    aberto para a recepção e para o corredor, e a sala de reunião ao lado do hall;
//  - cada sala de departamento tem 5 lugares (o chefe na mesa maior, mais ao fundo, e duas filas de duas mesas compactas
//    com um corredorzinho no meio, por onde se chega às cadeiras). As equipes de hoje têm de 3 a 4 pessoas por departamento.
import { Z_FRENTE_SEDE } from "./onestate";
import type { Setor } from "./escritorio";

export const W = 19.2, D = 14.4, X0 = -W / 2, X1 = W / 2, Z1 = Z_FRENTE_SEDE, Z0 = Z1 - D;
export const CORREDOR = 1.6, FILEIRA = (D - CORREDOR) / 2; // 6,4 m de fundo em cada fileira
export const ZC = Z0 + FILEIRA + CORREDOR / 2; // eixo do corredor: de ZC - 0,8 a ZC + 0,8
export const POR_FILEIRA = 6, LARG = W / POR_FILEIRA; // 3,2 m por sala
const ZN = ZC - CORREDOR / 2, ZS = ZC + CORREDOR / 2; // paredes do corredor (norte e sul)
// bloco do meio da fileira sul (2 colunas): recepção na frente, reunião (oeste) e hall com café (leste) atrás dela
const XM0 = X0 + 2 * LARG, XM1 = X0 + 4 * LARG, XMEIO = (XM0 + XM1) / 2;
export const Z_RECEPCAO = Z1 - 3.4; // parede entre a recepção e a sala de reunião
export type Sala = { id: string; nome: string; cor: string; tipo: "depto" | "recepcao" | "reuniao" | "hall"; norte: boolean; i: number; x0: number; x1: number; z0: number; z1: number };
export const cx = (s: Sala) => (s.x0 + s.x1) / 2;
// balcão da recepção: a oeste da porta da rua, de frente para ela; a passagem para o hall fica do lado leste
export const BALCAO_SEDE = { x: XMEIO - 1.1, z: Z1 - 2.25 };
const ZMEIO_FUNDO = (ZS + Z_RECEPCAO) / 2; // meio da reunião e do hall, em z
// Móveis grandes da recepção, da reunião e do hall (centro e tamanho no chão): a cena (scene/OneStateInterior.tsx)
// desenha neles e o andar por dentro (data/plantaInterna.ts) usa as mesmas caixas como bloqueio
export const MOVEIS_SEDE = {
  balcao: { x: BALCAO_SEDE.x, z: BALCAO_SEDE.z, w: 3.1, d: 0.8 },
  sofa: { x: XM1 - 0.5, z: Z1 - 1.35, w: 0.9, d: 1.9 }, // encostado na parede leste da recepção, virado para o oeste
  painel: { x: XM0 + 0.8, z: Z_RECEPCAO + 0.2, w: 1.2, d: 0.3 }, // a logo atrás da recepcionista
  vaso: { x: XM0 + 0.4, z: Z1 - 0.4, w: 0.5, d: 0.5 },
  reuniao: { x: (XM0 + XMEIO) / 2, z: ZMEIO_FUNDO, w: 2.0, d: 1.9 }, // mesa e cadeiras
  cafe: { x: XM1 - 0.37, z: ZMEIO_FUNDO, w: 0.66, d: 1.75 }, // balcão do café, encostado na parede leste do hall
  bebedouro: { x: XM1 - 0.3, z: ZS + 0.3, w: 0.4, d: 0.4 },
  mesaAlta: { x: XMEIO + 0.55, z: Z_RECEPCAO - 0.95, w: 0.8, d: 1.2 }, // mesa alta com uma banqueta
};
// onde os agentes param no café do hall (na rotina)
export const CAFE_SEDE = { x: XM1 - 0.95, z: ZMEIO_FUNDO };

// Catraca da recepção (20/11/2026, pedido do dono: o visitante só tem acesso à recepcionista; data/recepcao.ts). Uma linha
// ao longo de x, em z: vidro baixo de x0 a g0 e de g1 a x1, e o portão (duas folhas de vidro) entre g0 e g1. Quem pode
// passar (dono, sócio ou visitante encaminhado pela recepção) atravessa pelo portão; o vidro barra todo mundo.
// Coordenadas locais da planta (aqui, as do lote da sede; nas lojas, as do prédio do cliente: data/escritorio.ts).
export interface Catraca { id: string; x0: number; x1: number; z: number; g0: number; g1: number }
export const LARG_PORTAO = 1.1;
// na sede: na passagem da recepção para o hall com o café (o resto da recepção é fechado por paredes). O portão fica no
// meio do hall, por onde a recepcionista e quem vem do corredor já passam
export function catracasDaSede(salas: Sala[]): Catraca[] {
  const hall = salas.find((s) => s.tipo === "hall"); if (!hall) return [];
  const c = cx(hall);
  return [{ id: "hall", x0: hall.x0 + 0.06, x1: hall.x1 - 0.06, z: Z_RECEPCAO + 0.2, g0: c - LARG_PORTAO / 2, g1: c + LARG_PORTAO / 2 }];
}

export function montarSalas(setores: Setor[]): Sala[] {
  const deptos = setores.filter((s) => s.id !== "recepcao");
  const sala = (s: { id: string; nome: string; cor: string }, tipo: Sala["tipo"], norte: boolean, i: number, x0: number, x1: number, z0: number, z1: number): Sala => ({ id: s.id, nome: s.nome, cor: s.cor, tipo, norte, i, x0, x1, z0, z1 });
  const coluna = (i: number): [number, number] => [X0 + i * LARG, X0 + (i + 1) * LARG];
  const lista: Sala[] = [];
  deptos.slice(0, POR_FILEIRA).forEach((s, i) => lista.push(sala(s, "depto", true, i, ...coluna(i), Z0, ZN)));
  // fileira sul: 4 departamentos nas pontas (colunas 0, 1, 4 e 5); o bloco do meio é da recepção, do hall e da reunião
  const posSul = [0, 1, 4, 5];
  deptos.slice(POR_FILEIRA, POR_FILEIRA + 4).forEach((s, k) => lista.push(sala(s, "depto", false, posSul[k], ...coluna(posSul[k]), ZS, Z1)));
  lista.push(sala({ id: "recepcao", nome: "Recepção", cor: "#E9C46A" }, "recepcao", false, 2, XM0, XM1, Z_RECEPCAO, Z1));
  lista.push(sala({ id: "reuniao", nome: "Sala de reunião", cor: "#94A3B8" }, "reuniao", false, 2, XM0, XMEIO, ZS, Z_RECEPCAO));
  lista.push(sala({ id: "hall", nome: "Hall e café", cor: "#C8B89A" }, "hall", false, 3, XMEIO, XM1, ZS, Z_RECEPCAO));
  return lista;
}

// centro da sala de um departamento (x, z LOCAIS do lote), para a câmera ir até ela
export function centroDaSala(setores: Setor[], id: string): [number, number] | null {
  const s = montarSalas(setores).find((x) => x.id === id);
  return s ? [cx(s), (s.z0 + s.z1) / 2] : null;
}

// ---------- paredes e lugares de trabalho (17/11/2026): os mesmos números da cena 3D (scene/OneStateInterior.tsx ›
// Fixos) e do andar por dentro (data/plantaInterna.ts), para a parede desenhada ser a mesma que barra o personagem ----------
// as portas das salas ficam no meio de cada uma (cx), na parede do corredor; o hall tem uma passagem mais larga
export const ESP_PAREDE = 0.12, PORTA_SALA = 1.1, PORTA_RUA = 2.4, PORTA_HALL = 2.0;
export type Pedaco = { x: number; z: number; w: number; d: number }; // centro e tamanho (x = largura, z = profundidade)
export function paredesDaSede(salas: Sala[]): Pedaco[] {
  const pedacos: Pedaco[] = [];
  const muroX = (x0: number, x1: number, z: number, vaos: [number, number][] = []) => { let a = x0; for (const [c, l] of [...vaos].sort((p, q) => p[0] - q[0])) { if (c - l / 2 > a) pedacos.push({ x: (a + c - l / 2) / 2, z, w: c - l / 2 - a, d: ESP_PAREDE }); a = c + l / 2; } if (x1 > a) pedacos.push({ x: (a + x1) / 2, z, w: x1 - a, d: ESP_PAREDE }); };
  const muroZ = (z0: number, z1: number, x: number) => pedacos.push({ x, z: (z0 + z1) / 2, w: ESP_PAREDE, d: z1 - z0 });
  // fundo norte fechado; frente sul com a porta da rua no meio da recepção; laterais
  muroX(X0, X1, Z0);
  const rec = salas.find((s) => s.tipo === "recepcao");
  muroX(X0, X1, Z1, rec ? [[cx(rec), PORTA_RUA]] : []);
  muroZ(Z0, Z1, X0); muroZ(Z0, Z1, X1);
  // as duas paredes do corredor, com uma porta para cada sala (o hall tem a passagem larga)
  muroX(X0, X1, ZN, salas.filter((s) => s.norte).map((s) => [cx(s), PORTA_SALA]));
  muroX(X0, X1, ZS, salas.filter((s) => !s.norte && s.tipo !== "recepcao").map((s) => [cx(s), s.tipo === "hall" ? PORTA_HALL : PORTA_SALA]));
  // divisórias entre as salas: todas na fileira norte; na sul, as das pontas e as duas do bloco do meio
  for (let i = 1; i < POR_FILEIRA; i++) muroZ(Z0, ZN, X0 + i * LARG);
  for (const x of [X0 + LARG, XM0, XM1, X1 - LARG]) muroZ(ZS, Z1, x);
  // sala de reunião: parede com o hall (leste) e com a recepção (sul); o hall fica aberto para a recepção
  muroZ(ZS, Z_RECEPCAO, XMEIO);
  muroX(XM0, XMEIO, Z_RECEPCAO);
  return pedacos;
}
// lugares de trabalho: todos olham para a frente da sede (+z local, o lado de onde a câmera olha); o chefe na mesa
// maior, mais ao fundo da sala (longe da porta); as outras em duas filas de duas mesas compactas, com um corredorzinho
// de 60 cm no meio (MESA_COMPACTA)
export const MESA_COMPACTA = { comum: [1.1, 0.7], chefe: [1.6, 0.8] } as const; // largura x profundidade (scene/Moveis.tsx › Mesa compacta)
export type LugarSede = { pos: [number, number, number]; mesa: [number, number, number]; chefe: boolean };
// distância do centro da sala até o meio de cada mesa da fila
const DX_FILA = 0.85;
// fundo da sala (do lado da porta, onde quem chega para) e a fila do chefe e as outras duas, em z
export const zDentro = (s: Sala) => (s.norte ? s.z1 - 0.8 : s.z0 + 0.8);
function filas(s: Sala) {
  return s.norte ? [s.z0 + 1.35, s.z0 + 3.05, s.z0 + 4.7] : [s.z1 - 0.95, s.z0 + 3.75, s.z0 + 2.1];
}
export function lugaresDaSala(s: Sala, n: number): LugarSede[] {
  const out: LugarSede[] = [];
  const [zChefe, ...outras] = filas(s);
  const vagas: { x: number; z: number; chefe: boolean }[] = [{ x: cx(s), z: zChefe, chefe: true }];
  for (const z of outras) for (const dx of [-DX_FILA, DX_FILA]) vagas.push({ x: cx(s) + dx, z, chefe: false });
  for (let k = 0; k < Math.min(n, vagas.length); k++) {
    const v = vagas[k];
    out.push({ mesa: [v.x, 0, v.z], pos: [v.x, 0, v.z - 0.62], chefe: v.chefe });
  }
  return out;
}
