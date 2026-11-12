"use client";
// Trânsito do mapa (11/11/2026, pedido do dono: "as ruas faltam semáforos, os carros precisam respeitar as sinalizações").
//  - Semáforo em cada aproximação dos 16 cruzamentos: verde → amarelo → todos vermelhos → verde da outra rua. Cruzamentos
//    vizinhos ficam em fase oposta (xadrez), para a cidade não parar toda de uma vez.
//  - Faixa de pedestre e linha de parada em todas as aproximações.
//  - Carros: param na linha no vermelho, decidem no amarelo se dá para parar, guardam distância do carro da frente (fila),
//    seguem reto ou viram à direita; na borda do mapa viram (à direita ou, sem ninguém vindo, à esquerda) para continuar
//    na cidade. Mão direita: o carro anda à direita do eixo da rua.
//  - Vida na rua (12/11/2026, "vida e clima"): ciclistas e motoboys andam na mesma simulação dos carros (param no
//    vermelho, esperam pedestre, guardam distância). O motoboy sai da frente da loja quando alguém pede pelo WhatsApp
//    (evento "workend:pedido" e /api/workend/movimento, ver Motoboys) e some depois de ~30 s. À noite e na chuva os
//    faróis ganham o cone de luz.
import * as THREE from "three";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, toro } from "./geo";
import { Estatico } from "./Estatico";
import { ComFallback, Modelo, type NomeModelo } from "./Modelos";
import { SombraContato } from "./SombraContato";
import { leve } from "./qualidade";
import { EIXOS_RUA, RUA, QUARTEIROES, PASSO, BORDA_CALCADA, LOTES, LOTE_POR_CHAVE } from "../data/mundo";
import { useMundo } from "../mundoStore";
import { clima } from "../clima";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { ceu, texturaLuz } from "./CicloDia";

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
  meio: number; // meio comprimento (carro 2,2; ônibus 5,3)
  // ônibus (12/11/2026): rota fixa virando sempre à direita em volta da Nuvem e paradas nos pontos
  onibus?: { paradas: { x: number; z: number; d: V2 }[]; esperaAte: number; ultima: number };
  // decisão para o próximo cruzamento: chave do cruzamento e o que fazer
  plano: { chave: string; acao: "reto" | "direita" | "esquerda" } | null;
  freando: boolean;
  // vida na rua (12/11/2026): motoboy (some sozinho; ativo = false fica guardado fora da cidade) e ciclista
  ativo?: boolean;
  moto?: { cor: string; ate: number; saindo: number | null };
  bici?: { cor: string; camisa: string };
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
  if (c.onibus && temRua(cr, r)) return "direita";
  if (c.moto && temRua(cr, c.d) && Math.random() < 0.8) return "reto";
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
  // o ônibus nasce primeiro (os carros sorteados ficam longe dele)
  const lista: Carro[] = [{ modelo: "carroSedan", x: -12, z: -26 + FAIXA_CARRO, d: [1, 0], v: 0, vMax: 5, curva: null, plano: null, freando: false, meio: MEIO_ONIBUS, onibus: { paradas: PONTOS_ONIBUS, esperaAte: 0, ultima: -1 } }];
  let semente = 7; const sorte = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  let tentativas = 0;
  while (lista.length < n + 1 && tentativas++ < 2000) {
    const d = DIRECOES[Math.floor(sorte() * 4)]; const r = direita(d);
    const rua = EIXOS_RUA[Math.floor(sorte() * EIXOS_RUA.length)];
    const ao = MIN_E + 6 + sorte() * (MAX_E - MIN_E - 12);
    // fora dos cruzamentos e longe dos outros
    if (EIXOS_RUA.some((e) => Math.abs(ao - e) < LINHA_PARADA + FRENTE + 1)) continue;
    const x = d[0] !== 0 ? ao : rua + r[0] * FAIXA_CARRO, z = d[0] !== 0 ? rua + r[1] * FAIXA_CARRO : ao;
    if (lista.some((o) => Math.hypot(o.x - x, o.z - z) < 9)) continue;
    const modelo = modelos[lista.length % 3];
    lista.push({ modelo, x, z, d, v: 0, vMax: 5.2 + sorte() * 2.6, curva: null, plano: null, freando: false, meio: FRENTE });
  }
  // ciclistas: andam na faixa dos carros, devagar (os carros esperam atrás, como na rua de verdade)
  const coresBici = ["#E2575B", "#22A86B", "#1D4ED8", "#FFB020", "#8B6CF0", "#EC6B8D"], camisas = ["#FFFFFF", "#2B2F36", "#40C4FF", "#F2913D", "#3FBFA8", "#FFD24A"];
  const nBici = Math.round(n / 4.5); let feitos = 0; tentativas = 0;
  while (feitos < nBici && tentativas++ < 2000) {
    const d = DIRECOES[Math.floor(sorte() * 4)]; const r = direita(d);
    const rua = EIXOS_RUA[Math.floor(sorte() * EIXOS_RUA.length)];
    const ao = MIN_E + 6 + sorte() * (MAX_E - MIN_E - 12);
    if (EIXOS_RUA.some((e) => Math.abs(ao - e) < LINHA_PARADA + FRENTE + 1)) continue;
    const x = d[0] !== 0 ? ao : rua + r[0] * FAIXA_CARRO, z = d[0] !== 0 ? rua + r[1] * FAIXA_CARRO : ao;
    if (lista.some((o) => Math.hypot(o.x - x, o.z - z) < 10)) continue;
    lista.push({ modelo: "carroHatch", x, z, d, v: 0, vMax: 3.8 + sorte() * 1.1, curva: null, plano: null, freando: false, meio: MEIO_BICI, bici: { cor: coresBici[feitos % coresBici.length], camisa: camisas[(feitos * 5) % camisas.length] } });
    feitos++;
  }
  // vagas de motoboy: guardadas fora da cidade até alguém pedir
  for (let k = 0; k < MAX_MOTOS; k++) lista.push({ modelo: "carroHatch", x: 5000 + k * 50, z: 5000, d: [1, 0], v: 0, vMax: 8.5, curva: null, plano: null, freando: false, meio: MEIO_MOTO, ativo: false, moto: { cor: "#1D4ED8", ate: 0, saindo: null } });
  return lista;
}
const MEIO_BICI = 0.95, MEIO_MOTO = 1.1, MAX_MOTOS = 3;

