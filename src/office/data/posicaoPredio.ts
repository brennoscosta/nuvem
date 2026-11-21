// Posição e giro dos prédios no terreno (21/11/2026, pedido do dono: "quero que tenha a opção de poder girar o prédio,
// estilo a parte de editar do game RollerCoaster Tycoon, SimCity e etc. para que possamos posicionar no local correto do
// nosso terreno"). UMA fonte só: para cada prédio (loja num lote, lote duplo, quiosque e sede) diz onde ele fica no mundo,
// para onde gira, o retângulo que ocupa no chão e a porta (no quiosque, o balcão), já girados e deslocados, e confere se a
// posição vale: o prédio inteiro dentro do terreno, com margem, e um caminho da porta até a calçada (ou até o chão público,
// no quiosque). Usam esta fonte: a cena (scene/EscritorioCliente.tsx, scene/Quiosques.tsx e as sedes), as caixas da câmera
// e a colisão (data/obstaculos.ts e data/caminhos.ts), a entrada (data/entradas.ts), a planta de dentro (data/plantaInterna.ts),
// a foto do prédio, o mapa 2D, o modo "Editar posição" (scene/EditorPosicao.tsx e ui/EditorPosicao.tsx) e a rota que salva
// (src/server/posicao.ts), que repete a conferência e não confia no navegador. Outras frentes (câmera, presentes) usam
// poseDoTerreno() / posesDaCidade() para saber onde cada prédio está.
// Onde fica gravado: escritorio.decor.giro (quartos de volta, já existia desde 11/11/2026) e escritorio.decor.desloc
// ([dx, dz] em metros, eixos do mundo, de 0,5 em 0,5 m) do terreno. Sem migração.
// Convenção de cada desenho (rotation.y do three.js, a mesma conta de paraMundo):
//  - loja: frente local -z, rot = frenteDoLote + π + giro·π/2 (o que já era);
//  - sede: frente local +z, rot = frenteDoLote + giro·π/2;
//  - quiosque: frente (balcão) local +z, rot = rot da vaga + giro·π/2.
// 21/11/2026 (lote em quartos, data/quartosLote.ts): o lote pode ter várias estruturas (até 4 quiosques, ou um prédio médio
// numa metade e quiosques na outra). Cada uma encaixa no quarto ou na metade dela (sem deslocamento fino), gira de 90 em 90
// graus (o médio só fica de frente ou de costas na metade) e passa pela mesma conferência, com as outras do lote no caminho:
// conferirQuartos. poseConferida e poseDoTerreno devolvem a principal (o prédio médio, ou o 1º quiosque); posesDoTerreno,
// todas. O lote sem quartos (os de antes, as sedes e o lote duplo) segue a conta de sempre, sem mudar nada.
// Tudo aqui é função pura (sem three.js, sem React): roda no servidor e nos testes com tsx.
import { LOTE_POR_CHAVE, frenteDoLote, LOTE, MEIO_Q, MEIO_CALCADA, type LoteInfo } from "./mundo";
import { DIM_LAYOUT, PREDIO_CLIENTE, PREDIO_MEDIO, andaresDoPredio, type Escritorio, type Decoracao } from "./escritorio";
import { QUARTOS_DA_METADE, NOME_METADE, NOME_QUARTO, type QuartosLote, type Quarto, type Metade } from "./quartosLote";
import { ehKit, medidasKit } from "./predios";
import { SEDE_POR_CHAVE, type Sede } from "./sedes";
import { Z1 as SEDE_Z1, X0 as SEDE_X0, X1 as SEDE_X1, Z0 as SEDE_Z0, montarSalas, cx as cxSala } from "./plantaSede";
import { QUIOSQUE_POR_CHAVE, pegadaQuiosque, corpoQuiosque, BALCAO_Z, type QuiosqueInfo } from "./quiosques";

export type Ponto = [number, number];
export type Giro = 0 | 1 | 2 | 3;
export type Lado = "n" | "s" | "l" | "o"; // norte (-z), sul (+z), leste (+x), oeste (-x)
export interface Ret { x0: number; x1: number; z0: number; z1: number }
export type TipoPredio = "loja" | "quiosque" | "sede";

// o chão onde o prédio pode ficar: o lote, os dois lotes do lote duplo, o lote da sede ou o terreninho do quiosque
export interface Terreninho {
  chave: string; tipo: TipoPredio;
  ret: Ret; centro: Ponto; // limites no mundo e o centro (onde o prédio fica com deslocamento zero)
  rotBase: number; // rotation.y do prédio com giro 0
  abertos: Lado[]; // lados que dão para chão público (a rua e a calçada; no quiosque, os quatro)
  so180: boolean; // lote duplo: o prédio largo só fica de frente ou de costas para a rua
  margem: number; // folga mínima do prédio até a beira
  dentroBloco: boolean; // lote dentro do quarteirão (a calçada fica depois da beira); o quiosque fica em chão público
  limite?: Ret; // lote em quartos: o quarto ou a metade onde a estrutura tem de caber (o caminho da porta usa o lote todo)
}
// lote em quartos: o que é esta estrutura (o prédio médio tem o id "predio")
export type TamanhoEstrutura = "medio" | "quiosque";
export interface InfoEstrutura { id: string; tamanho: TamanhoEstrutura; lugar: Quarto | Metade; quartos: Quarto[]; nome: string }
export interface PosePredio {
  chave: string; tipo: TipoPredio;
  centro: Ponto; rot: number; // onde fica e como gira o grupo do prédio
  giro: Giro; desloc: Ponto; // o que está gravado (giro efetivo e deslocamento já encaixado)
  caixa: Ret; // o que o prédio ocupa no chão, no mundo (com marquise, toldo e jardim da frente)
  corpo: Ret; // as paredes, no mundo (o caminho até a porta desvia disto)
  porta: Ponto; // logo na frente da porta (no quiosque, onde o cliente fica no balcão)
  frente: Ponto; // para onde a porta olha (vetor unitário)
  terreno: Terreninho;
  estrutura?: InfoEstrutura; // só no lote em quartos
}
// enfeite da decoração do lote (árvore, banco, vaso...) no mundo: sai quando encosta no prédio ou no caminho da porta
export interface Enfeite { id: string; nome: string; x: number; z: number; r: number }
export interface Conferencia {
  ok: boolean; motivo: string | null; avisos: string[];
  trilha: Ponto[]; // da frente da porta até a beira do terreno, do lado aberto (mundo); só a porta, no quiosque
  fora: Ponto | null; // logo depois da beira: na calçada (lote) ou no chão público (quiosque)
  escondidos: string[]; // enfeites que saem do lugar
}

