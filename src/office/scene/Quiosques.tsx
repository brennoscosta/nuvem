"use client";
// Quiosques no mapa (20/11/2026, data/quiosques.ts). Três desenhos, todos com balcão, banquinhos e letreiro com a logo e as
// cores da empresa: "toldo" (toldo listrado e teto reto), "chale" (madeira e telhado de duas águas com placa no alto) e
// "redondo" (de praia, cobertura em gomos listrados). Livre: portinhola fechada e a placa "Disponível". Reservado: em
// montagem. Aberto: a atendente da empresa atrás do balcão; quem chega no balcão recebe a saudação dela (a conversa é a
// mesma da loja, no cartão: ui/Quiosque.tsx). À noite acendem as lâmpadas do toldo e a luz de dentro.
// As peças paradas vão para o <Estatico> (poucos draw calls); a atendente e as lâmpadas ficam de fora.
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
import { QUIOSQUES, QUIOSQUE_LARGURA as LQ, QUIOSQUE_FUNDO as FQ, PRECO_QUIOSQUE, balcaoDoQuiosque, type QuiosqueInfo } from "../data/quiosques";
import { useMundo, promocaoAtiva, useAgora, type Terreno, type Rascunho } from "../mundoStore";
import { nomeNicho } from "../data/mundo";
import { minhaPos, usePersonagem } from "../personagemStore";
import type { Membro } from "../data/escritorio";

type Estado = "livre" | "reservado" | "ativo";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DIST_VER = 175; // longe disto o quiosque some (a câmera não chega a ver o detalhe)

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
// letreiro do alto (faixa larga): nome e logo; livre mostra número e preço
function texturaLetreiro(nome: string, cor: string, logo: string | null, estado: Estado, numero: number) {
  const k = `l|${nome}|${cor}|${logo ?? ""}|${estado}|${numero}`; const pronta = cacheTex.get(k); if (pronta) return pronta;
  const { g, tex } = novaTextura(640, 120);
  const desenhar = (img: HTMLImageElement | null) => {
    if (estado === "livre") {
      g.fillStyle = "#F7F4EC"; g.fillRect(0, 0, 640, 120);
      g.fillStyle = "#0F766E"; g.fillRect(0, 0, 14, 120); g.fillRect(626, 0, 14, 120);
      g.fillStyle = "#1D2128"; g.textBaseline = "middle"; g.textAlign = "left"; caberTexto(g, `QUIOSQUE ${numero}`, 330, 46, 28); g.fillText(`QUIOSQUE ${numero}`, 34, 48);
      g.fillStyle = "#5B6472"; g.font = "700 24px Inter, Arial, sans-serif"; g.fillText("disponível · WorkEnd", 36, 92);
      g.fillStyle = "#0F766E"; g.beginPath(); g.roundRect(410, 26, 200, 68, 34); g.fill();
      g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.font = "900 30px Inter, Arial, sans-serif"; g.fillText(`${brl(PRECO_QUIOSQUE)}/mês`, 510, 61);
    } else {
      g.fillStyle = cor; g.fillRect(0, 0, 640, 120);
      const grad = g.createLinearGradient(0, 0, 0, 120); grad.addColorStop(0, "rgba(255,255,255,.18)"); grad.addColorStop(1, "rgba(0,0,0,.12)"); g.fillStyle = grad; g.fillRect(0, 0, 640, 120);
      let x0 = 30;
      if (img) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(18, 12, 96, 96, 18); g.fill(); const s = 84, r = Math.min(s / img.width, s / img.height), w = img.width * r, h = img.height * r; g.drawImage(img, 24 + (s - w) / 2, 18 + (s - h) / 2, w, h); x0 = 134; }
      g.fillStyle = "#FFFFFF"; g.textBaseline = "middle"; g.textAlign = img ? "left" : "center";
      const texto = nome.trim() || "Sua empresa"; caberTexto(g, texto, 640 - x0 - 26, 58, 26);
      g.fillText(texto, img ? x0 : 320, estado === "ativo" ? 60 : 50, 640 - x0 - 26);
      if (estado !== "ativo") { g.font = "800 20px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.85)"; g.fillText("EM MONTAGEM · ABRE EM BREVE", img ? x0 : 320, 96); }
    }
    tex.needsUpdate = true;
  };
  desenhar(null);
  if (logo && estado !== "livre") { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => desenhar(img); img.src = logo; }
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
export function Quiosques() {
  const terrenos = useMundo((s) => s.terrenos);
  const sel = useMundo((s) => s.loteSelecionado);
  const hover = useMundo((s) => s.loteHover);
  const rascunho = useMundo((s) => s.rascunho);
  const agora = useAgora();
  const filtro = useMemo(() => nichoDestacado(), []);
  useFrame(() => { MAT_LAMPADA.emissiveIntensity = 0.2 + ceu.noite * 2.6; MAT_LUZ_DENTRO.emissiveIntensity = 0.1 + ceu.noite * 1.4; });
  return (
    <group>
      {QUIOSQUES.map((k) => {
        const t = terrenos[k.chave];
        const r: Rascunho | null = sel === k.chave && rascunho ? rascunho : null;
        return <Quiosque3D key={k.chave} k={k} t={t} r={r} marcado={sel === k.chave ? "sel" : hover === k.chave ? "hover" : null} promo={t?.status === "ativo" ? promocaoAtiva(t, agora)?.texto ?? null : null} filtro={filtro} />;
      })}
    </group>
  );
}

