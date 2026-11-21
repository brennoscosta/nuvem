// Andar livre por dentro dos prédios (17/11/2026, continuação do pedido do dono: "preciso que possa entrar… respeitando
// paredes e portas"). Para cada prédio com escritório (lojas e sedes) monta uma planta navegável em coordenadas LOCAIS:
//  - limites do prédio, paredes (com o vão de cada porta) e os móveis que barram (mesas, balcão, sofás, mesa de reunião…);
//  - zonas: recepção, hall, corredor/café são do público; salas da equipe, do CEO e de reunião são só da equipe;
//  - um A* pequeno (grade de 25 cm) com o corpo do boneco (raio de 25 cm) e retas esticadas sem atravessar nada.
// Sedes: data/plantaSede.ts (as mesmas paredes da cena, paredesDaSede), em coordenadas do lote da sede e giradas para a
// rua da frente dela (19/11/2026: cada sede num lote só; data/sedes.ts › rot).
// Lojas: data/escritorio.ts › plantaCliente (porta da rua em [0, z0], divisória recepção | hall com passagem na frente,
// vidro do CEO com porta, setores com porta), girada como o prédio (frente do lote, giro do dono, lote duplo).
// 20/11/2026 (pedido do dono: "quando a pessoa entre em uma das empresas e seja visitante tenha acesso apenas à
// recepcionista, e daí ela vai ser direcionada para outro setor"): o acesso deixou de ser só dono | visitante.
//  - Acesso false: dono ou sócio, anda por tudo;
//  - Acesso true: visitante, só na recepção (na loja, também a frente do hall, por onde se entra); as catracas fecham;
//  - Acesso { zonas, catracas }: visitante que a recepção encaminhou: ganha só as zonas e as catracas do caminho até a
//    sala do setor (liberarCaminho).
// Tudo aqui é função pura (sem three.js, sem React): testável com tsx.
import { LOTE_POR_CHAVE } from "./mundo";
import { poseConferida } from "./posicaoPredio"; // centro e giro do prédio no lote (21/11/2026, modo "Editar posição")
import { PREDIO_CLIENTE, plantaCliente, catracasCliente, Z_CATRACA_CLIENTE, DECORACAO_DISCRETA, type Escritorio } from "./escritorio";
import { sedeDe } from "./sedes";
import { montarSalas, paredesDaSede, lugaresDaSala, catracasDaSede, cx, X0 as SX0, X1 as SX1, Z0 as SZ0, Z1 as SZ1, ZC, CORREDOR, ESP_PAREDE, MESA_COMPACTA, MOVEIS_SEDE, type Catraca } from "./plantaSede";
import type { Ponto } from "./caminhos";

type Ret = { x0: number; z0: number; x1: number; z1: number };
// publica: não é sala da equipe (o aviso "Área só da equipe"); visitante: o visitante fica nela sem ser encaminhado;
// reservada: sala do CEO e de reunião, que nunca servem de passagem para outro setor
export interface Zona extends Ret { id: string; nome: string; publica: boolean; visitante: boolean; reservada: boolean }
export interface PlantaInterna {
  chave: string; nome: string;
  limites: Ret; // por dentro (local)
  bloqueios: Ret[]; // paredes e móveis (local, sem a folga do corpo)
  zonas: Zona[];
  catracas: Catraca[]; // data/plantaSede.ts › Catraca (local)
  portaDentro: Ponto; // logo depois da porta da rua, por dentro (local)
  centro: Ponto; rot: number; // local → mundo: gira por rot e soma centro (como <group rotation={[0, rot, 0]}>)
}
export interface AcessoLiberado { zonas: string[]; catracas: string[] }
export type Acesso = boolean | AcessoLiberado;

const CORPO = 0.25; // raio do boneco
const CEL = 0.25;

