"use client";
// Na fachada (12/11/2026, lote visual): letreiro de LED com texto correndo e os produtos da vitrine colados no vidro.
// O LED desenha o texto uma vez num canvas (pontos acesos e apagados, como painel de verdade) e só desloca a textura a
// cada quadro. Modos: texto do dono, promoção atual ou "aberto/fechado agora" (pelo horário da agenda ou o que o dono
// informou). A vitrine busca os produtos da loja (rota pública) e monta um cartaz por produto: foto, nome e preço.
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, mat, plano } from "./geo";
import { useAgora } from "../mundoStore";
import { CORES_LED, type Led, type LayoutId } from "../data/escritorio";
import { faixasDoDia, type DiaAgenda } from "../data/agenda";

// ---------- horário de funcionamento ----------
const cacheHorario = new Map<number, Promise<Record<string, DiaAgenda> | null>>();
function horarioDaAgenda(numero: number) {
  let p = cacheHorario.get(numero);
  if (!p) { p = fetch(`/api/workend/loja/${numero}/horario`).then((r) => r.json()).then((j) => (j?.fonte === "agenda" ? (j.horarios as Record<string, DiaAgenda>) : null)).catch(() => null); cacheHorario.set(numero, p); }
  return p;
}
// dia da semana (0 = domingo) e minutos do dia em Brasília
function agoraBR(agora: number) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(agora));
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.find((x) => x.type === "weekday")?.value ?? "Mon");
  return { dia, min: Number(p.find((x) => x.type === "hour")?.value ?? 12) * 60 + Number(p.find((x) => x.type === "minute")?.value ?? 0) };
}
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const NOMES_DIA = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
export function textoHorario(faixas: (d: number) => [number, number][], agora: number) {
  const { dia, min } = agoraBR(agora);
  const hoje = faixas(dia).find(([a, b]) => min >= a && min < b);
  if (hoje) return `ABERTO AGORA · ATÉ ${hhmm(hoje[1])}`;
  const maisTarde = faixas(dia).find(([a]) => a > min);
  if (maisTarde) return `FECHADO · ABRE HOJE ÀS ${hhmm(maisTarde[0])}`;
  for (let k = 1; k <= 7; k++) { const d = (dia + k) % 7; const f = faixas(d)[0]; if (f) return `FECHADO · ABRE ${k === 1 ? "AMANHÃ" : NOMES_DIA[d]} ÀS ${hhmm(f[0])}`; }
  return "FECHADO";
}

