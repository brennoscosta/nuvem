"use client";
// Praça de eventos (12/11/2026, ideia do dono): o lote 0,1,1, em frente à Nuvem, virou praça. Palco no fundo com um telão
// que mostra o evento do momento (ou o próximo), plateia no meio e postes de luz. Aos sábados, das 8h às 18h (Brasília),
// as 6 barracas da feira aparecem nas laterais com o nome de quem alugou; ?feira=1 liga a feira fora do sábado (prévias).
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { Arvore } from "./Entorno";
import { Estatico } from "./Estatico";
import { Balao } from "./Lotes";
import { ceu } from "./CicloDia";
import { LOTE_POR_CHAVE, frenteDoLote } from "../data/mundo";
import { PRACA_CHAVE, TIPOS_BARRACA, feiraAberta, dataCurta } from "../data/praca";
import { useMundo, type Praca as DadosPraca, type EventoPraca, type BarracaFeira } from "../mundoStore";

export const feiraVisivel = () => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("feira") === "1") || feiraAberta();
const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const diaSemana = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "");
// o evento que está no palco agora e o próximo
export function eventosDoMomento(agenda: EventoPraca[], agora = Date.now()) {
  const vivo = agenda.find((e) => new Date(e.inicio).getTime() <= agora && new Date(e.fim).getTime() > agora) ?? null;
  const proximo = agenda.find((e) => new Date(e.inicio).getTime() > agora) ?? null;
  return { vivo, proximo };
}

// ---------- telão (canvas único, redesenhado quando a agenda muda e a cada minuto) ----------
let TEX_TELAO: THREE.CanvasTexture | null = null;
function texturaTelao() {
  if (TEX_TELAO || typeof document === "undefined") return TEX_TELAO;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 576;
  TEX_TELAO = new THREE.CanvasTexture(c); TEX_TELAO.colorSpace = THREE.SRGBColorSpace; TEX_TELAO.anisotropy = 4;
  return TEX_TELAO;
}
function caber(g: CanvasRenderingContext2D, texto: string, max: number, tam: number, min = 30) {
  g.font = `900 ${tam}px Inter, Arial, sans-serif`;
  while (g.measureText(texto).width > max && tam > min) { tam -= 4; g.font = `900 ${tam}px Inter, Arial, sans-serif`; }
}
function desenharTelao(dados: DadosPraca | null) {
  const tex = texturaTelao(); if (!tex) return;
  const c = tex.image as HTMLCanvasElement, g = c.getContext("2d")!; const W = c.width, H = c.height;
  const { vivo, proximo } = eventosDoMomento(dados?.agenda ?? []);
  const ev = vivo ?? proximo;
  const cor = ev?.empresa.cor ?? "#1D4ED8";
  const fundo = g.createLinearGradient(0, 0, W, H); fundo.addColorStop(0, "#0B1220"); fundo.addColorStop(1, cor); g.fillStyle = fundo; g.fillRect(0, 0, W, H);
  // brilho de palco
  const luz = g.createRadialGradient(W * 0.8, -40, 10, W * 0.8, -40, 520); luz.addColorStop(0, "rgba(255,255,255,.28)"); luz.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = luz; g.fillRect(0, 0, W, H);
  g.textBaseline = "middle"; g.textAlign = "left";
  if (ev) {
    const tag = vivo ? "AO VIVO AGORA" : `PRÓXIMO · ${diaSemana(new Date(ev.inicio)).toUpperCase()} · ${hhmm(new Date(ev.inicio))}`;
    g.font = "800 34px Inter, Arial, sans-serif"; const lt = g.measureText(tag).width + 48;
    g.fillStyle = vivo ? "#E11D48" : "rgba(255,255,255,.16)"; g.beginPath(); g.roundRect(60, 64, lt, 62, 31); g.fill();
    if (vivo) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(88, 95, 9, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#FFFFFF"; g.fillText(tag, vivo ? 108 : 84, 96);
    caber(g, ev.titulo, W - 120, 96); g.fillText(ev.titulo, 60, 250, W - 120);
    g.font = "600 40px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(`por ${ev.empresa.nome}`, 60, 340, W - 120);
    g.font = "500 32px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.7)";
    g.fillText(`${hhmm(new Date(ev.inicio))} às ${hhmm(new Date(ev.fim))}${ev.link ? " · clique na praça para entrar" : ""}`, 60, 410, W - 120);
  } else {
    g.fillStyle = "#FFFFFF"; caber(g, "Praça de Eventos", W - 120, 92); g.fillText("Praça de Eventos", 60, 200);
    g.font = "600 40px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.85)";
    g.fillText("Lives e lançamentos das empresas da cidade", 60, 290, W - 120);
    g.font = "500 32px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.7)"; g.fillText("Tem lote? Marque o seu evento de graça: clique na praça.", 60, 360, W - 120);
  }
  // rodapé: feira de sábado
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, H - 92, W, 92);
  g.fillStyle = "#FFD24A"; g.font = "800 34px Inter, Arial, sans-serif";
  const pagas = dados?.feira.barracas.filter((b) => b.status === "paga").length ?? 0;
  g.fillText(feiraAberta() ? `FEIRA DE SÁBADO ABERTA · ${pagas} barraca${pagas === 1 ? "" : "s"} · até as 18h` : `Feira de sábado ${dados ? dataCurta(dados.feira.dia) : ""} · 8h às 18h · barraca R$ 9,90`, 60, H - 46, W - 120);
  tex.needsUpdate = true;
}

