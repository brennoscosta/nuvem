"use client";
// Quiosques no mapa (20/11/2026, data/quiosques.ts). Três desenhos, todos com balcão, banquinhos, prateleira, geladeira e
// letreiro com a logo e as cores da empresa: "toldo" (toldo listrado e teto reto), "chale" (madeira e telhado de duas águas
// com placa no alto) e "redondo" (de praia, cobertura em gomos listrados). Livre: portinhola fechada e a placa
// "Disponível". Reservado: em montagem. Aberto: a atendente da empresa atrás do balcão; quem chega no balcão recebe a
// saudação dela (a conversa é a mesma da loja, no cartão: ui/Quiosque.tsx). À noite acendem as lâmpadas do toldo e a luz de dentro.
// 21/11/2026 (pedido do dono: "muito pequenos" e "de frente para o local errado"): tamanho de quiosque de verdade (4,2 × 3 m,
// data/quiosques.ts), todos na Rua dos Quiosques da Orla, cada um no seu terreninho de 6,4 × 6 m marcado no chão, onde o
// dono gira e ajusta no modo "Editar posição". Desempenho: as peças paradas de TODOS os quiosques vão para um <Estatico> só
// (as lâmpadas também: o brilho é do material); o letreiro dos livres é uma textura só com os 14 números. O quiosque em edição
// sai do desenho junto e vira fantasma (scene/EditorPosicao.tsx).
import { QuiosqueShopping } from "./QuiosqueShopping";
import * as THREE from "three";
import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { Balao, nichoDestacado } from "./Lotes";
import { ceu } from "./CicloDia";
import { leve } from "./qualidade";
import { BonecoProcedural, HIPS, useAnimacao, type BonecoHandle } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { QUIOSQUES, ESPACOS, QUIOSQUE_POR_CHAVE, PRECO_QUIOSQUE, QUIOSQUE_LARGURA as LQ, QUIOSQUE_FUNDO as FQ, TOLDO_Q, balcaoDoQuiosque, precoDoQuiosque, rotuloQuiosque, corredorDoLote, ehEspacoDoFundo, ehShopping, LOTE_DO_ESPACO, TAMANHO_ESPACO, type QuiosqueInfo } from "../data/quiosques";
import { useMundo, promocaoAtiva, useAgora, type Terreno, type Rascunho } from "../mundoStore";
import { nomeNicho, LOTE_POR_CHAVE } from "../data/mundo";
import { anexosDe, quartosDoTerreno, conferirQuartos, ID_PREDIO } from "../data/posicaoPredio";
import { minhaPos, usePersonagem } from "../personagemStore";
import { useEdicao, editandoQuiosque } from "../edicaoStore";
import { usePoseAoVivo, useFantasma } from "./EditorPosicao";
import type { Membro } from "../data/escritorio";

type Estado = "livre" | "reservado" | "ativo";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const FZ = FQ / 2; // frente do corpo (o balcão)