export const PASSO_GRADE = 0.5; // encaixe do arrasto e das setas
export const MAX_DESLOC = 10;
const FOLGA_CORPO = 0.55; // o corpo de quem anda e mais um pouco: corredor de uns 85 cm entre a parede e a divisa
const R90 = Math.PI / 2;

// ---------- contas de giro ----------
export const paraMundo = (c: Ponto, rot: number, lx: number, lz: number): Ponto => [c[0] + lx * Math.cos(rot) + lz * Math.sin(rot), c[1] - lx * Math.sin(rot) + lz * Math.cos(rot)];
export const paraLocal = (c: Ponto, rot: number, x: number, z: number): Ponto => { const dx = x - c[0], dz = z - c[1]; return [dx * Math.cos(rot) - dz * Math.sin(rot), dx * Math.sin(rot) + dz * Math.cos(rot)]; };
// retângulo local girado em quartos de volta (o giro é sempre múltiplo de 90°)
export function retNoMundo(c: Ponto, rot: number, r: Ret): Ret {
  const xs: number[] = [], zs: number[] = [];
  for (const lx of [r.x0, r.x1]) for (const lz of [r.z0, r.z1]) { const [x, z] = paraMundo(c, rot, lx, lz); xs.push(x); zs.push(z); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
const arred = (v: number) => Math.round(v * 1000) / 1000;
export const encaixar = (v: number) => Math.max(-MAX_DESLOC, Math.min(MAX_DESLOC, Math.round(v / PASSO_GRADE) * PASSO_GRADE));
export const giroValido = (g: unknown): Giro => ([0, 1, 2, 3].includes(Number(g)) ? (Number(g) as Giro) : 0);
export function deslocValido(d: unknown): Ponto {
  if (!Array.isArray(d) || d.length !== 2) return [0, 0];
  const x = Number(d[0]), z = Number(d[1]);
  return [Number.isFinite(x) ? encaixar(x) : 0, Number.isFinite(z) ? encaixar(z) : 0];
}
// para onde fica cada lado do mundo, como vetor
const VETOR: Record<Lado, Ponto> = { n: [0, -1], s: [0, 1], l: [1, 0], o: [-1, 0] };
export const NOME_LADO: Record<Lado, string> = { n: "norte", s: "sul", l: "leste", o: "oeste" };
export function ladoDoVetor(v: Ponto): Lado { return Math.abs(v[0]) > Math.abs(v[1]) ? (v[0] > 0 ? "l" : "o") : v[1] > 0 ? "s" : "n"; }

// ---------- o terreno de cada prédio ----------
// lote k (posição física no quarteirão): 0 = noroeste, 1 = nordeste, 2 = sudoeste, 3 = sudeste. Todo lote de um quarteirão
// 2 × 2 é de esquina: dá para a rua da frente (norte ou sul) e para a rua do lado (oeste ou leste)
const ladosDoLote = (k: number): Lado[] => [k >= 2 ? "s" : "n", k % 2 === 0 ? "o" : "l"];
const retDoLote = (l: LoteInfo): Ret => ({ x0: l.centro[0] - LOTE / 2, x1: l.centro[0] + LOTE / 2, z0: l.centro[1] - LOTE / 2, z1: l.centro[1] + LOTE / 2 });
export function terrenoDoLote(chave: string, anexo: string | null): Terreninho | null {
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const la = anexo ? LOTE_POR_CHAVE[anexo] : null;
  const r1 = retDoLote(l), ret = la ? (() => { const r2 = retDoLote(la); return { x0: Math.min(r1.x0, r2.x0), x1: Math.max(r1.x1, r2.x1), z0: Math.min(r1.z0, r2.z0), z1: Math.max(r1.z1, r2.z1) }; })() : r1;
  const abertos = la ? [...new Set([...ladosDoLote(l.k), ...ladosDoLote(la.k)])] : ladosDoLote(l.k);
  return { chave, tipo: "loja", ret, centro: [(ret.x0 + ret.x1) / 2, (ret.z0 + ret.z1) / 2], rotBase: frenteDoLote(l.k) + Math.PI, abertos, so180: !!la, margem: 0.4, dentroBloco: true };
}
export function terrenoDaSede(sd: Sede): Terreninho {
  const { x, z, rot, k } = sd.lote;
  return { chave: sd.chave, tipo: "sede", ret: { x0: x - LOTE / 2, x1: x + LOTE / 2, z0: z - LOTE / 2, z1: z + LOTE / 2 }, centro: [x, z], rotBase: rot, abertos: ladosDoLote(k), so180: false, margem: 0.3, dentroBloco: true };
}
export function terrenoDoQuiosque(k: QuiosqueInfo): Terreninho {
  return { chave: k.chave, tipo: "quiosque", ret: { ...k.terreno }, centro: [...k.pos0], rotBase: k.rot0, abertos: ["n", "s", "l", "o"], so180: false, margem: 0.25, dentroBloco: false };
}

// ---------- o que cada prédio ocupa (local, na convenção do desenho) ----------
interface TerrenoPose { chave: string; status: string; escritorio: Escritorio | null; anexoDe?: string | null; empresaNome?: string }
// loja: o lado de fora do modelo (medidas do kit ou dos GLB antigos) somado à planta de dentro (16 × 14 m, igual em todos)
export function pegadaLoja(e: Escritorio, duplo: boolean): { pegada: Ret; corpo: Ret } {
  const medio = !duplo && !!e.decor?.quartos?.predio; // prédio médio do lote em quartos (fundura reduzida)
  const P = medio ? PREDIO_MEDIO : PREDIO_CLIENTE;
  let r: Ret;
  if (ehKit(e.layout)) {
    const m = medidasKit(e.layout, andaresDoPredio(e), duplo, (e.decor?.cobertura ?? "nenhuma") !== "nenhuma", false, false, medio);
    // Sede corporativa nos dois lotes: duas torres de 13 m com os centros a ±8,4 m (scene/EscritorioCliente.tsx › TorresGemeas)
    const w = e.modelo === "sede" && duplo ? 2 * 8.4 + 13 : m.w;
    const z0 = Math.min(m.z0, m.frenteZ, m.anexo?.z0 ?? 0, m.letreiro.z);
    r = { x0: Math.min(-w / 2, m.anexo?.x0 ?? 0), x1: Math.max(w / 2, m.anexo?.x1 ?? 0), z0, z1: m.z1 };
  } else {
    const d = DIM_LAYOUT[e.layout], w = d.largura * (duplo ? 1.6 : 1);
    r = { x0: -w / 2, x1: w / 2, z0: -d.prof / 2, z1: d.prof / 2 };
  }
  const corpo = { x0: Math.min(r.x0, P.x0), x1: Math.max(r.x1, P.x1), z0: Math.min(r.z0, P.z0), z1: Math.max(r.z1, P.z1) };
  return { pegada: corpo, corpo };
}
// sede (frente +z): a planta de 19,2 × 14,4 m e o jardim da frente até a beira do lote (o jardim é de passagem)
const PEGADA_SEDE: Ret = { x0: SEDE_X0, x1: SEDE_X1, z0: SEDE_Z0, z1: LOTE / 2 - 0.4 };
const CORPO_SEDE: Ret = { x0: SEDE_X0, x1: SEDE_X1, z0: SEDE_Z0, z1: SEDE_Z1 };

// ---------- pose ----------
export interface PedidoPose { giro?: unknown; desloc?: unknown }
function montarPose(tr: Terreninho, pegadaLocal: Ret, corpoLocal: Ret, portaLocal: Ponto, frenteLocal: Ponto, giroIn: unknown, deslocIn: unknown): PosePredio {
  let giro = giroValido(giroIn); if (tr.so180) giro = (giro - (giro % 2)) as Giro;
  const desloc = deslocValido(deslocIn);
  const rot = tr.rotBase + giro * R90;
  const centro: Ponto = [arred(tr.centro[0] + desloc[0]), arred(tr.centro[1] + desloc[1])];
  const porta = paraMundo(centro, rot, portaLocal[0], portaLocal[1]);
  const f = paraMundo([0, 0], rot, frenteLocal[0], frenteLocal[1]);
  return { chave: tr.chave, tipo: tr.tipo, centro, rot, giro, desloc, caixa: retNoMundo(centro, rot, pegadaLocal), corpo: retNoMundo(centro, rot, corpoLocal), porta: [arred(porta[0]), arred(porta[1])], frente: [Math.round(f[0]), Math.round(f[1])], terreno: tr };
}
// pose de uma loja num lote (ou no lote duplo), de uma sede ou de um quiosque, com o giro e o deslocamento pedidos (ou os
// gravados no escritório). Não confere nada: para a pose que vale, use poseConferida.
export function poseCrua(t: TerrenoPose, anexo: string | null, pedido?: PedidoPose): PosePredio | null {
  // lote em quartos: a estrutura principal, no lugar dela (o giro e o lugar de cada uma mudam por conferirQuartos)
  const q = quartosDoTerreno(t, anexo);
  if (q && t.escritorio) return conferirQuartos(t.chave, t.escritorio).poses[0] ?? null;
  const d: Partial<Decoracao> = t.escritorio?.decor ?? {};
  const giro = pedido?.giro ?? d.giro ?? 0, desloc = pedido?.desloc ?? d.desloc ?? [0, 0];
  const qk = QUIOSQUE_POR_CHAVE[t.chave];
  if (qk) return montarPose(terrenoDoQuiosque(qk), pegadaQuiosque(), corpoQuiosque(), [0, BALCAO_Z], [0, 1], giro, desloc);
  const sd = SEDE_POR_CHAVE[t.chave];
  if (sd) {
    const rec = t.escritorio ? montarSalas(t.escritorio.setores).find((s) => s.tipo === "recepcao") : null;
    return montarPose(terrenoDaSede(sd), PEGADA_SEDE, CORPO_SEDE, [rec ? cxSala(rec) : 0, SEDE_Z1 + 0.6], [0, 1], giro, desloc);
  }
  if (!t.escritorio) return null;
  const tr = terrenoDoLote(t.chave, anexo); if (!tr) return null;
  const { pegada, corpo } = pegadaLoja(t.escritorio, !!anexo);
  return montarPose(tr, pegada, corpo, [0, pegada.z0 - 0.6], [0, -1], giro, desloc);
}

// ---------- conferência ----------
const dentro = (r: Ret, x: number, z: number, f = 0) => x >= r.x0 - f && x <= r.x1 + f && z >= r.z0 - f && z <= r.z1 + f;

// caminho na grade de 0,5 m do terreno, da frente da porta até um lado aberto (busca em largura, 8 vizinhos sem cortar quina).
// obst: o que mais fica no lote em quartos (as outras estruturas), que o caminho contorna como o próprio prédio
function caminhoAteAberto(p: PosePredio, obst: Ret[] = []): Ponto[] | null {
  const r = p.terreno.ret, C = PASSO_GRADE, nx = Math.round((r.x1 - r.x0) / C), nz = Math.round((r.z1 - r.z0) / C);
  const cx = (i: number) => r.x0 + C / 2 + i * C, cz = (j: number) => r.z0 + C / 2 + j * C;
  const livre = new Uint8Array(nx * nz);
  const ocupado = (x: number, z: number, f: number) => dentro(p.corpo, x, z, f) || obst.some((o) => dentro(o, x, z, f));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) livre[j * nx + i] = ocupado(cx(i), cz(j), FOLGA_CORPO) ? 0 : 1;
  const ab = new Set(p.terreno.abertos);
  const meta = (i: number, j: number) => (ab.has("o") && i === 0) || (ab.has("l") && i === nx - 1) || (ab.has("n") && j === 0) || (ab.has("s") && j === nz - 1);
  // a célula da porta (ou a livre mais perto dela, até 1 m)
  let ini = -1, dm = Infinity;
  const pi = Math.floor((p.porta[0] - r.x0) / C), pj = Math.floor((p.porta[1] - r.z0) / C);
  for (let j = pj - 2; j <= pj + 2; j++) for (let i = pi - 2; i <= pi + 2; i++) {
    if (i < 0 || j < 0 || i >= nx || j >= nz || !livre[j * nx + i]) continue;
    const d = Math.hypot(cx(i) - p.porta[0], cz(j) - p.porta[1]); if (d < dm) { dm = d; ini = j * nx + i; }
  }
  if (ini < 0) return null;
  const veio = new Int32Array(nx * nz).fill(-2); veio[ini] = -1;
  const fila = [ini]; let fim = -1;
  const VIZ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let q = 0; q < fila.length && fim < 0; q++) {
    const c = fila[q], i = c % nx, j = Math.floor(c / nx);
    if (meta(i, j)) { fim = c; break; }
    for (const [di, dj] of VIZ) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const n = b * nx + a; if (!livre[n] || veio[n] !== -2) continue;
      if (di && dj && (!livre[j * nx + a] || !livre[b * nx + i])) continue;
      veio[n] = c; fila.push(n);
    }
  }
  if (fim < 0) return null;
  const cel: number[] = []; for (let c = fim; c >= 0; c = veio[c]) cel.push(c);
  cel.reverse();
  const pts: Ponto[] = [p.porta, ...cel.map((c): Ponto => [cx(c % nx), cz(Math.floor(c / nx))])];
  // a saída fica na beira, reto para fora da última célula
  const ult = cel[cel.length - 1], ui = ult % nx, uj = Math.floor(ult / nx);
  const lado: Lado = ab.has("n") && uj === 0 ? "n" : ab.has("s") && uj === nz - 1 ? "s" : ab.has("o") && ui === 0 ? "o" : "l";
  const [ux, uz] = pts[pts.length - 1];
  pts.push(lado === "n" ? [ux, r.z0] : lado === "s" ? [ux, r.z1] : lado === "o" ? [r.x0, uz] : [r.x1, uz]);
  // estica: de cada ponto, pula para o mais longe que dá para ver em reta sem entrar no corpo
  const reta = (a: Ponto, b: Ponto) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2)); for (let k = 1; k < n; k++) { const t = k / n; if (ocupado(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, FOLGA_CORPO - 0.05)) return false; } return true; };
  const out: Ponto[] = [pts[0]]; let k = 0;
  while (k < pts.length - 1) { let m = pts.length - 1; while (m > k + 1 && !reta(pts[k], pts[m])) m--; out.push(pts[m]); k = m; }
  // a saída fica reta na frente do ponto anterior, quando dá (sem o meio passo da grade)
  if (out.length >= 2) {
    const a = out[out.length - 2], s = out[out.length - 1];
    const reto: Ponto = lado === "n" || lado === "s" ? [a[0], s[1]] : [s[0], a[1]];
    if (dentro(r, reto[0], reto[1]) && reta(a, reto)) out[out.length - 1] = reto;
  }
  return out.map(([x, z]) => [arred(x), arred(z)] as Ponto);
}
// confere a pose: dentro do terreno com margem, porta (ou balcão) dentro dele e com caminho até um lado aberto. Os enfeites
// que encostam no prédio ou no caminho saem do lugar (aviso), não impedem.
// obst (lote em quartos): as outras estruturas do lote, que o caminho da porta contorna
export function conferirPose(p: PosePredio, enfeites: Enfeite[] = [], obst: Ret[] = []): Conferencia {
  const tr = p.terreno, r = tr.ret, m = tr.margem, c = p.caixa, lim = tr.limite ?? r, est = p.estrutura?.tamanho;
  const falha = (motivo: string): Conferencia => ({ ok: false, motivo, avisos: [], trilha: [], fora: null, escondidos: [] });
  const quiosque = tr.tipo === "quiosque" || est === "quiosque", oQue = quiosque ? "O quiosque" : tr.tipo === "sede" ? "A sede" : "O prédio";
  const onde = tr.tipo === "quiosque" ? "do terreninho" : est === "quiosque" ? "do quarto do lote" : est === "medio" ? "da metade do lote" : "do lote";
  const passa: string[] = [];
  if (c.z0 < lim.z0 + m - 1e-6) passa.push("norte"); if (c.z1 > lim.z1 - m + 1e-6) passa.push("sul");
  if (c.x0 < lim.x0 + m - 1e-6) passa.push("oeste"); if (c.x1 > lim.x1 - m + 1e-6) passa.push("leste");
  if (passa.length) return falha(`${oQue} passa ${onde} pelo lado ${passa.join(" e ")}.`);
  // porta encostada na beira: se a beira dá para a rua, a porta abre direto na calçada; se dá para o vizinho, não há passagem
  if (!dentro(r, p.porta[0], p.porta[1], -0.2)) {
    const lado = ladoDoVetor(p.frente);
    if (tr.tipo === "quiosque") return falha("O balcão fica fora do terreninho: o cliente não teria onde ficar.");
    if (quiosque) return falha("O balcão fica fora do lote: o cliente não teria onde ficar.");
    if (!tr.abertos.includes(lado)) return falha(`A porta fica virada para o ${NOME_LADO[lado]}, colada na divisa com o vizinho: sem passagem até a calçada.`);
    const v = VETOR[lado], d = tr.dentroBloco ? MEIO_CALCADA - MEIO_Q : 0;
    const borda: Ponto = lado === "n" ? [p.porta[0], r.z0] : lado === "s" ? [p.porta[0], r.z1] : lado === "o" ? [r.x0, p.porta[1]] : [r.x1, p.porta[1]];
    return { ok: true, motivo: null, avisos: [], trilha: [p.porta], fora: [arred(borda[0] + v[0] * d), arred(borda[1] + v[1] * d)], escondidos: enfeites.filter((e) => dentro(c, e.x, e.z, -0.2)).map((e) => e.id) };
  }
  const trilha = caminhoAteAberto(p, obst);
  if (!trilha) {
    const lado = NOME_LADO[ladoDoVetor(p.frente)];
    return falha(quiosque ? `O balcão, virado para o ${lado}, fica sem passagem para o cliente.` : `A porta fica virada para o ${lado}, sem passagem até a calçada. Gire para a rua ou deixe um corredor do lado.`);
  }
  const avisos: string[] = [], escondidos: string[] = [];
  for (const e of enfeites) {
    // sai só o que fica dentro do prédio ou em cima do caminho da porta (o vaso ao lado da porta, o banco na frente e a
    // árvore do canto continuam onde estão, como antes do modo de edição)
    const noPredio = dentro(c, e.x, e.z, -0.2);
    const noCaminho = trilha.some((a, i) => i > 0 && distSeg(e.x, e.z, trilha[i - 1], a) < Math.min(e.r, 0.6) + 0.3);
    if (noPredio || noCaminho) { escondidos.push(e.id); avisos.push(`${e.nome} sai do lugar: ${noPredio ? "encosta no prédio" : "fica no caminho da porta"}.`); }
  }
  const saida = trilha[trilha.length - 1];
  let fora: Ponto = saida;
  if (tr.dentroBloco) {
    // da beira do quarteirão até o meio da calçada (data/mundo.ts › MEIO_CALCADA)
    const d = MEIO_CALCADA - MEIO_Q, lado = saida[1] <= r.z0 + 1e-6 ? "n" : saida[1] >= r.z1 - 1e-6 ? "s" : saida[0] <= r.x0 + 1e-6 ? "o" : "l";
    const v = VETOR[lado]; fora = [arred(saida[0] + v[0] * d), arred(saida[1] + v[1] * d)];
  }
  return { ok: true, motivo: null, avisos, trilha, fora, escondidos };
}
function distSeg(px: number, pz: number, a: Ponto, b: Ponto) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; const t = L ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L)) : 0; return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz)); }

