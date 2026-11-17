// Andar livre por dentro dos prédios (17/11/2026, continuação do pedido do dono: "preciso que possa entrar… respeitando
// paredes e portas"). Para cada prédio com escritório (lojas e sedes) monta uma planta navegável em coordenadas LOCAIS:
//  - limites do prédio, paredes (com o vão de cada porta) e os móveis que barram (mesas, balcão, sofás, mesa de reunião…);
//  - zonas: recepção, hall, corredor/café são do público; salas da equipe, do CEO e de reunião são só da equipe;
//  - um A* pequeno (grade de 25 cm) com o corpo do boneco (raio de 25 cm) e retas esticadas sem atravessar nada.
// Sedes: data/plantaSede.ts (as mesmas paredes da cena, paredesDaSede), deslocadas para o quarteirão de cada sede.
// Lojas: data/escritorio.ts › plantaCliente (porta da rua em [0, z0], divisória recepção | hall com passagem na frente,
// vidro do CEO com porta, setores com porta), girada como o prédio (frente do lote, giro do dono, lote duplo).
// Tudo aqui é função pura (sem three.js, sem React): testável com tsx.
import { LOTE_POR_CHAVE, frenteDoLote } from "./mundo";
import { PREDIO_CLIENTE, plantaCliente, DECORACAO_DISCRETA, type Escritorio } from "./escritorio";
import { sedeDe, deslocamento } from "./sedes";
import { montarSalas, paredesDaSede, lugaresDaSala, cx, X0 as SX0, X1 as SX1, Z0 as SZ0, Z1 as SZ1, ZC, CORREDOR, ESP_PAREDE } from "./plantaSede";
import type { Ponto } from "./caminhos";

type Ret = { x0: number; z0: number; x1: number; z1: number };
export interface Zona extends Ret { id: string; nome: string; publica: boolean }
export interface PlantaInterna {
  chave: string; nome: string;
  limites: Ret; // por dentro (local)
  bloqueios: Ret[]; // paredes e móveis (local, sem a folga do corpo)
  zonas: Zona[];
  portaDentro: Ponto; // logo depois da porta da rua, por dentro (local)
  centro: Ponto; rot: number; // local → mundo: gira por rot e soma centro (como <group rotation={[0, rot, 0]}>)
}

const CORPO = 0.25; // raio do boneco
const CEL = 0.25;

// ---------- local ↔ mundo ----------
export const paraMundo = (pl: Pick<PlantaInterna, "centro" | "rot">, x: number, z: number): Ponto => [pl.centro[0] + x * Math.cos(pl.rot) + z * Math.sin(pl.rot), pl.centro[1] - x * Math.sin(pl.rot) + z * Math.cos(pl.rot)];
export const paraLocal = (pl: Pick<PlantaInterna, "centro" | "rot">, x: number, z: number): Ponto => { const dx = x - pl.centro[0], dz = z - pl.centro[1]; return [dx * Math.cos(pl.rot) - dz * Math.sin(pl.rot), dx * Math.sin(pl.rot) + dz * Math.cos(pl.rot)]; };