// ---------- local ↔ mundo ----------
export const paraMundo = (pl: Pick<PlantaInterna, "centro" | "rot">, x: number, z: number): Ponto => [pl.centro[0] + x * Math.cos(pl.rot) + z * Math.sin(pl.rot), pl.centro[1] - x * Math.sin(pl.rot) + z * Math.cos(pl.rot)];
export const paraLocal = (pl: Pick<PlantaInterna, "centro" | "rot">, x: number, z: number): Ponto => { const dx = x - pl.centro[0], dz = z - pl.centro[1]; return [dx * Math.cos(pl.rot) - dz * Math.sin(pl.rot), dx * Math.sin(pl.rot) + dz * Math.cos(pl.rot)]; };

const caixa = (x: number, z: number, w: number, d: number): Ret => ({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
const dentroDe = (r: Ret, x: number, z: number, folga = 0) => x >= r.x0 - folga && x <= r.x1 + folga && z >= r.z0 - folga && z <= r.z1 + folga;

// ---------- catracas ----------
// o que barra todo mundo: o vidro dos lados e os dois postes do portão (por fora dele, para o vão continuar com 1,1 m)
function bloqueiosDaCatraca(c: Catraca): Ret[] {
  const out: Ret[] = [{ x0: c.g0 - 0.16, x1: c.g0, z0: c.z - 0.15, z1: c.z + 0.15 }, { x0: c.g1, x1: c.g1 + 0.16, z0: c.z - 0.15, z1: c.z + 0.15 }];
  if (c.g0 - c.x0 > 0.02) out.push({ x0: c.x0, x1: c.g0, z0: c.z - 0.04, z1: c.z + 0.04 });
  if (c.x1 - c.g1 > 0.02) out.push({ x0: c.g1, x1: c.x1, z0: c.z - 0.04, z1: c.z + 0.04 });
  return out;
}
// o portão fechado: barra quem não tem a catraca liberada
const portaoDe = (c: Catraca): Ret => ({ x0: c.g0, x1: c.g1, z0: c.z - 0.05, z1: c.z + 0.05 });
const liberada = (c: Catraca, a: Acesso) => a === false || (a !== true && a.catracas.includes(c.id));
const podeZona = (z: Zona, a: Acesso) => a === false || z.visitante || (a !== true && a.zonas.includes(z.id));

// ---------- sedes ----------
function plantaDaSede(chave: string, nome: string, e: Escritorio): PlantaInterna | null {
  const sd = sedeDe(chave); if (!sd) return null;
  const salas = montarSalas(e.setores);
  const bloqueios: Ret[] = paredesDaSede(salas).map((p) => caixa(p.x, p.z, p.w, p.d));
  // mesas de cada departamento (mesma conta da cena: lugaresDaSala)
  const porSala: Record<string, number> = {};
  for (const m of e.equipe) { const s = m.setorId ?? (m.papel === "ceo" ? "diretoria" : "recepcao"); porSala[s] = (porSala[s] ?? 0) + 1; }
  const M = MESA_COMPACTA;
  for (const s of salas) if (s.tipo === "depto") for (const l of lugaresDaSala(s, porSala[s.id] ?? 0)) bloqueios.push(caixa(l.mesa[0], l.mesa[2], l.chefe ? M.chefe[0] : M.comum[0], l.chefe ? M.chefe[1] : M.comum[1]));
  // recepção, sala de reunião e hall com café (os mesmos lugares da cena: plantaSede › MOVEIS_SEDE)
  for (const m of Object.values(MOVEIS_SEDE)) bloqueios.push(caixa(m.x, m.z, m.w, m.d));
  const catracas = catracasDaSede(salas);
  for (const c of catracas) bloqueios.push(...bloqueiosDaCatraca(c));
  const rec = salas.find((s) => s.tipo === "recepcao");
  const ceo = e.equipe.find((m) => m.papel === "ceo"), salaCeo = ceo ? ceo.setorId ?? "diretoria" : null;
  // recepção e hall são do público; salas da equipe e reunião, só da equipe. O visitante fica só na recepção
  const zonas: Zona[] = salas.map((s) => ({ id: s.id, nome: s.nome, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, publica: s.tipo === "recepcao" || s.tipo === "hall", visitante: s.tipo === "recepcao", reservada: s.tipo === "reuniao" || s.id === salaCeo }));
  zonas.push({ id: "corredor", nome: "Corredor", x0: SX0, x1: SX1, z0: ZC - CORREDOR / 2, z1: ZC + CORREDOR / 2, publica: true, visitante: false, reservada: false });
  return {
    chave, nome, limites: { x0: SX0, z0: SZ0, x1: SX1, z1: SZ1 }, bloqueios, zonas, catracas,
    portaDentro: rec ? [cx(rec), SZ1 - 0.6] : [(SX0 + SX1) / 2, SZ1 - 0.6], centro: [sd.x, sd.z], rot: sd.rot,
  };
}

// ---------- lojas ----------
const parede = (a: Ponto, b: Ponto): Ret => ({ x0: Math.min(a[0], b[0]) - ESP_PAREDE / 2, z0: Math.min(a[1], b[1]) - ESP_PAREDE / 2, x1: Math.max(a[0], b[0]) + ESP_PAREDE / 2, z1: Math.max(a[1], b[1]) + ESP_PAREDE / 2 });
// parede com um vão no meio (como ParedeComPorta em scene/EscritorioCliente.tsx)
function paredeComPorta(a: Ponto, b: Ponto, vao: number): Ret[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len <= vao + 0.4) return [parede(a, b)];
  const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, k = (len - vao) / 2;
  return [parede(a, [a[0] + ux * k, a[1] + uz * k]), parede([b[0] - ux * k, b[1] - uz * k], b)];
}
function plantaDaLoja(chave: string, nome: string, e: Escritorio, anexo: string | null): PlantaInterna | null {
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const pc = poseConferida({ chave, status: "ativo", escritorio: e }, anexo); if (!pc) return null;
  const centro: Ponto = pc.pose.centro, rot = pc.pose.rot;
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = PREDIO_CLIENTE;
  const pl = plantaCliente(e);
  const zMeio = pl.salas[0].z1;
  const b: Ret[] = [];
  b.push(...paredeComPorta([X0, Z0], [X1, Z0], 2.2), parede([X0, Z1], [X1, Z1]), parede([X0, Z0], [X0, Z1]), parede([X1, Z0], [X1, Z1]));
  b.push(parede([-2.2, Z0 + 1.5], [-2.2, zMeio])); // recepção | hall, com a passagem na frente
  b.push(...paredeComPorta([2.2, Z0], [2.2, zMeio], 1.2)); // vidro do CEO, com porta
  for (const s of pl.salas.filter((x) => x.tipo === "setor")) {
    b.push(...paredeComPorta([s.x0, s.z0], [s.x1, s.z0], 1.6));
    if (s.x0 !== X0) b.push(...paredeComPorta([s.x0, s.z0], [s.x0, s.z1], 1.2));
  }
  b.push(caixa(pl.balcao[0], pl.balcao[1], 3.1, 0.8)); // balcão
  b.push(caixa(X0 + 1.0, -2.6, 0.9, 1.8), caixa(X0 + 2.2, -2.6, 0.8, 0.6)); // sofá e mesinha
  b.push(caixa(-1.85, zMeio - 0.85, 0.65, 1.7)); // café do hall, no canto oeste (scene/EscritorioCliente.tsx)
  // decoração escolhida pelo dono (só o que fica no meio do chão; o resto encosta nas paredes)
  const tem = new Set(e.decor?.interior?.decoracao ?? DECORACAO_DISCRETA);
  if (tem.has("cafe")) b.push(caixa(-1.2, -3.4, 0.8, 0.8), caixa(1.75, -2.0, 0.5, 0.5)); // mesa alta e bebedouro
  if (tem.has("salaDeEspera")) b.push(caixa(-4.5, -2.6, 0.8, 0.8)); // poltrona
  if (tem.has("logoNaParede")) b.push(caixa(1.35, -5.4, 1.0, 0.3)); // painel com a logo
  for (const s of pl.salas) for (const m of s.mesas) { const g = m.tipo !== "comum"; b.push(caixa(m.pos[0], m.pos[2], g ? 1.9 : 1.5, g ? 0.9 : 0.75)); }
  const catracas = catracasCliente(pl);
  for (const c of catracas) b.push(...bloqueiosDaCatraca(c));
  // o hall se divide na catraca: a frente (por onde se entra da rua até a recepção) é do visitante; o fundo, não
  const zonas: Zona[] = pl.salas.flatMap((s): Zona[] => s.tipo === "hall"
    ? [{ id: "_entrada", nome: "Entrada", x0: s.x0, x1: s.x1, z0: s.z0, z1: Z_CATRACA_CLIENTE, publica: true, visitante: true, reservada: false },
       { id: s.id, nome: s.nome, x0: s.x0, x1: s.x1, z0: Z_CATRACA_CLIENTE, z1: s.z1, publica: true, visitante: false, reservada: false }]
    : [{ id: s.id, nome: s.nome, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, publica: s.tipo === "recepcao", visitante: s.tipo === "recepcao", reservada: s.tipo === "ceo" }]);
  return { chave, nome, limites: { x0: X0, z0: Z0, x1: X1, z1: Z1 }, bloqueios: b, zonas, catracas, portaDentro: [0, Z0 + 0.6], centro, rot };
}

interface TerrenoPlanta { chave: string; empresaNome: string; status: string; escritorio: Escritorio | null; anexoDe?: string | null }
export function plantaInterna(t: TerrenoPlanta | null | undefined, anexo: string | null = null): PlantaInterna | null {
  if (!t || t.status !== "ativo" || !t.escritorio || t.anexoDe) return null;
  return sedeDe(t.chave) ? plantaDaSede(t.chave, t.empresaNome, t.escritorio) : plantaDaLoja(t.chave, t.empresaNome, t.escritorio, anexo);
}
// a planta do prédio `chave` a partir da lista de terrenos do mapa (acha a ampliação do lote duplo sozinha)
const cachePlanta = new WeakMap<object, { anexo: string | null; pl: PlantaInterna | null }>();
export function plantaPorChave(chave: string, terrenos: Record<string, TerrenoPlanta>): PlantaInterna | null {
  const t = terrenos[chave]; if (!t?.escritorio) return null;
  const anexo = Object.values(terrenos).find((x) => x.anexoDe === chave && x.status === "ativo")?.chave ?? null;
  const c = cachePlanta.get(t.escritorio);
  if (c && c.anexo === anexo) return c.pl;
  const pl = plantaInterna(t, anexo);
  cachePlanta.set(t.escritorio, { anexo, pl });
  return pl;
}

// ---------- o que é livre por dentro ----------
export const zonaEm = (pl: PlantaInterna, lx: number, lz: number) => pl.zonas.find((z) => dentroDe(z, lx, lz)) ?? null;
export const zonaNoMundo = (pl: PlantaInterna, x: number, z: number) => { const [lx, lz] = paraLocal(pl, x, z); return zonaEm(pl, lx, lz); };
// ponto LOCAL livre para o corpo: dentro dos limites, longe das paredes e móveis e, para o visitante, numa zona que ele
// pode usar e fora do portão de uma catraca fechada para ele
export function livreLocal(pl: PlantaInterna, lx: number, lz: number, acesso: Acesso) {
  const L = pl.limites;
  if (lx < L.x0 + CORPO || lx > L.x1 - CORPO || lz < L.z0 + CORPO || lz > L.z1 - CORPO) return false;
  for (const r of pl.bloqueios) if (dentroDe(r, lx, lz, CORPO)) return false;
  if (acesso !== false) {
    const z = zonaEm(pl, lx, lz); if (!z || !podeZona(z, acesso)) return false;
    for (const c of pl.catracas) if (!liberada(c, acesso) && dentroDe(portaoDe(c), lx, lz, CORPO)) return false;
  }
  return true;
}
// ponto do MUNDO dentro do prédio? (limites, sem olhar paredes)
export function dentroDoPredio(pl: PlantaInterna, x: number, z: number) { const [lx, lz] = paraLocal(pl, x, z); return dentroDe(pl.limites, lx, lz); }
export function livreDentro(pl: PlantaInterna, x: number, z: number, acesso: Acesso) { const [lx, lz] = paraLocal(pl, x, z); return livreLocal(pl, lx, lz, acesso); }
// zona do público? (para avisar "Área só da equipe" quando o visitante toca numa sala da equipe)
export function areaDaEquipe(pl: PlantaInterna, x: number, z: number) { const zn = zonaNoMundo(pl, x, z); return !!zn && !zn.publica; }
// o visitante pode ir até este ponto (MUNDO)? Só a zona: paredes e catracas ficam com o caminho
export function podeEntrarEm(pl: PlantaInterna, x: number, z: number, acesso: Acesso) { if (acesso === false) return true; const zn = zonaNoMundo(pl, x, z); return !!zn && podeZona(zn, acesso); }

const retaLocal = (pl: PlantaInterna, a: Ponto, b: Ponto, acesso: Acesso) => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.1));
  for (let k = 1; k <= n; k++) { const t = k / n; if (!livreLocal(pl, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, acesso)) return false; }
  return true;
};

