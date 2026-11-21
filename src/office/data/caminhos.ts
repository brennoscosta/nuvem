// Caminhos do personagem pela cidade (17/11/2026, pedido do dono: "o personagem está ignorando a física dos prédios,
// paredes e portas, está atravessando e entrando por dentro das estruturas"). Ruas, calçadas, a grama das bordas e a
// praça são livres; dentro dos quarteirões (prédios, lojas, a sede) não se entra. Tocar no chão calcula o caminho
// pelas ruas e calçadas (A* numa grade de 1 m, depois esticado em retas que não encostam em nada); tocar dentro de um
// quarteirão leva até a calçada mais perto. A caminhada pelo teclado usa o mesmo livre() (scene/CameraMundo.tsx).
import { LOTE_POR_CHAVE, PASSO, MEIO_Q, MUNDO, N, LOTE, MEIO_CALCADA, BORDAS, NORTE, pontoNaCalcada } from "./mundo";
import { PRACA_CHAVE } from "./praca";
import { sedeNoPonto, paraLocalSede, paraMundoSede } from "./sedes";
import { quiosqueNoPonto } from "./quiosques";

export type Ponto = [number, number];
const PRACA = LOTE_POR_CHAVE[PRACA_CHAVE]?.centro ?? null;

// ---- início do trecho da frente "editor" (21/11/2026) ----
// O calçadão da orla (leste e sul, até a mureta da areia) também é livre: a Rua dos Quiosques da Orla (data/quiosques.ts)
// fica de frente para ele e o cliente é atendido no balcão, na beira do calçadão.
export const ORLA_FIM = MUNDO.x + BORDAS.orla - 0.6; // 98,4 (a mureta fica em 99)
const naOrla = (x: number, z: number) =>
  (x > MUNDO.x - 2 && x <= ORLA_FIM && z >= NORTE.calcadao.z0 && z <= ORLA_FIM) || (z > MUNDO.z - 2 && z <= ORLA_FIM && x >= -(MUNDO.x - 2) && x <= ORLA_FIM);
// a grade do caminho é montada uma vez; quando um quiosque muda de lugar (giro do dono), ela é refeita
export function refazerCaminhos() { grade = null; }
// ---- fim do trecho da frente "editor" ----
// calçadas, ruas e a grama das bordas são livres; dentro dos quarteirões só a praça é aberta
export function livre(x: number, z: number) {
  if (Math.abs(x) > MUNDO.x - 2 || Math.abs(z) > MUNDO.z - 2) return naOrla(x, z) && !quiosqueNoPonto(x, z);
  if (quiosqueNoPonto(x, z)) return false; // quiosques (20/11/2026): desvia do corpo; o balcão e os banquinhos ficam de fora
  const i = Math.round(x / PASSO), j = Math.round(z / PASSO);
  if (Math.abs(i) > N || Math.abs(j) > N) return true;
  const B = MEIO_Q + 0.35;
  if (Math.abs(x - i * PASSO) >= B || Math.abs(z - j * PASSO) >= B) return true;
  return !!PRACA && Math.abs(x - PRACA[0]) < 10.4 && Math.abs(z - PRACA[1]) < 10.4;
}
// livre com folga (o corpo do boneco tem uns 30 cm): o caminho não raspa na quina dos quarteirões
const FOLGA = 0.45;
const folgado = (x: number, z: number) => livre(x, z) && livre(x + FOLGA, z) && livre(x - FOLGA, z) && livre(x, z + FOLGA) && livre(x, z - FOLGA);

// ponto livre mais perto: dentro de um quarteirão vai para a calçada da frente; fora do mapa volta para a borda
export function pontoLivre(x: number, z: number): Ponto {
  const lx = MUNDO.x - 2.6, lz = MUNDO.z - 2.6;
  let px = Math.max(-lx, Math.min(ORLA_FIM - 0.6, x)), pz = Math.max(-lz, Math.min(ORLA_FIM - 0.6, z)); // até a orla (editor)
  if (folgado(px, pz)) return [px, pz];
  // tocou numa sede (data/sedes.ts; desde 19/11/2026 num lote só): vai até a calçada da frente dela, e não à mais perto
  const sd = sedeNoPonto(px, pz);
  if (sd) { const [lx] = paraLocalSede(sd, px, pz); return paraMundoSede(sd, Math.max(-8, Math.min(8, lx)), LOTE / 2 + (MEIO_CALCADA - MEIO_Q)); }
  [px, pz] = pontoNaCalcada(px, pz);
  if (folgado(px, pz)) return [px, pz];
  // perto da praça ou de uma quina: procura em volta, do mais perto para o mais longe
  for (let r = 0.5; r <= 8; r += 0.5) for (let a = 0; a < 16; a++) {
    const qx = px + Math.cos((a / 16) * Math.PI * 2) * r, qz = pz + Math.sin((a / 16) * Math.PI * 2) * r;
    if (folgado(qx, qz)) return [qx, qz];
  }
  return [px, pz];
}

