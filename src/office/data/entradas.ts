// Entradas dos prédios (17/11/2026, pedido do dono: "preciso que possa entrar, e que apareça uma porta ou se direcione
// para a recepção onde será atendido. Por ser o dono eles irão reconhecer, mas se for um visitante precisará ser
// recepcionado e aguardar até ser atendido"). Para cada prédio com escritório (lojas e a sede da Social RP):
//  - fora: o ponto da calçada em frente à porta (onde o caminho pelas ruas termina);
//  - porta: a porta da frente (onde a vista passa para dentro);
//  - espera: diante do balcão da recepção, de frente para a atendente;
//  - olhar: para onde o personagem fica virado na espera.
// Lojas: a planta é a mesma de data/escritorio.ts (plantaCliente: porta em [0, z0], balcão em [-5,2; -4,8]), girada como
// o prédio em scene/EscritorioCliente.tsx (frente do lote, giro do dono e lote duplo). Sede: data/plantaSede.ts.
// 21/11/2026 (modo "Editar posição"): o centro, o giro e o caminho da porta até a calçada vêm de data/posicaoPredio.ts
// (a mesma fonte da cena e da colisão). trilha: da frente da porta até a beira do lote, por dentro do terreno (com o prédio
// virado para o vizinho, o caminho dá a volta pelo corredor do lado); quem entra anda fora → trilha ao contrário → porta.
// 21/11/2026 (lote em quartos, data/quartosLote.ts): um lote pode ter várias entradas, uma por estrutura, todas da mesma
// empresa (a mesma chave): a do prédio médio (com a recepção de dentro) vem primeiro; cada quiosque tem a dele, com
// balcao = true (não tem interior: a pessoa fica na frente do balcão e a atendente da empresa atende ali, como na orla).
import { LOTE_POR_CHAVE, MEIO_CALCADA, MEIO_Q, LOTE } from "./mundo";
import { poseConferida, paraMundo as paraMundoPose, quartosDoTerreno, conferirQuartos, type PosePredio, type Conferencia } from "./posicaoPredio";
import { plantaCliente, type Escritorio } from "./escritorio";
import { sedeDe, paraMundoSede } from "./sedes";
import { montarSalas, cx, Z1, BALCAO_SEDE } from "./plantaSede";
import { pontoLivre, livre, type Ponto } from "./caminhos";

export interface Entrada { chave: string; nome: string; numero: number | null; fora: Ponto; porta: Ponto; espera: Ponto; olhar: number; centro: Ponto; rot: number; trilha?: Ponto[]; balcao?: boolean; estrutura?: string }
interface TerrenoEntrada { chave: string; empresaNome: string; status: string; escritorio: Escritorio | null; anexoDe?: string | null }

// local do prédio (frente = -z) → mundo, como o <group rotation={[0, rot, 0]}> do three.js
const paraMundo = (c: Ponto, rot: number, lx: number, lz: number): Ponto => [c[0] + lx * Math.cos(rot) + lz * Math.sin(rot), c[1] - lx * Math.sin(rot) + lz * Math.cos(rot)];

