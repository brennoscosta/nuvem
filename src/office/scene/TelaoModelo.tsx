"use client";
// Telão de LED do modelo "Estúdio de vídeo e lives" (20/11/2026, data/modelos.ts): a tela acesa na fachada, com o nome e a
// logo da empresa, um halo na cor da marca e o selo AO VIVO. A textura é desenhada uma vez por empresa (guardada) e não
// muda a cada quadro; a moldura escura é do prédio (scene/KitPredio.tsx › estudio). Coordenadas do lote: frente para -z.
import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";
import { plano } from "./geo";

const TEX = new Map<string, THREE.CanvasTexture>();
const caixaRedonda = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
const comAlfa = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function pintar(nome: string, cor: string, rodape: string, aspecto: number, img: HTMLImageElement | null) {
  const W = 1024, H = Math.max(256, Math.min(1024, Math.round(W / aspecto)));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const fundo = g.createLinearGradient(0, 0, W, H); fundo.addColorStop(0, "#14161B"); fundo.addColorStop(1, "#060709");
  g.fillStyle = fundo; g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.55); halo.addColorStop(0, comAlfa(cor, 0.45)); halo.addColorStop(1, comAlfa(cor, 0));
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  // logo (quando carregou) e o nome embaixo dela
  let yNome = H * 0.58;
  if (img && (img.naturalWidth || img.width)) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, lh = H * 0.42, lw = Math.min(W * 0.5, (lh * iw) / ih);
    g.drawImage(img, (W - lw) / 2, H * 0.2, lw, (lw * ih) / iw); yNome = H * 0.78;
  }
  g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
  let px = Math.round(H * (img ? 0.13 : 0.22)); g.font = `900 ${px}px Inter, Arial, sans-serif`;
  const texto = (nome.trim() || "Sua empresa").slice(0, 26);
  while (g.measureText(texto).width > W * 0.86 && px > 18) { px -= 4; g.font = `900 ${px}px Inter, Arial, sans-serif`; }
  g.fillText(texto, W / 2, yNome);
  // selo AO VIVO no canto
  const sh = Math.round(H * 0.13), sw = sh * 3.6;
  g.fillStyle = cor; caixaRedonda(g, 26, 22, sw, sh, sh / 2); g.fill();
  g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(26 + sh * 0.55, 22 + sh / 2, sh * 0.19, 0, Math.PI * 2); g.fill();
  g.font = `800 ${Math.round(sh * 0.5)}px Inter, Arial, sans-serif`; g.textAlign = "left"; g.fillText("AO VIVO", 26 + sh, 22 + sh / 2 + 1);
  if (rodape) { g.fillStyle = "rgba(255,255,255,.7)"; g.font = `700 ${Math.round(H * 0.07)}px Inter, Arial, sans-serif`; g.textAlign = "right"; g.fillText(rodape, W - 28, H - H * 0.08); }
  // grade de LED
  g.fillStyle = "rgba(0,0,0,.28)"; for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function TelaoModelo({ nome, cor, logo, telao, rodape = "" }: { nome: string; cor: string; logo: string | null; telao: { x: number; y0: number; y1: number; largura: number; z: number }; rodape?: string }) {
  const h = telao.y1 - telao.y0, aspecto = telao.largura / h;
  // a logo carrega por fora (sem suspense): o telão aparece com o nome e ganha a logo quando ela chega
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!logo) return;
    let vivo = true; const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => { if (vivo) setImg(i); }; i.src = logo;
    return () => { vivo = false; };
  }, [logo]);
  const imgOk = logo ? img : null;
  const mat = useMemo(() => {
    if (typeof document === "undefined") return null;
    const k = `${nome}|${cor}|${rodape}|${aspecto.toFixed(2)}|${imgOk ? logo : ""}`;
    let t = TEX.get(k); if (!t) { t = pintar(nome, cor, rodape, aspecto, imgOk); TEX.set(k, t); }
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  }, [nome, cor, rodape, aspecto, imgOk, logo]);
  useEffect(() => () => mat?.dispose(), [mat]);
  if (!mat) return null;
  return <mesh geometry={plano(telao.largura, h)} material={mat} position={[telao.x, telao.y0 + h / 2, telao.z + 0.1]} rotation={[0, Math.PI, 0]} />;
}