// o deslocamento válido mais perto do pedido, com o mesmo giro (troca de modelo, lote duplo novo, posição antiga que não
// cabe mais). Procura em anéis de 0,5 m; sem nenhum, tenta o giro 0 no centro.
export function ajustarPose(t: TerrenoPose, anexo: string | null, pedido?: PedidoPose): { pose: PosePredio; conf: Conferencia; ajustada: boolean } | null {
  const p0 = poseCrua(t, anexo, pedido); if (!p0) return null;
  const c0 = conferirPose(p0); if (c0.ok) return { pose: p0, conf: c0, ajustada: false };
  for (let anel = 1; anel <= 2 * MAX_DESLOC; anel++) {
    let melhor: { pose: PosePredio; conf: Conferencia; d: number } | null = null;
    for (let a = -anel; a <= anel; a++) for (let b = -anel; b <= anel; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== anel) continue;
      const desloc: Ponto = [p0.desloc[0] + a * PASSO_GRADE, p0.desloc[1] + b * PASSO_GRADE];
      if (Math.abs(desloc[0]) > MAX_DESLOC || Math.abs(desloc[1]) > MAX_DESLOC) continue;
      const p = poseCrua(t, anexo, { giro: p0.giro, desloc }); if (!p) continue;
      const c = conferirPose(p); const d = Math.hypot(a, b);
      if (c.ok && (!melhor || d < melhor.d)) melhor = { pose: p, conf: c, d };
    }
    if (melhor) return { pose: melhor.pose, conf: melhor.conf, ajustada: true };
  }
  const pz = poseCrua(t, anexo, { giro: 0, desloc: [0, 0] });
  return pz ? { pose: pz, conf: conferirPose(pz), ajustada: true } : null;
}

