// Moradores da cidade (19/11/2026, pedido do dono): parte dos pedestres virou gente fixa, com nome, profissão, idade,
// jeito, gostos, casa e roupa própria. Cada um tem uma agenda do dia (sai de casa, trabalha, almoça, passeia, volta para
// casa e dorme) e anda pelas calçadas entre os lugares, atravessando nas esquinas como os outros pedestres.
// A rotina é DETERMINÍSTICA pela hora da cidade (horário de Brasília, o mesmo relógio do servidor): todo visitante vê o
// mesmo morador no mesmo lugar na mesma hora, e o servidor sabe o que cada um está fazendo para conversar.
// Este arquivo é puro (sem React nem three.js): o mapa (scene/Moradores.tsx) e o servidor (src/server/moradores.ts) usam.
// Desempenho: os caminhos e a linha do tempo de cada morador são montados uma vez; a posição de cada quadro sai de uma
// conta simples, escrita num objeto reaproveitado (nenhuma alocação por quadro).
import { PASSO, MEIO_CALCADA, centroLote } from "./mundo";
import { BONECO, codificarVisual, visualCompleto, type Visual } from "./bonecos";

export type Ponto = [number, number];

// ---------------- rede de calçadas ----------------
// Nós: as 4 esquinas da calçada de cada um dos 9 quarteirões (mesma convenção dos pedestres de Transito.tsx: 0 = -x-z,
// 1 = +x-z, 2 = +x+z, 3 = -x+z), mais o calçadão do rio (norte) e as orlas leste e sul. Arestas: os lados de cada
// calçada, as faixas de pedestre entre quarteirões vizinhos e as travessias das avenidas da borda.
const B = MEIO_CALCADA; // 21,3
const Z_CALCADAO = -85.6, X_ORLA = 95.5, Z_ORLA = 95.5;
const NOS: Ponto[] = [];
const ARESTAS: { a: number; b: number; travessia: boolean }[] = [];
const idNo = new Map<string, number>();
function no(x: number, z: number) {
  const k = `${x.toFixed(2)},${z.toFixed(2)}`; let i = idNo.get(k);
  if (i == null) { i = NOS.length; NOS.push([x, z]); idNo.set(k, i); }
  return i;
}
const esquina = (i: number, j: number, k: number) => no(i * PASSO + (k === 1 || k === 2 ? B : -B), j * PASSO + (k >= 2 ? B : -B));
const ligar = (a: number, b: number, travessia = false) => ARESTAS.push({ a, b, travessia });
for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
  for (let k = 0; k < 4; k++) ligar(esquina(i, j, k), esquina(i, j, (k + 1) % 4));
  if (i < 1) { ligar(esquina(i, j, 1), esquina(i + 1, j, 0), true); ligar(esquina(i, j, 2), esquina(i + 1, j, 3), true); }
  if (j < 1) { ligar(esquina(i, j, 3), esquina(i, j + 1, 0), true); ligar(esquina(i, j, 2), esquina(i, j + 1, 1), true); }
}
// calçadão do rio (atravessa a Avenida Beira-Rio), orla leste (Avenida Atlântica) e orla sul (Avenida da Praia)
const calcadao: number[] = [], orlaL: number[] = [], orlaS: number[] = [];
for (let i = -1; i <= 1; i++) for (const k of [0, 1]) { const e = esquina(i, -1, k); const n = no(NOS[e][0], Z_CALCADAO); ligar(e, n, true); calcadao.push(n); }
for (let j = -1; j <= 1; j++) for (const k of [1, 2]) { const e = esquina(1, j, k); const n = no(X_ORLA, NOS[e][1]); ligar(e, n, true); orlaL.push(n); }
for (let i = -1; i <= 1; i++) for (const k of [3, 2]) { const e = esquina(i, 1, k); const n = no(NOS[e][0], Z_ORLA); ligar(e, n, true); orlaS.push(n); }
for (const fila of [calcadao, orlaL, orlaS]) for (let k = 0; k + 1 < fila.length; k++) ligar(fila[k], fila[k + 1]);