function passo(carros: Carro[], dt: number, t: number) {
  for (const c of carros) {
    if (c.ativo === false) continue;
    // motoboy: acabou a entrega, some numa reta (encolhe em 0,7 s e volta para a vaga)
    if (c.moto) {
      if (c.moto.saindo == null && t > c.moto.ate && !c.curva) c.moto.saindo = t;
      if (c.moto.saindo != null && t - c.moto.saindo > 0.7) { c.ativo = false; c.x = 5000; c.z = 5000; c.v = 0; c.plano = null; continue; }
    }
    // ---- na curva: anda pelo arco e sai na rua nova ----
    if (c.curva) {
      const k = c.curva;
      // pedestre na frente (na faixa da rua de destino): espera no meio da curva
      const hx = k.d[0] * Math.cos(k.phi) + k.lado * k.r[0] * Math.sin(k.phi), hz = k.d[1] * Math.cos(k.phi) + k.lado * k.r[1] * Math.sin(k.phi);
      if (pedestreNaFrente(c.x, c.z, hx, hz, c.meio + 4.5, 1.8)) { c.v = 0; c.freando = true; continue; }
      c.v = Math.min(c.onibus ? 3 : VEL_CURVA, c.v + ACEL * dt);
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
      const atePararr = dist - (LINHA_PARADA + 0.4 + c.meio); // quanto falta até o ponto de parada
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
        const ocupada = carros.some((o) => o !== c && o.ativo !== false && !o.curva && o.d[0] === nd[0] && o.d[1] === nd[1] && Math.abs((o.x - sx) * direita(nd)[0] + (o.z - sz) * direita(nd)[1]) < 1.2 && (() => { const g = (o.x - sx) * nd[0] + (o.z - sz) * nd[1]; return g > -1 && g < DISTANCIA + 1; })());
        // e só vira se ninguém está atravessando a faixa da rua de destino
        const pedestre = pedestreNaFrente(sx - nd[0] * 1.2, sz - nd[1] * 1.2, nd[0], nd[1], 4.5, 3.6);
        if (ocupada || pedestre) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, dist - (pedestre ? MEIA_RUA + 0.2 : PARADA_CENTRO)))));
        else if (dist <= MEIA_RUA + 0.05) { iniciarCurva(c, cr, lado); continue; }
      }
    }
    // carro da frente na mesma faixa (inclusive quem está entrando nela numa curva)
    const latMeu = lateral(c), fMeu = frente(c);
    let gap = Infinity, folga = DISTANCIA;
    for (const o of carros) {
      if (o === c || o.ativo === false) continue;
      const lat = o.x * direita(c.d)[0] + o.z * direita(c.d)[1];
      if (Math.abs(lat - latMeu) > 1.3) continue;
      const g = o.x * c.d[0] + o.z * c.d[1] - fMeu;
      if (g > 0 && g < gap) { gap = g; folga = c.meio + o.meio + 2.6; }
    }
    if (gap < Infinity) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, gap - folga))));
    // pedestre atravessando na frente: para antes da faixa
    const p = pedestreAFrente(c.x, c.z, c.d[0], c.d[1], c.meio + 7, 1.7);
    if (p != null) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO * Math.max(0, p - c.meio - 1.6))));
    // ônibus: para 6 s em cada ponto
    if (c.onibus) {
      const o = c.onibus;
      o.paradas.forEach((pt, i) => {
        if (pt.d[0] !== c.d[0] || pt.d[1] !== c.d[1] || i === o.ultima) return;
        const g = (pt.x - c.x) * c.d[0] + (pt.z - c.z) * c.d[1], lat = Math.abs((pt.x - c.x) * direita(c.d)[0] + (pt.z - c.z) * direita(c.d)[1]);
        if (lat > 1 || g < -0.5 || g > 40) return;
        vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, g))));
        if (g < 0.4 && c.v < 0.2) { o.esperaAte = t + 6; o.ultima = i; }
      });
      if (t < o.esperaAte) vAlvo = 0;
    }
    // não fica parado no meio do cruzamento: se a fila do outro lado chega até a saída, espera na linha de parada
    if (prox && c.plano?.acao === "reto" && gap < prox.dist + MEIA_RUA + folga && prox.dist - PARADA_CENTRO > -0.2) vAlvo = Math.min(vAlvo, Math.sqrt(Math.max(0, 2 * FREIO_CONFORTO * Math.max(0, prox.dist - PARADA_CENTRO))));
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