// ---------- a pose que vale, com cache ----------
// a gravada, se ela valer para o modelo de agora; senão a mais perto que vale (é o que a cena desenha e o servidor grava
// ao trocar de modelo). Guardada pela assinatura do que muda a pose.
const CACHE = new Map<string, { pose: PosePredio; conf: Conferencia; ajustada: boolean }>();
function assinatura(t: TerrenoPose, anexo: string | null, pedido?: PedidoPose) {
  const e = t.escritorio, d = e?.decor;
  return [t.chave, anexo ?? "", e?.layout ?? "", e?.modelo ?? "", e?.decor?.andares ?? "", d?.cobertura ?? "", JSON.stringify(pedido?.giro ?? d?.giro ?? 0), JSON.stringify(pedido?.desloc ?? d?.desloc ?? [0, 0]),
    SEDE_POR_CHAVE[t.chave] ? (e?.setores.length ?? 0) : ""].join("|");
}
export function poseConferida(t: TerrenoPose, anexo: string | null, pedido?: PedidoPose): { pose: PosePredio; conf: Conferencia; ajustada: boolean } | null {
  // lote em quartos: a estrutura principal (o prédio médio, ou o 1º quiosque), conferida com as outras do lote
  const q = quartosDoTerreno(t, anexo);
  if (q && t.escritorio) { const lc = conferirQuartos(t.chave, t.escritorio); return lc.poses[0] ? { pose: lc.poses[0], conf: lc.confs[0], ajustada: false } : null; }
  const k = assinatura(t, anexo, pedido);
  let r = CACHE.get(k);
  if (!r) { const a = ajustarPose(t, anexo, pedido); if (!a) return null; r = a; if (CACHE.size > 400) CACHE.clear(); CACHE.set(k, r); }
  return r;
}
// o lote do lado (ampliação ativa) de cada lote principal
export function anexosDe(terrenos: Record<string, { chave: string; status: string; anexoDe?: string | null }>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const t of Object.values(terrenos)) if (t.anexoDe && t.status === "ativo") m[t.anexoDe] = t.chave;
  return m;
}
// a pose de um terreno da cidade (lojas e sedes ativas com escritório e quiosques com dono); null sem prédio
export function poseDoTerreno(chave: string, terrenos: Record<string, TerrenoPose>, anexos?: Record<string, string>): PosePredio | null {
  const t = terrenos[chave]; if (!t || t.anexoDe) return null;
  if (!QUIOSQUE_POR_CHAVE[chave] && (t.status !== "ativo" || !t.escritorio)) return null;
  return poseConferida(t, (anexos ?? anexosDe(terrenos))[chave] ?? null)?.pose ?? null;
}
// todas as estruturas de um terreno: no lote em quartos, o prédio médio e os quiosques; nos outros, o prédio de sempre
export function posesDoTerreno(chave: string, terrenos: Record<string, TerrenoPose>, anexos?: Record<string, string>): PosePredio[] {
  const t = terrenos[chave], a = anexos ?? anexosDe(terrenos);
  const q = t ? quartosDoTerreno(t, a[chave] ?? null) : null;
  if (q && t?.escritorio && t.status === "ativo" && !t.anexoDe) return conferirQuartos(chave, t.escritorio).poses;
  const p = poseDoTerreno(chave, terrenos, a); return p ? [p] : [];
}
// todas as poses da cidade (quiosques sem dono ficam na vaga deles, com giro 0; no lote em quartos, cada estrutura)
export function posesDaCidade(terrenos: Record<string, TerrenoPose>): PosePredio[] {
  const anexos = anexosDe(terrenos), out: PosePredio[] = [];
  for (const t of Object.values(terrenos)) out.push(...posesDoTerreno(t.chave, terrenos, anexos));
  for (const k of Object.values(QUIOSQUE_POR_CHAVE)) if (!terrenos[k.chave]) { const p = poseCrua({ chave: k.chave, status: "livre", escritorio: null }, null); if (p) out.push(p); }
  return out;
}