// grade de livres (25 cm), montada uma vez por planta e por acesso
const chaveAcesso = (a: Acesso) => (a === false ? "e" : a === true ? "p" : `p|${[...a.zonas].sort().join(",")}|${[...a.catracas].sort().join(",")}`);
const cacheGrade = new WeakMap<PlantaInterna, Map<string, Uint8Array>>();
function grade(pl: PlantaInterna, acesso: Acesso, nx: number, nz: number) {
  let c = cacheGrade.get(pl); if (!c) { c = new Map(); cacheGrade.set(pl, c); }
  const k = chaveAcesso(acesso), ja = c.get(k);
  if (ja) return ja;
  const L = pl.limites, g = new Uint8Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) g[iz * nx + ix] = livreLocal(pl, L.x0 + ix * CEL, L.z0 + iz * CEL, acesso) ? 1 : 0;
  if (c.size > 24) c.clear(); // cada encaminhamento cria um acesso; não guarda grade sem fim
  c.set(k, g); return g;
}
// A* na grade de 25 cm da planta (8 vizinhos sem cortar quina) e retas esticadas
function aEstrela(pl: PlantaInterna, de: Ponto, para: Ponto, acesso: Acesso): Ponto[] | null {
  const L = pl.limites, nx = Math.ceil((L.x1 - L.x0) / CEL) + 1, nz = Math.ceil((L.z1 - L.z0) / CEL) + 1, tot = nx * nz;
  const livreG = grade(pl, acesso, nx, nz);
  const cel = (p: Ponto) => { // célula livre mais perto do ponto
    const cx0 = Math.round((p[0] - L.x0) / CEL), cz0 = Math.round((p[1] - L.z0) / CEL);
    let melhor = -1, dm = Infinity;
    for (let r = 0; r <= 6 && melhor < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const ix = cx0 + dx, iz = cz0 + dz; if (ix < 0 || iz < 0 || ix >= nx || iz >= nz || !livreG[iz * nx + ix]) continue;
      const d = Math.hypot(L.x0 + ix * CEL - p[0], L.z0 + iz * CEL - p[1]); if (d < dm) { dm = d; melhor = iz * nx + ix; }
    }
    return melhor;
  };
  const a = cel(de), b = cel(para); if (a < 0 || b < 0) return null;
  const custo = new Float32Array(tot).fill(Infinity), veio = new Int32Array(tot).fill(-1), fechado = new Uint8Array(tot);
  const bx = b % nx, bz = Math.floor(b / nx);
  const h = (i: number) => { const dx = Math.abs((i % nx) - bx), dz = Math.abs(Math.floor(i / nx) - bz); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const heap: [number, number][] = [];
  const push = (i: number, p: number) => { heap.push([p, i]); let k = heap.length - 1; while (k > 0) { const pai = (k - 1) >> 1; if (heap[pai][0] <= heap[k][0]) break; [heap[pai], heap[k]] = [heap[k], heap[pai]]; k = pai; } };
  const pop = () => { const topo = heap[0], ult = heap.pop()!; if (heap.length) { heap[0] = ult; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return topo[1]; };
  custo[a] = 0; push(a, h(a));
  const VIZ: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let achou = false;
  while (heap.length) {
    const i = pop(); if (fechado[i]) continue; fechado[i] = 1;
    if (i === b) { achou = true; break; }
    const ix = i % nx, iz = Math.floor(i / nx);
    for (const [dx, dz, c] of VIZ) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const j = jz * nx + jx; if (!livreG[j] || fechado[j]) continue;
      if (dx && dz && (!livreG[iz * nx + jx] || !livreG[jz * nx + ix])) continue;
      const nc = custo[i] + c; if (nc < custo[j]) { custo[j] = nc; veio[j] = i; push(j, nc + h(j)); }
    }
  }
  if (!achou) return null;
  const cels: number[] = []; for (let k = b; k >= 0; k = veio[k]) cels.push(k); cels.reverse();
  const ponto = (i: number): Ponto => [L.x0 + (i % nx) * CEL, L.z0 + Math.floor(i / nx) * CEL];
  // só as quinas (onde a direção muda), depois esticadas em retas livres
  const quinas = cels.filter((c, k) => k === 0 || k === cels.length - 1 || c - cels[k - 1] !== cels[k + 1] - c).map(ponto);
  const fim = livreLocal(pl, para[0], para[1], acesso) ? para : quinas[quinas.length - 1];
  const pts: Ponto[] = [livreLocal(pl, de[0], de[1], acesso) ? de : quinas[0], ...quinas, fim];
  const out: Ponto[] = []; let k = 0;
  while (k < pts.length - 1) { let m = pts.length - 1; while (m > k + 1 && !retaLocal(pl, pts[k], pts[m], acesso)) m--; out.push(pts[m]); k = m; }
  return out;
}

// O ponto da sala `sala` mais perto de `para` (LOCAL) que dá para alcançar a partir de `de` com este acesso: busca em
// largura na grade. Serve quando a frente da mesa fica atrás de outras mesas (nas salas compactas da sede o corredorzinho
// entre as mesas, de 60 cm, é estreito demais para a grade de 25 cm com o corpo de 25 cm de raio).
function pontoAlcancavel(pl: PlantaInterna, de: Ponto, para: Ponto, sala: string, acesso: Acesso): Ponto | null {
  const L = pl.limites, nx = Math.ceil((L.x1 - L.x0) / CEL) + 1, nz = Math.ceil((L.z1 - L.z0) / CEL) + 1;
  const g = grade(pl, acesso, nx, nz);
  const ix0 = Math.round((de[0] - L.x0) / CEL), iz0 = Math.round((de[1] - L.z0) / CEL);
  let ini = -1, dm = Infinity;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const ix = ix0 + dx, iz = iz0 + dz; if (ix < 0 || iz < 0 || ix >= nx || iz >= nz || !g[iz * nx + ix]) continue;
    const d = Math.hypot(dx, dz); if (d < dm) { dm = d; ini = iz * nx + ix; }
  }
  if (ini < 0) return null;
  const visto = new Uint8Array(nx * nz), fila = [ini]; visto[ini] = 1;
  let melhor: Ponto | null = null, dMelhor = Infinity;
  for (let k = 0; k < fila.length; k++) {
    const i = fila[k], ix = i % nx, iz = Math.floor(i / nx), x = L.x0 + ix * CEL, z = L.z0 + iz * CEL;
    if (zonaEm(pl, x, z)?.id === sala) { const d = Math.hypot(x - para[0], z - para[1]); if (d < dMelhor) { dMelhor = d; melhor = [x, z]; } }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const j = jz * nx + jx; if (visto[j] || !g[j]) continue;
      if (dx && dz && (!g[iz * nx + jx] || !g[jz * nx + ix])) continue;
      visto[j] = 1; fila.push(j);
    }
  }
  return melhor;
}