// faróis: acesos de leve de dia e fortes à noite, com o facho de luz na pista
const FAROL = new THREE.MeshStandardMaterial({ color: "#F5F3EA", emissive: "#FFF4D6", emissiveIntensity: 0.3, roughness: 0.3 });
const FACHO = new THREE.MeshBasicMaterial({ color: "#FFE9B8", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
// cone de luz dos faróis (12/11/2026): só aparece à noite, mais forte na neblina e na chuva (a luz "pega" na água do ar)
let TEX_CONE: THREE.CanvasTexture | null = null;
function texturaCone() {
  if (TEX_CONE || typeof document === "undefined") return TEX_CONE;
  const c = document.createElement("canvas"); c.width = 8; c.height = 128; const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(255,244,214,1)"); gr.addColorStop(0.35, "rgba(255,236,196,.45)"); gr.addColorStop(1, "rgba(255,230,190,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128); TEX_CONE = new THREE.CanvasTexture(c); TEX_CONE.colorSpace = THREE.SRGBColorSpace; return TEX_CONE;
}
const CONE = new THREE.MeshBasicMaterial({ color: "#FFF1D0", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
// cilindro aberto deitado: a ponta estreita no farol (x = 0), a boca larga 7,5 m à frente, um pouco para baixo
function geometriaCone(comp: number, boca: number) {
  const g = new THREE.CylinderGeometry(0.22, boca, comp, 18, 1, true);
  g.rotateZ(Math.PI / 2); g.translate(comp / 2, 0, 0); g.rotateZ(-0.075);
  return g;
}
function acenderFarois() {
  FAROL.emissiveIntensity = 0.3 + ceu.noite * 2.6;
  FACHO.opacity = ceu.noite * 0.42 * (1 + clima.molhado * 0.6);
  CONE.opacity = ceu.noite * (0.08 + clima.neblina * 0.14 + clima.chuva * 0.08);
  if (!FACHO.map) { const t = texturaLuz(); if (t) { FACHO.map = t; FACHO.needsUpdate = true; } }
  if (!CONE.map) { const t = texturaCone(); if (t) { CONE.map = t; CONE.needsUpdate = true; } }
}
const LUZ_FREIO = new THREE.MeshStandardMaterial({ color: "#5A0E0E", emissive: "#FF2020", emissiveIntensity: 0, roughness: 0.4 });
const LUZ_FREIO_ACESA = new THREE.MeshStandardMaterial({ color: "#FF3030", emissive: "#FF2020", emissiveIntensity: 2.2, roughness: 0.4 });

// ---------- motoboys (12/11/2026) ----------
// Cada pedido pelo WhatsApp (o meu, pelo evento da página, e o dos outros visitantes, por /api/workend/movimento) põe um
// motoboy na faixa da rua em frente à loja. Se a faixa estiver ocupada, ele espera um pouco (até 15 s) para sair.
const FILA_MOTOS: { numero: number; ate: number }[] = [];
export function chamarMotoboy(numero: number) { if (FILA_MOTOS.length < 6 && Number.isFinite(numero)) FILA_MOTOS.push({ numero, ate: relogio.t + 15 }); }
function saidaDaLoja(numero: number): { x: number; z: number; d: V2; cor: string } | null {
  const l = LOTES.find((x) => x.numero === numero); if (!l) return null;
  const ts = useMundo.getState().terrenos;
  const t = ts[l.chave]; const principal = (t?.anexoDe ? LOTE_POR_CHAVE[t.anexoDe] : null) ?? l;
  const anexo = Object.values(ts).find((o) => o.anexoDe === principal.chave && o.status === "ativo");
  const la = anexo ? LOTE_POR_CHAVE[anexo.chave] : null;
  const x = la ? (principal.centro[0] + la.centro[0]) / 2 : principal.centro[0];
  // a frente do lote: k >= 2 olha para +z (rua de baixo), senão para -z; a moto sai na faixa do lado da loja
  const frenteMais = principal.k >= 2, eixo = principal.j * PASSO + (frenteMais ? PASSO / 2 : -PASSO / 2);
  const d: V2 = frenteMais ? [-1, 0] : [1, 0];
  return { x, z: eixo + direita(d)[1] * FAIXA_CARRO, d, cor: ts[principal.chave]?.cor ?? "#1D4ED8" };
}
function soltarMotos(carros: Carro[], t: number) {
  // vence o que esperou demais; depois tenta cada pedido da fila (um pedido preso não segura os outros)
  for (let k = FILA_MOTOS.length - 1; k >= 0; k--) if (t > FILA_MOTOS[k].ate) FILA_MOTOS.splice(k, 1);
  for (let k = 0; k < FILA_MOTOS.length; k++) {
    const vaga = carros.find((c) => c.moto && c.ativo === false); if (!vaga) return; // as 3 motos estão na rua: espera
    const saida = saidaDaLoja(FILA_MOTOS[k].numero); if (!saida) { FILA_MOTOS.splice(k--, 1); continue; }
    const r = direita(saida.d);
    // em frente à loja; se tiver carro ali, um pouco antes ou depois na mesma calçada (fora dos cruzamentos)
    for (const dx of [0, -7, 7, -13, 13]) {
      const x = saida.x + saida.d[0] * dx, z = saida.z;
      if (EIXOS_RUA.some((e) => Math.abs(x - e) < LINHA_PARADA + FRENTE + 1)) continue;
      const ocupado = carros.some((o) => o.ativo !== false && (o.curva ? Math.hypot(o.x - x, o.z - z) < 9 : o.d[0] === saida.d[0] && o.d[1] === saida.d[1] && Math.abs((o.x - x) * r[0] + (o.z - z) * r[1]) < 1.3 && Math.abs((o.x - x) * saida.d[0] + (o.z - z) * saida.d[1]) < 8));
      if (ocupado) continue;
      Object.assign(vaga, { x, z, d: saida.d, v: 0, curva: null, plano: null, ativo: true, freando: false });
      vaga.moto = { cor: saida.cor, ate: t + 32, saindo: null };
      FILA_MOTOS.splice(k--, 1);
      break;
    }
  }
}
// pedidos: o meu na hora (evento da página) e os de todo mundo a cada 20 s (sem repetir o mesmo)
function useChamadasMotoboy() {
  useEffect(() => {
    const vistos = new Set<string>(); const meus: { numero: number; em: number }[] = [];
    const aoPedir = (e: Event) => { const n = Number((e as CustomEvent<{ numero?: number }>).detail?.numero); if (!n) return; meus.push({ numero: n, em: Date.now() }); chamarMotoboy(n); };
    const conferir = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/workend/movimento").then((r) => (r.ok ? r.json() : null)).then((j: { pedidos?: { numero: number; em: number }[]; agora?: number } | null) => {
        const agora = j?.agora ?? Date.now();
        for (const p of j?.pedidos ?? []) {
          const k = `${p.numero}:${p.em}`; if (vistos.has(k)) continue; vistos.add(k);
          if (agora - p.em > 90_000) continue; // pedido velho de quando a página abriu
          if (meus.some((m) => m.numero === p.numero && Math.abs(m.em - p.em) < 60_000)) continue; // esse fui eu
          chamarMotoboy(p.numero);
        }
      }).catch(() => { /* sem movimento: tudo bem */ });
    };
    window.addEventListener("workend:pedido", aoPedir);
    const t0 = setTimeout(conferir, 3000), t = setInterval(conferir, 20_000);
    return () => { window.removeEventListener("workend:pedido", aoPedir); clearTimeout(t0); clearInterval(t); };
  }, []);
}

export function Trafego() {
  const poucos = leve();
  const carros = useMemo(() => criarCarros(poucos ? 10 : 22), [poucos]);
  // ?medir=1: os testes leem as posições dos carros e o relógio do semáforo
  useEffect(() => { if (new URLSearchParams(window.location.search).has("medir")) (window as unknown as { __trafego?: unknown }).__trafego = { carros, luzDe, CRUZAMENTOS, agora, passo, relogio, PEDESTRES, passoPedestres, chamarMotoboy, soltarMotos, FILA_MOTOS }; }, [carros]);
  useChamadasMotoboy();
  const cone = useMemo(() => geometriaCone(7.5, 1.7), []), coneMoto = useMemo(() => geometriaCone(5, 1), []);
  const grupos = useRef<(THREE.Group | null)[]>([]);
  const freios = useRef<(THREE.Mesh | null)[][]>([]);
  useFrame((_, dt) => {
    const passoDt = Math.min(dt, 0.1); relogio.t += passoDt; const t = relogio.t;
    soltarMotos(carros, t);
    passo(carros, passoDt, t);
    acenderFarois();
    carros.forEach((c, i) => {
      const g = grupos.current[i]; if (!g) return;
      g.visible = c.ativo !== false;
      if (!g.visible) return;
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
          {c.onibus ? <Onibus /> : c.moto ? <Moto c={c} freio={(el) => { (freios.current[i] ??= [])[0] = el; }} /> : c.bici ? <Bicicleta c={c} /> : (
            <ComFallback fallback={<mesh geometry={caixa(4.2, 1.3, 1.9)} material={mat("#E53935")} position={[0, 0.7, 0]} />}>
              <Modelo nome={c.modelo as NomeModelo} position={[0, 0, 0]} altura={ALTURA[c.modelo]} sombra={false} />
            </ComFallback>
          )}
          {/* luzes de freio na traseira (acendem quando o carro freia ou está parado no sinal) */}
          {!c.moto && !c.bici && [-0.62, 0.62].map((lz, k) => (
            <mesh key={k} ref={(el) => { (freios.current[i] ??= [])[k] = el; }} geometry={caixa(0.06, 0.12, 0.3)} material={LUZ_FREIO} position={[-c.meio + 0.08, c.onibus ? 0.9 : 0.78, lz * (c.onibus ? 1.6 : 1)]} />
          ))}
          {!c.moto && !c.bici && [-0.6, 0.6].map((lz, k) => <mesh key={`f${k}`} geometry={caixa(0.06, 0.16, 0.36)} material={FAROL} position={[c.meio - 0.08, c.onibus ? 0.8 : 0.72, lz * (c.onibus ? 1.6 : 1)]} />)}
          {!c.bici && <mesh geometry={c.moto ? plano(3.8, 1.8) : plano(6.5, 3.4)} material={FACHO} rotation={[-Math.PI / 2, 0, 0]} position={[c.meio + (c.moto ? 1.9 : 3), 0.04, 0]} renderOrder={2} />}
          {!c.bici && <mesh geometry={c.moto ? coneMoto : cone} material={CONE} position={[c.meio - 0.05, c.onibus ? 0.85 : c.moto ? 0.85 : 0.72, 0]} renderOrder={3} />}
          <SombraContato r={c.onibus ? 5.6 : c.moto ? 1.3 : c.bici ? 1.1 : 2.4} />
        </group>
      ))}
    </group>
  );
}

// ---------- moto do motoboy e bicicleta (12/11/2026) ----------
// Desenhadas em código (poucas peças): a moto com o baú na cor da loja que fez a venda; o ciclista pedala no ritmo da
// velocidade. As duas olham para +x, como os carros.
// o baú troca de cor quando a mesma moto sai de outra loja
function pintar(o: THREE.Mesh | null, cor: string) { const m = o?.material as THREE.MeshStandardMaterial | undefined; if (m && m.userData.cor !== cor) { m.color.set(cor); m.userData.cor = cor; } }
function Moto({ c, freio }: { c: Carro; freio: (el: THREE.Mesh | null) => void }) {
  const g = useRef<THREE.Group>(null), bauRef = useRef<THREE.Mesh>(null);
  const bau = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1D4ED8", roughness: 0.55 }), []);
  const rodas = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    const m = c.moto; if (!m || !g.current) return;
    pintar(bauRef.current, m.cor);
    const sc = m.saindo != null ? Math.max(0.01, 1 - (relogio.t - m.saindo) / 0.7) : 1;
    g.current.scale.setScalar(sc);
    for (const r of rodas.current) if (r) r.rotation.y -= (c.v * Math.min(dt, 0.1)) / 0.3;
  });
  const preto = mat("#1B1E23", { rough: 0.7 }), metal = mat("#9AA3AE", { metal: 0.6, rough: 0.35 }), jaqueta = mat("#2B2F36", { rough: 0.8 }), pele = mat("#C98E6B", { rough: 0.8 }), branco = mat("#F4F5F7", { rough: 0.4 });
  return (
    <group ref={g}>
      {[0.62, -0.62].map((x, k) => <mesh key={x} ref={(el) => { rodas.current[k] = el; }} geometry={cilindro(0.3, 0.3, 0.12, 14)} material={preto} position={[x, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} />)}
      <mesh geometry={caixa(1.05, 0.3, 0.28)} material={mat("#C62828", { rough: 0.45 })} position={[0.05, 0.62, 0]} castShadow />
      <mesh geometry={caixa(0.55, 0.09, 0.3)} material={preto} position={[-0.2, 0.82, 0]} />
      <mesh geometry={cilindro(0.025, 0.025, 0.62, 6)} material={metal} position={[0.48, 0.66, 0]} rotation={[0, 0, -0.35]} />
      <mesh geometry={caixa(0.05, 0.05, 0.62)} material={metal} position={[0.55, 1.0, 0]} />
      <mesh geometry={caixa(0.08, 0.12, 0.16)} material={FAROL} position={[0.66, 0.86, 0]} />
      <mesh ref={freio} geometry={caixa(0.05, 0.08, 0.14)} material={LUZ_FREIO} position={[-0.8, 0.82, 0]} />
      {/* baú de entrega na cor da loja, com faixa branca */}
      <mesh ref={bauRef} geometry={caixa(0.48, 0.44, 0.48)} material={bau} position={[-0.58, 1.08, 0]} castShadow />
      <mesh geometry={caixa(0.49, 0.07, 0.49)} material={branco} position={[-0.58, 1.12, 0]} />
      {/* motoboy: corpo inclinado para a frente, braços no guidão, capacete */}
      <mesh geometry={caixa(0.3, 0.5, 0.36)} material={jaqueta} position={[-0.06, 1.16, 0]} rotation={[0, 0, -0.32]} castShadow />
      {[-0.17, 0.17].map((z) => <mesh key={z} geometry={caixa(0.5, 0.09, 0.09)} material={jaqueta} position={[0.26, 1.13, z]} rotation={[0, 0, -0.42]} />)}
      {[-0.13, 0.13].map((z) => <mesh key={`p${z}`} geometry={caixa(0.45, 0.13, 0.13)} material={mat("#3A4150", { rough: 0.8 })} position={[0.02, 0.83, z]} rotation={[0, 0, -0.35]} />)}
      <mesh geometry={caixa(0.1, 0.1, 0.1)} material={pele} position={[0.06, 1.42, 0]} />
      <mesh geometry={esfera(0.17, 12)} material={branco} position={[0.1, 1.56, 0]} />
      <mesh geometry={caixa(0.06, 0.1, 0.22)} material={mat("#1C2B3A", { rough: 0.15, metal: 0.4 })} position={[0.25, 1.55, 0]} />
    </group>
  );
}
function Bicicleta({ c }: { c: Carro }) {
  const pedal = useRef<THREE.Group>(null), pernas = useRef<(THREE.Mesh | null)[]>([]), rodas = useRef<(THREE.Mesh | null)[]>([]);
  const ang = useRef(0);
  useFrame((_, dt) => {
    const v = c.v; ang.current += (v * Math.min(dt, 0.1)) / 0.34 * 0.55;
    const a = ang.current;
    if (pedal.current) pedal.current.rotation.z = -a;
    for (const r of rodas.current) if (r) r.rotation.z -= (v * Math.min(dt, 0.1)) / 0.34;
    // pernas: do quadril (x -0.12, y 0.98) até cada pedal (centro do pedivela em x 0, y 0.36, raio 0.16)
    [0, Math.PI].forEach((f, k) => {
      const p = pernas.current[k]; if (!p) return;
      const px = Math.cos(-a + f) * 0.16, py = 0.36 + Math.sin(-a + f) * 0.16;
      const hx = -0.12, hy = 0.98, dx = px - hx, dy = py - hy, L = Math.hypot(dx, dy);
      p.position.set((hx + px) / 2, (hy + py) / 2, k ? 0.1 : -0.1); p.rotation.z = Math.atan2(dy, dx) + Math.PI / 2; p.scale.y = L / 0.62;
    });
  });
  const preto = mat("#1B1E23", { rough: 0.7 }), quadro = mat(c.bici?.cor ?? "#E2575B", { rough: 0.45, metal: 0.3 }), camisa = mat(c.bici?.camisa ?? "#FFFFFF", { rough: 0.8 }), pele = mat("#B98263", { rough: 0.8 });
  return (
    <group>
      {[0.52, -0.52].map((x, k) => <mesh key={x} ref={(el) => { rodas.current[k] = el; }} geometry={toro(0.32, 0.035, 20)} material={preto} position={[x, 0.36, 0]} />)}
      <mesh geometry={caixa(0.78, 0.05, 0.05)} material={quadro} position={[0.02, 0.62, 0]} rotation={[0, 0, -0.18]} />
      <mesh geometry={caixa(0.62, 0.05, 0.05)} material={quadro} position={[-0.2, 0.5, 0]} rotation={[0, 0, 0.72]} />
      <mesh geometry={caixa(0.5, 0.05, 0.05)} material={quadro} position={[0.28, 0.5, 0]} rotation={[0, 0, -0.95]} />
      <mesh geometry={caixa(0.05, 0.05, 0.5)} material={preto} position={[0.46, 0.92, 0]} />
      <mesh geometry={caixa(0.2, 0.05, 0.1)} material={preto} position={[-0.2, 0.86, 0]} />
      <group ref={pedal} position={[0, 0.36, 0]}><mesh geometry={caixa(0.34, 0.04, 0.04)} material={metal()} /></group>
      {/* ciclista: tronco inclinado, braços no guidão, capacete; as pernas acompanham os pedais */}
      <mesh geometry={caixa(0.26, 0.52, 0.32)} material={camisa} position={[0.0, 1.18, 0]} rotation={[0, 0, -0.55]} castShadow />
      {[-0.16, 0.16].map((z) => <mesh key={z} geometry={caixa(0.48, 0.08, 0.08)} material={camisa} position={[0.26, 1.12, z]} rotation={[0, 0, -0.3]} />)}
      {[0, 1].map((k) => <mesh key={`l${k}`} ref={(el) => { pernas.current[k] = el; }} geometry={caixa(0.11, 0.62, 0.11)} material={mat("#2B2F36", { rough: 0.85 })} />)}
      <mesh geometry={esfera(0.13, 10)} material={pele} position={[0.24, 1.46, 0]} />
      <mesh geometry={esfera(0.15, 10)} material={mat(c.bici?.cor ?? "#E2575B", { rough: 0.4 })} position={[0.22, 1.53, 0]} scale={[1.15, 0.7, 1]} />
      <mesh geometry={caixa(0.05, 0.07, 0.1)} material={FAROL} position={[0.5, 0.98, 0]} />
      <mesh geometry={caixa(0.04, 0.06, 0.08)} material={LUZ_FREIO_ACESA} position={[-0.62, 0.78, 0]} />
    </group>
  );
}
const metal = () => mat("#9AA3AE", { metal: 0.6, rough: 0.35 });