// ---------- texturas (canvas, em cache) ----------
const cacheTex = new Map<string, THREE.CanvasTexture>();
function guardar(k: string, tex: THREE.CanvasTexture) {
  cacheTex.set(k, tex);
  if (cacheTex.size > 90) { const p = cacheTex.keys().next().value; if (p) { cacheTex.get(p)?.dispose(); cacheTex.delete(p); } }
  return tex;
}
function novaTextura(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { c, g: c.getContext("2d")!, tex };
}
function caberTexto(g: CanvasRenderingContext2D, texto: string, max: number, tam: number, min: number, peso = 900) {
  g.font = `${peso} ${tam}px Inter, Arial, sans-serif`;
  while (g.measureText(texto).width > max && tam > min) { tam -= 2; g.font = `${peso} ${tam}px Inter, Arial, sans-serif`; }
}
// letreiro dos quiosques livres: uma textura só, uma faixa por número (cada letreiro usa a faixa dele pelas coordenadas)
const FAIXA_H = 120;
function texturaLivres() {
  const k = "livres"; const pronta = cacheTex.get(k); if (pronta) return pronta;
  const { g, tex } = novaTextura(640, FAIXA_H * QUIOSQUES.length);
  QUIOSQUES.forEach((q, i) => {
    const y0 = i * FAIXA_H;
    g.fillStyle = "#F7F4EC"; g.fillRect(0, y0, 640, FAIXA_H);
    g.fillStyle = "#0F766E"; g.fillRect(0, y0, 14, FAIXA_H); g.fillRect(626, y0, 14, FAIXA_H);
    g.fillStyle = "#1D2128"; g.textBaseline = "middle"; g.textAlign = "left"; caberTexto(g, `QUIOSQUE ${q.numero}`, 330, 46, 28); g.fillText(`QUIOSQUE ${q.numero}`, 34, y0 + 48);
    g.fillStyle = "#5B6472"; g.font = "700 24px Inter, Arial, sans-serif"; g.fillText("disponível · WorkEnd", 36, y0 + 92);
    g.fillStyle = "#0F766E"; g.beginPath(); g.roundRect(410, y0 + 26, 200, 68, 34); g.fill();
    g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.font = "900 30px Inter, Arial, sans-serif"; g.fillText(`${brl(PRECO_QUIOSQUE)}/mês`, 510, y0 + 61);
  });
  tex.needsUpdate = true;
  return guardar(k, tex);
}
// a faixa do número i na textura dos livres: um plano com as coordenadas recortadas (guardado por tamanho e faixa)
const cacheFaixa = new Map<string, THREE.PlaneGeometry>();
function planoFaixa(w: number, h: number, i: number) {
  const k = `${w}|${h}|${i}`; let g = cacheFaixa.get(k);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv as THREE.BufferAttribute, n = QUIOSQUES.length;
    for (let j = 0; j < uv.count; j++) uv.setY(j, 1 - (i + 1 - uv.getY(j)) / n);
    uv.needsUpdate = true; cacheFaixa.set(k, g);
  }
  return g;
}
// letreiro de quem tem o quiosque: nome e logo
function texturaLetreiro(nome: string, cor: string, logo: string | null, estado: Estado) {
  const k = `l|${nome}|${cor}|${logo ?? ""}|${estado}`; const pronta = cacheTex.get(k); if (pronta) return pronta;
  const { g, tex } = novaTextura(640, 120);
  const desenhar = (img: HTMLImageElement | null) => {
    g.fillStyle = cor; g.fillRect(0, 0, 640, 120);
    const grad = g.createLinearGradient(0, 0, 0, 120); grad.addColorStop(0, "rgba(255,255,255,.18)"); grad.addColorStop(1, "rgba(0,0,0,.12)"); g.fillStyle = grad; g.fillRect(0, 0, 640, 120);
    let x0 = 30;
    if (img) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(18, 12, 96, 96, 18); g.fill(); const s = 84, r = Math.min(s / img.width, s / img.height), w = img.width * r, h = img.height * r; g.drawImage(img, 24 + (s - w) / 2, 18 + (s - h) / 2, w, h); x0 = 134; }
    g.fillStyle = "#FFFFFF"; g.textBaseline = "middle"; g.textAlign = img ? "left" : "center";
    const texto = nome.trim() || "Sua empresa"; caberTexto(g, texto, 640 - x0 - 26, 58, 26);
    g.fillText(texto, img ? x0 : 320, estado === "ativo" ? 60 : 50, 640 - x0 - 26);
    if (estado !== "ativo") { g.font = "800 20px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.85)"; g.fillText("EM MONTAGEM · ABRE EM BREVE", img ? x0 : 320, 96); }
    tex.needsUpdate = true;
  };
  desenhar(null);
  if (logo) { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => desenhar(img); img.src = logo; }
  return guardar(k, tex);
}
// painel da frente do balcão: a logo grande (ou as iniciais) sobre branco, com a faixa da cor
function texturaBalcao(nome: string, cor: string, logo: string | null) {
  const k = `b|${nome}|${cor}|${logo ?? ""}`; const pronta = cacheTex.get(k); if (pronta) return pronta;
  const { g, tex } = novaTextura(256, 144);
  const desenhar = (img: HTMLImageElement | null) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 256, 144); g.fillStyle = cor; g.fillRect(0, 126, 256, 18);
    if (img) { const s = 104, r = Math.min(s / img.width, s / img.height), w = img.width * r, h = img.height * r; g.drawImage(img, (256 - w) / 2, 12 + (s - h) / 2, w, h); }
    else { g.fillStyle = cor; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 64px Inter, Arial, sans-serif"; g.fillText((nome.trim() || "WE").slice(0, 2).toUpperCase(), 128, 66); }
    tex.needsUpdate = true;
  };
  desenhar(null);
  if (logo) { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => desenhar(img); img.src = logo; }
  return guardar(k, tex);
}
// listras do toldo (cor da empresa e branco); "gomos" repete em volta da cobertura redonda
function texturaListras(cor: string, gomos = false) {
  const k = `t|${cor}|${gomos}`; const pronta = cacheTex.get(k); if (pronta) return pronta;
  const { g, tex } = novaTextura(256, 32);
  const n = 8; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? "#FBFAF6" : cor; g.fillRect((i * 256) / n, 0, 256 / n, 32); }
  tex.wrapS = THREE.RepeatWrapping; if (gomos) tex.repeat.set(2, 1);
  tex.needsUpdate = true;
  return guardar(k, tex);
}
const cacheMat = new Map<string, THREE.Material>();
function matTextura(tex: THREE.Texture, basico = false) {
  const k = `${tex.uuid}|${basico}`; let m = cacheMat.get(k);
  if (!m) { m = basico ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }); cacheMat.set(k, m); }
  return m;
}
// lâmpadas do toldo e luz de dentro: um material só, acende com a noite (CicloDia.ceu)
const MAT_LAMPADA = new THREE.MeshStandardMaterial({ color: "#FFF1D6", emissive: "#FFC879", emissiveIntensity: 0.2, roughness: 0.4 });
const MAT_LUZ_DENTRO = new THREE.MeshStandardMaterial({ color: "#FFF6E6", emissive: "#FFD9A0", emissiveIntensity: 0.1, roughness: 0.6 });