// menor caminho entre todos os pares (Floyd-Warshall, ~54 nós: feito uma vez, sob demanda)
let DIST: Float64Array | null = null, PROX: Int16Array | null = null;
const dNo = (a: number, b: number) => Math.hypot(NOS[a][0] - NOS[b][0], NOS[a][1] - NOS[b][1]);
function montarDistancias() {
  const n = NOS.length; const d = new Float64Array(n * n).fill(Infinity); const p = new Int16Array(n * n).fill(-1);
  for (let i = 0; i < n; i++) { d[i * n + i] = 0; p[i * n + i] = i; }
  for (const e of ARESTAS) { const c = dNo(e.a, e.b); d[e.a * n + e.b] = d[e.b * n + e.a] = c; p[e.a * n + e.b] = e.b; p[e.b * n + e.a] = e.a; }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) { const ik = d[i * n + k]; if (ik === Infinity) continue; for (let j = 0; j < n; j++) { const v = ik + d[k * n + j]; if (v < d[i * n + j]) { d[i * n + j] = v; p[i * n + j] = p[i * n + k]; } } }
  DIST = d; PROX = p;
}
const ehTravessia = (a: number, b: number) => ARESTAS.some((e) => e.travessia && ((e.a === a && e.b === b) || (e.a === b && e.b === a)));

// aresta da calçada mais perto de um ponto (onde o lugar "encosta" na rede)
function arestaDe(p: Ponto) {
  let melhor = 0, dm = Infinity;
  ARESTAS.forEach((e, k) => {
    if (e.travessia) return;
    const [ax, az] = NOS[e.a], [bx, bz] = NOS[e.b]; const vx = bx - ax, vz = bz - az; const L2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - az) * vz) / L2)); const d = Math.hypot(ax + vx * t - p[0], az + vz * t - p[1]);
    if (d < dm) { dm = d; melhor = k; }
  });
  return ARESTAS[melhor];
}

// ---------------- lugares ----------------
// ancora: ponto na calçada onde o lugar começa; entrada: passos de lá até o primeiro ponto; pontos: onde a pessoa fica
// (ela troca de ponto de tempos em tempos, devagar); dentro: some da rua quando chega (casa, cozinha, escritório).
export interface Lugar { id: string; nome: string; indo: string; ancora: Ponto; entrada?: Ponto[]; pontos: Ponto[]; olhar?: number; dentro?: boolean }
const L = (l: Lugar) => l;
export const LUGARES: Record<string, Lugar> = Object.fromEntries([
  L({ id: "praca", nome: "Praça de Eventos", indo: "indo para a praça", ancora: [10, PASSO - B], entrada: [[10, 33.6]], pontos: [[10, 34.4], [4.6, 40], [15.4, 43.6], [10, 43.5]] }),
  L({ id: "praca-cafe", nome: "carrinho de café da praça", indo: "indo montar o carrinho de café", ancora: [15.6, 30.7], pontos: [[15.6, 35.2], [14.6, 35.6]], olhar: -Math.PI / 2 }),
  L({ id: "praca-domino", nome: "mesa de dominó da praça", indo: "indo para o dominó da praça", ancora: [4.6, 30.7], entrada: [[4.6, 34.6]], pontos: [[4.6, 40], [4.8, 38.4]], olhar: Math.PI / 2 }),
  L({ id: "praca-palco", nome: "frente do palco da praça", indo: "indo tocar na praça", ancora: [10, 30.7], entrada: [[10, 33.6]], pontos: [[10, 43.4], [11, 43.2]], olhar: Math.PI }),
  L({ id: "restaurante", nome: "mesinhas do restaurante", indo: "indo para o restaurante", ancora: [30.7, -0.35], entrada: [[40.4, -0.35]], pontos: [[43.6, -4], [41.6, -6.5], [43.6, -9]], olhar: Math.PI / 2 }),
  L({ id: "cozinha", nome: "cozinha do restaurante", indo: "indo para o restaurante", ancora: [30.7, -0.35], entrada: [[40.4, -0.35], [47.4, -7.55]], pontos: [[50.2, -7.55]], dentro: true }),
  L({ id: "nuvem", nome: "escritório da Nuvem", indo: "indo para o escritório da Nuvem", ancora: [-B, -1.1], pontos: [[-10.4, -1.1]], dentro: true }),
  L({ id: "bancos-nuvem", nome: "bancos da praça da Nuvem", indo: "indo para os bancos da praça da Nuvem", ancora: [-3, B], pontos: [[-7, 14.7], [8.5, 14.7], [1.2, 16.4]], olhar: 0 }),
  L({ id: "calcadao", nome: "calçadão do rio", indo: "indo para o calçadão do rio", ancora: [0, Z_CALCADAO], pontos: [[-12, -86.4], [6, -87.2], [20, -85.8]], olhar: Math.PI }),
  L({ id: "orla-leste", nome: "orla da praia", indo: "indo para a orla", ancora: [X_ORLA, 0], pontos: [[95.6, -18], [96.2, 6], [95.6, 28]], olhar: Math.PI / 2 }),
  L({ id: "orla-sul", nome: "orla sul", indo: "indo para a orla sul", ancora: [0, Z_ORLA], pontos: [[-30, 95.6], [-6, 96.2], [24, 95.6]], olhar: 0 }),
  L({ id: "comercio", nome: "banca de chaves da Rua do Comércio", indo: "indo para a banca da Rua do Comércio", ancora: [PASSO - B, 13], pontos: [[PASSO - B + 0.3, 13], [PASSO - B + 0.3, 11.6]], olhar: -Math.PI / 2 }),
  L({ id: "vila", nome: "Vila dos Criativos", indo: "indo para a Vila dos Criativos", ancora: [-4, -PASSO + B], pontos: [[-12, -30.9], [5, -30.9], [14, -30.9]], olhar: Math.PI }),
].map((l) => [l.id, l]));

