"use client";
// Trânsito do mapa (11/11/2026, pedido do dono: "as ruas faltam semáforos, os carros precisam respeitar as sinalizações").
//  - Semáforo em cada aproximação dos 16 cruzamentos: verde → amarelo → todos vermelhos → verde da outra rua. Cruzamentos
//    vizinhos ficam em fase oposta (xadrez), para a cidade não parar toda de uma vez.
//  - Faixa de pedestre e linha de parada em todas as aproximações.
//  - Carros: param na linha no vermelho, decidem no amarelo se dá para parar, guardam distância do carro da frente (fila),
//    seguem reto ou viram à direita; na borda do mapa viram (à direita ou, sem ninguém vindo, à esquerda) para continuar
//    na cidade. Mão direita: o carro anda à direita do eixo da rua.
import * as THREE from "three";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { ComFallback, Modelo, type NomeModelo } from "./Modelos";
import { SombraContato } from "./SombraContato";
import { leve } from "./qualidade";
import { EIXOS_RUA, RUA } from "../data/mundo";

// ---------- tempos do semáforo (segundos) ----------
const VERDE = 9, AMARELO = 2.5, TODOS_VERMELHOS = 1.5;
const MEIA = VERDE + AMARELO + TODOS_VERMELHOS; // uma rua: verde + amarelo + vermelho de segurança
export const CICLO = 2 * MEIA;
export type Luz = "verde" | "amarelo" | "vermelho";
// eixo "x": carros que andam ao longo de x (ruas horizontais) cruzando a rua vertical do cruzamento
export function luzDe(grupo: number, eixo: "x" | "z", t: number): Luz {
  const f = (((t + grupo * MEIA) % CICLO) + CICLO) % CICLO;
  const minha = eixo === "x" ? f : (f + MEIA) % CICLO; // a rua z tem a mesma sequência meio ciclo depois
  return minha < VERDE ? "verde" : minha < VERDE + AMARELO ? "amarelo" : "vermelho";
}
// relógio da simulação: o trânsito avança e o semáforo lê o mesmo tempo. Em aparelho lento (poucos quadros por segundo)
// tudo desacelera junto, então nenhum carro "fura" o sinal por estar em câmera lenta.
const relogio = { t: 0 };
const agora = () => relogio.t;

// ---------- geometria do cruzamento ----------
const MEIA_RUA = RUA / 2; // 3,5: meio-fio a partir do eixo
const FAIXA_CARRO = 1.75; // centro da faixa a partir do eixo
const ZEBRA_INI = MEIA_RUA, ZEBRA_FIM = MEIA_RUA + 2.5; // faixa de pedestre alinhada com a calçada da rua que cruza
const LINHA_PARADA = ZEBRA_FIM + 0.5; // 6,5 do centro do cruzamento
const FRENTE = 2.2; // meio comprimento do carro
const PARADA_CENTRO = LINHA_PARADA + 0.4 + FRENTE; // onde o centro do carro para
const MIN_E = Math.min(...EIXOS_RUA), MAX_E = Math.max(...EIXOS_RUA);
interface Cruzamento { x: number; z: number; ix: number; iz: number; grupo: number }
const CRUZAMENTOS: Cruzamento[] = EIXOS_RUA.flatMap((x, ix) => EIXOS_RUA.map((z, iz) => ({ x, z, ix, iz, grupo: (ix + iz) % 2 })));
const cruzamento = (x: number, z: number) => CRUZAMENTOS.find((c) => c.x === x && c.z === z)!;