// ---------- a cena ----------
interface Dados { k: QuiosqueInfo; t?: Terreno; r: Rascunho | null; estado: Estado; nome: string; cor: string; logo: string | null; nicho?: string | null }
function dadosDe(k: QuiosqueInfo, terrenos: Record<string, Terreno>, sel: string | null, rascunho: Rascunho | null): Dados {
  const t = terrenos[k.chave], r = sel === k.chave && rascunho ? rascunho : null;
  const estado: Estado = t?.status === "ativo" ? "ativo" : t || r ? "reservado" : "livre";
  return { k, t, r, estado, nome: r?.empresaNome ?? t?.empresaNome ?? "", cor: r?.cor ?? t?.cor ?? "#0F766E", logo: r ? r.logoDataUrl : t?.temLogo ? `/api/terrenos/${encodeURIComponent(k.chave)}/logo` : null, nicho: r?.nicho ?? t?.nicho };
}
export function Quiosques() {
  const terrenos = useMundo((s) => s.terrenos);
  const sel = useMundo((s) => s.loteSelecionado);
  const hover = useMundo((s) => s.loteHover);
  const rascunho = useMundo((s) => s.rascunho);
  const editando = useEdicao(editandoQuiosque);
  const agora = useAgora();
  const filtro = useMemo(() => nichoDestacado(), []);
  useFrame(() => { MAT_LAMPADA.emissiveIntensity = 0.2 + ceu.noite * 2.6; MAT_LUZ_DENTRO.emissiveIntensity = 0.1 + ceu.noite * 1.4; });
  // os 14 da orla sempre; os espaços de 10 × 10 m dos lotes (o lote dividido em 4, 24/11/2026) só quando reservados ou alugados (ou sendo reservados
  // agora, com o rascunho): o lote vazio fica só na grama. O espaço livre selecionado ganha só o contorno no chão (MarcaEspaco).
  const espacos = ESPACOS.filter((k) => terrenos[k.chave] || (sel === k.chave && rascunho));
  const dados = [...QUIOSQUES, ...espacos].map((k) => dadosDe(k, terrenos, sel, rascunho));
  const espacoLivre = sel && !terrenos[sel] && !rascunho ? ESPACOS.find((k) => k.chave === sel) ?? null : null;
  // tudo o que é parado, de todos os quiosques menos o que está em edição, num desenho só; muda quando muda um deles
  const juntos = dados.filter((d) => d.k.chave !== editando);
  const assinatura = juntos.map((d) => `${d.k.chave}|${d.estado}|${d.cor}|${d.nome}|${d.logo ?? ""}|${d.k.pos.join(",")}|${d.k.rot.toFixed(4)}`).join(";") + (leve() ? "|leve" : "");
  const emEdicao = editando ? dados.find((d) => d.k.chave === editando) ?? null : null;
  return (
    <group>
      <Terreninhos editando={editando} espacos={espacos} />
      {espacoLivre && <MarcaEspaco k={espacoLivre} />}
      <Estatico key={assinatura}>
        {juntos.map((d) => <group key={d.k.chave} position={[d.k.pos[0], 0, d.k.pos[1]]} rotation={[0, d.k.rot, 0]}><Corpo d={d} /></group>)}
      </Estatico>
      {emEdicao && <QuiosqueEmEdicao d={emEdicao} />}
      {dados.map((d) => {
        const marcado = sel === d.k.chave ? "sel" : hover === d.k.chave ? "hover" : null;
        return <Vivo key={d.k.chave} d={d} marcado={marcado} promo={d.t?.status === "ativo" ? promocaoAtiva(d.t, agora)?.texto ?? null : null} filtro={filtro} />;
      })}
    </group>
  );
}

// o quiosque em edição: o mesmo corpo, num grupo que segue o rascunho e vira fantasma
function QuiosqueEmEdicao({ d }: { d: Dados }) {
  const g = useRef<THREE.Group>(null);
  usePoseAoVivo(g, d.k.chave, [d.k.pos[0], d.k.pos[1], d.k.rot], (p) => [p.centro[0], p.centro[1], p.rot]);
  useFantasma(g, d.k.chave);
  return <group ref={g} position={[d.k.pos[0], 0, d.k.pos[1]]} rotation={[0, d.k.rot, 0]}><Estatico key={`${d.estado}|${d.cor}|${d.nome}|${d.logo ?? ""}`}><Corpo d={d} /></Estatico></group>;
}