// ---------- decoração do lote (scene/EscritorioCliente.tsx › DecorLote) ----------
// O pátio (piso, cerca, árvores e enfeites) fica preso ao lote, girado como o prédio (a frente do pátio é a da porta),
// mas sem o deslocamento: o prédio anda e o pátio fica. Estas posições são as do DecorLote, no mesmo sistema (frente -z).
// no lote em quartos o pátio não gira com nenhuma estrutura: fica virado para a rua da frente (o giro 0 do prédio)
export const rotDoPatio = (p: PosePredio) => (p.estrutura ? frenteDoLote(LOTE_POR_CHAVE[p.chave]?.k ?? 0) + Math.PI : p.terreno.rotBase + p.giro * R90);
export function enfeitesDoLote(p: PosePredio, d: Partial<Decoracao> | undefined): Enfeite[] {
  if (p.tipo !== "loja" || !d) return [];
  const duplo = p.terreno.so180, H = 9.62, hx = duplo ? H + 10 : H, sx = duplo ? 1.6 : 1, rot = rotDoPatio(p), out: Enfeite[] = [];
  const add = (id: string, nome: string, lx: number, lz: number, r: number) => { const [x, z] = paraMundo(p.terreno.centro, rot, lx, lz); out.push({ id, nome, x, z, r }); };
  const tem = (x: string) => (d.extras ?? []).includes(x as never);
  ([[-hx + 1.12, 8.5], [hx - 1.12, 8.5], [-hx + 0.62, -9.0], [hx - 0.62, -9.0]] as Ponto[]).slice(0, d.arvores ?? 0).forEach(([x, z], i) => add(`arvore-${i}`, "A árvore do lote", x, z, 0.9));
  if (tem("vasos")) [-1.9 * sx, 1.9 * sx].forEach((x, i) => add(`vasos-${i}`, "O vaso da entrada", x, -8.25, 0.5));
  if (tem("bancos")) (duplo ? [-8, 8] : [-5, 5]).forEach((x, i) => add(`bancos-${i}`, "O banco", x, -9.0, 0.9));
  if (tem("mesas")) [-(hx - 2.32), hx - 2.32].forEach((x, i) => add(`mesas-${i}`, "A mesa com guarda-sol", x, -8.7, 1.0));
  if (tem("totem")) add("totem", "O totem", -3.2 * sx, -9.25, 0.5);
  if (tem("bandeiras")) [-(hx - 0.42), hx - 0.42].forEach((x, i) => add(`bandeiras-${i}`, "A bandeira", x, -6.2, 0.4));
  if (tem("luzes")) [-(hx - 1.02), hx - 1.02].forEach((x, i) => add(`luzes-${i}`, "O poste das luzinhas", x, -9.3, 0.3));
  if (tem("bicicletario")) add("bicicletario", "O bicicletário", hx - 0.52, -3.6, 0.6);
  if (tem("natal")) add("natal", "A decoração de Natal", duplo ? 4.7 : 3.1, -8.4, 0.8);
  return out;
}
// onde a cerca do pátio abre (no lugar onde o caminho da porta sai do lote), no sistema do pátio
export type LadoPatio = "frente" | "fundo" | "esq" | "dir";
export function passagemNoPatio(p: PosePredio, conf: Conferencia | null): { lado: LadoPatio; c: number } {
  const s = conf?.ok ? conf.trilha[conf.trilha.length - 1] : null;
  if (!s) return { lado: "frente", c: 0 };
  const [lx, lz] = paraLocal(p.terreno.centro, rotDoPatio(p), s[0], s[1]);
  const hx = (p.terreno.ret.x1 - p.terreno.ret.x0) / 2, hz = (p.terreno.ret.z1 - p.terreno.ret.z0) / 2;
  // no lote duplo girado meia volta o pátio continua 40 × 20 (a largura acompanha o x local)
  const meiaX = p.terreno.so180 ? Math.max(hx, hz) : hx, meiaZ = p.terreno.so180 ? Math.min(hx, hz) : hz;
  const d = { frente: Math.abs(lz + meiaZ), fundo: Math.abs(lz - meiaZ), esq: Math.abs(lx + meiaX), dir: Math.abs(lx - meiaX) };
  const lado = (Object.keys(d) as LadoPatio[]).reduce((a, b) => (d[b] < d[a] ? b : a));
  return { lado, c: lado === "frente" || lado === "fundo" ? lx : lz };
}
// a conferência com os enfeites do lote (o que a cena esconde e o aviso do modo de edição)
export function conferirComEnfeites(p: PosePredio, d: Partial<Decoracao> | undefined): Conferencia { return conferirPose(p, enfeitesDoLote(p, d)); }