// ---------- ônibus e pontos (12/11/2026, "vida na rua") ----------
const MEIO_ONIBUS = 5.3;
// pontos nas calçadas norte e sul do quarteirão da Nuvem (o ônibus contorna a Nuvem virando sempre à direita)
const PONTOS_ONIBUS: { x: number; z: number; d: V2 }[] = [
  { x: 2, z: -26 + FAIXA_CARRO, d: [1, 0] },
  { x: -2, z: 26 - FAIXA_CARRO, d: [-1, 0] },
];
const AZUL = "#0A6CFF";
function Onibus() {
  const vidro = mat("#1C2B3A", { rough: 0.2, metal: 0.4 }), roda = mat("#1B1E23", { rough: 0.8 });
  return (
    <group>
      <mesh geometry={caixa(10.4, 2.5, 2.5)} material={mat(AZUL, { rough: 0.55 })} position={[0, 1.65, 0]} castShadow />
      <mesh geometry={caixa(10.42, 0.35, 2.52)} material={mat("#FFFFFF", { rough: 0.6 })} position={[0, 1.05, 0]} />
      <mesh geometry={caixa(10.3, 0.12, 2.4)} material={mat("#E8ECF2", { rough: 0.6 })} position={[0, 2.95, 0]} />
      {/* janelas dos dois lados e para-brisa */}
      <mesh geometry={caixa(8.6, 0.95, 2.54)} material={vidro} position={[-0.5, 2.15, 0]} />
      <mesh geometry={caixa(0.06, 1.3, 2.2)} material={vidro} position={[5.21, 2.05, 0]} />
      {/* letreiro de destino aceso */}
      <mesh geometry={caixa(0.07, 0.3, 1.6)} material={mat("#FFB020", { emissive: "#FFB020", ei: 1.4 })} position={[5.23, 2.78, 0]} />
      {[[-3.4, 1], [-3.4, -1], [3.3, 1], [3.3, -1]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.48, 0.48, 0.3, 14)} material={roda} position={[x, 0.48, z * 1.13]} rotation={[Math.PI / 2, 0, 0]} />)}
    </group>
  );
}
function PontoOnibus({ x, z, frente }: { x: number; z: number; frente: 1 | -1 }) {
  const metal = mat("#2B2F36", { metal: 0.4, rough: 0.5 });
  return (
    <group position={[x, 0, z]} rotation={[0, frente > 0 ? 0 : Math.PI, 0]}>
      {[-1.5, 1.5].map((px) => <mesh key={px} geometry={caixa(0.08, 2.5, 0.08)} material={metal} position={[px, 1.25, 0.55]} />)}
      <mesh geometry={caixa(3.4, 0.08, 1.5)} material={mat("#F2F4F7", { rough: 0.5 })} position={[0, 2.5, 0]} castShadow />
      <mesh geometry={caixa(3.2, 1.7, 0.05)} material={mat("#BFE3FF", { opacity: 0.45, rough: 0.1 })} position={[0, 1.3, 0.62]} />
      <mesh geometry={caixa(2.4, 0.08, 0.42)} material={mat("#A0703C", { rough: 0.9 })} position={[0, 0.46, 0.38]} />
      <mesh geometry={cilindro(0.04, 0.04, 2.6, 6)} material={metal} position={[-2.1, 1.3, 0]} />
      <mesh geometry={caixa(0.06, 0.55, 0.55)} material={mat(AZUL, { emissive: AZUL, ei: 0.4 })} position={[-2.1, 2.45, 0]} />
    </group>
  );
}
export function PontosOnibus() {
  // abrigo na beira da calçada, ao lado de onde o ônibus para
  return <Estatico>{PONTOS_ONIBUS.map((p, i) => <PontoOnibus key={i} x={p.x} z={p.z + (p.d[0] > 0 ? 2.05 : -2.05)} frente={p.d[0] > 0 ? 1 : -1} />)}</Estatico>;
}

