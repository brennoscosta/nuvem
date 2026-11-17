// Entradas dos prédios (17/11/2026, pedido do dono: "preciso que possa entrar, e que apareça uma porta ou se direcione
// para a recepção onde será atendido. Por ser o dono eles irão reconhecer, mas se for um visitante precisará ser
// recepcionado e aguardar até ser atendido"). Para cada prédio com escritório (lojas e a sede da Social RP):
//  - fora: o ponto da calçada em frente à porta (onde o caminho pelas ruas termina);
//  - porta: a porta da frente (onde a vista passa para dentro);
//  - espera: diante do balcão da recepção, de frente para a atendente;
//  - olhar: para onde o personagem fica virado na espera.
// Lojas: a planta é a mesma de data/escritorio.ts (plantaCliente: porta em [0, z0], balcão em [-5,2; -4,8]), girada como
// o prédio em scene/EscritorioCliente.tsx (frente do lote, giro do dono e lote duplo). Sede: data/plantaSede.ts.
import { LOTE_POR_CHAVE, frenteDoLote } from "./mundo";
import { PREDIO_CLIENTE, plantaCliente, type Escritorio } from "./escritorio";
import { CHAVE_SEDE } from "./onestate";
import { montarSalas, cx, Z1 } from "./plantaSede";
import { pontoLivre, livre, type Ponto } from "./caminhos";

export interface Entrada { chave: string; nome: string; numero: number | null; fora: Ponto; porta: Ponto; espera: Ponto; olhar: number; centro: Ponto; rot: number }
interface TerrenoEntrada { chave: string; empresaNome: string; status: string; escritorio: Escritorio | null; anexoDe?: string | null }

// local do prédio (frente = -z) → mundo, como o <group rotation={[0, rot, 0]}> do three.js
const paraMundo = (c: Ponto, rot: number, lx: number, lz: number): Ponto => [c[0] + lx * Math.cos(rot) + lz * Math.sin(rot), c[1] - lx * Math.sin(rot) + lz * Math.cos(rot)];

export function entradaDoPredio(t: TerrenoEntrada, anexo: string | null): Entrada | null {
  if (t.status !== "ativo" || !t.escritorio || t.anexoDe) return null;
  if (t.chave === CHAVE_SEDE) {
    const rec = montarSalas(t.escritorio.setores).find((s) => s.tipo === "recepcao");
    if (!rec) return null;
    const x = cx(rec);
    // a porta é o vão de 3 m no meio da parede sul da recepção; a atendente fica atrás do balcão (z1 - 4,2)
    return { chave: t.chave, nome: t.empresaNome, numero: null, fora: pontoLivre(x, Z1 + 7), porta: [x, Z1 + 0.4], espera: [x, rec.z1 - 3.0], olhar: Math.PI, centro: [x, rec.z1 - 4], rot: 0 };
  }
  const l = LOTE_POR_CHAVE[t.chave]; if (!l) return null;
  const la = anexo ? LOTE_POR_CHAVE[anexo] : null;
  const centro: Ponto = [l.centro[0] + (la ? (la.centro[0] - l.centro[0]) / 2 : 0), l.centro[1]];
  const giro = t.escritorio.decor?.giro ?? 0, giroEf = la ? giro - (giro % 2) : giro;
  const rot = frenteDoLote(l.k) + Math.PI + giroEf * (Math.PI / 2);
  const pl = plantaCliente(t.escritorio);
  const porta = paraMundo(centro, rot, pl.porta[0], PREDIO_CLIENTE.z0 - 0.4);
  // na espera, de frente para o balcão (a atendente fica atrás dele, olhando para a porta)
  const espera = paraMundo(centro, rot, pl.balcao[0], pl.balcao[1] - 1.2);
  const balcao = paraMundo(centro, rot, pl.balcao[0], pl.balcao[1]);
  const olhar = Math.atan2(balcao[0] - espera[0], balcao[1] - espera[1]);
  // calçada: segue reto para fora da porta até achar chão livre (prédio girado para os fundos: a calçada mais perto)
  const dir = paraMundo([0, 0], rot, 0, -1);
  let fora: Ponto | null = null;
  for (let k = 1; k <= 16 && !fora; k += 0.5) { const p: Ponto = [porta[0] + dir[0] * k, porta[1] + dir[1] * k]; if (livre(p[0], p[1])) fora = pontoLivre(p[0] + dir[0] * 1.2, p[1] + dir[1] * 1.2); }
  return { chave: t.chave, nome: t.empresaNome, numero: l.numero, fora: fora ?? pontoLivre(porta[0], porta[1]), porta, espera, olhar, centro, rot };
}

// todas as entradas da cidade (lojas ativas com escritório e a sede)
export function entradasDaCidade(terrenos: Record<string, TerrenoEntrada>): Entrada[] {
  const anexos: Record<string, string> = {};
  for (const t of Object.values(terrenos)) if (t.anexoDe && t.status === "ativo") anexos[t.anexoDe] = t.chave;
  return Object.values(terrenos).map((t) => entradaDoPredio(t, anexos[t.chave] ?? null)).filter((e): e is Entrada => !!e);
}