// ---------- lote em quartos (21/11/2026, data/quartosLote.ts) ----------
// Os quartos só valem num lote da lista (não na sede, no quiosque da orla nem no lote duplo, onde o prédio grande ocupa os
// dois terrenos como sempre).
export function quartosDoTerreno(t: TerrenoPose, anexo: string | null): QuartosLote | null {
  const q = t.escritorio?.decor?.quartos;
  if (!q || anexo || t.anexoDe || !LOTE_POR_CHAVE[t.chave] || SEDE_POR_CHAVE[t.chave] || QUIOSQUE_POR_CHAVE[t.chave]) return null;
  return q;
}
export const ID_PREDIO = "predio";
const MARGEM_QUARTO = 0.3; // folga da estrutura até a beira do quarto ou da metade
export function retDoQuarto(l: LoteInfo, q: Quarto): Ret {
  const x0 = l.centro[0] - LOTE / 2 + (q % 2) * (LOTE / 2), z0 = l.centro[1] - LOTE / 2 + (q >= 2 ? LOTE / 2 : 0);
  return { x0, x1: x0 + LOTE / 2, z0, z1: z0 + LOTE / 2 };
}
export function retDaMetade(l: LoteInfo, m: Metade): Ret {
  const [a, b] = QUARTOS_DA_METADE[m].map((q) => retDoQuarto(l, q));
  return { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) };
}
export const centroDoRet = (r: Ret): Ponto => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
// o prédio médio fica de frente ou de costas na metade: nas metades norte e sul a fachada (o x do modelo) corre ao longo
// do x do mundo; nas de leste e oeste, ao longo do z. O giro que não serve vira o mais perto que serve.
export function giroDoMedio(m: Metade, giro: unknown): Giro {
  const g = giroValido(giro), ns = m === "n" || m === "s";
  return (g % 2 === 1) === ns ? (((g + 1) % 4) as Giro) : g;
}
export interface EstruturaDoLote { id: string; tamanho: TamanhoEstrutura; lugar: Quarto | Metade; giro: Giro; nome: string }
// as estruturas na ordem: o prédio médio (se tiver) e os quiosques
export function estruturasDoLote(q: QuartosLote, e: Escritorio): EstruturaDoLote[] {
  const out: EstruturaDoLote[] = [];
  if (q.predio) out.push({ id: ID_PREDIO, tamanho: "medio", lugar: q.predio.metade, giro: giroDoMedio(q.predio.metade, e.decor?.giro), nome: "O prédio médio" });
  q.quiosques.forEach((k, i) => out.push({ id: k.id, tamanho: "quiosque", lugar: k.quarto, giro: giroValido(k.giro), nome: q.quiosques.length > 1 ? `O quiosque ${i + 1}` : "O quiosque" }));
  return out;
}
const quartosDoLugar = (s: Pick<EstruturaDoLote, "tamanho" | "lugar">): Quarto[] => (s.tamanho === "medio" ? [...QUARTOS_DA_METADE[s.lugar as Metade]] : [s.lugar as Quarto]);
// a pose de uma estrutura no quarto ou na metade: o que ela ocupa no chão fica no meio do lugar dela
export function poseDaEstrutura(chave: string, e: Escritorio, s: Omit<EstruturaDoLote, "nome"> & { nome?: string }): PosePredio | null {
  const l = LOTE_POR_CHAVE[chave], base = terrenoDoLote(chave, null); if (!l || !base) return null;
  const quiosque = s.tamanho === "quiosque";
  const lim = quiosque ? retDoQuarto(l, s.lugar as Quarto) : retDaMetade(l, s.lugar as Metade);
  // quiosque: frente (balcão) +z, giro 0 = de frente para a rua da frente; prédio: frente -z, como a loja
  const tr: Terreninho = { ...base, limite: lim, rotBase: frenteDoLote(l.k) + (quiosque ? 0 : Math.PI), margem: MARGEM_QUARTO };
  const giro = quiosque ? giroValido(s.giro) : giroDoMedio(s.lugar as Metade, s.giro);
  let pegada: Ret, corpo: Ret, porta: Ponto, frente: Ponto;
  if (quiosque) { pegada = pegadaQuiosque(); corpo = corpoQuiosque(); porta = [0, BALCAO_Z]; frente = [0, 1]; }
  else { const pl = pegadaLoja(e, false); pegada = pl.pegada; corpo = pl.corpo; porta = [0, pl.pegada.z0 - 0.6]; frente = [0, -1]; }
  const rot = tr.rotBase + giro * R90;
  const pc = paraMundo([0, 0], rot, (pegada.x0 + pegada.x1) / 2, (pegada.z0 + pegada.z1) / 2), lc = centroDoRet(lim);
  const centro: Ponto = [arred(lc[0] - pc[0]), arred(lc[1] - pc[1])];
  const pt = paraMundo(centro, rot, porta[0], porta[1]), f = paraMundo([0, 0], rot, frente[0], frente[1]);
  const info: InfoEstrutura = { id: s.id, tamanho: s.tamanho, lugar: s.lugar, quartos: quartosDoLugar(s), nome: s.nome ?? (quiosque ? "O quiosque" : "O prédio médio") };
  return { chave, tipo: "loja", centro, rot, giro, desloc: [arred(centro[0] - tr.centro[0]), arred(centro[1] - tr.centro[1])], caixa: retNoMundo(centro, rot, pegada), corpo: retNoMundo(centro, rot, corpo),
    porta: [arred(pt[0]), arred(pt[1])], frente: [Math.round(f[0]), Math.round(f[1])], terreno: tr, estrutura: info };
}
export interface LoteConferido { poses: PosePredio[]; confs: Conferencia[]; ok: boolean; motivo: string | null; ruim: number }
// pedido: uma estrutura num giro ou lugar novo (o modo "Editar posição" e a rota que salva)
export interface PedidoEstrutura { id: string; giro?: unknown; lugar?: Quarto | Metade }
const CACHE_Q = new Map<string, LoteConferido>();
// confere o lote inteiro: cada estrutura no lugar dela, sem quarto repetido, e a porta (ou o balcão) de cada uma com
// passagem até a calçada contornando as outras (e sem fechar a passagem das outras)
export function conferirQuartos(chave: string, e: Escritorio, pedido?: PedidoEstrutura): LoteConferido {
  const q = e.decor?.quartos;
  const k = [chave, e.layout, e.modelo ?? "", e.decor?.andares ?? "", e.decor?.cobertura ?? "", e.decor?.giro ?? 0, JSON.stringify(q ?? null), pedido ? JSON.stringify(pedido) : ""].join("|");
  const c = CACHE_Q.get(k); if (c) return c;
  const vazio: LoteConferido = { poses: [], confs: [], ok: false, motivo: "O lote não tem nada.", ruim: -1 };
  if (!q) return vazio;
  const ests = estruturasDoLote(q, e).map((s) => (pedido && s.id === pedido.id ? { ...s, giro: pedido.giro === undefined ? s.giro : giroValido(pedido.giro), lugar: pedido.lugar ?? s.lugar } : s));
  const poses = ests.map((s) => poseDaEstrutura(chave, e, s)).filter((p): p is PosePredio => !!p);
  const confs = poses.map((p, i) => conferirPose(p, [], poses.filter((_, j) => j !== i).map((o) => o.caixa)));
  // dois no mesmo quarto (só acontece num pedido do modo de edição)
  const usados = new Map<Quarto, number>();
  ests.forEach((s, i) => { for (const x of quartosDoLugar(s)) { if (usados.has(x)) { const outro = ests[usados.get(x)!]; confs[i] = { ok: false, motivo: `Este lugar já tem ${outro.tamanho === "medio" ? "o prédio médio" : outro.nome.toLowerCase()}.`, avisos: [], trilha: [], fora: null, escondidos: [] }; } else usados.set(x, i); } });
  const ruim = confs.findIndex((x) => !x.ok);
  const r: LoteConferido = { poses, confs, ok: poses.length > 0 && ruim < 0, motivo: ruim < 0 ? null : (ests.length > 1 ? `${ests[ruim].nome}: ` : "") + (confs[ruim].motivo ?? "posição que não vale."), ruim };
  if (CACHE_Q.size > 300) CACHE_Q.clear();
  CACHE_Q.set(k, r);
  return r;
}
// o escritório com uma estrutura num giro e lugar novos (o giro do prédio médio fica em decor.giro, como o do grande)
export function comEstrutura(e: Escritorio, id: string, giro: Giro, lugar?: Quarto | Metade): Escritorio {
  const d = e.decor, q = d?.quartos; if (!d || !q) return e;
  if (id === ID_PREDIO) return { ...e, decor: { ...d, giro, quartos: { ...q, predio: q.predio ? { metade: (lugar as Metade) ?? q.predio.metade } : null } } };
  return { ...e, decor: { ...d, quartos: { ...q, quiosques: q.quiosques.map((k) => (k.id === id ? { ...k, giro, quarto: lugar === undefined ? k.quarto : (lugar as Quarto) } : k)) } } };
}
// giros na ordem de preferência: o pedido, depois os outros (o prédio médio só tem as duas frentes da metade)
export function girosParaTentar(g: Giro, tamanho: TamanhoEstrutura, lugar: Quarto | Metade): Giro[] {
  if (tamanho === "medio") { const a = giroDoMedio(lugar as Metade, g); return [a, ((a + 2) % 4) as Giro]; }
  return [g, ((g + 1) % 4) as Giro, ((g + 3) % 4) as Giro, ((g + 2) % 4) as Giro];
}
// gira o que não vale até achar o giro que vale (a estrutura nova chega com giro 0 e acha a frente para a rua sozinha)
export function acomodarQuartos(chave: string, e: Escritorio): Escritorio {
  let atual = e;
  for (let volta = 0; volta < 3; volta++) {
    const lc = conferirQuartos(chave, atual); if (lc.ok || !atual.decor?.quartos) return atual;
    const ests = estruturasDoLote(atual.decor.quartos, atual);
    let mudou = false;
    lc.confs.forEach((cf, i) => {
      if (cf.ok || mudou) return;
      const s = ests[i];
      for (const g of girosParaTentar(s.giro, s.tamanho, s.lugar).slice(1)) {
        const t = comEstrutura(atual, s.id, g);
        if (conferirQuartos(chave, t).confs[i]?.ok) { atual = t; mudou = true; return; }
      }
    });
    if (!mudou) return atual;
  }
  return atual;
}
// o lugar livre mais perto de um ponto (arrastar no modo de edição): quartos para o quiosque, metades para o prédio médio
export function lugarMaisPerto(chave: string, q: QuartosLote, id: string, tamanho: TamanhoEstrutura, x: number, z: number): Quarto | Metade | null {
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const outros = new Set<Quarto>();
  if (q.predio && id !== ID_PREDIO) QUARTOS_DA_METADE[q.predio.metade].forEach((x) => outros.add(x));
  for (const k of q.quiosques) if (k.id !== id) outros.add(k.quarto);
  const opcoes: (Quarto | Metade)[] = tamanho === "medio" ? (Object.keys(QUARTOS_DA_METADE) as Metade[]).filter((m) => QUARTOS_DA_METADE[m].every((x) => !outros.has(x))) : ([0, 1, 2, 3] as Quarto[]).filter((x) => !outros.has(x));
  let melhor: Quarto | Metade | null = null, dm = Infinity;
  for (const o of opcoes) { const c = centroDoRet(tamanho === "medio" ? retDaMetade(l, o as Metade) : retDoQuarto(l, o as Quarto)); const d = Math.hypot(c[0] - x, c[1] - z); if (d < dm) { dm = d; melhor = o; } }
  return melhor;
}
export const nomeDoLugar = (tamanho: TamanhoEstrutura, lugar: Quarto | Metade) => (tamanho === "medio" ? `metade ${NOME_METADE[lugar as Metade]}` : `quarto ${NOME_QUARTO[lugar as Quarto]}`);
// o giro de quem chega num quarto ou numa metade: de frente para a rua que aquele lugar toca (a da frente primeiro); sem rua
// encostada, de frente para a rua da frente (o prédio médio de leste ou oeste, para a rua do lado). O caminho até a calçada
// é conferido depois (acomodarQuartos troca o giro se não houver passagem).
export function giroPreferido(chave: string, tamanho: TamanhoEstrutura, lugar: Quarto | Metade): Giro {
  const l = LOTE_POR_CHAVE[chave]; if (!l) return 0;
  const r = retDoLote(l), lim = tamanho === "medio" ? retDaMetade(l, lugar as Metade) : retDoQuarto(l, lugar as Quarto);
  const pode = (x: Lado) => tamanho === "quiosque" || ((lugar === "n" || lugar === "s") ? x === "n" || x === "s" : x === "o" || x === "l");
  const abertos = ladosDoLote(l.k).filter(pode);
  const toca = (x: Lado) => (x === "n" ? lim.z0 <= r.z0 + 1e-6 : x === "s" ? lim.z1 >= r.z1 - 1e-6 : x === "o" ? lim.x0 <= r.x0 + 1e-6 : lim.x1 >= r.x1 - 1e-6);
  const alvo = abertos.find(toca) ?? abertos[0]; if (!alvo) return 0;
  const base = frenteDoLote(l.k) + (tamanho === "quiosque" ? 0 : Math.PI);
  for (const g of [0, 1, 2, 3] as Giro[]) {
    const rot = base + g * R90, f: Ponto = tamanho === "quiosque" ? [Math.sin(rot), Math.cos(rot)] : [-Math.sin(rot), -Math.cos(rot)];
    if (ladoDoVetor(f) === alvo) return g;
  }
  return 0;
}
// as estruturas novas (giro ainda não escolhido) com o giro preferido e, se algo não valer, o giro que vale
export function prepararQuartos(chave: string, e: Escritorio, novos: string[]): Escritorio {
  let atual = e; const q = e.decor?.quartos; if (!q) return e;
  for (const s of estruturasDoLote(q, e)) if (novos.includes(s.id)) atual = comEstrutura(atual, s.id, giroPreferido(chave, s.tamanho, s.lugar));
  return acomodarQuartos(chave, atual);
}
// o pátio do lote em quartos (scene/EscritorioCliente.tsx › DecorLote): os enfeites que encostam em qualquer estrutura ou no
// caminho dela saem do lugar, e a cerca abre onde o caminho de cada uma sai do lote
export function patioDosQuartos(lc: LoteConferido, d: Partial<Decoracao> | undefined): { escondidos: string[]; passagens: { lado: LadoPatio; c: number }[] } {
  const esc = new Set<string>(), passagens: { lado: LadoPatio; c: number }[] = [];
  lc.poses.forEach((p, i) => {
    const conf = conferirPose(p, enfeitesDoLote(p, d), lc.poses.filter((_, j) => j !== i).map((o) => o.caixa));
    for (const x of conf.escondidos) esc.add(x);
    if (conf.ok) passagens.push(passagemNoPatio(p, conf));
  });
  return { escondidos: [...esc], passagens };
}