// ---------- pedestres que atravessam na faixa (12/11/2026) ----------
// Andam pelo meio da calçada em volta do quarteirão; em cada esquina às vezes atravessam para o quarteirão vizinho, pela
// faixa, quando os carros daquela rua estão no vermelho (e ainda dá tempo de chegar do outro lado). Os carros param
// para quem está na faixa, inclusive quem vira à direita.
const B_CALCADA = BORDA_CALCADA - 1.2; // meio da calçada (21,3 do centro do quarteirão)
const EIXO = PASSO / 2; // eixo da rua a partir do centro do quarteirão (26)
const QUART = new Set(QUARTEIROES.map((q) => `${q.i},${q.j}`));
interface Passante { x: number; z: number; v: number; vMax: number; estado: "andando" | "esperando" | "atravessando"; alvo: [number, number]; i: number; j: number; canto: number; sentido: 1 | -1; espera: { cr: Cruzamento; eixoCarros: "x" | "z"; i: number; j: number; canto: number } | null; boneco: string; camisa: string; rot: number }
export const PEDESTRES: Passante[] = [];
const cantoXZ = (i: number, j: number, k: number): [number, number] => [i * PASSO + (k === 1 || k === 2 ? B_CALCADA : -B_CALCADA), j * PASSO + (k >= 2 ? B_CALCADA : -B_CALCADA)];