// ---------- placa de cada barraca ----------
const cachePlacas = new Map<string, THREE.CanvasTexture>();
function texturaBarraca(b: BarracaFeira) {
  const livre = b.status !== "paga"; const k = livre ? `livre${b.vaga}` : `${b.vaga}|${b.nome}|${b.cor}|${b.tipo}`;
  let t = cachePlacas.get(k); if (t) return t;
  const c = document.createElement("canvas"); c.width = 512; c.height = 160; const g = c.getContext("2d")!;
  g.fillStyle = livre ? "#F4F1EA" : "#FFFDF8"; g.fillRect(0, 0, 512, 160);
  g.fillStyle = livre ? "#C9C2B4" : b.cor; g.fillRect(0, 0, 512, 14); g.fillRect(0, 146, 512, 14);
  g.textAlign = "center"; g.textBaseline = "middle";
  if (livre) { g.fillStyle = "#7A7366"; g.font = "800 44px Inter, Arial, sans-serif"; g.fillText(b.status === "reservada" ? "RESERVADA" : "BARRACA LIVRE", 256, 70); g.font = "600 28px Inter, Arial, sans-serif"; g.fillText(b.status === "reservada" ? "aguardando o Pix" : "alugue por R$ 9,90 · clique", 256, 118); }
  else {
    const icone = TIPOS_BARRACA.find((x) => x.id === b.tipo)?.icone ?? "🛍️";
    g.font = "64px sans-serif"; g.fillText(icone, 66, 82);
    g.fillStyle = "#1D2128"; let tam = 58; g.font = `900 ${tam}px Inter, Arial, sans-serif`;
    while (g.measureText(b.nome).width > 360 && tam > 26) { tam -= 4; g.font = `900 ${tam}px Inter, Arial, sans-serif`; }
    g.textAlign = "left"; g.fillText(b.nome, 120, 82, 370);
  }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cachePlacas.set(k, t);
  return t;
}
const cacheToldo = new Map<string, THREE.CanvasTexture>();
function texturaToldo(cor: string) {
  let t = cacheToldo.get(cor); if (t) return t;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#FFFFFF" : cor; g.fillRect(i * 16, 0, 16, 128); }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cacheToldo.set(cor, t); return t;
}
// piso de pedra clara em placas
let TEX_PISO: THREE.CanvasTexture | null = null;
function texturaPiso() {
  if (TEX_PISO || typeof document === "undefined") return TEX_PISO;
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#E7E1D5"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#E0D9CB" : "#EDE8DE"; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  TEX_PISO = new THREE.CanvasTexture(c); TEX_PISO.colorSpace = THREE.SRGBColorSpace; TEX_PISO.wrapS = TEX_PISO.wrapT = THREE.RepeatWrapping; TEX_PISO.repeat.set(5, 5); TEX_PISO.anisotropy = 4;
  return TEX_PISO;
}

// lâmpadas da praça e refletores do palco: acendem com a noite (e o palco sempre que tem evento ao vivo)
const MAT_LAMP = new THREE.MeshStandardMaterial({ color: "#3A3F47", emissive: "#FFD58A", emissiveIntensity: 0, roughness: 0.5 });
const MAT_REFLETOR = new THREE.MeshStandardMaterial({ color: "#20242B", emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.4 });
const MAT_TELA = new THREE.MeshBasicMaterial({ toneMapped: false });
const estado = { vivo: false };
function acender() { MAT_LAMP.emissiveIntensity = ceu.noite * 3; MAT_REFLETOR.emissiveIntensity = estado.vivo ? 2.2 : ceu.noite * 1.4; }