// casa (24/11/2026, pedido do dono: "retirar as casas fakes dos terrenos que não têm uma loja"): os lotes sem loja ficaram
// só com a grama, então ninguém mora mais num lote. "Voltar para casa" é sair da cidade pela borda mais perto de onde a
// casa ficava (i, j, k: o lote de antes): o calçadão do rio ao norte, a orla sul ou a orla leste. A pessoa anda até lá e
// some (dentro), e volta pelo mesmo caminho na hora de sair de casa. Cada morador tem um ponto próprio na borda.
function casa(i: number, j: number, k: number): Lugar {
  const [x, z] = centroLote(i, j, k);
  const id = `casa:${i},${j},${k}`, base = { id, nome: "casa", indo: "voltando para casa", dentro: true };
  if (j > 0) return { ...base, ancora: [0, Z_ORLA], pontos: [[Math.max(-30, Math.min(24, x)), 96]], olhar: 0 };
  if (i > 0 && j === 0) return { ...base, ancora: [X_ORLA, 0], pontos: [[96, Math.max(-18, Math.min(28, z))]], olhar: Math.PI / 2 };
  return { ...base, ancora: [0, Z_CALCADAO], pontos: [[Math.max(-12, Math.min(20, x)), -86.6]], olhar: Math.PI };
}

// ---------------- moradores ----------------
export type Tom = "desconfiado" | "neutro" | "simpatico" | "amigo";
export interface Compromisso { h: number; lugar: string; fazendo: string }
export interface Morador {
  id: string; nome: string; curto: string; idade: number; profissao: string; genero: "f" | "m";
  personalidade: string; jeito: string; gostos: string[]; bairro: string; casa: Lugar;
  boneco: string; roupa: string; acessorios?: string[];
  celular: boolean; // aparece também no modo leve (celular)
  base: number; // afinidade inicial (o jeito da pessoa: a Dona Cida já começa gostando, o Seu Valdir é desconfiado)
  agenda: Compromisso[];
  nichos: string[]; // assuntos de empresa que ela costuma indicar (ids de NICHOS, data/mundo.ts)
  bordao: string; // expressão que a pessoa usa
}
const visual = (roupa: string, v: Visual) => codificarVisual(visualCompleto(BONECO.classico, roupa, v));
const H = (h: number, lugar: string, fazendo: string): Compromisso => ({ h, lugar, fazendo });