function pedestreAFrente(x: number, z: number, hx: number, hz: number, alcance: number, largura: number): number | null {
  let menor: number | null = null;
  for (const p of PEDESTRES) {
    if (p.estado !== "atravessando") continue;
    const dx = p.x - x, dz = p.z - z, g = dx * hx + dz * hz, lat = Math.abs(-dx * hz + dz * hx);
    if (g > 0 && g < alcance && lat < largura && (menor == null || g < menor)) menor = g;
  }
  return menor;
}
const pedestreNaFrente = (x: number, z: number, hx: number, hz: number, alcance: number, largura: number) => pedestreAFrente(x, z, hx, hz, alcance, largura) != null;

function criarPedestres(n: number): Passante[] {
  const bonecos = ["casual-f", "casual-m", "exec-f", "exec-m", "criativo-f", "criativo-m", "classico", "coque", "longo", "ruivo"];
  const cores = ["#E2575B", "#F2913D", "#3FBFA8", "#1D4ED8", "#8B6CF0", "#22A86B", "#EC6B8D", "#FFB020", "#2B2F36", "#40C4FF"];
  const lista: Passante[] = [];
  for (let k = 0; k < n; k++) {
    const q = QUARTEIROES[k % QUARTEIROES.length]; const canto = (k * 3) % 4; const sentido: 1 | -1 = k % 2 ? 1 : -1;
    const [cx, cz] = cantoXZ(q.i, q.j, canto); const prox = (canto + sentido + 4) % 4; const [ax, az] = cantoXZ(q.i, q.j, prox);
    const t = ((k * 37) % 100) / 100; // começa no meio do lado
    lista.push({ x: cx + (ax - cx) * t, z: cz + (az - cz) * t, v: 0, vMax: 1.1 + ((k * 13) % 5) * 0.1, estado: "andando", alvo: [ax, az], i: q.i, j: q.j, canto: prox, sentido, espera: null, boneco: bonecos[k % bonecos.length], camisa: cores[(k * 7) % cores.length], rot: 0 });
  }
  return lista;
}

