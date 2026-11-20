// Caixas que podem esconder o personagem da câmera (18/11/2026, pedido do dono: "a câmera de seguir o personagem fica
// bugada quando se aproxima de um prédio, fica escondendo o boneco"). Uma caixa simples, alinhada aos eixos, para cada
// coisa grande da cidade: o prédio da Nuvem, a lanchonete, a torre de cada sede, o prédio de cada loja, as
// casas dos lotes à venda e os outdoors. A câmera (scene/CameraMundo.tsx) testa a cada quadro um raio do boneco até ela
// contra estas caixas: umas poucas dezenas de testes de caixa, no lugar de um raio contra todas as malhas da cena.
// Tudo aqui é função pura (sem three.js, sem React): testável com tsx.
import { LOTES, frenteDoLote, LOTE_POR_CHAVE, type ModeloCasa } from "./mundo";
import { DIM_LAYOUT, alturaPredio, andaresDoPredio, type Escritorio } from "./escritorio";
import { ehKit, medidasKit } from "./predios";
import { SEDES, alturaSede, degrausEstudio, logosModeloSede, type EstiloSede } from "./sedes";
import { SEDE } from "./onestate";
import { LANCH } from "./lanchonete";
import { PREDIO } from "./layout";
import { OUTDOORS } from "./outdoors";

export interface Caixa { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
interface TerrenoCaixa { chave: string; status: string; escritorio: Escritorio | null; anexoDe?: string | null }

const caixaXZ = (cx: number, cz: number, w: number, d: number, y0: number, y1: number): Caixa => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1 });
// retângulo local (frente = -z) girado em quartos de volta, como o <group rotation={[0, rot, 0]}> do prédio
function girada(cx: number, cz: number, rot: number, lx0: number, lx1: number, lz0: number, lz1: number, y1: number): Caixa {
  const c = Math.round(Math.cos(rot)), s = Math.round(Math.sin(rot));
  const xs: number[] = [], zs: number[] = [];
  for (const lx of [lx0, lx1]) for (const lz of [lz0, lz1]) { xs.push(cx + lx * c + lz * s); zs.push(cz - lx * s + lz * c); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: 0, y1 };
}

// casas dos lotes à venda (scene/Lotes.tsx): altura de cada modelo e o lado maior da base (medido nos GLB), na escala do lote
// (20/11/2026: casas desenhadas em código, scene/KitPredio.tsx › CasasDesenhadas; com beirais)
const CASA: Record<ModeloCasa, { altura: number; lado: number }> = {
  casaVelha: { altura: 5.0, lado: 9.6 }, casaTerrea: { altura: 5.0, lado: 9.6 }, casaSobrado: { altura: 7.8, lado: 9.2 },
  casaColonial: { altura: 7.8, lado: 9.2 }, casaModerna: { altura: 4.6, lado: 10.6 },
};
// largura da logo do alto, na frente, de cada estilo de sede (scene/SedeEstilos.tsx › logosBase, antes da escala)
const LOGO_ALTO: Record<EstiloSede, number> = { classica: 15, tech: 14, festa: 13, estudio: 11 };
// outdoor (scene/Anuncios.tsx › FACE_OUTDOOR): face de 14,4 × 7,2 m com a borda de baixo a 6,6 m (as colunas são finas)
const OUTDOOR = { larg: 14.4, alt: 7.2, base: 6.6 };