// 24/11/2026 (pedido do dono: "vamos zerar agentes... só permanece os usuários, personagens comprados"): os 12 moradores
// saíram da cidade e as conversas deles foram apagadas (migração 0063). A agenda, os lugares e a conversa continuam aqui
// para um morador novo entrar do mesmo jeito. Os de antes estão no histórico do git.
export const MORADORES: Morador[] = [];
export const MORADOR_POR_ID: Record<string, Morador> = Object.fromEntries(MORADORES.map((m) => [m.id, m]));
export const lugarDe = (m: Morador, id: string): Lugar => (id === "casa" ? m.casa : LUGARES[id] ?? m.casa);

// ---------------- hora da cidade ----------------
// Segundos desde a meia-noite em Brasília (UTC-3, sem horário de verão). `desvioMs` = relógio do servidor - do aparelho.
export const DIA = 86400;
export function segundosBrasilia(agoraMs = Date.now()) { return ((((agoraMs / 1000 - 3 * 3600) % DIA) + DIA) % DIA); }

// ---------------- caminhos e linha do tempo ----------------
interface Trecho { pts: Float32Array; cum: Float32Array; trav: Uint8Array; total: number }
function trecho(pontos: Ponto[], travessia: boolean[]): Trecho {
  const n = pontos.length; const pts = new Float32Array(n * 2), cum = new Float32Array(n), trav = new Uint8Array(Math.max(0, n - 1));
  let total = 0;
  pontos.forEach((p, k) => { pts[k * 2] = p[0]; pts[k * 2 + 1] = p[1]; if (k) { total += Math.hypot(p[0] - pontos[k - 1][0], p[1] - pontos[k - 1][1]); trav[k - 1] = travessia[k - 1] ? 1 : 0; } cum[k] = total; });
  return { pts, cum, trav, total };
}
// do ponto onde a pessoa está (primeiro ponto do lugar de origem) até o primeiro ponto do lugar de destino
function rotaEntre(de: Lugar, para: Lugar): Trecho {
  const pontos: Ponto[] = [], trav: boolean[] = [];
  const empurra = (p: Ponto, t = false) => { const u = pontos[pontos.length - 1]; if (u && Math.hypot(u[0] - p[0], u[1] - p[1]) < 0.01) return; if (pontos.length) trav.push(t); pontos.push(p); };
  if (de.id === para.id) { empurra(de.pontos[0]); return trecho(pontos, trav); }
  empurra(de.pontos[0]);
  for (const p of [...(de.entrada ?? [])].reverse()) empurra(p);
  empurra(de.ancora);
  if (!DIST) montarDistancias();
  const n = NOS.length, ea = arestaDe(de.ancora), eb = arestaDe(para.ancora);
  const mesmaAresta = (ea.a === eb.a && ea.b === eb.b) || (ea.a === eb.b && ea.b === eb.a);
  if (!mesmaAresta) {
    let melhor = Infinity, ini = ea.a, fim = eb.a;
    for (const a of [ea.a, ea.b]) for (const b of [eb.a, eb.b]) {
      const c = Math.hypot(NOS[a][0] - de.ancora[0], NOS[a][1] - de.ancora[1]) + DIST![a * n + b] + Math.hypot(NOS[b][0] - para.ancora[0], NOS[b][1] - para.ancora[1]);
      if (c < melhor) { melhor = c; ini = a; fim = b; }
    }
    let atual = ini; empurra(NOS[atual]);
    for (let guarda = 0; atual !== fim && guarda < 80; guarda++) { const prox = PROX![atual * n + fim]; if (prox < 0) break; empurra(NOS[prox], ehTravessia(atual, prox)); atual = prox; }
  }
  empurra(para.ancora);
  for (const p of para.entrada ?? []) empurra(p);
  empurra(para.pontos[0]);
  return trecho(pontos, trav);
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
interface Bloco { t0: number; chegada: number; trecho: Trecho; lugar: Lugar; fazendo: string; indo: string; c: Compromisso }
interface Linha { blocos: Bloco[]; vel: number; troca: number }
const linhas = new Map<string, Linha>();
export const velocidadeDe = (m: Morador) => 1.1 + (hash(m.id) % 5) * 0.06;
function linhaDe(m: Morador): Linha {
  const pronta = linhas.get(m.id); if (pronta) return pronta;
  const vel = velocidadeDe(m), ag = [...m.agenda].sort((a, b) => a.h - b.h);
  const blocos = ag.map((c, k) => {
    const de = lugarDe(m, ag[(k - 1 + ag.length) % ag.length].lugar), para = lugarDe(m, c.lugar);
    const tr = rotaEntre(de, para); const t0 = c.h * 3600;
    return { t0, chegada: t0 + tr.total / vel, trecho: tr, lugar: para, fazendo: c.fazendo, indo: para.indo, c };
  });
  const l = { blocos, vel, troca: 150 + (hash(m.id + "t") % 5) * 25 };
  linhas.set(m.id, l); return l;
}

export interface EstadoMorador { x: number; z: number; rot: number; andando: boolean; visivel: boolean; travessia: boolean; fazendo: string; lugar: string; bloco: number }
export const novoEstado = (): EstadoMorador => ({ x: 0, z: 0, rot: 0, andando: false, visivel: true, travessia: false, fazendo: "", lugar: "", bloco: 0 });

// ponto a uma distância d do começo do trecho (escreve em `o`; devolve o índice do pedaço)
function noTrecho(tr: Trecho, d: number, o: EstadoMorador) {
  const n = tr.cum.length;
  if (n === 1 || d <= 0) { o.x = tr.pts[0]; o.z = tr.pts[1]; return 0; }
  let k = 1; while (k < n - 1 && tr.cum[k] < d) k++;
  const a = tr.cum[k - 1], b = tr.cum[k], t = b > a ? Math.min(1, (d - a) / (b - a)) : 1;
  const ax = tr.pts[(k - 1) * 2], az = tr.pts[(k - 1) * 2 + 1], bx = tr.pts[k * 2], bz = tr.pts[k * 2 + 1];
  o.x = ax + (bx - ax) * t; o.z = az + (bz - az) * t; o.rot = Math.atan2(bx - ax, bz - az);
  return k - 1;
}

// Onde o morador está e o que está fazendo, em `seg` segundos do dia (0..86400). Sem alocação: escreve em `o`.
export function estadoMorador(m: Morador, seg: number, o: EstadoMorador = novoEstado()): EstadoMorador {
  const ln = linhaDe(m), bl = ln.blocos;
  let k = bl.length - 1;
  for (let i = 0; i < bl.length; i++) if (bl[i].t0 <= seg) k = i; else break;
  const b = bl[k]; const t0 = b.t0 > seg ? b.t0 - DIA : b.t0; // antes do primeiro compromisso: ainda é o último de ontem
  const passou = seg - t0; const andar = b.chegada - b.t0;
  o.bloco = k; o.lugar = b.lugar.id;
  if (passou < andar && b.trecho.total > 0.01) {
    const p = noTrecho(b.trecho, passou * ln.vel, o);
    o.andando = true; o.visivel = true; o.travessia = b.trecho.trav[p] === 1; o.fazendo = b.indo;
    return o;
  }
  // chegou: fica no lugar, trocando de ponto de tempos em tempos (devagar)
  o.andando = false; o.travessia = false; o.fazendo = b.fazendo; o.visivel = !b.lugar.dentro;
  const pts = b.lugar.pontos; const ficou = passou - andar;
  if (pts.length < 2) { o.x = pts[0][0]; o.z = pts[0][1]; if (b.lugar.olhar != null) o.rot = b.lugar.olhar; return o; }
  const vez = Math.floor(ficou / ln.troca), dentroDaVez = ficou - vez * ln.troca;
  const ponto = (v: number) => (v <= 0 ? 0 : hash(`${m.id}:${k}:${v}`) % pts.length);
  const de = pts[ponto(vez - 1)], para = pts[ponto(vez)];
  const dist = Math.hypot(para[0] - de[0], para[1] - de[1]), lento = 0.8;
  if (vez > 0 && dentroDaVez * lento < dist) {
    const t = (dentroDaVez * lento) / dist; o.x = de[0] + (para[0] - de[0]) * t; o.z = de[1] + (para[1] - de[1]) * t;
    o.rot = Math.atan2(para[0] - de[0], para[1] - de[1]); o.andando = true; return o;
  }
  o.x = para[0]; o.z = para[1]; if (b.lugar.olhar != null) o.rot = b.lugar.olhar;
  return o;
}
// o próximo compromisso (para a conversa: "depois vou almoçar")
export function proximoCompromisso(m: Morador, seg: number) {
  const ln = linhaDe(m); const k = estadoMorador(m, seg).bloco; return ln.blocos[(k + 1) % ln.blocos.length].c;
}

// ---------------- jeito de tratar ----------------
export function tomDaAfinidade(a: number): Tom { return a < -30 ? "desconfiado" : a < 15 ? "neutro" : a < 50 ? "simpatico" : "amigo"; }
export const NOME_TOM: Record<Tom, string> = { desconfiado: "desconfiado", neutro: "conhecido", simpatico: "simpático", amigo: "amigo" };

// Cumprimento curto quando o visitante passa perto de um morador que o conhece (sem IA, sem servidor: da memória).
export interface RelacaoCurta { id: string; chamar: string | null; afinidade: number; plano: string; conversas: number }
export function cumprimentoDePassagem(m: Morador, r: RelacaoCurta, seg: number) {
  const tom = tomDaAfinidade(r.afinidade); const nome = r.chamar ? `, ${r.chamar}` : "";
  const h = seg / 3600; const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const v = hash(`${m.id}:${r.conversas}:${Math.floor(seg / 600)}`) % 3;
  if (tom === "desconfiado") return ["Hm.", "...", `${periodo}.`][v];
  if (tom === "neutro") return [`${periodo}${nome}.`, `Oi${nome}.`, `E aí${nome}?`][v];
  if (tom === "simpatico") return [`${periodo}${nome}!`, `Oi${nome}! Tudo bem?`, `Olha quem passou${nome}!`][v];
  return [r.plano ? `Ô${nome}! E aí, conseguiu ${r.plano}?` : `Ô${nome}! Que bom te ver!`, `${periodo}${nome}! Passa aqui depois!`, `Ei${nome}! Saudade de você!`][v];
}

// lista do modo leve (celular): menos gente na rua
export const moradoresDoAparelho = (leve: boolean) => (leve ? MORADORES.filter((m) => m.celular) : MORADORES);

// Botões da conversa (sem IA ou com IA, é o mesmo caminho): o rótulo do botão e o que o visitante "diz" ao tocar nele
export const ACOES_MORADOR = [
  { id: "cumprimentar", rotulo: "Cumprimentar", fala: "Oi! Tudo bem?" },
  { id: "agora", rotulo: "O que está fazendo?", fala: "O que você está fazendo?" },
  { id: "cidade", rotulo: "Perguntar da cidade", fala: "Me conta da cidade?" },
  { id: "indicacao", rotulo: "Pedir indicação de empresa", fala: "Pode me indicar uma empresa daqui?" },
  { id: "sobre_mim", rotulo: "Contar sobre mim", fala: "Quero te contar um pouco sobre mim." },
  { id: "despedir", rotulo: "Despedir-se", fala: "Tchau, até mais!" },
  { id: "desculpa", rotulo: "Pedir desculpas", fala: "Desculpa pelo que eu disse." },
] as const;
export type AcaoMorador = (typeof ACOES_MORADOR)[number]["id"];