function Quiosque3D({ k, t, r, marcado, promo, filtro }: { k: QuiosqueInfo; t?: Terreno; r: Rascunho | null; marcado: "sel" | "hover" | null; promo: string | null; filtro: string | null }) {
  const estado: Estado = t?.status === "ativo" ? "ativo" : t || r ? "reservado" : "livre";
  const nome = r?.empresaNome ?? t?.empresaNome ?? "";
  const cor = r?.cor ?? t?.cor ?? "#0F766E";
  const logo = r ? r.logoDataUrl : t?.temLogo ? `/api/terrenos/${encodeURIComponent(k.chave)}/logo` : null;
  const nicho = r?.nicho ?? t?.nicho;
  const atendente: Membro | null = estado === "ativo" ? t?.escritorio?.equipe.find((m) => m.papel === "atendente") ?? t?.escritorio?.equipe[0] ?? null : null;
  const g = useRef<THREE.Group>(null); const n = useRef(0);
  useFrame(({ camera }) => {
    if ((n.current++ & 7) !== 0 || !g.current) return;
    const dx = camera.position.x - k.pos[0], dz = camera.position.z - k.pos[1];
    g.current.visible = dx * dx + dz * dz < DIST_VER * DIST_VER;
  });
  const selecionar = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useMundo.getState().selecionarLote(k.chave); };
  const apagado = !!filtro && (estado !== "ativo" || nicho !== filtro);
  return (
    <group ref={g} position={[k.pos[0], 0, k.pos[1]]} rotation={[0, k.rot, 0]}>
      <Estatico key={`${estado}|${cor}|${nome}|${logo ?? ""}`}>
        <Corpo k={k} cor={cor} nome={nome} logo={logo} estado={estado} />
      </Estatico>
      <Lampadas k={k} />
      {atendente && <Atendente m={atendente} chave={k.chave} nome={nome} />}
      {estado !== "livre" && <Balao position={[0, k.modelo === "chale" ? 4.6 : 4.1, 0]} nome={nome} cor={cor} logo={logo} subtitulo={estado === "ativo" ? `Quiosque ${k.numero} · ${nomeNicho(nicho)}` : "Quiosque · em montagem"} onClick={() => useMundo.getState().selecionarLote(k.chave)} apagado={apagado} destaque={!!filtro && !apagado} promo={promo} />}
      {estado === "livre" && marcado && (
        <Html position={[0, 3.6, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max select-none rounded-full bg-[#0F766E] px-3 py-1 text-[12px] font-bold text-white shadow-lg">Quiosque {k.numero} · {brl(PRECO_QUIOSQUE)}/mês</div>
        </Html>
      )}
      {/* área de clique e contorno no chão (sob o mouse ou selecionado) */}
      <mesh position={[0, 1.6, 0.35]} geometry={caixa(LQ + 0.5, 3.3, FQ + 1.5)} visible={false} onClick={selecionar}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useMundo.getState().setLoteHover(k.chave); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { useMundo.getState().setLoteHover(null); document.body.style.cursor = ""; }} />
      {marcado && <Contorno cor={marcado === "sel" ? "#1D4ED8" : "#FFFFFF"} forte={marcado === "sel"} />}
    </group>
  );
}

function Contorno({ cor, forte }: { cor: string; forte: boolean }) {
  const w = LQ + 1.0, d = FQ + 2.0, z0 = 0.45;
  const m = mat(cor, { emissive: cor, ei: forte ? 0.6 : 0.3 });
  return <group>{[[0, z0 - d / 2, w, 0.12], [0, z0 + d / 2, w, 0.12], [-w / 2, z0, 0.12, d], [w / 2, z0, 0.12, d]].map(([x, z, a, b], i) => <mesh key={i} geometry={caixa(a, 0.06, b)} material={m} position={[x, 0.05, z]} />)}</group>;
}

// lâmpadas na borda do toldo e a luz do teto (fora do Estatico: o brilho muda com a hora)
function Lampadas({ k }: { k: QuiosqueInfo }) {
  const y = k.modelo === "toldo" ? 2.0 : k.modelo === "chale" ? 2.0 : 1.96, z = k.modelo === "toldo" ? FQ / 2 + 0.84 : k.modelo === "chale" ? FQ / 2 + 0.14 : FQ / 2 + 0.03;
  const xs = leve() ? [-0.9, 0.9] : [-1.2, -0.6, 0, 0.6, 1.2];
  return (
    <group>
      {xs.map((x) => <mesh key={x} geometry={esfera(0.055, 8)} material={MAT_LAMPADA} position={[x, y, z]} />)}
      <mesh geometry={caixa(1.6, 0.04, 0.32)} material={MAT_LUZ_DENTRO} position={[0, 2.36, -0.1]} />
    </group>
  );
}

// a atendente atrás do balcão; quando o meu personagem chega no balcão deste quiosque, ela cumprimenta
function Atendente({ m, chave, nome }: { m: Membro; chave: string; nome: string }) {
  const h = useRef<BonecoHandle>(null);
  const fase = useMemo(() => (m.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97) / 10, [m.id]);
  useAnimacao(h, () => "idle", fase, HIPS.procedural.base);
  const def = BONECO[m.boneco] ?? BONECO.classico;
  const ativo = usePersonagem((s) => s.ativo);
  const [perto, setPerto] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt; if (acc.current < 0.4) return; acc.current = 0;
    const k = QUIOSQUES.find((q) => q.chave === chave); if (!k || !ativo) { if (perto) setPerto(false); return; }
    const [bx, bz] = balcaoDoQuiosque(k);
    const p = Math.hypot(minhaPos.x - bx, minhaPos.z - bz) < 2.4;
    if (p !== perto) setPerto(p);
  });
  const saudacao = m.treino?.saudacao || `Olá! Bem-vindo à ${nome}. Em que posso ajudar?`;
  return (
    <group position={[0, 0.14, -0.2]}>
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

// ---------- o corpo do quiosque (peças paradas) ----------
function Corpo({ k, cor, nome, logo, estado }: { k: QuiosqueInfo; cor: string; nome: string; logo: string | null; estado: Estado }) {
  const poucos = leve();
  const corEf = estado === "livre" ? "#0F766E" : cor;
  const letreiro = matTextura(texturaLetreiro(nome, cor, logo, estado, k.numero), true);
  const painel = estado === "livre" ? null : matTextura(texturaBalcao(nome, cor, logo));
  const listras = matTextura(texturaListras(estado === "livre" ? "#9AA3AE" : corEf, k.modelo === "redondo"));
  const branco = mat("#F7F5F0", { rough: 0.8 }), madeira = mat("#B9875A", { rough: 0.9 }), madeiraEsc = mat("#7A5233", { rough: 0.85 });
  const metal = mat("#3A3F47", { metal: 0.3, rough: 0.5 }), pedra = mat("#EEEAE1", { rough: 0.7 }), corMat = mat(corEf, { rough: 0.7 });
  const piso = k.modelo === "redondo" ? mat("#E3D9C3", { rough: 0.95 }) : mat("#A58A68", { rough: 0.95 });
  const fz = FQ / 2; // frente do corpo
  const parede = k.modelo === "chale" ? madeira : branco;
  const fechado = estado !== "ativo";
  return (
    <group>
      {/* deque */}
      <mesh geometry={caixa(LQ + 0.3, 0.14, FQ + 0.4)} material={piso} position={[0, 0.07, 0.08]} receiveShadow castShadow />
      {/* paredes (o redondo é aberto, com 4 colunas e meia parede no fundo) */}
      {k.modelo !== "redondo" ? (
        <>
          <mesh geometry={caixa(LQ, 2.3, 0.1)} material={parede} position={[0, 1.29, -fz + 0.05]} castShadow />
          {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.1, 2.3, FQ)} material={parede} position={[s * (LQ / 2 - 0.05), 1.29, 0]} castShadow />)}
          {k.modelo === "toldo" && [-1, 1].map((s) => <mesh key={`f${s}`} geometry={caixa(0.12, 0.95, FQ + 0.02)} material={corMat} position={[s * (LQ / 2 - 0.05), 0.62, 0]} />)}

        </>
      ) : (
        <>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} geometry={cilindro(0.06, 0.07, 2.3, 8)} material={branco} position={[sx * (LQ / 2 - 0.12), 1.29, sz * (fz - 0.12)]} castShadow />)}
          <mesh geometry={caixa(LQ - 0.2, 1.05, 0.08)} material={branco} position={[0, 0.66, -fz + 0.12]} />
          {[-1, 1].map((s) => <mesh key={`l${s}`} geometry={caixa(0.08, 1.05, FQ - 0.3)} material={branco} position={[s * (LQ / 2 - 0.12), 0.66, 0]} />)}
        </>
      )}
      {/* balcão: corpo, tampo e o painel com a logo */}
      <mesh geometry={caixa(LQ - 0.12, 1.0, 0.45)} material={k.modelo === "chale" ? madeiraEsc : k.modelo === "redondo" ? branco : corMat} position={[0, 0.64, fz - 0.24]} castShadow />
      {k.modelo === "redondo" && <mesh geometry={caixa(LQ - 0.1, 0.16, 0.46)} material={corMat} position={[0, 0.26, fz - 0.24]} />}
      <mesh geometry={caixa(LQ + 0.12, 0.06, 0.66)} material={k.modelo === "chale" ? madeira : pedra} position={[0, 1.17, fz - 0.18]} castShadow />
      {painel && <mesh geometry={plano(1.12, 0.63)} material={painel} position={[0, 0.7, fz + 0.002]} />}
      {/* portinhola fechada (livre / em montagem) */}
      {fechado && (
        <group>
          <mesh geometry={caixa(LQ - 0.24, estado === "livre" ? 1.06 : 0.5, 0.04)} material={mat("#C9CDD3", { metal: 0.4, rough: 0.45 })} position={[0, estado === "livre" ? 1.74 : 2.0, fz - 0.06]} />
          {!poucos && [0, 1, 2, 3].map((i) => <mesh key={i} geometry={caixa(LQ - 0.26, 0.02, 0.05)} material={mat("#AEB4BC", { metal: 0.4, rough: 0.45 })} position={[0, 1.36 + i * 0.25, fz - 0.05]} />)}
        </group>
      )}
      {/* prateleira do fundo com mercadoria e o caixa no balcão */}
      {!poucos && (
        <group>
          {[1.45, 1.85].map((y) => <mesh key={y} geometry={caixa(LQ - 0.45, 0.05, 0.28)} material={madeira} position={[0, y, -fz + 0.26]} />)}
          {estado === "ativo" && [-0.9, -0.5, -0.1, 0.35, 0.8].map((x, i) => <mesh key={x} geometry={i % 2 ? cilindro(0.08, 0.08, 0.2, 10) : caixa(0.22, 0.18, 0.16)} material={mat(["#F2C14E", "#E2575B", "#4E9B47", "#8B6CF0", corEf][i], { rough: 0.6 })} position={[x, 1.57 + (i % 2) * 0.4, -fz + 0.26]} />)}
          {estado === "ativo" && <mesh geometry={caixa(0.36, 0.14, 0.26)} material={metal} position={[0.85, 1.27, fz - 0.28]} />}
          {estado === "ativo" && <group position={[-0.95, 1.2, fz - 0.22]}><mesh geometry={cilindro(0.09, 0.07, 0.16, 10)} material={mat("#C2703D")} position={[0, 0.08, 0]} /><mesh geometry={esfera(0.15, 8)} material={mat("#4E9B47", { rough: 1 })} position={[0, 0.26, 0]} /></group>}
        </group>
      )}
      {/* banquinhos na frente do balcão */}
      {(poucos ? [-0.7, 0.7] : [-0.9, 0, 0.9]).map((x) => (
        <group key={x} position={[x, 0.14, fz + 0.55]}>
          <mesh geometry={cilindro(0.035, 0.06, 0.62, 6)} material={metal} position={[0, 0.31, 0]} />
          <mesh geometry={cilindro(0.21, 0.19, 0.08, 12)} material={estado === "livre" ? madeira : corMat} position={[0, 0.66, 0]} castShadow />
          {!poucos && <mesh geometry={cilindro(0.17, 0.17, 0.02, 12)} material={metal} position={[0, 0.2, 0]} />}
        </group>
      ))}
      {/* cobertura de cada modelo e o letreiro */}
      {k.modelo === "toldo" && (
        <group>
          <mesh geometry={caixa(LQ + 0.24, 0.14, FQ + 0.24)} material={branco} position={[0, 2.5, 0]} castShadow />
          <mesh geometry={caixa(LQ + 0.24, 0.52, 0.1)} material={branco} position={[0, 2.82, fz + 0.07]} />
          <mesh geometry={plano(LQ + 0.1, 0.46)} material={letreiro} position={[0, 2.82, fz + 0.125]} />
          {/* toldo listrado caindo para a frente, com a sanefa */}
          <mesh geometry={caixa(LQ + 0.34, 0.035, 1.0)} material={listras} position={[0, 2.29, fz + 0.47]} rotation={[0.34, 0, 0]} castShadow />
          <mesh geometry={caixa(LQ + 0.34, 0.2, 0.03)} material={listras} position={[0, 2.03, fz + 0.94]} />
        </group>
      )}
      {k.modelo === "chale" && (
        <group>
          {[-1, 1].map((s) => <mesh key={s} geometry={caixa(LQ + 0.44, 0.08, 1.62)} material={corMat} position={[0, 2.62, s * 0.6]} rotation={[s * 0.52, 0, 0]} castShadow />)}
          <mesh geometry={caixa(LQ + 0.46, 0.1, 0.1)} material={corMat} position={[0, 3.03, 0]} />
          <mesh geometry={caixa(LQ + 0.44, 0.2, 0.03)} material={listras} position={[0, 2.12, fz + 0.18]} />
          {/* placa em pé no alto do telhado, dos dois lados */}
          {[-0.5, 0.5].map((x) => <mesh key={x} geometry={caixa(0.06, 0.4, 0.06)} material={metal} position={[x, 3.22, 0]} />)}
          <mesh geometry={caixa(2.3, 0.48, 0.06)} material={branco} position={[0, 3.62, 0]} />
          <mesh geometry={plano(2.24, 0.42)} material={letreiro} position={[0, 3.62, 0.035]} />
          <mesh geometry={plano(2.24, 0.42)} material={letreiro} position={[0, 3.62, -0.035]} rotation={[0, Math.PI, 0]} />
        </group>
      )}
      {k.modelo === "redondo" && (
        <group>
          <mesh geometry={caixa(LQ + 0.1, 0.1, FQ + 0.1)} material={branco} position={[0, 2.45, 0]} />
          <mesh geometry={cilindro(0.06, 2.05, 0.95, 8)} material={listras} position={[0, 2.98, 0]} rotation={[0, Math.PI / 8, 0]} castShadow />
          <mesh geometry={esfera(0.12, 10)} material={corMat} position={[0, 3.5, 0]} />
          <mesh geometry={caixa(LQ - 0.1, 0.42, 0.07)} material={branco} position={[0, 2.18, fz - 0.06]} />
          <mesh geometry={plano(LQ - 0.16, 0.38)} material={letreiro} position={[0, 2.18, fz - 0.02]} />
        </group>
      )}
    </group>
  );
}
