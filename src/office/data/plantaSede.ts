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