// ---------- textura de LED ----------
const texLed = new Map<string, { tex: THREE.CanvasTexture; colunas: number }>();
const CEL = 6, ALT_SRC = 16;
function texturaLed(texto: string, cor: string) {
  const k = `${cor}|${texto}`; const c0 = texLed.get(k); if (c0 || typeof document === "undefined") return c0 ?? null;
  const src = document.createElement("canvas"); const gs = src.getContext("2d")!;
  gs.font = "bold 13px Arial, sans-serif";
  const larg = Math.min(640, Math.ceil(gs.measureText(texto).width) + 40); // espaço no fim antes de repetir
  src.width = larg; src.height = ALT_SRC; gs.font = "bold 13px Arial, sans-serif"; gs.fillStyle = "#fff"; gs.textBaseline = "middle"; gs.fillText(texto, 4, ALT_SRC / 2 + 1);
  const px = gs.getImageData(0, 0, larg, ALT_SRC).data;
  const c = document.createElement("canvas"); c.width = larg * CEL; c.height = ALT_SRC * CEL; const g = c.getContext("2d")!;
  g.fillStyle = "#07080A"; g.fillRect(0, 0, c.width, c.height);
  const apagado = "#2A1E10";
  for (let y = 0; y < ALT_SRC; y++) for (let x = 0; x < larg; x++) {
    const aceso = px[(y * larg + x) * 4 + 3] > 90;
    g.fillStyle = aceso ? cor : apagado; g.beginPath(); g.arc(x * CEL + CEL / 2, y * CEL + CEL / 2, CEL * (aceso ? 0.42 : 0.3), 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  const r = { tex, colunas: larg }; texLed.set(k, r); return r;
}

export function LetreiroLed({ led, numero, promo, nome, y, z, largura }: { led: Led; numero: number | null; promo: string | null; nome: string; y: number; z: number; largura: number }) {
  const agora = useAgora();
  const [agenda, setAgenda] = useState<{ n: number; h: Record<string, DiaAgenda> | null } | null>(null);
  useEffect(() => {
    if (led.modo !== "horario" || !numero) return;
    let vivo = true; void horarioDaAgenda(numero).then((h) => { if (vivo) setAgenda({ n: numero, h }); });
    return () => { vivo = false; };
  }, [led.modo, numero]);
  const h = agenda?.n === numero ? agenda.h : null;
  let texto: string;
  if (led.modo === "promocao") texto = promo ? `🏷 ${promo}` : led.texto || nome;
  else if (led.modo === "horario") {
    const faixas = h ? (d: number) => faixasDoDia(h[String(d)]) : (d: number) => (led.dias.includes(d) ? faixasDoDia({ aberto: true, ini: led.abre, fim: led.fecha }) : []);
    texto = agora ? textoHorario(faixas, agora) : "";
  } else texto = led.texto || nome;
  texto = texto.replace(/🏷\s?/, "").toUpperCase();
  const cor = CORES_LED[led.cor]?.hex ?? CORES_LED.ambar.hex;
  const dados = useMemo(() => (texto ? texturaLed(`   ${texto}   ·`, cor) : null), [texto, cor]);
  const alt = 0.46, ref = useRef<THREE.MeshBasicMaterial>(null);
  // quantas colunas de LED cabem no painel (proporção), e o deslocamento a cada quadro
  useFrame((_, dt) => {
    const m = ref.current; if (!m || !dados) return;
    const visiveis = (largura / alt) * ALT_SRC;
    m.map!.repeat.x = visiveis / dados.colunas;
    m.map!.offset.x = (m.map!.offset.x + dt * 0.11 * (24 / Math.max(24, dados.colunas / 4))) % 1;
  });
  if (!dados) return null;
  return (
    <group position={[0, y, z]}>
      <mesh geometry={caixa(largura + 0.14, alt + 0.14, 0.14)} material={mat("#15171B", { rough: 0.5, metal: 0.3 })} castShadow />
      <mesh geometry={plano(largura, alt)} position={[0, 0, -0.075]} rotation={[0, Math.PI, 0]}>
        <meshBasicMaterial ref={ref} key={dados.tex.uuid} map={dados.tex} toneMapped={false} />
      </mesh>
      {/* suportes até a fachada */}
      {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.07, 0.07, 0.5)} material={mat("#2B2F36")} position={[s * (largura / 2 - 0.3), -alt / 2 - 0.02, 0.25]} />)}
    </group>
  );
}