// reta sem obstáculo (testa a cada 25 cm)
export function retaLivre(a: Ponto, b: Ponto) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.25));
  for (let k = 1; k <= n; k++) { const t = k / n; if (!folgado(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
  return true;
}

// ---- grade do A* (1 m), montada uma vez ----
const CEL = 1;
const X0 = -(MUNDO.x - 2), Z0 = -(MUNDO.z - 2);
const NX = Math.floor((ORLA_FIM - X0) / CEL) + 1, NZ = Math.floor((ORLA_FIM - Z0) / CEL) + 1; // até a orla (editor)
let grade: Uint8Array | null = null;
function montarGrade() {
  const g = new Uint8Array(NX * NZ);
  for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) g[iz * NX + ix] = folgado(X0 + ix * CEL, Z0 + iz * CEL) ? 1 : 0;
  return g;
}
const celula = (x: number, z: number) => [Math.max(0, Math.min(NX - 1, Math.round((x - X0) / CEL))), Math.max(0, Math.min(NZ - 1, Math.round((z - Z0) / CEL)))] as const;
const centro = (i: number): Ponto => [X0 + (i % NX) * CEL, Z0 + Math.floor(i / NX) * CEL];
// célula livre mais perto (o ponto pode estar na beira, entre duas células)
function celulaLivre(g: Uint8Array, x: number, z: number) {
  const [cx, cz] = celula(x, z);
  let melhor = -1, dm = Infinity;
  for (let r = 0; r <= 3 && melhor < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const ix = cx + dx, iz = cz + dz; if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
    const i = iz * NX + ix; if (!g[i]) continue;
    const [px, pz] = centro(i), d = Math.hypot(px - x, pz - z); if (d < dm) { dm = d; melhor = i; }
  }
  return melhor;
}

// A* com 8 vizinhos (sem cortar quina) e fila de prioridade binária
function aEstrela(g: Uint8Array, ini: number, fim: number): number[] | null {
  const tot = NX * NZ, custo = new Float32Array(tot).fill(Infinity), veio = new Int32Array(tot).fill(-1), fechado = new Uint8Array(tot);
  const [fx, fz] = [fim % NX, Math.floor(fim / NX)];
  const h = (i: number) => { const dx = Math.abs((i % NX) - fx), dz = Math.abs(Math.floor(i / NX) - fz); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const heap: number[] = [], prio: number[] = [];
  const push = (i: number, p: number) => { heap.push(i); prio.push(p); let k = heap.length - 1; while (k > 0) { const pai = (k - 1) >> 1; if (prio[pai] <= prio[k]) break; [heap[pai], heap[k]] = [heap[k], heap[pai]]; [prio[pai], prio[k]] = [prio[k], prio[pai]]; k = pai; } };
  const pop = () => {
    const topo = heap[0], ult = heap.pop()!, up = prio.pop()!;
    if (heap.length) { heap[0] = ult; prio[0] = up; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && prio[a] < prio[m]) m = a; if (b < heap.length && prio[b] < prio[m]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [prio[m], prio[k]] = [prio[k], prio[m]]; k = m; } }
    return topo;
  };
  custo[ini] = 0; push(ini, h(ini));
  const VIZ: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const i = pop(); if (fechado[i]) continue; fechado[i] = 1;
    if (i === fim) { const out: number[] = []; for (let k = i; k >= 0; k = veio[k]) out.push(k); return out.reverse(); }
    const ix = i % NX, iz = Math.floor(i / NX);
    for (const [dx, dz, c] of VIZ) {
      const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const j = nz * NX + nx; if (!g[j] || fechado[j]) continue;
      if (dx && dz && (!g[iz * NX + nx] || !g[nz * NX + ix])) continue; // não corta a quina
      const nc = custo[i] + c; if (nc < custo[j]) { custo[j] = nc; veio[j] = i; push(j, nc + h(j)); }
    }
  }
  return null;
}

// Caminho de `de` até `para`: lista de pontos para seguir em reta, um depois do outro (o último é o destino final).
// Se `de` estiver dentro de um quarteirão (boneco antigo que entrou antes desta regra), o primeiro passo é sair dele.
export function rota(de: Ponto, para: Ponto): Ponto[] {
  const alvo = pontoLivre(para[0], para[1]);
  const saida: Ponto[] = folgado(de[0], de[1]) ? [] : [pontoLivre(de[0], de[1])];
  const ini = saida[0] ?? de;
  if (retaLivre(ini, alvo)) return [...saida, alvo];
  grade ??= montarGrade();
  const a = celulaLivre(grade, ini[0], ini[1]), b = celulaLivre(grade, alvo[0], alvo[1]);
  if (a < 0 || b < 0) return [...saida, alvo];
  const cel = aEstrela(grade, a, b);
  if (!cel) return [...saida, ini]; // sem caminho: fica onde está
  // só as quinas do caminho da grade (onde a direção muda); depois estica: de cada ponto, pula para o mais longe que
  // dá para ver em reta
  const quinas = cel.filter((c, k) => k === 0 || k === cel.length - 1 || c - cel[k - 1] !== cel[k + 1] - c);
  const pts: Ponto[] = [ini, ...quinas.map(centro), alvo];
  const out: Ponto[] = [];
  let k = 0;
  while (k < pts.length - 1) {
    let m = pts.length - 1;
    while (m > k + 1 && !retaLivre(pts[k], pts[m])) m--;
    out.push(pts[m]); k = m;
  }
  return [...saida, ...out];
}

// anda o que der (teclado e joystick): se bater num quarteirão, escorrega ao longo da calçada
export function caminhar(x: number, z: number, dx: number, dz: number): Ponto {
  if (livre(x + dx, z + dz)) return [x + dx, z + dz];
  if (livre(x + dx, z)) return [x + dx, z];
  if (livre(x, z + dz)) return [x, z + dz];
  return [x, z];
}