// Caminho por dentro de `de` até `para` (MUNDO). Devolve os pontos a seguir (o último é o destino ou o ponto livre mais
// perto dele); null = sem passagem (sala fechada, só da equipe ou depois da catraca para o visitante).
export function rotaDentro(pl: PlantaInterna, de: Ponto, para: Ponto, acesso: Acesso): Ponto[] | null {
  const a = paraLocal(pl, de[0], de[1]), b = paraLocal(pl, para[0], para[1]);
  const loc = retaLocal(pl, a, b, acesso) && livreLocal(pl, b[0], b[1], acesso) ? [b] : aEstrela(pl, a, b, acesso);
  return loc ? loc.map((p) => paraMundo(pl, p[0], p[1])) : null;
}
// teclado/joystick por dentro: anda o que der; se bater, escorrega ao longo da parede
export function caminharDentro(pl: PlantaInterna, x: number, z: number, dx: number, dz: number, acesso: Acesso): Ponto {
  const a = paraLocal(pl, x, z);
  // o passo inteiro precisa ser livre (o teclado manda 2,6 m à frente: pularia uma parede fina); se não der, encurta
  for (const k of [1, 0.6, 0.35, 0.15]) for (const [ex, ez] of [[dx, dz], [dx, 0], [0, dz]]) {
    if (!ex && !ez) continue;
    const b = paraLocal(pl, x + ex * k, z + ez * k);
    if (retaLocal(pl, a, b, acesso)) return [x + ex * k, z + ez * k];
  }
  return [x, z];
}
// porta por dentro (MUNDO): onde o caminho interno começa ao entrar e termina ao sair
export const portaDentroMundo = (pl: PlantaInterna): Ponto => paraMundo(pl, pl.portaDentro[0], pl.portaDentro[1]);