// ---------- vitrine na janela ----------
export interface ProdutoVitrine { id: string; nome: string; preco: number | null; foto: string | null }
const cacheVitrine = new Map<number, { em: number; p: Promise<ProdutoVitrine[]> }>();
function produtosDaLoja(numero: number) {
  const c = cacheVitrine.get(numero);
  if (c && Date.now() - c.em < 60_000) return c.p;
  const p = fetch(`/api/workend/loja/${numero}/vitrine`).then((r) => (r.ok ? r.json() : null)).then((j) => ((j?.produtos ?? []) as ProdutoVitrine[]).filter((x) => x.foto)).catch(() => []);
  cacheVitrine.set(numero, { em: Date.now(), p }); return p;
}
const precoTexto = (c: number | null) => (c == null ? "Sob consulta" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
// cartaz: foto em cima, nome e preço embaixo, na cor da marca
function montarCartaz(img: HTMLImageElement | null, p: ProdutoVitrine, cor: string) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 352; const g = c.getContext("2d")!;
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 256, 352);
  if (img) { const s = Math.max(240 / img.width, 240 / img.height); const w = img.width * s, h = img.height * s; g.save(); g.beginPath(); g.rect(8, 8, 240, 240); g.clip(); g.drawImage(img, 8 + (240 - w) / 2, 8 + (240 - h) / 2, w, h); g.restore(); }
  else { g.fillStyle = "#EEF1F5"; g.fillRect(8, 8, 240, 240); }
  g.fillStyle = "#1D2128"; g.font = "bold 22px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const nome = p.nome.length > 20 ? p.nome.slice(0, 19) + "…" : p.nome; g.fillText(nome, 128, 274, 236);
  g.fillStyle = cor; g.fillRect(28, 296, 200, 44); g.fillStyle = "#FFFFFF"; g.font = "bold 24px Arial, sans-serif"; g.fillText(precoTexto(p.preco), 128, 319, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// onde os cartazes ficam no vidro de cada prédio (x ao longo da fachada, y do centro do cartaz), medido nas fotos
// (os tipos do kit modular passam os lugares deles: medidasKit().vitrine)
export const CARTAZES: Partial<Record<LayoutId, { x: number; y: number }[]>> = {
  // x local positivo = à esquerda de quem olha a fachada (a frente aponta para -z)
  moderno: [{ x: 5.0, y: 3.25 }, { x: 3.6, y: 3.25 }, { x: 2.2, y: 3.25 }],
  vidro: [{ x: -4.0, y: 1.8 }, { x: -2.6, y: 1.8 }, { x: 2.8, y: 1.8 }, { x: 4.2, y: 1.8 }],
  sobrado: [{ x: 3.9, y: 1.8 }, { x: 2.5, y: 1.8 }, { x: 1.1, y: 1.8 }],
  loja: [{ x: 2.6, y: 2.4 }, { x: 1.3, y: 2.4 }],
  galpao: [{ x: -3.6, y: 2.3 }, { x: 3.4, y: 2.3 }],
  container: [{ x: 3.6, y: 1.7 }, { x: 2.2, y: 1.7 }],
};
// conferência: ?vitrineTeste=1 põe cartazes de mentira em todos os prédios (para medir as posições nas fotos)
const VITRINE_TESTE = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("vitrineTeste");
const FALSOS: ProdutoVitrine[] = [{ id: "t1", nome: "Produto um", preco: 1290, foto: null }, { id: "t2", nome: "Produto dois", preco: 4990, foto: null }, { id: "t3", nome: "Produto três", preco: null, foto: null }, { id: "t4", nome: "Produto quatro", preco: 990, foto: null }];
export function VitrineJanela({ numero, layout, z, sx, sy = 1, cor, lugares: lugaresKit }: { numero: number | null; layout: LayoutId; z: number; sx: number; sy?: number; cor: string; lugares?: { x: number; y: number }[] }) {
  const lugares = lugaresKit ?? CARTAZES[layout] ?? [];
  const [itens, setItens] = useState<{ n: number; texs: THREE.Texture[] } | null>(null);
  useEffect(() => {
    if (!numero) return;
    let vivo = true;
    void (VITRINE_TESTE ? Promise.resolve(FALSOS) : produtosDaLoja(numero)).then((lista) => {
      const max = lugares.length;
      const escolhidos = lista.slice(0, max);
      Promise.all(escolhidos.map((p) => new Promise<THREE.Texture>((ok) => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => ok(montarCartaz(img, p, cor)); img.onerror = () => ok(montarCartaz(null, p, cor));
        if (!p.foto) { ok(montarCartaz(null, p, cor)); return; }
        img.src = p.foto;
      }))).then((texs) => { if (vivo) setItens({ n: numero, texs }); });
    });
    return () => { vivo = false; };
  }, [numero, layout, cor, lugares.length]);
  const texs = itens?.n === numero ? itens.texs : [];
  if (!texs.length) return null;
  return (
    <group>
      {texs.map((t, i) => (
        <group key={i} position={[lugares[i].x * sx, lugares[i].y * sy, z - 0.04]} rotation={[0, Math.PI, 0]}>
          <mesh geometry={plano(0.98, 1.35)}><meshBasicMaterial map={t} toneMapped={false} /></mesh>
          {/* brilho do vidro por cima */}
          <mesh geometry={plano(0.98, 1.35)} position={[0, 0, 0.012]}><meshStandardMaterial color="#DDEFFF" transparent opacity={0.12} roughness={0.05} metalness={0.2} /></mesh>
        </group>
      ))}
    </group>
  );
}