// travessias possíveis numa esquina: atravessar a rua de cima/baixo (carros do eixo x param) ou a do lado (eixo z)
function travessias(p: Passante) {
  const sx = p.canto === 1 || p.canto === 2 ? 1 : -1, sz = p.canto >= 2 ? 1 : -1;
  const cx = p.i * PASSO, cz = p.j * PASSO;
  const cr = CRUZAMENTOS.find((c) => Math.abs(c.x - (cx + sx * EIXO)) < 0.01 && Math.abs(c.z - (cz + sz * EIXO)) < 0.01);
  const op: NonNullable<Passante["espera"]>[] = [];
  if (!cr) return op;
  if (QUART.has(`${p.i},${p.j + sz}`)) op.push({ cr, eixoCarros: "x", i: p.i, j: p.j + sz, canto: sz > 0 ? (sx > 0 ? 1 : 0) : (sx > 0 ? 2 : 3) });
  if (QUART.has(`${p.i + sx},${p.j}`)) op.push({ cr, eixoCarros: "z", i: p.i + sx, j: p.j, canto: sx > 0 ? (sz > 0 ? 3 : 0) : (sz > 0 ? 2 : 1) });
  return op;
}

function passoPedestres(lista: Passante[], dt: number, t: number) {
  for (const p of lista) {
    if (p.estado === "esperando" && p.espera) {
      const e = p.espera; const pedestre = e.eixoCarros === "x" ? "z" : "x"; // anda quando a rua que cruza (o eixo dos pedestres) está verde
      const podeIr = luzDe(e.cr.grupo, pedestre, t) === "verde" && luzDe(e.cr.grupo, pedestre, t + 7.5) === "verde";
      p.v = 0;
      if (podeIr) { p.estado = "atravessando"; p.alvo = cantoXZ(e.i, e.j, e.canto); }
      continue;
    }
    const dx = p.alvo[0] - p.x, dz = p.alvo[1] - p.z, dist = Math.hypot(dx, dz);
    p.v = Math.min(p.vMax * (p.estado === "atravessando" ? 1.15 : 1), p.v + 2 * dt);
    if (dist > 0.05) { const s = Math.min(dist, p.v * dt); p.x += (dx / dist) * s; p.z += (dz / dist) * s; p.rot = Math.atan2(dx, dz); }
    if (dist > 0.08) continue;
    // chegou: terminou a travessia (está na esquina do quarteirão novo) ou chegou numa esquina
    if (p.estado === "atravessando" && p.espera) { p.i = p.espera.i; p.j = p.espera.j; p.canto = p.espera.canto; p.espera = null; }
    p.estado = "andando";
    const op = travessias(p);
    if (op.length && Math.random() < 0.5) { p.espera = op[Math.floor(Math.random() * op.length)]; p.estado = "esperando"; continue; }
    if (Math.random() < 0.25) p.sentido = (p.sentido * -1) as 1 | -1;
    p.canto = (p.canto + p.sentido + 4) % 4; p.alvo = cantoXZ(p.i, p.j, p.canto);
  }
}

function PassanteBoneco({ p }: { p: Passante }) {
  const g = useRef<THREE.Group>(null), h = useRef<BonecoHandle>(null);
  const fase = useMemo(() => (p.x * 7 + p.z * 3) % 5, [p]);
  useAnimacao(h, () => (p.v > 0.15 ? "walk" : "idle"), fase, HIPS.procedural.base);
  useFrame(() => { const o = g.current; if (!o) return; o.position.set(p.x, 0, p.z); let dif = p.rot - o.rotation.y; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); o.rotation.y += dif * 0.25; });
  const def = BONECO[p.boneco] ?? BONECO.classico;
  return <group ref={g} position={[p.x, 0, p.z]}><BonecoProcedural ref={h} def={def} camisa={p.camisa} cracha={p.camisa} /></group>;
}

export function Passantes() {
  const lista = useMemo(() => criarPedestres(leve() ? 6 : 14), []);
  useEffect(() => { PEDESTRES.length = 0; PEDESTRES.push(...lista); return () => { PEDESTRES.length = 0; }; }, [lista]);
  useFrame((_, dt) => passoPedestres(lista, Math.min(dt, 0.1), relogio.t));
  return <group>{lista.map((p, i) => <PassanteBoneco key={i} p={p} />)}</group>;
}