// ---------- encaminhamento pela recepção (20/11/2026) ----------
// Libera o caminho de `de` até `para` (MUNDO), na sala `sala`: tenta primeiro só a sala com o hall e o corredor; se não
// houver passagem (na loja, o setor do fundo só abre por outro setor), qualquer sala que não seja a do CEO ou a de
// reunião; por último, tudo. No fim fica liberado só o que o caminho usa: as zonas por onde passa e as catracas que cruza.
export function liberarCaminho(pl: PlantaInterna, de: Ponto, para: Ponto, sala: string): { acesso: AcessoLiberado; rota: Ponto[] } | null {
  const todas = pl.catracas.map((c) => c.id);
  const naoDoVisitante = pl.zonas.filter((z) => !z.visitante);
  const tentativas = [naoDoVisitante.filter((z) => z.publica), naoDoVisitante.filter((z) => !z.reservada), naoDoVisitante];
  for (const zs of tentativas) {
    const teste: AcessoLiberado = { zonas: [...new Set([sala, ...zs.map((z) => z.id)])], catracas: todas };
    // até o ponto pedido ou, se ele estiver fechado por móveis, até o ponto da sala mais perto dele que dá para alcançar
    let r = rotaDentro(pl, de, para, teste);
    const fimOk = (rr: Ponto[] | null) => !!rr && rr.length > 0 && zonaNoMundo(pl, rr[rr.length - 1][0], rr[rr.length - 1][1])?.id === sala;
    if (!fimOk(r)) {
      const alt = pontoAlcancavel(pl, paraLocal(pl, de[0], de[1]), paraLocal(pl, para[0], para[1]), sala, teste);
      r = alt ? rotaDentro(pl, de, paraMundo(pl, alt[0], alt[1]), teste) : null;
    }
    if (!r || !r.length) continue;
    const alvo = r[r.length - 1];
    const zonas = new Set<string>([sala]), catracas = new Set<string>();
    let a = paraLocal(pl, de[0], de[1]);
    for (const pm of r) {
      const b = paraLocal(pl, pm[0], pm[1]), n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * (k / n), z = a[1] + (b[1] - a[1]) * (k / n);
        const zn = zonaEm(pl, x, z); if (zn && !zn.visitante) zonas.add(zn.id);
        for (const c of pl.catracas) if (dentroDe(portaoDe(c), x, z, CORPO)) catracas.add(c.id);
      }
      a = b;
    }
    const acesso: AcessoLiberado = { zonas: [...zonas], catracas: [...catracas] };
    return { acesso, rota: rotaDentro(pl, de, alvo, acesso) ?? r };
  }
  return null;
}
// onde a pessoa da equipe trabalha (LOCAL): a cadeira, para onde ela olha e a sala. As contas são as da cena:
// sede › scene/OneStateInterior.tsx (lugaresDaSala, o chefe primeiro); loja › data/escritorio.ts › plantaCliente
export function lugarDoMembro(e: Escritorio, membroId: string, sede: boolean): { pos: Ponto; rot: number; sala: string } | null {
  const m = e.equipe.find((x) => x.id === membroId); if (!m) return null;
  if (!sede) { const l = plantaCliente(e).lugares[membroId]; return l ? { pos: [l.pos[0], l.pos[2]], rot: l.rot, sala: l.sala } : null; }
  const salaDe = (x: typeof m) => x.setorId ?? (x.papel === "ceo" ? "diretoria" : "recepcao");
  const s = montarSalas(e.setores).find((x) => x.id === salaDe(m) && x.tipo === "depto"); if (!s) return null;
  const chefe = (x: typeof m) => Number(x.nivel === "ceo" || x.nivel === "gerente");
  const membros = e.equipe.filter((x) => salaDe(x) === s.id).sort((a, b) => chefe(b) - chefe(a));
  const l = lugaresDaSala(s, membros.length)[membros.findIndex((x) => x.id === membroId)];
  return l ? { pos: [l.pos[0], l.pos[2]], rot: 0, sala: s.id } : null;
}
// onde o visitante para para ser atendido (MUNDO): do outro lado da mesa, de frente para a pessoa; se ali não couber,
// atrás da cadeira ou ao lado dela, sempre dentro da mesma sala
export function pontoDeAtendimento(pl: PlantaInterna, e: Escritorio, membroId: string): { ponto: Ponto; agente: Ponto; sala: string } | null {
  const l = lugarDoMembro(e, membroId, !!sedeDe(pl.chave)); if (!l) return null;
  const fx = Math.sin(l.rot), fz = Math.cos(l.rot), [px, pz] = l.pos;
  const opcoes: Ponto[] = [[px + fx * 1.4, pz + fz * 1.4], [px - fx * 0.7, pz - fz * 0.7], [px + fz * 0.8, pz - fx * 0.8], [px - fz * 0.8, pz + fx * 0.8]];
  const ok = opcoes.find((c) => livreLocal(pl, c[0], c[1], false) && zonaEm(pl, c[0], c[1])?.id === l.sala) ?? opcoes[0];
  return { ponto: paraMundo(pl, ok[0], ok[1]), agente: paraMundo(pl, px, pz), sala: l.sala };
}