type V2 = [number, number];
const direita = (d: V2): V2 => [-d[1], d[0]]; // à direita de quem anda em d (y para cima)
const DIRECOES: V2[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- semáforos ----------
// Cada aproximação: poste na calçada à direita, antes da faixa de pedestre, com braço sobre a pista e duas caixas (uma no
// braço, sobre a faixa do carro, e uma repetidora no poste). As lâmpadas são esferas instanciadas: 12 malhas no total
// (2 grupos × 2 eixos × 3 cores), e o material de cada uma acende e apaga conforme o ciclo.
interface Aproximacao { c: Cruzamento; d: V2 }
// só as aproximações que têm rua de onde o carro vem (na borda do mapa não há rua do lado de fora)
const APROXIMACOES: Aproximacao[] = CRUZAMENTOS.flatMap((c) => DIRECOES.filter((d) => temRua(c, [-d[0], -d[1]])).map((d) => ({ c, d })));
const CORES: Record<Luz, string> = { vermelho: "#FF3B30", amarelo: "#FFB020", verde: "#2BD46B" };
const ORDEM_LUZ: Luz[] = ["vermelho", "amarelo", "verde"];

function posteDe(a: Aproximacao) {
  const r = direita(a.d);
  const px = a.c.x - a.d[0] * (LINHA_PARADA + 0.3) + r[0] * (MEIA_RUA + 0.7);
  const pz = a.c.z - a.d[1] * (LINHA_PARADA + 0.3) + r[1] * (MEIA_RUA + 0.7);
  return { px, pz, r, rotY: Math.atan2(-a.d[0], -a.d[1]) }; // a frente da caixa (local +z) olha para quem chega (-d)
}

function PartesFixas({ simples }: { simples: boolean }) {
  const metal = mat("#2B2F36", { metal: 0.4, rough: 0.55 }), caixaMat = mat("#1B1E23", { rough: 0.7 });
  return (
    <>
      {APROXIMACOES.map((a, i) => {
        const { px, pz, rotY } = posteDe(a);
        return (
          <group key={i} position={[px, 0, pz]} rotation={[0, rotY, 0]}>
            <mesh geometry={cilindro(0.09, 0.11, simples ? 3.2 : 5.6, 8)} material={metal} position={[0, simples ? 1.6 : 2.8, 0]} />
            {/* braço sobre a pista: o local -x aponta para o meio da rua */}
            {!simples && <mesh geometry={caixa(2.6, 0.12, 0.12)} material={metal} position={[-1.3, 5.45, 0]} />}
            {!simples && <mesh geometry={caixa(0.42, 1.18, 0.3)} material={caixaMat} position={[-2.45, 4.75, 0]} />}
            <mesh geometry={caixa(0.36, 1.02, 0.26)} material={caixaMat} position={[0, simples ? 2.75 : 2.7, 0.16]} />
          </group>
        );
      })}
    </>
  );
}

// materiais das lâmpadas (um por grupo/eixo/cor), criados uma vez; acender() liga a cor da vez a cada quadro
let MATS_LUZ: Record<string, THREE.MeshStandardMaterial> | null = null;
function materiaisLuz() {
  if (!MATS_LUZ) {
    MATS_LUZ = {};
    for (const g of [0, 1]) for (const e of ["x", "z"]) for (const l of ORDEM_LUZ) MATS_LUZ[`${g}${e}${l}`] = new THREE.MeshStandardMaterial({ color: "#30343B", emissive: CORES[l], emissiveIntensity: 0, roughness: 0.35 });
  }
  return MATS_LUZ;
}
function acender(t: number) {
  const mats = materiaisLuz();
  for (const g of [0, 1]) for (const e of ["x", "z"] as const) {
    const luz = luzDe(g, e, t);
    for (const l of ORDEM_LUZ) { const m = mats[`${g}${e}${l}`]; const acesa = l === luz; m.emissiveIntensity = acesa ? 2.6 : 0; m.color.set(acesa ? CORES[l] : "#30343B"); }
  }
}

function Lampadas({ simples }: { simples: boolean }) {
  const mats = materiaisLuz();
  const geo = useMemo(() => new THREE.SphereGeometry(0.115, 10, 8), []);
  // posições de cada lâmpada (no mundo) por grupo/eixo/cor
  const posicoes = useMemo(() => {
    const p: Record<string, THREE.Matrix4[]> = {};
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    for (const a of APROXIMACOES) {
      const { px, pz, rotY } = posteDe(a);
      const eixo = a.d[0] !== 0 ? "x" : "z";
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      const cabecas: [number, number, number][] = simples ? [[0, 2.75, 0.3]] : [[-2.45, 4.75, 0.16], [0, 2.7, 0.3]];
      for (const [cx, cy, cz] of cabecas) {
        ORDEM_LUZ.forEach((l, k) => {
          v.set(cx, cy + 0.34 - k * 0.34, cz).applyQuaternion(q).add(new THREE.Vector3(px, 0, pz));
          (p[`${a.c.grupo}${eixo}${l}`] ??= []).push(m.compose(v, new THREE.Quaternion(), s).clone());
        });
      }
    }
    return p;
  }, [simples]);
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  useEffect(() => {
    for (const [k, lista] of Object.entries(posicoes)) { const im = refs.current[k]; if (!im) continue; lista.forEach((mm, i) => im.setMatrixAt(i, mm)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  }, [posicoes]);
  useFrame(() => acender(agora()));
  return (
    <>
      {Object.entries(posicoes).map(([k, lista]) => (
        <instancedMesh key={k} ref={(el) => { refs.current[k] = el; }} args={[geo, mats[k], lista.length]} frustumCulled={false} />
      ))}
    </>
  );
}

// ---------- faixas de pedestre e linhas de parada ----------
function Sinalizacao() {
  const branco = mat("#F2EFE6", { rough: 0.9 });
  const pecas: ReactNode[] = [];
  APROXIMACOES.forEach((a, i) => {
    const r = direita(a.d);
    // faixa de pedestre: barras paralelas à rua, lado a lado atravessando a pista
    const meio = (ZEBRA_INI + ZEBRA_FIM) / 2;
    for (let k = 0; k < 7; k++) {
      const lat = -2.85 + k * 0.95;
      const x = a.c.x - a.d[0] * meio + r[0] * lat, z = a.c.z - a.d[1] * meio + r[1] * lat;
      const w = a.d[0] !== 0 ? ZEBRA_FIM - ZEBRA_INI : 0.55, h = a.d[0] !== 0 ? 0.55 : ZEBRA_FIM - ZEBRA_INI;
      pecas.push(<mesh key={`z${i}-${k}`} geometry={plano(w, h)} material={branco} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, z]} />);
    }
    // linha de parada só nas faixas de quem chega (à direita do eixo)
    const lx = a.c.x - a.d[0] * LINHA_PARADA + r[0] * 1.75, lz = a.c.z - a.d[1] * LINHA_PARADA + r[1] * 1.75;
    pecas.push(<mesh key={`p${i}`} geometry={a.d[0] !== 0 ? plano(0.32, 3.2) : plano(3.2, 0.32)} material={branco} rotation={[-Math.PI / 2, 0, 0]} position={[lx, 0.004, lz]} />);
  });
  return <>{pecas}</>;
}

export function Semaforos() {
  const simples = leve();
  return (
    <>
      <Estatico><PartesFixas simples={simples} /><Sinalizacao /></Estatico>
      <Lampadas simples={simples} />
    </>
  );
}

// ---------- carros ----------
type Modelo3 = "carroSedan" | "carroHatch" | "carroSuv";
const ALTURA: Record<Modelo3, number> = { carroSedan: 1.45, carroHatch: 1.5, carroSuv: 1.7 };
const ACEL = 2.4, FREIO = 6, FREIO_CONFORTO = 3.2, VEL_CURVA = 3.6, DISTANCIA = 7; // m/s², m/s, m (centro a centro)
interface Curva { cx: number; cz: number; lado: 1 | -1; R: number; d: V2; r: V2; phi: number }
interface Carro {
  modelo: Modelo3; x: number; z: number; d: V2; v: number; vMax: number; curva: Curva | null;
  // decisão para o próximo cruzamento: chave do cruzamento e o que fazer
  plano: { chave: string; acao: "reto" | "direita" | "esquerda" } | null;
  freando: boolean;
}
const lateral = (c: { x: number; z: number; d: V2 }) => { const r = direita(c.d); return c.x * r[0] + c.z * r[1]; }; // coordenada do lado
const frente = (c: { x: number; z: number; d: V2 }) => c.x * c.d[0] + c.z * c.d[1]; // coordenada ao longo do caminho
// próximo cruzamento à frente (no eixo de quem anda), ou null se já passou do último
function proximo(c: Carro): { cr: Cruzamento; dist: number } | null {
  const ao = c.d[0] !== 0 ? "x" : "z";
  const eixoDaRua = c.d[0] !== 0 ? c.z - direita(c.d)[1] * FAIXA_CARRO : c.x - direita(c.d)[0] * FAIXA_CARRO;
  const ruaReal = EIXOS_RUA.reduce((m, e) => (Math.abs(e - eixoDaRua) < Math.abs(m - eixoDaRua) ? e : m), EIXOS_RUA[0]);
  const f = frente(c); let melhor: { cr: Cruzamento; dist: number } | null = null;
  for (const e of EIXOS_RUA) {
    const fc = e * (c.d[0] + c.d[1]);
    const dist = fc - f; // distância do centro do carro ao centro do cruzamento
    if (dist < -MEIA_RUA) continue;
    if (!melhor || dist < melhor.dist) melhor = { cr: ao === "x" ? cruzamento(e, ruaReal) : cruzamento(ruaReal, e), dist };
  }
  return melhor;
}
// pode sair do cruzamento indo na direção nd? (tem rua do outro lado)
function temRua(cr: Cruzamento, nd: V2) {
  if (nd[0] > 0) return cr.x < MAX_E; if (nd[0] < 0) return cr.x > MIN_E;
  if (nd[1] > 0) return cr.z < MAX_E; return cr.z > MIN_E;
}
function decidir(c: Carro, cr: Cruzamento): "reto" | "direita" | "esquerda" {
  const r = direita(c.d);
  const reto = temRua(cr, c.d), dir = temRua(cr, r), esq = temRua(cr, [-r[0], -r[1]]);
  if (reto && dir) return Math.random() < 0.28 ? "direita" : "reto";
  if (reto) return "reto";
  if (dir) return "direita";
  return esq ? "esquerda" : "direita";
}
function iniciarCurva(c: Carro, cr: Cruzamento, lado: 1 | -1) {
  const r = direita(c.d); const R = lado > 0 ? MEIA_RUA - FAIXA_CARRO : MEIA_RUA + FAIXA_CARRO; // 1,75 à direita; 5,25 à esquerda
  // ponto de entrada: na boca do cruzamento, na faixa do carro
  const ex = cr.x - c.d[0] * MEIA_RUA + r[0] * FAIXA_CARRO, ez = cr.z - c.d[1] * MEIA_RUA + r[1] * FAIXA_CARRO;
  c.x = ex; c.z = ez;
  c.curva = { cx: ex + lado * r[0] * R, cz: ez + lado * r[1] * R, lado, R, d: c.d, r, phi: 0 };
}

function criarCarros(n: number): Carro[] {
  const modelos: Modelo3[] = ["carroSedan", "carroHatch", "carroSuv"];
  const lista: Carro[] = [];
  let semente = 7; const sorte = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  let tentativas = 0;
  while (lista.length < n && tentativas++ < 2000) {
    const d = DIRECOES[Math.floor(sorte() * 4)]; const r = direita(d);
    const rua = EIXOS_RUA[Math.floor(sorte() * EIXOS_RUA.length)];
    const ao = MIN_E + 6 + sorte() * (MAX_E - MIN_E - 12);
    // fora dos cruzamentos e longe dos outros
    if (EIXOS_RUA.some((e) => Math.abs(ao - e) < LINHA_PARADA + FRENTE + 1)) continue;
    const x = d[0] !== 0 ? ao : rua + r[0] * FAIXA_CARRO, z = d[0] !== 0 ? rua + r[1] * FAIXA_CARRO : ao;
    if (lista.some((o) => Math.hypot(o.x - x, o.z - z) < 9)) continue;
    const modelo = modelos[lista.length % 3];
    lista.push({ modelo, x, z, d, v: 0, vMax: 5.2 + sorte() * 2.6, curva: null, plano: null, freando: false });
  }
  return lista;
}

function passo(carros: Carro[], dt: number, t: number) {
  for (const c of carros) {
    // ---- na curva: anda pelo arco e sai na rua nova ----
    if (c.curva) {
      const k = c.curva; c.v = Math.min(VEL_CURVA, c.v + ACEL * dt);
      k.phi = Math.min(Math.PI / 2, k.phi + (c.v * dt) / k.R);
      const co = Math.cos(k.phi), si = Math.sin(k.phi);
      c.x = k.cx - k.lado * k.r[0] * k.R * co + k.d[0] * k.R * si;
      c.z = k.cz - k.lado * k.r[1] * k.R * co + k.d[1] * k.R * si;
      if (k.phi >= Math.PI / 2) { c.d = [k.lado * k.r[0], k.lado * k.r[1]] as V2; c.curva = null; c.plano = null; }
      c.freando = false;
      continue;
    }
    // ---- em linha reta ----
    let vAlvo = c.vMax;
    const prox = proximo(c);
    if (prox) {
      const { cr, dist } = prox;
      const chave = `${cr.x},${cr.z}`;
      if (!c.plano || c.plano.chave !== chave) c.plano = { chave, acao: decidir(c, cr) };
      const eixo = c.d[0] !== 0 ? "x" : "z";
      const luz = luzDe(cr.grupo, eixo, t);
      const atePararr = dist - PARADA_CENTRO; // quanto falta até o ponto de parada
      if (atePararr > -0.2 && luz !== "verde") {
        // amarelo: só para se dá para parar com freada confortável; vermelho: para sempre
        const precisa = (c.v * c.v) / (2 * FREIO_CONFORTO);
        if (luz === "vermelho" || precisa < atePararr + 0.5) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, atePararr))));
      }
      if (c.plano.acao !== "reto") vAlvo = Math.min(vAlvo, Math.max(VEL_CURVA, Math.sqrt(VEL_CURVA * VEL_CURVA + 2 * FREIO_CONFORTO * Math.max(0, dist - MEIA_RUA))));
      // curva planejada: só entra se a pista de destino tem espaço logo depois da saída
      if (c.plano.acao !== "reto" && dist < 14 && dist > -0.5) {
        const lado = c.plano.acao === "direita" ? 1 : -1; const r = direita(c.d); const nd: V2 = [lado * r[0], lado * r[1]];
        const sx = cr.x + nd[0] * MEIA_RUA + direita(nd)[0] * FAIXA_CARRO, sz = cr.z + nd[1] * MEIA_RUA + direita(nd)[1] * FAIXA_CARRO;
        const ocupada = carros.some((o) => o !== c && !o.curva && o.d[0] === nd[0] && o.d[1] === nd[1] && Math.abs((o.x - sx) * direita(nd)[0] + (o.z - sz) * direita(nd)[1]) < 1.2 && (() => { const g = (o.x - sx) * nd[0] + (o.z - sz) * nd[1]; return g > -1 && g < DISTANCIA + 1; })());
        if (ocupada) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, dist - PARADA_CENTRO))));
        else if (dist <= MEIA_RUA + 0.05) { iniciarCurva(c, cr, lado); continue; }
      }
    }
    // carro da frente na mesma faixa (inclusive quem está entrando nela numa curva)
    const latMeu = lateral(c), fMeu = frente(c);
    let gap = Infinity;
    for (const o of carros) {
      if (o === c) continue;
      const lat = o.x * direita(c.d)[0] + o.z * direita(c.d)[1];
      if (Math.abs(lat - latMeu) > 1.3) continue;
      const g = o.x * c.d[0] + o.z * c.d[1] - fMeu;
      if (g > 0 && g < gap) gap = g;
    }
    if (gap < Infinity) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, gap - DISTANCIA))));
    // não fica parado no meio do cruzamento: se a fila do outro lado chega até a saída, espera na linha de parada
    if (prox && c.plano?.acao === "reto" && gap < prox.dist + MEIA_RUA + DISTANCIA && prox.dist - PARADA_CENTRO > -0.2) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, prox.dist - PARADA_CENTRO))));
    const antes = c.v;
    c.v = c.v < vAlvo ? Math.min(vAlvo, c.v + ACEL * dt) : Math.max(vAlvo, c.v - FREIO * dt);
    c.freando = c.v < antes - 0.01 || (c.v < 0.3 && vAlvo < 0.3);
    c.x += c.d[0] * c.v * dt; c.z += c.d[1] * c.v * dt;
  }
}