// a entrada principal do terreno (o prédio; no lote só com quiosques, o balcão do 1º quiosque)
export function entradaDoPredio(t: TerrenoEntrada, anexo: string | null): Entrada | null { return entradasDoLote(t, anexo)[0] ?? null; }
// prédio da loja (grande ou médio): a porta da planta de dentro, a espera diante do balcão da recepção e a calçada no fim do
// caminho da porta pelo lote
function entradaDaLoja(t: TerrenoEntrada & { escritorio: Escritorio }, numero: number, pose: PosePredio, c: Conferencia): Entrada {
  const { centro, rot } = pose, conf = c.ok ? c : null;
  const pl = plantaCliente(t.escritorio);
  const porta = paraMundo(centro, rot, pl.porta[0], pl.limites.z0 - 0.4);
  // na espera, de frente para o balcão (a atendente fica atrás dele, olhando para a porta)
  const espera = paraMundo(centro, rot, pl.balcao[0], pl.balcao[1] - 1.2);
  const balcao = paraMundo(centro, rot, pl.balcao[0], pl.balcao[1]);
  const olhar = Math.atan2(balcao[0] - espera[0], balcao[1] - espera[1]);
  // calçada: no fim do caminho da porta pelo lote (data/posicaoPredio.ts › conferirPose). Sem caminho (não acontece com
  // posição conferida), o de antes: reto para fora da porta até achar chão livre
  let fora: Ponto | null = conf?.fora ? pontoLivre(conf.fora[0], conf.fora[1]) : null;
  const dir = paraMundoPose([0, 0], rot, 0, -1);
  for (let k = 1; k <= 16 && !fora; k += 0.5) { const p: Ponto = [porta[0] + dir[0] * k, porta[1] + dir[1] * k]; if (livre(p[0], p[1])) fora = pontoLivre(p[0] + dir[0] * 1.2, p[1] + dir[1] * 1.2); }
  return { chave: t.chave, nome: t.empresaNome, numero, fora: fora ?? pontoLivre(porta[0], porta[1]), porta, espera, olhar, centro, rot, trilha: conf?.trilha ?? [], ...(pose.estrutura ? { estrutura: pose.estrutura.id } : {}) };
}
// quiosque do lote em quartos: a pessoa fica na frente do balcão (a "porta" e a espera são o mesmo ponto), de frente para ele
function entradaDoBalcao(t: TerrenoEntrada, numero: number, pose: PosePredio, c: Conferencia): Entrada {
  const conf = c.ok ? c : null, bal = pose.porta;
  const fora = conf?.fora ? pontoLivre(conf.fora[0], conf.fora[1]) : pontoLivre(bal[0], bal[1]);
  const olhar = Math.atan2(pose.centro[0] - bal[0], pose.centro[1] - bal[1]);
  return { chave: t.chave, nome: t.empresaNome, numero, fora, porta: bal, espera: bal, olhar, centro: pose.centro, rot: pose.rot, trilha: conf?.trilha ?? [], balcao: true, estrutura: pose.estrutura?.id };
}
// todas as entradas do terreno: uma só nos lotes de sempre e nas sedes; no lote em quartos, uma por estrutura
export function entradasDoLote(t: TerrenoEntrada, anexo: string | null): Entrada[] {
  if (t.status !== "ativo" || !t.escritorio || t.anexoDe) return [];
  const sd = sedeDe(t.chave);
  if (sd) {
    // sedes (data/sedes.ts, 19/11/2026: num lote só): a planta compacta (data/plantaSede.ts) em coordenadas do lote,
    // girada para a rua da frente. A porta é o vão no meio da parede da frente da recepção; a calçada fica reto para
    // fora dela (na faixa do meio da calçada, como os pedestres); a espera é diante do balcão, de frente para a atendente
    const rec = montarSalas(t.escritorio.setores).find((s) => s.tipo === "recepcao");
    if (!rec) return [];
    const p = (lx: number, lz: number) => paraMundoSede(sd, lx, lz);
    const pc = poseConferida(t, null), conf = pc?.conf.ok ? pc.conf : null;
    const reta = p(cx(rec), LOTE / 2 + (MEIO_CALCADA - MEIO_Q)), porta = p(cx(rec), Z1 + 0.4);
    const fora = conf?.fora ?? reta;
    // olhar: a frente local (-z, para o balcão) girada como a sede
    return [{ chave: t.chave, nome: t.empresaNome, numero: sd.numeroLoja, fora: pontoLivre(fora[0], fora[1]), porta, espera: p(BALCAO_SEDE.x, BALCAO_SEDE.z + 1.2), olhar: sd.rot + Math.PI, centro: p(BALCAO_SEDE.x, BALCAO_SEDE.z), rot: sd.rot, trilha: conf?.trilha ?? [] }];
  }
  const l = LOTE_POR_CHAVE[t.chave]; if (!l) return [];
  const te = t as TerrenoEntrada & { escritorio: Escritorio };
  if (quartosDoTerreno(t, anexo)) {
    const lc = conferirQuartos(t.chave, t.escritorio);
    return lc.poses.map((p, i) => (p.estrutura?.tamanho === "quiosque" ? entradaDoBalcao(t, l.numero, p, lc.confs[i]) : entradaDaLoja(te, l.numero, p, lc.confs[i])));
  }
  const pc = poseConferida(t, anexo); if (!pc) return [];
  return [entradaDaLoja(te, l.numero, pc.pose, pc.conf)];
}

// todas as entradas da cidade (lojas ativas com escritório e a sede; no lote em quartos, uma por estrutura)
export function entradasDaCidade(terrenos: Record<string, TerrenoEntrada>): Entrada[] {
  const anexos: Record<string, string> = {};
  for (const t of Object.values(terrenos)) if (t.anexoDe && t.status === "ativo") anexos[t.anexoDe] = t.chave;
  return Object.values(terrenos).flatMap((t) => entradasDoLote(t, anexos[t.chave] ?? null));
}