const caixa = (x: number, z: number, w: number, d: number): Ret => ({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
const dentroDe = (r: Ret, x: number, z: number, folga = 0) => x >= r.x0 - folga && x <= r.x1 + folga && z >= r.z0 - folga && z <= r.z1 + folga;

// ---------- sedes ----------
function plantaDaSede(chave: string, nome: string, e: Escritorio): PlantaInterna | null {
  const sd = sedeDe(chave); if (!sd) return null;
  const salas = montarSalas(e.setores);
  const bloqueios: Ret[] = paredesDaSede(salas).map((p) => caixa(p.x, p.z, p.w, p.d));
  // mesas de cada departamento (mesma conta da cena: lugaresDaSala)
  const porSala: Record<string, number> = {};
  for (const m of e.equipe) { const s = m.setorId ?? (m.papel === "ceo" ? "diretoria" : "recepcao"); porSala[s] = (porSala[s] ?? 0) + 1; }
  for (const s of salas) if (s.tipo === "depto") for (const l of lugaresDaSala(s, porSala[s.id] ?? 0)) bloqueios.push(caixa(l.mesa[0], l.mesa[2], l.chefe ? 1.9 : 1.5, l.chefe ? 0.9 : 0.75));
  const rec = salas.find((s) => s.tipo === "recepcao"), reuniao = salas.find((s) => s.tipo === "reuniao");
  if (rec) {
    bloqueios.push(caixa(cx(rec), rec.z1 - 4.2, 3.1, 0.8)); // balcão
    bloqueios.push(caixa(rec.x0 + 0.8, rec.z1 - 2, 0.9, 2.0)); // sofá
    bloqueios.push(caixa(cx(rec) + 1.75, rec.z1 - 2.05, 0.8, 1.9)); // poltronas
    bloqueios.push(caixa(cx(rec) - 1.65, rec.z1 - 6.3, 2.0, 0.35), caixa(cx(rec) + 1.6, rec.z1 - 6.3, 0.7, 0.7)); // painel da logo e ficus
  }
  if (reuniao) bloqueios.push(caixa(cx(reuniao), (reuniao.z0 + reuniao.z1) / 2 + 0.6, 3.6, 7.0)); // mesa comprida e cadeiras
  bloqueios.push(caixa(SX0 + 1.2, ZC, 0.65, 1.7)); // café
  bloqueios.push(caixa(SX0 + 2.1, ZC + 1.05, 0.8, 0.8)); // mesa alta
  const zonas: Zona[] = salas.map((s) => ({ id: s.id, nome: s.nome, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, publica: s.tipo === "recepcao" }));
  zonas.push({ id: "corredor", nome: "Corredor e café", x0: SX0, x1: SX1, z0: ZC - CORREDOR / 2, z1: ZC + CORREDOR / 2, publica: true });
  const [dx, dz] = deslocamento(sd);
  return {
    chave, nome, limites: { x0: SX0, z0: SZ0, x1: SX1, z1: SZ1 }, bloqueios, zonas,
    portaDentro: rec ? [cx(rec), SZ1 - 0.6] : [(SX0 + SX1) / 2, SZ1 - 0.6], centro: [dx, dz], rot: 0,
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
  const la = anexo ? LOTE_POR_CHAVE[anexo] : null;
  const centro: Ponto = [l.centro[0] + (la ? (la.centro[0] - l.centro[0]) / 2 : 0), l.centro[1]];
  const giro = e.decor?.giro ?? 0, giroEf = la ? giro - (giro % 2) : giro;
  const rot = frenteDoLote(l.k) + Math.PI + giroEf * (Math.PI / 2);
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
  const zonas: Zona[] = pl.salas.map((s) => ({ id: s.id, nome: s.nome, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, publica: s.tipo === "recepcao" || s.tipo === "hall" }));
  return { chave, nome, limites: { x0: X0, z0: Z0, x1: X1, z1: Z1 }, bloqueios: b, zonas, portaDentro: [0, Z0 + 0.6], centro, rot };
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
// ponto LOCAL livre para o corpo: dentro dos limites, longe das paredes e móveis e (visitante) numa zona do público
export function livreLocal(pl: PlantaInterna, lx: number, lz: number, publico: boolean) {
  const L = pl.limites;
  if (lx < L.x0 + CORPO || lx > L.x1 - CORPO || lz < L.z0 + CORPO || lz > L.z1 - CORPO) return false;
  for (const r of pl.bloqueios) if (dentroDe(r, lx, lz, CORPO)) return false;
  if (publico) { const z = zonaEm(pl, lx, lz); if (!z || !z.publica) return false; }
  return true;
}
// ponto do MUNDO dentro do prédio? (limites, sem olhar paredes)
export function dentroDoPredio(pl: PlantaInterna, x: number, z: number) { const [lx, lz] = paraLocal(pl, x, z); return dentroDe(pl.limites, lx, lz); }
export function livreDentro(pl: PlantaInterna, x: number, z: number, publico: boolean) { const [lx, lz] = paraLocal(pl, x, z); return livreLocal(pl, lx, lz, publico); }
// zona do público? (para avisar "Área só da equipe" quando o visitante toca numa sala da equipe)
export function areaDaEquipe(pl: PlantaInterna, x: number, z: number) { const [lx, lz] = paraLocal(pl, x, z); const zn = zonaEm(pl, lx, lz); return !!zn && !zn.publica; }

const retaLocal = (pl: PlantaInterna, a: Ponto, b: Ponto, publico: boolean) => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.1));
  for (let k = 1; k <= n; k++) { const t = k / n; if (!livreLocal(pl, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, publico)) return false; }
  return true;
};

// grade de livres (25 cm), montada uma vez por planta e por público
const cacheGrade = new WeakMap<PlantaInterna, Partial<Record<"p" | "e", Uint8Array>>>();
function grade(pl: PlantaInterna, publico: boolean, nx: number, nz: number) {
  const c = cacheGrade.get(pl) ?? {}; const k = publico ? "p" : "e";
  if (c[k]) return c[k]!;
  const L = pl.limites, g = new Uint8Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) g[iz * nx + ix] = livreLocal(pl, L.x0 + ix * CEL, L.z0 + iz * CEL, publico) ? 1 : 0;
  c[k] = g; cacheGrade.set(pl, c); return g;
}
// A* na grade de 25 cm da planta (8 vizinhos sem cortar quina) e retas esticadas
function aEstrela(pl: PlantaInterna, de: Ponto, para: Ponto, publico: boolean): Ponto[] | null {
  const L = pl.limites, nx = Math.ceil((L.x1 - L.x0) / CEL) + 1, nz = Math.ceil((L.z1 - L.z0) / CEL) + 1, tot = nx * nz;
  const livreG = grade(pl, publico, nx, nz);
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
  const fim = livreLocal(pl, para[0], para[1], publico) ? para : quinas[quinas.length - 1];
  const pts: Ponto[] = [livreLocal(pl, de[0], de[1], publico) ? de : quinas[0], ...quinas, fim];
  const out: Ponto[] = []; let k = 0;
  while (k < pts.length - 1) { let m = pts.length - 1; while (m > k + 1 && !retaLocal(pl, pts[k], pts[m], publico)) m--; out.push(pts[m]); k = m; }
  return out;
}