const rotacao = (c: Carro) => {
  if (c.curva) { const k = c.curva; const hx = k.d[0] * Math.cos(k.phi) + k.lado * k.r[0] * Math.sin(k.phi), hz = k.d[1] * Math.cos(k.phi) + k.lado * k.r[1] * Math.sin(k.phi); return -Math.atan2(hz, hx); }
  return -Math.atan2(c.d[1], c.d[0]); // o modelo olha para +x
};

const LUZ_FREIO = new THREE.MeshStandardMaterial({ color: "#5A0E0E", emissive: "#FF2020", emissiveIntensity: 0, roughness: 0.4 });
const LUZ_FREIO_ACESA = new THREE.MeshStandardMaterial({ color: "#FF3030", emissive: "#FF2020", emissiveIntensity: 2.2, roughness: 0.4 });

export function Trafego() {
  const poucos = leve();
  const carros = useMemo(() => criarCarros(poucos ? 10 : 22), [poucos]);
  // ?medir=1: os testes leem as posições dos carros e o relógio do semáforo
  useEffect(() => { if (new URLSearchParams(window.location.search).has("medir")) (window as unknown as { __trafego?: unknown }).__trafego = { carros, luzDe, CRUZAMENTOS, agora, passo, relogio }; }, [carros]);
  const grupos = useRef<(THREE.Group | null)[]>([]);
  const freios = useRef<(THREE.Mesh | null)[][]>([]);
  useFrame((_, dt) => {
    const passoDt = Math.min(dt, 0.1); relogio.t += passoDt; const t = relogio.t;
    passo(carros, passoDt, t);
    carros.forEach((c, i) => {
      const g = grupos.current[i]; if (!g) return;
      g.position.set(c.x, 0, c.z);
      const alvo = rotacao(c); let dif = alvo - g.rotation.y; dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      g.rotation.y += dif * Math.min(1, passoDt * 14); // suaviza a virada
      for (const f of freios.current[i] ?? []) if (f) f.material = c.freando ? LUZ_FREIO_ACESA : LUZ_FREIO;
    });
  });
  return (
    <group>
      {carros.map((c, i) => (
        <group key={i} ref={(el) => { grupos.current[i] = el; }} position={[c.x, 0, c.z]} rotation={[0, rotacao(c), 0]}>
          <ComFallback fallback={<mesh geometry={caixa(4.2, 1.3, 1.9)} material={mat("#E53935")} position={[0, 0.7, 0]} />}>
            <Modelo nome={c.modelo as NomeModelo} position={[0, 0, 0]} altura={ALTURA[c.modelo]} sombra={false} />
          </ComFallback>
          {/* luzes de freio na traseira (acendem quando o carro freia ou está parado no sinal) */}
          {[-0.62, 0.62].map((lz, k) => (
            <mesh key={k} ref={(el) => { (freios.current[i] ??= [])[k] = el; }} geometry={caixa(0.06, 0.12, 0.3)} material={LUZ_FREIO} position={[-2.12, 0.78, lz]} />
          ))}
          <SombraContato r={2.4} />
        </group>
      ))}
    </group>
  );
}