export function caixasDaCidade(terrenos: Record<string, TerrenoCaixa>): Caixa[] {
  const out: Caixa[] = [];
  // prédio da Nuvem (scene/Fachada.tsx: envelope de ±9,8 m, 6,6 m de pé-direito e o letreiro em cima)
  out.push({ x0: PREDIO.x0 - 0.8, x1: PREDIO.x1 + 0.8, z0: PREDIO.z0 - 0.8, z1: PREDIO.z1 + 0.8, y0: 0, y1: 7.6 });
  // lanchonete
  out.push({ x0: LANCH.x0, x1: LANCH.x1, z0: LANCH.z0, z1: LANCH.z1, y0: 0, y1: LANCH.altura });
  // sedes: a torre (até a coroa) e as logos do alto (na beirada da frente e na do lado da rua; no NUVCAM, no último
  // degrau). A logo do alto tem a largura de SedeEstilos › logosBase × 0,8 × SX e nasce 1,4 m acima do topo. Desde
  // 19/11/2026 cada sede ocupa um lote só e o desenho é girado para a rua da frente (rot): as caixas são montadas em
  // coordenadas do lote e giradas como o prédio (o totem da praça saiu junto com a praça)
  for (const sd of SEDES) {
    const H = alturaSede(sd), g = (lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number): Caixa => ({ ...girada(sd.x, sd.z, sd.rot, lx0, lx1, lz0, lz1, y1), y0 });
    const S = SEDE.z + SEDE.d / 2, N = SEDE.z - SEDE.d / 2, O = SEDE.x - SEDE.w / 2, L = SEDE.x + SEDE.w / 2;
    // 20/11/2026: sede com modelo do catálogo (scene/SedeModelo.tsx): o prédio do kit na planta da sede e as logos do alto
    // (a da frente na beirada e a do lado da rua). No desenho do kit a frente é -z e o x é espelhado (meia volta)
    if (sd.modelo) {
      const lg = logosModeloSede(sd), topoLogo = lg.base + Math.max(lg.frente.h, lg.lado.h);
      out.push(g(O - 0.4, L + 0.4, N - 0.4, S + 0.4, 0, lg.m.altura));
      out.push(g(O + 0.6, L - 0.6, S - 1.2, S - 0.4, lg.topo, topoLogo));
      out.push(sd.lado === "oeste" ? g(O + 0.3, O + 1.1, N, S, lg.topo, topoLogo) : g(L - 1.1, L - 0.3, N, S, lg.topo, topoLogo));
      continue;
    }
    const borda = sd.estilo === "festa" ? 1.5 : 0.4; // as sacadas do bday.fm saem 1,4 m para fora
    out.push(g(O - borda, L + borda, N - borda, S + borda, 0, H + 1.3));
    const degraus = sd.estilo === "estudio" ? degrausEstudio(sd.andares) : 0, rf = 3 * degraus, rl = 2 * degraus;
    const hLogo = 1.4 + LOGO_ALTO[sd.estilo] * 0.8 * (SEDE.w / 22) * sd.propLogo;
    out.push(g(O + rl, L - rl, S - rf - 1.6, S - rf - 0.2, H, H + hLogo));
    // a logo do lado fica no lado da rua da esquina (sede.lado): no oeste ou espelhada no leste
    out.push(sd.lado === "oeste" ? g(O + rl + 0.2, O + rl + 1.6, N, S - rf, H, H + hLogo) : g(L - rl - 1.6, L - rl - 0.2, N, S - rf, H, H + hLogo));
  }
  // lojas dos clientes (scene/EscritorioCliente.tsx): no lote duplo o prédio fica no meio dos dois terrenos
  const anexos: Record<string, string> = {};
  for (const t of Object.values(terrenos)) if (t.anexoDe && t.status === "ativo") anexos[t.anexoDe] = t.chave;
  for (const t of Object.values(terrenos)) {
    if (t.status !== "ativo" || !t.escritorio || t.anexoDe) continue;
    const l = LOTE_POR_CHAVE[t.chave]; if (!l) continue;
    const la = anexos[t.chave] ? LOTE_POR_CHAVE[anexos[t.chave]] : null, duplo = !!la;
    const cx = l.centro[0] + (la ? (la.centro[0] - l.centro[0]) / 2 : 0), cz = l.centro[1];
    const giro = t.escritorio.decor?.giro ?? 0, giroEf = duplo ? giro - (giro % 2) : giro;
    const rot = frenteDoLote(l.k) + Math.PI + giroEf * (Math.PI / 2);
    const h = alturaPredio(t.escritorio, duplo), lay = t.escritorio.layout;
    if (ehKit(lay)) {
      const m = medidasKit(lay, andaresDoPredio(t.escritorio), duplo, (t.escritorio.decor?.cobertura ?? "nenhuma") !== "nenhuma");
      // Sede corporativa nos dois lotes: duas torres de 13 m com os centros a ±8,4 m (scene/EscritorioCliente.tsx › TorresGemeas)
      const wk = t.escritorio.modelo === "sede" && duplo ? 2 * 8.4 + 13 : m.w;
      out.push(girada(cx, cz, rot, -wk / 2, wk / 2, m.z0, m.z1, h));
      if (m.anexo) out.push(girada(cx, cz, rot, m.anexo.x0, m.anexo.x1, m.anexo.z0, m.anexo.z1, m.anexo.h));
    } else {
      const dim = DIM_LAYOUT[lay], w = dim.largura * (duplo ? 1.6 : 1);
      out.push(girada(cx, cz, rot, -w / 2, w / 2, -dim.prof / 2, dim.prof / 2, h));
    }
  }
  // casas dos lotes sem dono (o terreno reservado vira obra e o ativo vira loja: a casa some). Pela lista de lotes: a
  // chave pode não ser a posição física (data/mundo.ts › chaveDoLote)
  for (const l of LOTES) {
    if (l.lote.tipo !== "casa" || terrenos[l.chave] || anexos[l.chave]) continue;
    const [x, z] = l.centro, frente = l.k >= 2 ? 1 : -1, e = l.lote.escala ?? 1, c = CASA[l.lote.modelo];
    out.push(caixaXZ(x, z - frente * 1.2, c.lado * e, c.lado * e, 0, c.altura * e));
  }
  // outdoors das avenidas da borda
  for (const o of OUTDOORS) {
    const deLado = Math.abs(Math.sin(o.rot)) > 0.5;
    out.push(caixaXZ(o.pos[0], o.pos[1], deLado ? 0.6 : OUTDOOR.larg, deLado ? OUTDOOR.larg : 0.6, OUTDOOR.base, OUTDOOR.base + OUTDOOR.alt));
  }
  return out;
}

// Parte do segmento de `a` até `b` (0 = a, 1 = b) onde ele entra na primeira caixa; 1 = caminho livre. Caixa que já
// contém `a` (o boneco encostado ou dentro dela) não conta: senão a câmera nunca acharia saída.
export function primeiraBatida(caixas: Caixa[], ax: number, ay: number, az: number, bx: number, by: number, bz: number, folga = 0): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let melhor = 1;
  for (const c of caixas) {
    const x0 = c.x0 - folga, x1 = c.x1 + folga, y0 = c.y0, y1 = c.y1 + folga, z0 = c.z0 - folga, z1 = c.z1 + folga;
    if (ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1 && az >= z0 && az <= z1) continue;
    let t0 = 0, t1 = melhor, ok = true;
    for (const [o, d, mn, mx] of [[ax, dx, x0, x1], [ay, dy, y0, y1], [az, dz, z0, z1]] as const) {
      if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
      let ta = (mn - o) / d, tb = (mx - o) / d;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < melhor) melhor = t0;
  }
  return melhor;
}