// Caminho por dentro de `de` até `para` (MUNDO). Devolve os pontos a seguir (o último é o destino ou o ponto livre mais
// perto dele); null = sem passagem (sala fechada ou só da equipe para o visitante).
export function rotaDentro(pl: PlantaInterna, de: Ponto, para: Ponto, publico: boolean): Ponto[] | null {
  const a = paraLocal(pl, de[0], de[1]), b = paraLocal(pl, para[0], para[1]);
  const loc = retaLocal(pl, a, b, publico) && livreLocal(pl, b[0], b[1], publico) ? [b] : aEstrela(pl, a, b, publico);
  return loc ? loc.map((p) => paraMundo(pl, p[0], p[1])) : null;
}
// teclado/joystick por dentro: anda o que der; se bater, escorrega ao longo da parede
export function caminharDentro(pl: PlantaInterna, x: number, z: number, dx: number, dz: number, publico: boolean): Ponto {
  const a = paraLocal(pl, x, z);
  // o passo inteiro precisa ser livre (o teclado manda 2,6 m à frente: pularia uma parede fina); se não der, encurta
  for (const k of [1, 0.6, 0.35, 0.15]) for (const [ex, ez] of [[dx, dz], [dx, 0], [0, dz]]) {
    if (!ex && !ez) continue;
    const b = paraLocal(pl, x + ex * k, z + ez * k);
    if (retaLocal(pl, a, b, publico)) return [x + ex * k, z + ez * k];
  }
  return [x, z];
}
// porta por dentro (MUNDO): onde o caminho interno começa ao entrar e termina ao sair
export const portaDentroMundo = (pl: PlantaInterna): Ponto => paraMundo(pl, pl.portaDentro[0], pl.portaDentro[1]);
