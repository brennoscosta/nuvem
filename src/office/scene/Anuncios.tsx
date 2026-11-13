"use client";
// Outdoors nas avenidas e placa de esquina (12/11/2026). A arte é desenhada num canvas com a marca da empresa: fundo na
// cor, logo, nome, frase e o endereço da loja. Clicar no outdoor abre o cartão (alugar ou ver a loja). À noite acendem.
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat, plano } from "./geo";
import { leve } from "./qualidade";
import { Estatico } from "./Estatico";
import { ceu } from "./CicloDia";
import { useMundo } from "../mundoStore";
import { OUTDOORS, type OutdoorPublico } from "../data/outdoors";

export interface DadosMarca { nome: string; cor: string; nicho: string; frase?: string; numero?: number | null; logo?: string | null }
const FONTE = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
function escurecer(cor: string, k: number) { const c = new THREE.Color(cor); c.multiplyScalar(k); return `#${c.getHexString()}`; }
function quebra(g: CanvasRenderingContext2D, texto: string, larg: number, max: number) {
  const linhas: string[] = []; let linha = "";
  for (const p of texto.split(" ")) { const t = linha ? `${linha} ${p}` : p; if (g.measureText(t).width > larg && linha) { linhas.push(linha); linha = p; } else linha = t; }
  if (linha) linhas.push(linha);
  return linhas.slice(0, max);
}
// desenha o anúncio (paisagem, outdoor) ou a placa (retrato, totem)
export function desenharMarca(c: HTMLCanvasElement, d: DadosMarca | null, img: HTMLImageElement | null, retrato = false, rotuloLivre?: { titulo: string; sub: string; chamada: string }) {
  const g = c.getContext("2d")!; const W = c.width, H = c.height;
  if (!d) {
    // vaga livre: fundo noturno com a grade da cidade
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#161C25"); gr.addColorStop(1, "#0A3A8A"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(91,157,255,.18)"; g.lineWidth = 2; for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const r = rotuloLivre ?? { titulo: "Anuncie aqui", sub: "", chamada: "" };
    g.fillStyle = "#FFFFFF"; g.font = `800 ${Math.round(H * 0.2)}px ${FONTE}`; g.textBaseline = "top"; g.fillText(r.titulo, W * 0.06, H * 0.16);
    g.fillStyle = "rgba(255,255,255,.85)"; g.font = `500 ${Math.round(H * 0.075)}px ${FONTE}`; quebra(g, r.sub, W * 0.88, 2).forEach((l, i) => g.fillText(l, W * 0.06, H * 0.46 + i * H * 0.1));
    g.fillStyle = "#5B9DFF"; g.font = `700 ${Math.round(H * 0.07)}px ${FONTE}`; g.fillText(r.chamada, W * 0.06, H * 0.78);
    g.fillStyle = "#FFFFFF"; g.font = `800 ${Math.round(H * 0.07)}px ${FONTE}`; g.textAlign = "right"; g.fillText("WorkEnd", W * 0.95, H * 0.78); g.textAlign = "left";
    return;
  }
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, d.cor); gr.addColorStop(1, escurecer(d.cor, 0.45)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // círculos de luz ao fundo
  for (let i = 0; i < 3; i++) { const rg = g.createRadialGradient(W * (0.2 + i * 0.35), H * (i % 2 ? 0.9 : 0.1), 0, W * (0.2 + i * 0.35), H * (i % 2 ? 0.9 : 0.1), W * 0.35); rg.addColorStop(0, "rgba(255,255,255,.16)"); rg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  const L = retrato ? W * 0.62 : H * 0.62, lx = retrato ? (W - L) / 2 : H * 0.17, ly = retrato ? H * 0.07 : H * 0.19;
  g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(lx, ly, L, L, L * 0.16); g.fill();
  if (img) { const k = Math.min((L * 0.86) / img.width, (L * 0.86) / img.height); g.drawImage(img, lx + (L - img.width * k) / 2, ly + (L - img.height * k) / 2, img.width * k, img.height * k); }
  else { g.fillStyle = d.cor; g.font = `900 ${Math.round(L * 0.42)}px ${FONTE}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(d.nome.trim().slice(0, 2).toUpperCase(), lx + L / 2, ly + L / 2); g.textAlign = "left"; }
  g.textBaseline = "top"; g.fillStyle = "#FFFFFF";
  const tx = retrato ? W * 0.08 : lx + L + H * 0.12, larg = retrato ? W * 0.84 : W - tx - W * 0.05;
  let y = retrato ? ly + L + H * 0.05 : H * 0.17;
  g.font = `800 ${Math.round((retrato ? W : H) * (retrato ? 0.13 : 0.16))}px ${FONTE}`;
  for (const l of quebra(g, d.nome, larg, 2)) { if (retrato) { g.textAlign = "center"; g.fillText(l, W / 2, y); g.textAlign = "left"; } else g.fillText(l, tx, y); y += (retrato ? W * 0.14 : H * 0.17); }
  if (d.frase) { g.font = `500 ${Math.round((retrato ? W * 0.07 : H * 0.075))}px ${FONTE}`; g.fillStyle = "rgba(255,255,255,.92)"; for (const l of quebra(g, d.frase, larg, 2)) { if (retrato) { g.textAlign = "center"; g.fillText(l, W / 2, y); g.textAlign = "left"; } else g.fillText(l, tx, y); y += retrato ? W * 0.085 : H * 0.09; } }
  g.font = `700 ${Math.round((retrato ? W * 0.06 : H * 0.06))}px ${FONTE}`; g.fillStyle = "rgba(255,255,255,.8)";
  const rodape = `${d.nicho}${d.numero ? ` · workend.online/loja/${d.numero}` : ""}`;
  if (retrato) { g.textAlign = "center"; g.fillText(rodape, W / 2, H * 0.9); g.textAlign = "left"; } else g.fillText(rodape, tx, H * 0.8);
}

// textura que redesenha quando os dados mudam (e de novo quando a logo termina de carregar)
function useTexturaMarca(d: DadosMarca | null, w: number, h: number, retrato: boolean, livre?: { titulo: string; sub: string; chamada: string }) {
  const { tex, canvas } = useMemo(() => { const c = document.createElement("canvas"); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { tex: t, canvas: c }; }, [w, h]);
  const chave = JSON.stringify(d) + JSON.stringify(livre);
  useEffect(() => pintar(canvas, tex, d, retrato, livre), [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return tex;
}
// desenha já e de novo quando a logo carregar; devolve a limpeza do efeito
function pintar(canvas: HTMLCanvasElement, tex: THREE.CanvasTexture, d: DadosMarca | null, retrato: boolean, livre?: { titulo: string; sub: string; chamada: string }) {
  let vivo = true;
  desenharMarca(canvas, d, null, retrato, livre); tex.needsUpdate = true;
  if (d?.logo) { const img = new Image(); img.onload = () => { if (!vivo) return; desenharMarca(canvas, d, img, retrato, livre); tex.needsUpdate = true; }; img.src = d.logo; }
  return () => { vivo = false; };
}
const acesos = new Set<THREE.MeshStandardMaterial>();
function registrarAceso(m: THREE.MeshStandardMaterial) { acesos.add(m); return () => { acesos.delete(m); }; }
const materialAceso = (tex: THREE.Texture) => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#FFFFFF", emissiveIntensity: 0.12, roughness: 0.6 });
function acender() { for (const m of acesos) m.emissiveIntensity = 0.12 + ceu.noite * 0.9; }

// ---------- outdoor de estrada (v63, 12/11/2026: "aumentar o outdoors", ~1,8× o de antes) ----------
// Face de 14,4 × 7,2 m (mesma proporção 2:1 da arte) em cima de duas colunas tubulares com sapata de concreto,
// treliça de aço atrás, passarela com guarda-corpo e escada, e quatro refletores na passarela que lavam a arte de luz à
// noite. Atrás, a chapa de aço com a plaquinha "WorkEnd". Estrutura toda no Estatico (vira poucas malhas).
export const FACE_OUTDOOR = { larg: 14.4, alt: 7.2, base: 6.6 }; // base = altura da borda de baixo da arte
const FX = FACE_OUTDOOR.larg / 2, FY0 = FACE_OUTDOOR.base, FY1 = FACE_OUTDOOR.base + FACE_OUTDOOR.alt, FYM = (FY0 + FY1) / 2;
const COLUNAS = [-4.3, 4.3];
const REFLETORES = [-5.4, -1.8, 1.8, 5.4];
// luz dos refletores à noite: um leque de luz suave do refletor até a arte (sem luz de verdade: não pesa)
let TEX_LEQUE: THREE.CanvasTexture | null = null;
function texturaLeque() {
  if (TEX_LEQUE || typeof document === "undefined") return TEX_LEQUE;
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, "rgba(255,236,190,.9)"); gr.addColorStop(0.55, "rgba(255,236,190,.28)"); gr.addColorStop(1, "rgba(255,236,190,0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(26, 256); g.lineTo(38, 256); g.lineTo(64, 0); g.lineTo(0, 0); g.closePath(); g.fill();
  TEX_LEQUE = new THREE.CanvasTexture(c); TEX_LEQUE.colorSpace = THREE.SRGBColorSpace; return TEX_LEQUE;
}
const MAT_LEQUE = typeof document === "undefined" ? null : new THREE.MeshBasicMaterial({ map: texturaLeque(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
// plaquinha das costas (uma textura para todos)
let TEX_COSTAS: THREE.CanvasTexture | null = null;
function texturaCostas() {
  if (TEX_COSTAS || typeof document === "undefined") return TEX_COSTAS;
  const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d")!;
  g.fillStyle = "#1F2630"; g.fillRect(0, 0, 512, 128); g.fillStyle = "#5B9DFF"; g.fillRect(0, 0, 10, 128);
  g.fillStyle = "#FFFFFF"; g.font = `800 54px ${FONTE}`; g.textBaseline = "middle"; g.fillText("WorkEnd", 34, 50);
  g.fillStyle = "rgba(255,255,255,.7)"; g.font = `600 26px ${FONTE}`; g.fillText("Anuncie: workend.online", 34, 98);
  TEX_COSTAS = new THREE.CanvasTexture(c); TEX_COSTAS.colorSpace = THREE.SRGBColorSpace; return TEX_COSTAS;
}
const MAT_COSTAS = typeof document === "undefined" ? null : new THREE.MeshStandardMaterial({ map: texturaCostas(), roughness: 0.7 });

function PainelOutdoor({ o, preco }: { o: OutdoorPublico | undefined; preco: number }) {
  const dados: DadosMarca | null = o?.status === "ativo" && o.empresa ? { nome: o.empresa.nome, cor: o.empresa.cor, nicho: o.empresa.nicho, frase: o.frase, numero: o.empresa.numero, logo: o.empresa.logo } : null;
  const livre = { titulo: o?.status === "reservado" ? "Reservado" : "Anuncie aqui", sub: o?.status === "reservado" ? "Uma empresa está pagando este outdoor agora." : `A sua marca vista pela cidade inteira por R$ ${preco.toFixed(2).replace(".", ",")} a cada 30 dias.`, chamada: o?.status === "reservado" ? "" : "Clique neste outdoor" };
  // arte maior no computador; no modo leve, a de antes (pesa menos na placa de vídeo do celular)
  const [w, h] = leve() ? [1024, 512] : [1280, 640];
  const tex = useTexturaMarca(dados, w, h, false, livre);
  const m = useMemo(() => materialAceso(tex), [tex]);
  useEffect(() => registrarAceso(m), [m]);
  return <mesh material={m} geometry={plano(FACE_OUTDOOR.larg, FACE_OUTDOOR.alt)} position={[0, FYM, 0.13]} />;
}

// estrutura de um outdoor (coordenadas locais: a arte olha para +z, a cidade)
function EstruturaOutdoor() {
  const aco = mat("#3A3F47", { metal: 0.55, rough: 0.45 }), acoClaro = mat("#6B7280", { metal: 0.5, rough: 0.5 }), chapa = mat("#2B2F36", { rough: 0.75 });
  const concreto = mat("#B9B4AA", { rough: 0.95 }), moldura = mat("#1D2128", { metal: 0.3, rough: 0.5 }), grade = mat("#4B5563", { metal: 0.4, rough: 0.6 });
  const verticais = [-FX + 0.2, -FX / 2, 0, FX / 2, FX - 0.2];
  const diagonais: [number, number][] = [[-FX, -FX / 2], [-FX / 2, 0], [0, FX / 2], [FX / 2, FX]];
  const ld = Math.hypot(FX / 2, FACE_OUTDOOR.alt), ad = Math.atan2(FACE_OUTDOOR.alt, FX / 2);
  return (
    <group>
      {/* colunas tubulares com sapata e o braço que segura a treliça */}
      {COLUNAS.map((x) => (
        <group key={x}>
          <mesh geometry={caixa(1.5, 0.5, 1.5)} material={concreto} position={[x, 0.25, -0.75]} receiveShadow />
          <mesh geometry={cilindro(0.36, 0.42, FY0 + 1.6, 14)} material={aco} position={[x, (FY0 + 1.6) / 2 + 0.3, -0.75]} castShadow />
          <mesh geometry={caixa(0.9, 0.5, 0.9)} material={aco} position={[x, FY0 + 0.1, -0.75]} />
        </group>
      ))}
      {/* treliça de aço atrás da face: banzos, montantes e diagonais */}
      {[FY0 + 0.05, FYM, FY1 - 0.05].map((y) => <mesh key={y} geometry={caixa(FACE_OUTDOOR.larg + 0.2, 0.2, 0.2)} material={acoClaro} position={[0, y, -0.55]} />)}
      {verticais.map((x) => <mesh key={x} geometry={caixa(0.16, FACE_OUTDOOR.alt, 0.16)} material={acoClaro} position={[x, FYM, -0.55]} />)}
      {diagonais.map(([a, b], i) => <mesh key={i} geometry={caixa(ld, 0.1, 0.1)} material={acoClaro} position={[(a + b) / 2, FYM, -0.6]} rotation={[0, 0, i % 2 ? -ad : ad]} />)}
      {/* chapa da face (as costas da arte) e a moldura */}
      <mesh geometry={caixa(FACE_OUTDOOR.larg + 0.3, FACE_OUTDOOR.alt + 0.3, 0.16)} material={chapa} position={[0, FYM, 0]} castShadow />
      <mesh geometry={caixa(FACE_OUTDOOR.larg + 0.6, 0.3, 0.42)} material={moldura} position={[0, FY1 + 0.15, 0.08]} />
      <mesh geometry={caixa(FACE_OUTDOOR.larg + 0.6, 0.3, 0.42)} material={moldura} position={[0, FY0 - 0.15, 0.08]} />
      {[-FX - 0.15, FX + 0.15].map((x) => <mesh key={x} geometry={caixa(0.3, FACE_OUTDOOR.alt + 0.6, 0.42)} material={moldura} position={[x, FYM, 0.08]} />)}
      {/* passarela de manutenção na frente, com guarda-corpo baixo (não tampa a arte) e a escada na coluna */}
      <mesh geometry={caixa(FACE_OUTDOOR.larg + 0.8, 0.08, 1.15)} material={grade} position={[0, FY0 - 0.62, 0.62]} />
      {[-FX, -FX / 2, 0, FX / 2, FX].map((x) => <mesh key={x} geometry={caixa(0.07, 0.62, 0.07)} material={aco} position={[x, FY0 - 0.3, 1.16]} />)}
      <mesh geometry={caixa(FACE_OUTDOOR.larg + 0.8, 0.06, 0.06)} material={aco} position={[0, FY0 - 0.02, 1.16]} />
      {[-FX, 0, FX].map((x) => <mesh key={x} geometry={caixa(0.08, 0.08, 1.3)} material={aco} position={[x, FY0 - 0.68, 0.2]} rotation={[0.35, 0, 0]} />)}
      <group position={[COLUNAS[1] + 0.62, 0, -0.75]}>
        {[-0.22, 0.22].map((x) => <mesh key={x} geometry={caixa(0.05, FY0 - 0.6, 0.05)} material={aco} position={[x, (FY0 - 0.6) / 2, 0]} />)}
        {Array.from({ length: Math.floor((FY0 - 0.8) / 0.4) }, (_, i) => <mesh key={i} geometry={caixa(0.44, 0.04, 0.04)} material={aco} position={[0, 0.5 + i * 0.4, 0]} />)}
      </group>
      {/* refletores: braço na passarela e a lâmpada virada para a arte */}
      {REFLETORES.map((x) => (
        <group key={x} position={[x, FY0 - 0.58, 1.05]}>
          <mesh geometry={caixa(0.06, 0.06, 0.9)} material={aco} position={[0, 0.05, -0.1]} rotation={[-0.5, 0, 0]} />
          <mesh geometry={caixa(0.55, 0.22, 0.32)} material={moldura} position={[0, 0.32, 0.18]} rotation={[-0.75, 0, 0]} />
        </group>
      ))}
      {/* costas: plaquinha WorkEnd no meio da treliça */}
      {MAT_COSTAS && <mesh geometry={plano(3.2, 0.8)} material={MAT_COSTAS} position={[0, FYM, -0.66]} rotation={[0, Math.PI, 0]} />}
    </group>
  );
}

export function Outdoors() {
  const outdoors = useMundo((s) => s.outdoors), preco = useMundo((s) => s.precoOutdoor), abrir = useMundo((s) => s.abrirOutdoor);
  // lâmpadas dos refletores (acendem à noite) e o leque de luz na arte
  const lampada = mat("#F5F3EA", { emissive: "#FFF1C9", ei: 1.4 });
  useFrame(() => { acender(); if (MAT_LEQUE) MAT_LEQUE.opacity = Math.max(0, ceu.noite - 0.15) * 0.75; });
  return (
    <group>
      <Estatico>
        {OUTDOORS.map((v) => (
          <group key={v.id} position={[v.pos[0], 0, v.pos[1]]} rotation={[0, v.rot, 0]}><EstruturaOutdoor /></group>
        ))}
      </Estatico>
      {OUTDOORS.map((v) => (
        <group key={v.id} position={[v.pos[0], 0, v.pos[1]]} rotation={[0, v.rot, 0]}
          onClick={(e) => { e.stopPropagation(); abrir(v.id); }} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
          <PainelOutdoor o={outdoors.find((x) => x.slot === v.id)} preco={preco} />
          {REFLETORES.map((x) => <mesh key={x} geometry={caixa(0.46, 0.06, 0.24)} material={lampada} position={[x, FY0 - 0.2, 1.3]} rotation={[-0.75, 0, 0]} />)}
          {MAT_LEQUE && REFLETORES.map((x) => <mesh key={`l${x}`} geometry={plano(3.6, FACE_OUTDOOR.alt * 0.9)} material={MAT_LEQUE} position={[x, FY0 + FACE_OUTDOOR.alt * 0.42, 0.55]} rotation={[-0.12, 0, 0]} />)}
        </group>
      ))}
    </group>
  );
}

// placa de esquina do lote: totem alto na ponta virada para o cruzamento, que se lê das duas ruas
export function PlacaEsquina({ d, sx, sz }: { d: DadosMarca; sx: number; sz: number }) {
  const tex = useTexturaMarca(d, 512, 704, true);
  const m = useMemo(() => materialAceso(tex), [tex]);
  useEffect(() => registrarAceso(m), [m]);
  return (
    <group position={[sx * 8.85, 0, sz * 8.85]} rotation={[0, Math.atan2(sx, sz), 0]}>
      <mesh geometry={caixa(0.3, 3.2, 0.3)} material={mat("#2B2F36", { metal: 0.4, rough: 0.5 })} position={[0, 1.6, 0]} castShadow />
      <mesh geometry={caixa(2.3, 3.15, 0.32)} material={mat("#1F2630", { rough: 0.7 })} position={[0, 4.6, 0]} castShadow />
      <mesh material={m} position={[0, 4.6, 0.17]}><planeGeometry args={[2.1, 2.9]} /></mesh>
      <mesh material={m} position={[0, 4.6, -0.17]} rotation={[0, Math.PI, 0]}><planeGeometry args={[2.1, 2.9]} /></mesh>
    </group>
  );
}