// barraca: 4 postes, balcão, toldo listrado na cor e placa com o nome
function Barraca({ b, position, rot }: { b: BarracaFeira; position: [number, number, number]; rot: number }) {
  const placa = useMemo(() => texturaBarraca(b), [b]);
  const paga = b.status === "paga"; const cor = paga ? b.cor : "#B9B2A4";
  const toldo = useMemo(() => texturaToldo(cor), [cor]);
  return (
    <group position={position} rotation={[0, rot, 0]}>
      {paga ? (
        <>
          {[[-1.15, -0.7], [1.15, -0.7], [-1.15, 0.7], [1.15, 0.7]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.05, 0.05, 2.4, 6)} material={mat("#6B4F2A", { rough: 0.9 })} position={[x, 1.2, z]} castShadow />)}
          <mesh geometry={caixa(2.4, 0.9, 0.7)} material={mat("#C99B6B", { rough: 0.9 })} position={[0, 0.45, -0.5]} castShadow />
          <mesh geometry={caixa(2.5, 0.06, 0.8)} material={mat("#F4F1EA", { rough: 0.7 })} position={[0, 0.93, -0.5]} />
          {/* mercadoria em cima do balcão */}
          {[-0.75, -0.2, 0.35, 0.85].map((x, i) => <mesh key={x} geometry={i % 2 ? esfera(0.16, 8) : caixa(0.3, 0.22, 0.26)} material={mat(["#F2C14E", "#E2575B", "#4E9B47", "#8B6CF0"][i], { rough: 0.6 })} position={[x, 1.08, -0.5]} castShadow />)}
          <mesh geometry={caixa(2.7, 0.05, 1.9)} position={[0, 2.45, 0]} rotation={[-0.16, 0, 0]} castShadow><meshStandardMaterial map={toldo} roughness={0.8} /></mesh>
        </>
      ) : (
        // vaga livre: marcação no chão e um cavalete
        <>{[[0, -0.95, 2.6, 0.08], [0, 0.95, 2.6, 0.08], [-1.3, 0, 0.08, 1.9], [1.3, 0, 0.08, 1.9]].map(([x, z, w, d], i) => <mesh key={i} geometry={caixa(w, 0.02, d)} material={mat("#FFFFFF", { rough: 0.9 })} position={[x, 0.03, z]} />)}</>
      )}
      <group position={[0, paga ? 2.1 : 0.9, paga ? -0.86 : -0.2]}>
        {!paga && [-0.7, 0.7].map((x) => <mesh key={x} geometry={caixa(0.06, 1.1, 0.06)} material={mat("#6B4F2A")} position={[x, -0.4, 0.05]} />)}
        <mesh geometry={caixa(2.0, 0.66, 0.05)} material={mat("#FFFFFF")} />
        <mesh geometry={plano(1.92, 0.6)} position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]}><meshBasicMaterial map={placa} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