// o que mexe ou responde: a atendente, o balão, o número do livre, a área de clique e o contorno (segue a edição também)
function Vivo({ d, marcado, promo, filtro }: { d: Dados; marcado: "sel" | "hover" | null; promo: string | null; filtro: string | null }) {
  const { k, t, estado, nome, cor, logo, nicho } = d;
  const atendente: Membro | null = estado === "ativo" ? t?.escritorio?.equipe.find((m) => m.papel === "atendente") ?? t?.escritorio?.equipe[0] ?? null : null;
  const g = useRef<THREE.Group>(null);
  usePoseAoVivo(g, k.chave, [k.pos[0], k.pos[1], k.rot], (p) => [p.centro[0], p.centro[1], p.rot]);
  const selecionar = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useMundo.getState().selecionarLote(k.chave); };
  const apagado = !!filtro && (estado !== "ativo" || nicho !== filtro);
  return (
    <group ref={g} position={[k.pos[0], 0, k.pos[1]]} rotation={[0, k.rot, 0]}>
      {atendente && <Atendente m={atendente} chave={k.chave} nome={nome} />}
      {estado !== "livre" && <Balao position={[0, k.modelo === "chale" ? 5.2 : 4.6, 0]} nome={nome} cor={cor} logo={logo} subtitulo={estado === "ativo" ? `${rotuloQuiosque(k)} · ${nomeNicho(nicho)}` : `${k.area === "lote" ? "Espaço" : "Quiosque"} · em montagem`} onClick={() => useMundo.getState().selecionarLote(k.chave)} apagado={apagado} destaque={!!filtro && !apagado} promo={promo} />}
      {estado === "livre" && marcado && (
        <Html position={[0, 4.2, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max select-none rounded-full bg-[#0F766E] px-3 py-1 text-[12px] font-bold text-white shadow-lg">{rotuloQuiosque(k)} · {brl(precoDoQuiosque(k.chave))}/mês</div>
        </Html>
      )}
      {/* área de clique e contorno no chão (sob o mouse ou selecionado) */}
      <mesh position={[0, 1.8, 0.5]} geometry={caixa(LQ + 0.6, 3.6, FQ + 2.2)} visible={false} onClick={selecionar}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useMundo.getState().setLoteHover(k.chave); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { useMundo.getState().setLoteHover(null); document.body.style.cursor = ""; }} />
      {marcado && <Contorno cor={marcado === "sel" ? "#1D4ED8" : "#FFFFFF"} forte={marcado === "sel"} />}
    </group>
  );
}

function Contorno({ cor, forte }: { cor: string; forte: boolean }) {
  const w = LQ + 1.0, d = FQ + TOLDO_Q + 1.4, z0 = (TOLDO_Q + 0.4) / 2;
  const m = mat(cor, { emissive: cor, ei: forte ? 0.6 : 0.3 });
  return <group>{[[0, z0 - d / 2, w, 0.12], [0, z0 + d / 2, w, 0.12], [-w / 2, z0, 0.12, d], [w / 2, z0, 0.12, d]].map(([x, z, a, b], i) => <mesh key={i} geometry={caixa(a, 0.06, b)} material={m} position={[x, 0.05, z]} />)}</group>;
}

// espaço de 10 × 10 m livre selecionado no cartão do lote (24/11/2026): só o contorno dele no chão, com o preço por cima
function MarcaEspaco({ k }: { k: QuiosqueInfo }) {
  const r = k.terreno, w = r.x1 - r.x0, d = r.z1 - r.z0, m = mat("#1D4ED8", { emissive: "#1D4ED8", ei: 0.6 });
  return (
    <group position={[(r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2]}>
      {[[0, -d / 2, w, 0.14], [0, d / 2, w, 0.14], [-w / 2, 0, 0.14, d], [w / 2, 0, 0.14, d]].map(([x, z, a, b], i) => <mesh key={i} geometry={caixa(a, 0.06, b)} material={m} position={[x, 0.05, z]} />)}
      <Html position={[0, 1.6, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
        <div className="w-max select-none rounded-full bg-[#1D4ED8] px-3 py-1 text-[12px] font-bold text-white shadow-lg">{rotuloQuiosque(k)} · {TAMANHO_ESPACO} · {brl(precoDoQuiosque(k.chave))}/mês</div>
      </Html>
    </group>
  );
}

// os terreninhos marcados no chão (pedra clara com a borda e os cantos), num desenho só; o do quiosque em edição fica de
// fora (o modo de edição desenha a grade nele)
function Terreninhos({ editando, espacos }: { editando: string | null; espacos: QuiosqueInfo[] }) {
  const pedra = mat("#E7E0D2", { rough: 0.95 }), borda = mat("#B9AE98", { rough: 0.9 }), canto = mat("#0F766E", { rough: 0.8 });
  // lote dividido em 4 (24/11/2026): do espaço de 10 × 10 m fica só a borda no chão (o resto é a grama), e o corredor de
  // pedra no meio do lote aparece quando C ou D (os do fundo) têm empresa
  const corredores = [...new Set(espacos.filter(ehEspacoDoFundo).map((k) => LOTE_DO_ESPACO[k.chave]))].map((ch) => LOTE_POR_CHAVE[ch]).filter(Boolean);
  return (
    <Estatico key={`${editando ?? "-"}|${espacos.map((k) => k.chave).join(",")}`}>
      {QUIOSQUES.filter((k) => k.chave !== editando).map((k) => {
        const r = k.terreno, w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        return (
          <group key={k.chave} position={[cx, 0, cz]}>
            <mesh geometry={caixa(w, 0.04, d)} material={pedra} position={[0, 0.02, 0]} receiveShadow />
            {[[0, -d / 2 + 0.08, w, 0.16], [0, d / 2 - 0.08, w, 0.16], [-w / 2 + 0.08, 0, 0.16, d], [w / 2 - 0.08, 0, 0.16, d]].map(([x, z, a, b], i) => <mesh key={i} geometry={caixa(a, 0.06, b)} material={borda} position={[x, 0.03, z]} receiveShadow />)}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => <mesh key={`c${i}`} geometry={caixa(0.5, 0.07, 0.5)} material={canto} position={[sx * (w / 2 - 0.25), 0.035, sz * (d / 2 - 0.25)]} />)}
          </group>
        );
      })}
      {espacos.filter((k) => k.chave !== editando).map((k) => {
        const r = k.terreno, w = r.x1 - r.x0, d = r.z1 - r.z0;
        return (
          <group key={k.chave} position={[(r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2]}>
            {[[0, -d / 2 + 0.08, w - 0.3, 0.16], [0, d / 2 - 0.08, w - 0.3, 0.16], [-w / 2 + 0.08, 0, 0.16, d - 0.3], [w / 2 - 0.08, 0, 0.16, d - 0.3]].map(([x, z, a, b], i) => <mesh key={i} geometry={caixa(a, 0.05, b)} material={borda} position={[x, 0.03, z]} receiveShadow />)}
          </group>
        );
      })}
      {corredores.map((l) => {
        const c = corredorDoLote(l), w = c.x1 - c.x0, d = c.z1 - c.z0;
        return <mesh key={`corr${l.chave}`} geometry={caixa(w, 0.04, d)} material={pedra} position={[(c.x0 + c.x1) / 2, 0.025, (c.z0 + c.z1) / 2]} receiveShadow />;
      })}
    </Estatico>
  );
}

// a atendente atrás do balcão; quando o meu personagem chega no balcão deste quiosque, ela cumprimenta (balcao: o ponto do
// cliente no quiosque de um lote em quartos, que não está na lista da orla)
function Atendente({ m, chave, nome, balcao }: { m: Membro; chave: string; nome: string; balcao?: [number, number] }) {
  const h = useRef<BonecoHandle>(null);
  const fase = useMemo(() => (m.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97) / 10, [m.id]);
  useAnimacao(h, () => "idle", fase, HIPS.procedural.base);
  const def = BONECO[m.boneco] ?? BONECO.classico;
  const ativo = usePersonagem((s) => s.ativo);
  const [perto, setPerto] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt; if (acc.current < 0.4) return; acc.current = 0;
    const k = balcao ? null : QUIOSQUE_POR_CHAVE[chave] ?? null; if ((!balcao && !k) || !ativo) { if (perto) setPerto(false); return; }
    const [bx, bz] = balcao ?? balcaoDoQuiosque(k!);
    const p = Math.hypot(minhaPos.x - bx, minhaPos.z - bz) < 2.4;
    if (p !== perto) setPerto(p);
  });
  const saudacao = m.treino?.saudacao || `Olá! Bem-vindo à ${nome}. Em que posso ajudar?`;
  return (
    <group position={[0, 0.16, -0.25]}>
      <BonecoProcedural ref={h} def={def} camisa={m.camisa} headset cracha="#1D4ED8" />
      <mesh position={[0, 0.9, 0]} onClick={(e) => { e.stopPropagation(); useMundo.getState().selecionarLote(chave); }}>
        <cylinderGeometry args={[0.4, 0.4, 1.6, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {perto && (
        <Html position={[0, 2.05, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max max-w-[230px] select-none rounded-2xl bg-white/95 px-3 py-2 text-[12.5px] leading-snug text-[#1D2128] shadow-lg"><b className="block">{m.nome}</b>{saudacao}</div>
        </Html>
      )}
    </group>
  );
}

// ---------- o corpo do quiosque (peças paradas, inclusive as lâmpadas e a luz de dentro) ----------
// 4,2 m de frente, 3 m de fundo e 2,5 m de pé-direito: balcão na frente com o painel da logo, a atendente no meio, prateleiras
// e a geladeira no fundo, toldo de 1,1 m e quatro banquinhos (dois no modo leve).
function Corpo({ d }: { d: Dados }) {
  const { k, estado, nome, cor, logo } = d;
  // espaço de 10 × 10 m num lote (24/11/2026): um dos 6 quiosques de shopping, abertos (scene/QuiosqueShopping.tsx)
  if (ehShopping(k.modelo)) return <QuiosqueShopping modelo={k.modelo} cor={cor} letreiro={matTextura(texturaLetreiro(nome, cor, logo, estado), true)} painel={estado === "livre" ? null : matTextura(texturaBalcao(nome, cor, logo))} lampada={MAT_LAMPADA} />;
  const poucos = leve();
  const corEf = estado === "livre" ? "#0F766E" : cor;
  const indice = QUIOSQUES.indexOf(k);
  const letreiro = estado === "livre" ? matTextura(texturaLivres(), true) : matTextura(texturaLetreiro(nome, cor, logo, estado), true);
  const placa = (w: number, h: number) => (estado === "livre" ? planoFaixa(w, h, indice) : plano(w, h));
  const painel = estado === "livre" ? null : matTextura(texturaBalcao(nome, cor, logo));
  const listras = matTextura(texturaListras(estado === "livre" ? "#9AA3AE" : corEf, k.modelo === "redondo"));
  // poucos acabamentos (cada um vira uma malha só no Estatico): fosco, metal e a cor
  const branco = mat("#F7F5F0", { rough: 0.85 }), madeira = mat("#B9875A", { rough: 0.85 }), madeiraEsc = mat("#7A5233", { rough: 0.85 });
  const metal = mat("#3A3F47", { metal: 0.3, rough: 0.5 }), pedra = mat("#EEEAE1", { rough: 0.85 }), corMat = mat(corEf, { rough: 0.85 });
  const piso = k.modelo === "redondo" ? mat("#E3D9C3", { rough: 0.85 }) : mat("#A58A68", { rough: 0.85 });
  const parede = k.modelo === "chale" ? madeira : branco;
  const fechado = estado !== "ativo";
  const H = 2.5, Y0 = 0.16; // pé-direito e altura do deque
  const xsLamp = poucos ? [-1.4, 1.4] : [-1.8, -1.08, -0.36, 0.36, 1.08, 1.8];
  const yLamp = k.modelo === "redondo" ? 2.6 : 2.32, zLamp = k.modelo === "toldo" ? FZ + TOLDO_Q : k.modelo === "chale" ? FZ + 0.2 : FZ + 0.05;
  return (
    <group>
      {/* deque */}
      <mesh geometry={caixa(LQ + 0.4, Y0, FQ + 0.6)} material={piso} position={[0, Y0 / 2, 0.15]} receiveShadow castShadow />
      {/* paredes (o redondo é aberto, com 4 colunas e meia parede no fundo e nos lados) */}
      {k.modelo !== "redondo" ? (
        <>
          <mesh geometry={caixa(LQ, H, 0.1)} material={parede} position={[0, Y0 + H / 2, -FZ + 0.05]} castShadow />
          {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.1, H, FQ)} material={parede} position={[s * (LQ / 2 - 0.05), Y0 + H / 2, 0]} castShadow />)}
          {k.modelo === "toldo" && [-1, 1].map((s) => <mesh key={`f${s}`} geometry={caixa(0.12, 1.0, FQ + 0.02)} material={corMat} position={[s * (LQ / 2 - 0.05), Y0 + 0.5, 0]} />)}
        </>
      ) : (
        <>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} geometry={cilindro(0.07, 0.08, H, 8)} material={branco} position={[sx * (LQ / 2 - 0.14), Y0 + H / 2, sz * (FZ - 0.14)]} castShadow />)}
          <mesh geometry={caixa(LQ - 0.24, 1.1, 0.08)} material={branco} position={[0, Y0 + 0.55, -FZ + 0.14]} />
          {[-1, 1].map((s) => <mesh key={`l${s}`} geometry={caixa(0.08, 1.1, FQ - 0.36)} material={branco} position={[s * (LQ / 2 - 0.14), Y0 + 0.55, 0]} />)}
        </>
      )}
      {/* balcão: corpo, tampo e o painel com a logo */}
      <mesh geometry={caixa(LQ - 0.16, 1.05, 0.55)} material={k.modelo === "chale" ? madeiraEsc : k.modelo === "redondo" ? branco : corMat} position={[0, Y0 + 0.525, FZ - 0.3]} castShadow />
      {k.modelo === "redondo" && <mesh geometry={caixa(LQ - 0.14, 0.18, 0.56)} material={corMat} position={[0, Y0 + 0.12, FZ - 0.3]} />}
      <mesh geometry={caixa(LQ + 0.12, 0.06, 0.8)} material={k.modelo === "chale" ? madeira : pedra} position={[0, Y0 + 1.08, FZ - 0.22]} castShadow />
      {painel && <mesh geometry={plano(1.5, 0.84)} material={painel} position={[0, Y0 + 0.55, FZ - 0.02 + 0.004]} />}
      {/* portinhola fechada (livre / em montagem) */}
      {fechado && (
        <group>
          <mesh geometry={caixa(LQ - 0.3, estado === "livre" ? 1.25 : 0.6, 0.04)} material={mat("#C9CDD3", { metal: 0.3, rough: 0.5 })} position={[0, estado === "livre" ? Y0 + 1.74 : Y0 + 2.05, FZ - 0.06]} />
          {!poucos && [0, 1, 2, 3, 4].map((i) => <mesh key={i} geometry={caixa(LQ - 0.32, 0.02, 0.05)} material={metal} position={[0, Y0 + 1.22 + i * 0.25, FZ - 0.05]} />)}
        </group>
      )}
      {/* fundo: prateleiras com mercadoria, a geladeira e o cardápio; no balcão, o caixa e a plantinha */}
      {!poucos && (
        <group>
          {[1.45, 1.85, 2.25].map((y) => <mesh key={y} geometry={caixa(LQ - 1.6, 0.05, 0.32)} material={madeira} position={[0.45, Y0 + y - 0.16, -FZ + 0.27]} />)}
          {estado === "ativo" && [-0.7, -0.25, 0.2, 0.65, 1.1, 1.5].map((x, i) => <mesh key={x} geometry={i % 2 ? cilindro(0.08, 0.08, 0.2, 10) : caixa(0.22, 0.18, 0.16)} material={mat(["#F2C14E", "#E2575B", "#4E9B47", "#8B6CF0", corEf, "#2DA6D6"][i], { rough: 0.85 })} position={[x, Y0 + 1.42 + (i % 3) * 0.4, -FZ + 0.27]} />)}
          <mesh geometry={caixa(0.72, 1.7, 0.62)} material={mat("#E9EEF2", { metal: 0.3, rough: 0.5 })} position={[-(LQ / 2 - 0.55), Y0 + 0.85, -FZ + 0.42]} castShadow />
          <mesh geometry={caixa(0.6, 1.1, 0.02)} material={mat("#20262E", { rough: 0.85 })} position={[-(LQ / 2 - 0.55), Y0 + 1.05, -FZ + 0.74]} />
          {estado === "ativo" && <mesh geometry={caixa(0.4, 0.15, 0.28)} material={metal} position={[1.3, Y0 + 1.18, FZ - 0.3]} />}
          {estado === "ativo" && <group position={[-1.35, Y0 + 1.11, FZ - 0.25]}><mesh geometry={cilindro(0.1, 0.08, 0.18, 10)} material={mat("#C2703D", { rough: 0.85 })} position={[0, 0.09, 0]} /><mesh geometry={esfera(0.17, 8)} material={mat("#4E9B47", { rough: 0.85 })} position={[0, 0.3, 0]} /></group>}
        </group>
      )}
      {/* banquinhos na frente do balcão */}
      {(poucos ? [-0.9, 0.9] : [-1.5, -0.5, 0.5, 1.5]).map((x) => (
        <group key={x} position={[x, Y0, FZ + 0.6]}>
          <mesh geometry={cilindro(0.04, 0.07, 0.66, 6)} material={metal} position={[0, 0.33, 0]} />
          <mesh geometry={cilindro(0.23, 0.21, 0.08, 12)} material={estado === "livre" ? madeira : corMat} position={[0, 0.7, 0]} castShadow />
          {!poucos && <mesh geometry={cilindro(0.18, 0.18, 0.02, 12)} material={metal} position={[0, 0.22, 0]} />}
        </group>
      ))}
      {/* lâmpadas da beira e a luz do teto (o brilho vem do material, que acende com a noite) */}
      {xsLamp.map((x) => <mesh key={`lp${x}`} geometry={esfera(0.06, 8)} material={MAT_LAMPADA} position={[x, yLamp, zLamp]} />)}
      <mesh geometry={caixa(2.2, 0.04, 0.4)} material={MAT_LUZ_DENTRO} position={[0, Y0 + H - 0.04, -0.15]} />
      {/* cobertura de cada modelo e o letreiro */}
      {k.modelo === "toldo" && (
        <group>
          <mesh geometry={caixa(LQ + 0.3, 0.16, FQ + 0.3)} material={branco} position={[0, Y0 + H + 0.08, 0]} castShadow />
          <mesh geometry={caixa(LQ + 0.3, 0.64, 0.1)} material={branco} position={[0, Y0 + H + 0.46, FZ + 0.1]} />
          <mesh geometry={placa(LQ + 0.14, 0.56)} material={letreiro} position={[0, Y0 + H + 0.46, FZ + 0.155]} />
          {/* toldo listrado caindo para a frente, com a sanefa */}
          <mesh geometry={caixa(LQ + 0.4, 0.04, TOLDO_Q + 0.12)} material={listras} position={[0, Y0 + H - 0.2, FZ + (TOLDO_Q + 0.12) / 2]} rotation={[0.32, 0, 0]} castShadow />
          <mesh geometry={caixa(LQ + 0.4, 0.24, 0.03)} material={listras} position={[0, Y0 + H - 0.5, FZ + TOLDO_Q + 0.05]} />
        </group>
      )}
      {k.modelo === "chale" && (
        <group>
          {[-1, 1].map((s) => <mesh key={s} geometry={caixa(LQ + 0.5, 0.09, 2.05)} material={corMat} position={[0, Y0 + H + 0.42, s * 0.78]} rotation={[s * 0.5, 0, 0]} castShadow />)}
          <mesh geometry={caixa(LQ + 0.52, 0.11, 0.11)} material={corMat} position={[0, Y0 + H + 0.92, 0]} />
          <mesh geometry={caixa(LQ + 0.5, 0.24, 0.03)} material={listras} position={[0, Y0 + H - 0.22, FZ + 0.22]} />
          {/* placa em pé no alto do telhado, dos dois lados */}
          {[-0.75, 0.75].map((x) => <mesh key={x} geometry={caixa(0.07, 0.5, 0.07)} material={metal} position={[x, Y0 + H + 1.16, 0]} />)}
          <mesh geometry={caixa(3.1, 0.62, 0.07)} material={branco} position={[0, Y0 + H + 1.68, 0]} />
          <mesh geometry={placa(3.02, 0.54)} material={letreiro} position={[0, Y0 + H + 1.68, 0.04]} />
          <mesh geometry={placa(3.02, 0.54)} material={letreiro} position={[0, Y0 + H + 1.68, -0.04]} rotation={[0, Math.PI, 0]} />
        </group>
      )}
      {k.modelo === "redondo" && (
        <group>
          <mesh geometry={caixa(LQ + 0.12, 0.12, FQ + 0.12)} material={branco} position={[0, Y0 + H + 0.02, 0]} />
          <mesh geometry={cilindro(0.07, 2.9, 1.15, 8)} material={listras} position={[0, Y0 + H + 0.66, 0]} rotation={[0, Math.PI / 8, 0]} castShadow />
          <mesh geometry={esfera(0.14, 10)} material={corMat} position={[0, Y0 + H + 1.28, 0]} />
          <mesh geometry={caixa(LQ - 0.12, 0.52, 0.08)} material={branco} position={[0, Y0 + H - 0.3, FZ - 0.06]} />
          <mesh geometry={placa(LQ - 0.2, 0.46)} material={letreiro} position={[0, Y0 + H - 0.3, FZ - 0.015]} />
        </group>
      )}
    </group>
  );
}

