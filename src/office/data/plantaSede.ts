// Planta da sede da Social RP por dentro (16/11/2026): as salas no térreo, separadas da cena 3D para o cartão da sede
// (src/office/ui/CartaoOneState.tsx) poder levar a câmera até a sala de um departamento sem carregar o three.js.
// Corredor no meio (leste-oeste); 6 salas por fileira; na fileira sul, 4 departamentos, a recepção e a sala de reunião.
import { OS_X, OS_Z } from "./onestate";
import type { Setor } from "./escritorio";

export const W = 34, D = 30, X0 = OS_X - W / 2, Z0 = OS_Z - D / 2, X1 = X0 + W, Z1 = Z0 + D;
export const CORREDOR = 3, ZC = OS_Z; // corredor de z = ZC - 1,5 a ZC + 1,5
export const POR_FILEIRA = 6, LARG = W / POR_FILEIRA;
export type Sala = { id: string; nome: string; cor: string; tipo: "depto" | "recepcao" | "reuniao"; norte: boolean; i: number; x0: number; x1: number; z0: number; z1: number };
export const cx = (s: Sala) => (s.x0 + s.x1) / 2;

export function montarSalas(setores: Setor[]): Sala[] {
  const deptos = setores.filter((s) => s.id !== "recepcao");
  const sala = (s: { id: string; nome: string; cor: string }, tipo: Sala["tipo"], norte: boolean, i: number): Sala => ({
    id: s.id, nome: s.nome, cor: s.cor, tipo, norte, i,
    x0: X0 + i * LARG, x1: X0 + (i + 1) * LARG,
    z0: norte ? Z0 : ZC + CORREDOR / 2, z1: norte ? ZC - CORREDOR / 2 : Z1,
  });
  const lista: Sala[] = [];
  deptos.slice(0, POR_FILEIRA).forEach((s, i) => lista.push(sala(s, "depto", true, i)));
  // fileira sul: 4 departamentos, a recepção (entrada) na 3ª posição e a sala de reunião na ponta leste
  const sul = deptos.slice(POR_FILEIRA, POR_FILEIRA + 4);
  const posSul = [0, 1, 3, 4];
  sul.forEach((s, k) => lista.push(sala(s, "depto", false, posSul[k])));
  lista.push(sala({ id: "recepcao", nome: "Recepção", cor: "#E9C46A" }, "recepcao", false, 2));
  lista.push(sala({ id: "reuniao", nome: "Sala de reunião", cor: "#94A3B8" }, "reuniao", false, 5));
  return lista;
}

// centro da sala de um departamento (x, z), para a câmera ir até ela
export function centroDaSala(setores: Setor[], id: string): [number, number] | null {
  const s = montarSalas(setores).find((x) => x.id === id);
  return s ? [cx(s), (s.z0 + s.z1) / 2] : null;
}

// ---------- paredes e lugares de trabalho (17/11/2026): os mesmos números da cena 3D (scene/OneStateInterior.tsx ›
// Fixos) e do andar por dentro (data/plantaInterna.ts), para a parede desenhada ser a mesma que barra o personagem ----------
export const ESP_PAREDE = 0.12, PORTA_SALA = 1.5, PORTA_RUA = 3;
export type Pedaco = { x: number; z: number; w: number; d: number }; // centro e tamanho (x = largura, z = profundidade)
export function paredesDaSede(salas: Sala[]): Pedaco[] {
  const pedacos: Pedaco[] = [];
  const muroX = (x0: number, x1: number, z: number, vaos: [number, number][] = []) => { let a = x0; for (const [c, l] of [...vaos].sort((p, q) => p[0] - q[0])) { if (c - l / 2 > a) pedacos.push({ x: (a + c - l / 2) / 2, z, w: c - l / 2 - a, d: ESP_PAREDE }); a = c + l / 2; } if (x1 > a) pedacos.push({ x: (a + x1) / 2, z, w: x1 - a, d: ESP_PAREDE }); };
  const muroZ = (z0: number, z1: number, x: number) => pedacos.push({ x, z: (z0 + z1) / 2, w: ESP_PAREDE, d: z1 - z0 });
  // fundo norte fechado; frente sul com a entrada da recepção; laterais
  muroX(X0, X1, Z0);
  const rec = salas.find((s) => s.tipo === "recepcao");
  muroX(X0, X1, Z1, rec ? [[cx(rec), PORTA_RUA]] : []);
  muroZ(Z0, Z1, X0); muroZ(Z0, Z1, X1);
  // as duas paredes do corredor, com uma porta para cada sala
  for (const norte of [true, false]) muroX(X0, X1, norte ? ZC - CORREDOR / 2 : ZC + CORREDOR / 2, salas.filter((s) => s.norte === norte).map((s) => [cx(s), PORTA_SALA]));
  // divisórias entre as salas
  for (let i = 1; i < POR_FILEIRA; i++) { const x = X0 + i * LARG; muroZ(Z0, ZC - CORREDOR / 2, x); muroZ(ZC + CORREDOR / 2, Z1, x); }
  return pedacos;
}
// lugares de trabalho: todos olham para o sul (de frente para a câmera); o chefe na mesa maior, mais ao fundo
export type LugarSede = { pos: [number, number, number]; mesa: [number, number, number]; chefe: boolean };
export function lugaresDaSala(s: Sala, n: number): LugarSede[] {
  const out: LugarSede[] = [];
  const fundoZ = s.norte ? s.z0 + 2.3 : s.z1 - 9.6; // fila do chefe (longe do corredor na fileira norte)
  const linhas = s.norte ? [fundoZ, fundoZ + 3.6, fundoZ + 7.0] : [s.z0 + 3.4, s.z0 + 6.8, s.z0 + 10.2];
  const vagas: { x: number; z: number; chefe: boolean }[] = [{ x: cx(s), z: linhas[0], chefe: true }];
  for (const z of linhas.slice(1)) for (const dx of [-1.25, 1.25]) vagas.push({ x: cx(s) + dx, z, chefe: false });
  for (let k = 0; k < Math.min(n, vagas.length); k++) {
    const v = vagas[k];
    out.push({ mesa: [v.x, 0, v.z], pos: [v.x, 0, v.z - 0.62], chefe: v.chefe });
  }
  return out;
}