export function Praca() {
  const l = LOTE_POR_CHAVE[PRACA_CHAVE];
  const dados = useMundo((s) => s.praca);
  const carregar = useMundo((s) => s.carregarPraca);
  // a agenda chega pela API e é conferida a cada minuto (o telão e o aviso de "vai começar" usam a mesma)
  useEffect(() => { void carregar(); const t = setInterval(() => void carregar(), 60_000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => { desenharTelao(dados); estado.vivo = !!eventosDoMomento(dados?.agenda ?? []).vivo; const t = setInterval(() => desenharTelao(dados), 30_000); return () => clearInterval(t); }, [dados]);
  useEffect(() => { const t = texturaTelao(); if (t) { MAT_TELA.map = t; MAT_TELA.needsUpdate = true; } }, []);
  useFrame(acender);
  const piso = useMemo(() => texturaPiso(), []);
  const feira = feiraVisivel();
  if (!l) return null;
  const [x, z] = l.centro; const rot = frenteDoLote(l.k) + Math.PI; // frente local = -z, como os escritórios
  const barracas = dados?.feira.barracas ?? Array.from({ length: 6 }, (_, i) => ({ vaga: i + 1, status: "livre" as const, meu: false, nome: "", descricao: "", cor: "", tipo: "", contato: {} }));
  const { vivo, proximo } = eventosDoMomento(dados?.agenda ?? []);
  const madeira = mat("#8A5A33", { rough: 0.9 }), metal = mat("#2B2F36", { metal: 0.4, rough: 0.5 });
  return (
    <group position={[x, 0, z]}>
      <Balao position={[0, 9.6, 0]} nome="Praça de Eventos" cor={vivo ? "#E11D48" : "#0F766E"} subtitulo={vivo ? `Ao vivo: ${vivo.titulo.slice(0, 26)}` : proximo ? `Próximo: ${diaSemana(new Date(proximo.inicio))} ${hhmm(new Date(proximo.inicio))}` : feira ? "Feira de sábado aberta" : "Lives e lançamentos"} onClick={() => useMundo.getState().selecionarLote(PRACA_CHAVE)} destaque={!!vivo} />
      <group rotation={[0, rot, 0]}>
        {piso && <mesh geometry={plano(19.2, 19.2)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow><meshStandardMaterial map={piso} roughness={0.95} /></mesh>}
        <Estatico>
          {/* palco no fundo, virado para a rua */}
          <mesh geometry={caixa(10.4, 0.9, 5)} material={mat("#3B2A1E", { rough: 0.85 })} position={[0, 0.45, 6.2]} castShadow receiveShadow />
          <mesh geometry={caixa(10.6, 0.08, 5.2)} material={mat("#5A4030", { rough: 0.7 })} position={[0, 0.92, 6.2]} />
          {/* escada de 3 degraus na frente do palco (cada degrau vai até o chão) */}
          {[0, 1, 2].map((i) => <mesh key={i} geometry={caixa(3, (i + 1) * 0.3, 0.45)} material={mat("#5A4030", { rough: 0.8 })} position={[0, (i + 1) * 0.15, 3.7 - 0.225 - 0.45 * (2 - i)]} />)}
          {/* estrutura do telão e treliça com refletores */}
          {[-4.9, 4.9].map((px) => <mesh key={px} geometry={caixa(0.3, 6.6, 0.3)} material={metal} position={[px, 3.3, 8.3]} castShadow />)}
          <mesh geometry={caixa(10.1, 0.3, 0.3)} material={metal} position={[0, 6.5, 8.3]} />
          <mesh geometry={caixa(8.6, 4.9, 0.25)} material={mat("#111418", { rough: 0.5 })} position={[0, 3.75, 8.42]} castShadow />
          {/* caixas de som */}
          {[-5.6, 5.6].map((px) => <group key={px} position={[px, 0, 6.6]}><mesh geometry={caixa(0.9, 2.2, 0.8)} material={mat("#1C1F24", { rough: 0.6 })} position={[0, 1.1, 0]} castShadow />{[0.7, 1.55].map((y) => <mesh key={y} geometry={cilindro(0.28, 0.28, 0.04, 16)} material={mat("#3A3F47")} position={[0, y, -0.42]} rotation={[Math.PI / 2, 0, 0]} />)}</group>)}
          {/* plateia: bancos virados para o palco */}
          {[-0.4, -3.0, -5.6].flatMap((bz) => [-2.6, 2.6].map((bx) => (
            <group key={`${bx},${bz}`} position={[bx, 0, bz]} rotation={[0, Math.PI, 0]}>
              <mesh geometry={caixa(3.2, 0.08, 0.5)} material={madeira} position={[0, 0.46, 0]} castShadow />
              <mesh geometry={caixa(3.2, 0.42, 0.06)} material={madeira} position={[0, 0.74, 0.24]} />
              {[-1.4, 1.4].map((lx) => <mesh key={lx} geometry={caixa(0.08, 0.46, 0.5)} material={metal} position={[lx, 0.23, 0]} />)}
            </group>
          )))}
          {/* canteiros nas pontas da frente */}
          {[-7.8, 7.8].map((cx) => <mesh key={cx} geometry={caixa(3, 0.4, 1.4)} material={mat("#D9D2C4", { rough: 0.95 })} position={[cx, 0.2, -8.6]} />)}
          {[-7.8, 7.8].map((cx) => <mesh key={`g${cx}`} geometry={caixa(2.8, 0.1, 1.2)} material={mat("#4E9B47", { rough: 1 })} position={[cx, 0.42, -8.6]} />)}
          {/* postes de luz */}
          {[[-8.9, -3], [8.9, -3], [-8.9, 3.5], [8.9, 3.5]].map(([px, pz]) => <mesh key={`${px},${pz}`} geometry={cilindro(0.06, 0.08, 4.2, 8)} material={metal} position={[px, 2.1, pz]} castShadow />)}
        </Estatico>
        <mesh geometry={plano(8.2, 4.6)} material={MAT_TELA} position={[0, 3.75, 8.28]} rotation={[0, Math.PI, 0]} />
        {[-3.6, -1.2, 1.2, 3.6].map((rx) => <mesh key={rx} geometry={cilindro(0.18, 0.26, 0.4, 10)} material={MAT_REFLETOR} position={[rx, 6.25, 8.1]} rotation={[0.9, 0, 0]} />)}
        {[[-8.9, -3], [8.9, -3], [-8.9, 3.5], [8.9, 3.5]].map(([px, pz]) => <mesh key={`l${px},${pz}`} geometry={esfera(0.24, 10)} material={MAT_LAMP} position={[px, 4.3, pz]} />)}
        {[[-8.2, 8.6], [8.2, 8.6]].map(([ax, az]) => <Arvore key={ax} position={[ax, 0, az]} escala={1.25} />)}
        {/* feira de sábado: 3 barracas de cada lado, viradas para o corredor do meio */}
        {feira && barracas.map((b, i) => {
          const lado = i < 3 ? -1 : 1, fila = i % 3;
          return <Barraca key={b.vaga} b={b} position={[lado * 7.3, 0, -5.4 + fila * 3.4]} rot={lado * (Math.PI / 2)} />;
        })}
      </group>
    </group>
  );
}