// ---------- quiosques dos lotes em quartos (21/11/2026, data/quartosLote.ts) ----------
// Pedido do dono: o lote pode ter só um quiosque num quarto (e depois mais quiosques nos quartos livres). O mesmo desenho dos
// quiosques da orla (Corpo), com o nome, a logo e a cor da empresa do lote e a atendente no balcão; quem chega no balcão é
// atendido pela mesma atendente da empresa (data/entradas.ts › balcao). Desempenho: as peças paradas de TODOS os quiosques
// dos lotes vão para um <Estatico> só (como os da orla); cada quiosque soma a atendente (uma malha com esqueleto) e a área
// de clique invisível. O quiosque em edição sai do desenho junto e vira fantasma (scene/EditorPosicao.tsx).
interface QuiosqueDoLote { chave: string; id: string; k: QuiosqueInfo; d: Dados; atendente: Membro | null; balcao: [number, number] }
export function QuiosquesDosLotes() {
  const terrenos = useMundo((s) => s.terrenos);
  const sel = useMundo((s) => s.loteSelecionado);
  const rascunhoEsc = useMundo((s) => s.rascunhoEscritorio);
  const rascunho = useMundo((s) => s.rascunho);
  const editando = useEdicao((s) => (s.chave && s.estrutura && s.estrutura !== ID_PREDIO ? `${s.chave}#${s.estrutura}` : null));
  const lista = useMemo(() => {
    const anexos = anexosDe(terrenos), out: QuiosqueDoLote[] = [];
    for (const t of Object.values(terrenos)) {
      if (t.status !== "ativo" || t.anexoDe) continue;
      const e = t.chave === sel && rascunhoEsc ? rascunhoEsc : t.escritorio; if (!e) continue;
      const q = quartosDoTerreno({ chave: t.chave, status: t.status, escritorio: e }, anexos[t.chave] ?? null); if (!q) continue;
      const r = t.chave === sel && rascunho ? rascunho : null;
      const nome = r?.empresaNome ?? t.empresaNome, cor = r?.cor ?? t.cor, logo = r ? r.logoDataUrl : t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null;
      const atendente = e.equipe.find((m) => m.papel === "atendente") ?? e.equipe[0] ?? null;
      for (const p of conferirQuartos(t.chave, e).poses) {
        const est = p.estrutura; if (est?.tamanho !== "quiosque") continue;
        const modelo = q.quiosques.find((x) => x.id === est.id)?.modelo ?? "toldo";
        const k: QuiosqueInfo = { chave: `${t.chave}#${est.id}`, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? 0, area: "orlaCentro", ponto: "", modelo, terreno: p.terreno.limite ?? p.terreno.ret, pos0: p.centro, rot0: p.rot, pos: p.centro, rot: p.rot };
        out.push({ chave: t.chave, id: est.id, k, d: { k, t, r: null, estado: "ativo", nome, cor, logo, nicho: t.nicho }, atendente, balcao: p.porta });
      }
    }
    return out;
  }, [terrenos, sel, rascunhoEsc, rascunho]);
  if (!lista.length) return null;
  const juntos = lista.filter((x) => x.k.chave !== editando);
  const assinatura = juntos.map((x) => `${x.k.chave}|${x.d.cor}|${x.d.nome}|${x.d.logo ?? ""}|${x.k.modelo}|${x.k.pos.join(",")}|${x.k.rot.toFixed(4)}`).join(";") + (leve() ? "|leve" : "");
  const emEdicao = editando ? lista.find((x) => x.k.chave === editando) ?? null : null;
  return (
    <group>
      {juntos.length > 0 && <Estatico key={assinatura}>{juntos.map((x) => <group key={x.k.chave} position={[x.k.pos[0], 0, x.k.pos[1]]} rotation={[0, x.k.rot, 0]}><Corpo d={x.d} /></group>)}</Estatico>}
      {emEdicao && <QuiosqueDoLoteEmEdicao x={emEdicao} />}
      {lista.map((x) => <VivoDoLote key={x.k.chave} x={x} />)}
    </group>
  );
}
function QuiosqueDoLoteEmEdicao({ x }: { x: QuiosqueDoLote }) {
  const g = useRef<THREE.Group>(null);
  usePoseAoVivo(g, x.chave, [x.k.pos[0], x.k.pos[1], x.k.rot], (p) => [p.centro[0], p.centro[1], p.rot], x.id);
  useFantasma(g, x.chave, x.id);
  return <group ref={g} position={[x.k.pos[0], 0, x.k.pos[1]]} rotation={[0, x.k.rot, 0]}><Estatico key={`${x.d.cor}|${x.d.nome}|${x.d.logo ?? ""}|${x.k.modelo}`}><Corpo d={x.d} /></Estatico></group>;
}
// a atendente e a área de clique (abre o cartão do lote); seguem a edição também
function VivoDoLote({ x }: { x: QuiosqueDoLote }) {
  const g = useRef<THREE.Group>(null);
  usePoseAoVivo(g, x.chave, [x.k.pos[0], x.k.pos[1], x.k.rot], (p) => [p.centro[0], p.centro[1], p.rot], x.id);
  const selecionar = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useMundo.getState().selecionarLote(x.chave); };
  return (
    <group ref={g} name={`quiosque-lote:${x.k.chave}`} position={[x.k.pos[0], 0, x.k.pos[1]]} rotation={[0, x.k.rot, 0]}>
      {x.atendente && <Atendente m={x.atendente} chave={x.chave} nome={x.d.nome} balcao={x.balcao} />}
      <mesh position={[0, 1.8, 0.5]} geometry={caixa(LQ + 0.6, 3.6, FQ + 2.2)} visible={false} onClick={selecionar}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useMundo.getState().setLoteHover(x.chave); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { useMundo.getState().setLoteHover(null); document.body.style.cursor = ""; }} />
    </group>
  );
}
