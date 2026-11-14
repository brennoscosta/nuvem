"use client";
// Kit modular de prédios (v66, 13/11/2026): os 8 tipos novos (comercial, torre, esquina, galpão logístico, galpão
// industrial, coworking, café e clínica) montados em código com paredes de verdade (com espessura e vãos), janelas com
// caixilho, vidro, peitoril e o interior pintado lá dentro (aceso à noite, janela por janela), vitrines, marquises,
// telhados, docas, portões, guarda-corpos, escadas, ar-condicionado, caixa d'água, rufos e calhas.
// Tudo o que o prédio tem é juntado por material numa malha só (poucas chamadas de desenho por prédio). As texturas são
// pintadas em canvas uma vez e projetadas em metros (o tijolo não estica e casa entre as peças).
// Coordenadas locais do lote: frente para -z, x positivo = esquerda de quem olha a fachada (ver data/predios.ts).
import { lerVarios, guardar } from "./guardaNoAparelho";
import { contar } from "./medirGeracao";
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ceu } from "./CicloDia";
import { leve } from "./qualidade";
import { ArvoresInstanciadas } from "./Arvores";
import { medidasKit, type KitId, type MedidasKit } from "../data/predios";
import type { MaterialFachada } from "../data/escritorio";
import type { ItemInstancia } from "./Modelos";

// ---------------------------------------------------------------- texturas
type Desenho = (g: CanvasRenderingContext2D, w: number, h: number) => void;
const TEXS = new Map<string, THREE.CanvasTexture>();
function tex(chave: string, w: number, h: number, desenhar: Desenho) {
  let t = TEXS.get(chave); if (t) return t;
  const c = document.createElement("canvas"); c.width = w; c.height = h; desenhar(c.getContext("2d")!, w, h);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TEXS.set(chave, t); return t;
}
// gerador pseudo-aleatório fixo (as texturas saem iguais em todo aparelho)
const rnd = (s0: number) => { let s = s0 >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const salpicar = (g: CanvasRenderingContext2D, w: number, h: number, n: number, sem: number, a: number) => {
  const r = rnd(sem);
  for (let i = 0; i < n; i++) { const v = r() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${a * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
};
// reboco (cinza claro com textura): multiplica pela cor da peça, serve para qualquer pintura
const texReboco = () => tex("reboco", 512, 512, (g, w, h) => {
  g.fillStyle = "#F2F2F2"; g.fillRect(0, 0, w, h); salpicar(g, w, h, 9000, 3, 0.09);
  const r = rnd(9); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,90,90,${0.025 + r() * 0.03})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 8 + r() * 30, r() * 3, 0, 7); g.fill(); }
  // escorrido leve de chuva
  for (let i = 0; i < 18; i++) { const x = r() * w, gr = g.createLinearGradient(0, 0, 0, h * 0.6); gr.addColorStop(0, "rgba(70,70,70,0.07)"); gr.addColorStop(1, "rgba(70,70,70,0)"); g.fillStyle = gr; g.fillRect(x, 0, 3 + r() * 8, h * 0.6); }
});
const texConcreto = () => tex("concreto", 512, 512, (g, w, h) => {
  g.fillStyle = "#BFC0BE"; g.fillRect(0, 0, w, h); salpicar(g, w, h, 14000, 5, 0.12);
  const r = rnd(4); for (let i = 0; i < 26; i++) { const v = r() > 0.5 ? 255 : 60; g.fillStyle = `rgba(${v},${v},${v},0.04)`; g.fillRect(r() * w, r() * h, 60 + r() * 140, 20 + r() * 60); }
  // juntas das formas (a textura cobre 2,4 × 2,4 m) e furos dos tirantes
  g.strokeStyle = "rgba(70,72,74,0.5)"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  g.fillStyle = "rgba(60,62,64,0.55)"; for (const x of [w / 8, (3 * w) / 8, (5 * w) / 8, (7 * w) / 8]) for (const y of [h / 4, (3 * h) / 4]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
});
const texTijolo = () => tex("tijolo", 512, 512, (g, w, h) => {
  // 1,2 × 1,2 m: 16 fiadas de tijolo aparente com junta
  g.fillStyle = "#CFC6B8"; g.fillRect(0, 0, w, h);
  const r = rnd(11), fi = 16, alt = h / fi, comp = w / 5;
  const tons = [[164, 78, 54], [150, 66, 46], [178, 92, 62], [138, 62, 44], [170, 104, 76]];
  for (let y = 0; y < fi; y++) for (let x = -1; x < 6; x++) {
    const dx = (y % 2) * comp * 0.5, base = tons[Math.floor(r() * 5)], k = 0.86 + r() * 0.24;
    g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`; g.fillRect(x * comp + dx + 2, y * alt + 2, comp - 4, alt - 4);
    g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(x * comp + dx + 2, y * alt + alt - 6, comp - 4, 3);
  }
  salpicar(g, w, h, 5000, 12, 0.12);
});
const texMadeira = () => tex("madeira", 512, 512, (g, w, h) => {
  // ripado de 10 cm (a textura cobre 1,2 m = 12 ripas)
  const r = rnd(21), n = 12, larg = w / n, tons = [[156, 104, 62], [140, 92, 54], [170, 116, 70], [128, 84, 50]];
  for (let i = 0; i < n; i++) {
    const tom = tons[i % 4], k = 0.9 + r() * 0.2;
    g.fillStyle = `rgb(${tom[0] * k},${tom[1] * k},${tom[2] * k})`; g.fillRect(i * larg, 0, larg, h);
    for (let v = 0; v < 26; v++) { g.strokeStyle = `rgba(60,36,18,${0.08 + r() * 0.12})`; g.lineWidth = 1; g.beginPath(); const x = i * larg + r() * larg; g.moveTo(x, 0); g.bezierCurveTo(x + r() * 6 - 3, h / 3, x + r() * 6 - 3, (2 * h) / 3, x, h); g.stroke(); }
    g.fillStyle = "rgba(25,15,8,0.75)"; g.fillRect(i * larg, 0, 3, h);
  }
});
const texChapa = () => tex("chapa", 256, 256, (g, w, h) => {
  // chapa trapezoidal: 4 ondas em 0,9 m (cinza; a cor vem da peça)
  for (let x = 0; x < w; x++) {
    const f = (x % (w / 4)) / (w / 4), l = f < 0.18 ? 0.72 : f < 0.3 ? 0.98 : f < 0.7 ? 0.88 : f < 0.82 ? 0.78 : 0.72;
    g.fillStyle = `rgb(${255 * l},${255 * l},${255 * l})`; g.fillRect(x, 0, 1, h);
  }
  salpicar(g, w, h, 1600, 31, 0.06);
});
const texEnrolar = () => tex("enrolar", 256, 256, (g, w, h) => {
  for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, "#F4F4F4"); gr.addColorStop(0.55, "#D8D8D8"); gr.addColorStop(1, "#9A9A9A"); g.fillStyle = gr; g.fillRect(0, y, w, 16); }
  salpicar(g, w, h, 900, 41, 0.08);
});
const texTelha = () => tex("telha", 256, 256, (g, w, h) => {
  // telha colonial de barro: fileiras de capas
  g.fillStyle = "#8E3F24"; g.fillRect(0, 0, w, h); const r = rnd(51);
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
    const k = 0.85 + r() * 0.3, gr = g.createLinearGradient(x, 0, x + 32, 0);
    gr.addColorStop(0, `rgb(${120 * k},${50 * k},${30 * k})`); gr.addColorStop(0.5, `rgb(${196 * k},${96 * k},${58 * k})`); gr.addColorStop(1, `rgb(${120 * k},${50 * k},${30 * k})`);
    g.fillStyle = gr; g.fillRect(x + 1, y, 30, 30); g.fillStyle = "rgba(40,15,8,0.45)"; g.fillRect(x, y + 28, 32, 4);
  }
});
const texPastilha = () => tex("pastilha", 256, 256, (g, w, h) => {
  g.fillStyle = "#C9CFC9"; g.fillRect(0, 0, w, h); const r = rnd(61);
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const k = 0.88 + r() * 0.2; g.fillStyle = `rgb(${236 * k},${238 * k},${236 * k})`; g.fillRect(x + 1, y + 1, 14, 14); }
});
const texEspelho = () => tex("espelho", 256, 512, (g, w, h) => {
  // vidro espelhado: degradê de céu com reflexo de nuvem e de prédio (a cor vem da peça)
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#DCE9F2"); gr.addColorStop(0.55, "#8DA6BA"); gr.addColorStop(1, "#5D7387"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = rnd(71); for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,255,255,${0.06 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * h * 0.5, 50 + r() * 60, 14 + r() * 20, 0, 0, 7); g.fill(); }
  g.fillStyle = "rgba(40,52,64,0.18)"; for (let i = 0; i < 5; i++) g.fillRect(r() * w, h * (0.55 + r() * 0.3), 20 + r() * 40, h);
});
// interiores: o que se vê pela janela, em escala real (a textura cobre 6 × 3 m: 170 px por metro; o chão fica a
// 2,2 m do alto). Cada janela usa um pedaço diferente; à noite a textura inteira brilha (luminárias acesas).
type IntTipo = "escritorio" | "loja" | "cafe" | "clinica" | "cowork" | "galpao";
const texInterior = (tipo: IntTipo) => tex(`int-${tipo}`, 1024, 512, (g, w, h) => {
  const r = rnd(tipo.length * 977 + 3), S = 170, yF = Math.round(h * 0.74), m = (v: number) => v * S;
  const ret = (x: number, y: number, ww: number, hh: number, c: string, raio = 0) => { g.fillStyle = c; if (raio) { g.beginPath(); g.roundRect(x, y, ww, hh, raio); g.fill(); } else g.fillRect(x, y, ww, hh); };
  const teto = { escritorio: "#DCD9D2", loja: "#ECE6DA", cafe: "#5E4130", clinica: "#F1F3F4", cowork: "#34383D", galpao: "#7F868D" }[tipo];
  const fundo = { escritorio: "#E9E4DA", loja: "#F3EDE3", cafe: "#C9986A", clinica: "#F5F8F7", cowork: "#9E5640", galpao: "#AEB5BB" }[tipo];
  const chao = { escritorio: "#7E8288", loja: "#D5CCBC", cafe: "#6E4A31", clinica: "#DCE1DC", cowork: "#6A655F", galpao: "#9A9A95" }[tipo];
  ret(0, 0, w, h, fundo); ret(0, 0, w, m(0.42), teto); ret(0, yF, w, h - yF, chao);
  ret(0, yF - 6, w, 6, "rgba(0,0,0,0.18)"); // rodapé
  // luminárias de teto (placas de 60 cm) ou pendentes
  for (let x = m(0.4); x < w; x += m(1.5)) {
    if (tipo === "cafe" || tipo === "cowork") { ret(x + 40, m(0.42), 2, m(0.45), "#222"); g.fillStyle = tipo === "cafe" ? "#FFD08A" : "#FFF6E0"; g.beginPath(); g.arc(x + 41, m(0.9), 16, Math.PI, 0); g.fill(); }
    else if (tipo !== "galpao") ret(x, m(0.36), m(0.6), 7, "#FFFDF4");
  }
  const pessoa = (x: number, sentado = true) => {
    const cores = ["#3B5B92", "#B0413E", "#2F7A5E", "#6B4C9A", "#C77D2E", "#3A3F47", "#E7E2D8"], pele = ["#8C5E44", "#C68E6B", "#5E3B2A", "#E0B190"][Math.floor(r() * 4)];
    const topo = yF - m(sentado ? 1.28 : 1.68);
    ret(x - m(0.21), topo + m(0.24), m(0.42), m(sentado ? 0.62 : 0.8), cores[Math.floor(r() * cores.length)], 14);
    g.fillStyle = pele; g.beginPath(); g.arc(x, topo + m(0.11), m(0.1), 0, 7); g.fill();
    g.fillStyle = ["#2A1C14", "#4A3020", "#111", "#7A5230"][Math.floor(r() * 4)]; g.beginPath(); g.arc(x, topo + m(0.08), m(0.1), Math.PI, 0); g.fill();
  };
  const planta = (x: number) => { ret(x - m(0.15), yF - m(0.38), m(0.3), m(0.38), "#B36A3E", 4); g.fillStyle = "#3E8E41"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * m(0.4), yF - m(0.55) - r() * m(0.5), m(0.16), m(0.22), r() * 3, 0, 7); g.fill(); } };
  if (tipo === "escritorio" || tipo === "clinica" || tipo === "cowork") {
    // parede do fundo: quadros, estante ou tijolo; mesas de 1,4 m com monitor, cadeira e gente
    if (tipo === "cowork") for (let y = m(0.42); y < yF; y += 14) for (let x = (y / 14) % 2 ? 0 : -22; x < w; x += 44) ret(x + 1, y + 1, 42, 12, `rgba(${120 + r() * 50},${50 + r() * 25},${36 + r() * 15},0.55)`);
    for (let x = m(0.6); x < w; x += m(2.2)) { if (r() > 0.5) { ret(x, yF - m(1.9), m(0.7), m(0.5), "#2F3540"); ret(x + 4, yF - m(1.9) + 4, m(0.7) - 8, m(0.5) - 8, ["#7FB2E6", "#E2B05A", "#6CC2A8"][Math.floor(r() * 3)]); } else { ret(x, yF - m(1.8), m(0.9), m(1.8), "#B49A7C"); for (let k = 1; k < 4; k++) ret(x + 6, yF - m(1.8) + k * m(0.45) - 6, m(0.9) - 12, 6, "#8E7458"); } }
    if (tipo === "clinica") { ret(0, yF - m(1.15), w, m(0.12), "#6CC2A8"); ret(m(3.6), yF - m(1.1), m(1.8), m(1.1), "#F2F4F5", 6); ret(m(3.6), yF - m(1.1), m(1.8), 8, "#4FA88A"); }
    if (tipo === "cowork") { g.strokeStyle = "#FF5FA2"; g.lineWidth = 7; g.strokeRect(m(2.6), m(0.8), m(1.0), m(0.32)); }
    for (let x = m(0.3); x < w - m(1.2); x += m(1.75)) {
      if (tipo === "clinica" && x > m(3.2) && x < m(5.6)) continue;
      const tem = r() > 0.3;
      if (tem) pessoa(x + m(1.05));
      const yM = yF - m(0.75);
      ret(x, yM, m(1.4), 7, tipo === "cowork" ? "#8A6040" : "#F4F2EE"); ret(x + 6, yM + 7, 7, m(0.75) - 7, "#5A5E64"); ret(x + m(1.4) - 13, yM + 7, 7, m(0.75) - 7, "#5A5E64");
      ret(x + m(0.35), yM - m(0.42), m(0.55), m(0.34), "#1E2833", 3); ret(x + m(0.35) + 4, yM - m(0.42) + 4, m(0.55) - 8, m(0.34) - 8, "#86B8EA"); ret(x + m(0.6), yM - m(0.08), 6, m(0.08), "#1E2833");
      if (!tem) ret(x + m(0.85), yM - m(0.5), m(0.45), m(0.5), "#2B2F36", 8);
    }
    planta(m(0.15)); planta(w - m(0.3));
  } else if (tipo === "loja") {
    // gôndolas com produtos e o caixa
    for (let k = 0; k < 4; k++) { const y = yF - m(0.45) - k * m(0.42); ret(0, y, w, 6, "#B49A7C"); for (let x = 6; x < w; x += m(0.1) + r() * m(0.08)) { const a = m(0.12) + r() * m(0.16); ret(x, y - a, m(0.08) + r() * m(0.04), a, ["#E2575B", "#F2B134", "#3D8BD9", "#59B36A", "#9B6BD6", "#F2F2F2", "#2F3540"][Math.floor(r() * 7)], 2); } }
    ret(m(3.6), yF - m(1.0), m(1.8), m(1.0), "#4A5059", 4); pessoa(m(4.4), false); pessoa(m(1.6), false);
  } else if (tipo === "cafe") {
    ret(m(0.5), m(0.7), m(1.3), m(0.7), "#2E2F31", 4); g.fillStyle = "#F1EBDD"; g.font = "bold 28px Arial"; g.fillText("CAFÉ · PÃO DE QUEIJO", m(0.5) + 14, m(0.7) + 48, m(1.3) - 28); g.font = "22px Arial"; g.fillText("Coado  R$ 6  ·  Expresso  R$ 7", m(0.5) + 14, m(0.7) + 88, m(1.3) - 28);
    ret(m(2.6), yF - m(1.05), m(2.8), m(1.05), "#5A3A26", 4); ret(m(2.6), yF - m(1.05), m(2.8), 8, "#3B2A1E"); ret(m(3.2), yF - m(1.4), m(0.45), m(0.35), "#B9B9B9", 4);
    pessoa(m(4.4), false);
    for (const x of [m(0.4), m(1.5)]) { ret(x, yF - m(0.75), m(0.7), 6, "#3B2A1E"); ret(x + m(0.32), yF - m(0.75), 6, m(0.75), "#3B2A1E"); }
    pessoa(m(0.6)); planta(m(5.8));
  } else {
    // galpão: porta-paletes (vãos de 2,7 m) com paletes de caixas
    for (let x = m(0.2); x < w; x += m(2.7)) {
      ret(x, m(0.2), 14, yF - m(0.2), "#E2672B"); ret(x + m(2.5), m(0.2), 14, yF - m(0.2), "#E2672B");
      for (const nv of [0.15, 1.75]) {
        const y = yF - m(nv); ret(x, y, m(2.5) + 14, 10, "#2E5DA8");
        for (const px of [m(0.12), m(1.32)]) { ret(x + px, y - 12, m(1.1), 12, "#A58A5C"); for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) ret(x + px + j * m(0.37) + 2, y - 12 - (k + 1) * m(0.42), m(0.35), m(0.4), ["#C49A62", "#B58A54", "#D3AE76"][Math.floor(r() * 3)], 2); }
      }
    }
    ret(0, yF - 8, w, 8, "#F2C230");
  }
  const gr = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.25)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// ---------------------------------------------------------------- materiais
type Papel = "liso" | "fosco" | "metal" | "reboco" | "pintura" | "concreto" | "tijolo" | "madeira" | "chapa" | "telha" | "enrolar" | "pastilha" | "vidro" | "espelho" | "luz" | `int:${IntTipo}:${0 | 1}`;
// metros que a textura cobre (projeção em metros: as peças vizinhas casam)
const TILE: Partial<Record<Papel, number>> = { reboco: 3, pintura: 3, concreto: 2.4, tijolo: 1.2, madeira: 1.2, chapa: 0.9, telha: 1.1, enrolar: 1.2, pastilha: 0.6, espelho: 3.2 };
type MatKit = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
const MATS = new Map<string, MatKit>();
const LUZES_KIT = { acesos: [] as MatKit[], lampadas: [] as MatKit[] };
// no modo leve o mesmo material sai em Lambert (sem rugosidade nem metal)
function criar(o: THREE.MeshStandardMaterialParameters): MatKit {
  if (!leve()) return new THREE.MeshStandardMaterial(o);
  const p: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && k !== "roughness" && k !== "metalness") p[k] = v;
  return new THREE.MeshLambertMaterial(p as THREE.MeshLambertMaterialParameters);
}
function material(p: Papel): MatKit {
  let m = MATS.get(p); if (m) return m;
  if (p === "liso") m = criar({ vertexColors: true, roughness: 0.82 });
  else if (p === "fosco") m = criar({ vertexColors: true, roughness: 0.97 });
  else if (p === "metal") m = criar({ vertexColors: true, roughness: 0.38, metalness: 0.55 });
  else if (p === "reboco" || p === "pintura") m = criar({ vertexColors: true, map: texReboco(), roughness: 0.93 });
  else if (p === "concreto") m = criar({ vertexColors: true, map: texConcreto(), roughness: 0.95 });
  else if (p === "tijolo") m = criar({ vertexColors: true, map: texTijolo(), roughness: 0.9 });
  else if (p === "madeira") m = criar({ vertexColors: true, map: texMadeira(), roughness: 0.8 });
  else if (p === "chapa") m = criar({ vertexColors: true, map: texChapa(), roughness: 0.5, metalness: 0.45 });
  else if (p === "telha") m = criar({ vertexColors: true, map: texTelha(), roughness: 0.9 });
  else if (p === "enrolar") m = criar({ vertexColors: true, map: texEnrolar(), roughness: 0.45, metalness: 0.5 });
  else if (p === "pastilha") m = criar({ vertexColors: true, map: texPastilha(), roughness: 0.35 });
  else if (p === "vidro") m = criar({ color: "#6E8FA6", roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.42, depthWrite: false });
  else if (p === "espelho") m = criar({ vertexColors: true, map: texEspelho(), roughness: 0.06, metalness: 0.75 });
  else if (p === "luz") { m = criar({ color: "#FFF1D6", emissive: "#FFD9A0", emissiveIntensity: 0.15, roughness: 0.4 }); LUZES_KIT.lampadas.push(m); }
  else {
    // interior: de dia meio escuro atrás do vidro; à noite, se a janela é das acesas, a textura brilha
    const [, tipo, aceso] = p.split(":") as [string, IntTipo, string];
    const t = texInterior(tipo);
    m = aceso === "1" ? criar({ map: t, color: "#9A9A9A", emissive: "#FFFFFF", emissiveMap: t, emissiveIntensity: 0, roughness: 0.9 }) : criar({ map: t, color: "#9A9A9A", roughness: 0.9 });
    if (aceso === "1") LUZES_KIT.acesos.push(m);
  }
  MATS.set(p, m); return m;
}
// pintura escolhida pelo dono: o reboco na cor dele é um material (trocar a cor não refaz a malha do prédio)
function materialPintura(cor: string): MatKit {
  const k = `pintura:${cor.toUpperCase()}`; let m = MATS.get(k);
  if (!m) { m = criar({ vertexColors: true, map: texReboco(), color: cor, roughness: 0.93 }); MATS.set(k, m); }
  return m;
}
// à noite: janelas acesas e lâmpadas (só números; nada recompila). Montado uma vez na cena.
export function RelogioKit() {
  useFrame(() => {
    const n = ceu.noite;
    for (const m of LUZES_KIT.acesos) m.emissiveIntensity = n * 0.95;
    for (const m of LUZES_KIT.lampadas) m.emissiveIntensity = 0.15 + n * 2.4;
  });
  return null;
}

// ---------------------------------------------------------------- montador
const V = new THREE.Vector3(), VA = new THREE.Vector3(), VB = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
const M4 = new THREE.Matrix4(), RM = new THREE.Matrix4(), EU = new THREE.Euler(), CIMA = new THREE.Vector3(0, 1, 0), COR = new THREE.Color();
// Face de um volume: centro do plano externo (u = 0) e o giro (frente th = π, fundos 0, esquerda π/2, direita −π/2).
// u corre ao longo da face (na frente, da esquerda para a direita de quem olha), v é a altura, n aponta para fora.
interface Face { cx: number; cz: number; th: number }
interface Parte { geo: THREE.BufferGeometry; mat: MatKit; sombra: boolean; papel: Papel }
const fazSombra = (p: Papel) => p !== "vidro" && p !== "luz" && !p.startsWith("int:");
class Montador {
  lotes = new Map<Papel, THREE.BufferGeometry[]>();
  detalhe = !leve();
  private add(geo: THREE.BufferGeometry, p: Papel, m: THREE.Matrix4, cor: string | undefined, uvProprio = false) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    g.applyMatrix4(m);
    const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute, n = pos.count;
    if (!uvProprio) {
      // projeção em metros pela normal dominante
      const uv = new Float32Array(n * 2), t = TILE[p] ?? 1;
      for (let i = 0; i < n; i++) {
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (ny >= nx && ny >= nz) { uv[i * 2] = x / t; uv[i * 2 + 1] = z / t; }
        else if (nx >= nz) { uv[i * 2] = z / t; uv[i * 2 + 1] = y / t; }
        else { uv[i * 2] = x / t; uv[i * 2 + 1] = y / t; }
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }
    COR.set(cor ?? "#FFFFFF"); const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = COR.r; cols[i * 3 + 1] = COR.g; cols[i * 3 + 2] = COR.b; }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv" && k !== "color") g.deleteAttribute(k);
    g.clearGroups();
    let l = this.lotes.get(p); if (!l) { l = []; this.lotes.set(p, l); }
    l.push(g);
  }
  private matriz(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    EU.set(rx, ry, rz, "YXZ"); Q.setFromEuler(EU); V.set(x, y, z); return M4.compose(V, Q, S);
  }
  // caixa no espaço do lote (pelo centro)
  caixa(p: Papel, w: number, h: number, d: number, x: number, y: number, z: number, cor?: string, ry = 0, rx = 0, rz = 0) {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return;
    this.add(new THREE.BoxGeometry(w, h, d), p, this.matriz(x, y, z, ry, rx, rz), cor);
  }
  cil(p: Papel, r0: number, r1: number, h: number, x: number, y: number, z: number, cor?: string, seg = 12, rz = 0) {
    this.add(new THREE.CylinderGeometry(r0, r1, h, this.detalhe ? seg : Math.max(6, seg >> 1)), p, this.matriz(x, y, z, 0, 0, rz), cor);
  }
  // barra reta de a até b (corrimão, longarina, mão-francesa): seção esp × alt, "alt" fica para cima
  barra(p: Papel, ax: number, ay: number, az: number, bx: number, by: number, bz: number, esp: number, cor?: string, alt = esp) {
    VA.set(ax, ay, az); VB.set(bx, by, bz); const len = VA.distanceTo(VB); if (len < 0.001) return;
    RM.lookAt(VB, VA, CIMA); Q.setFromRotationMatrix(RM); V.addVectors(VA, VB).multiplyScalar(0.5);
    this.add(new THREE.BoxGeometry(esp, alt, len), p, M4.compose(V, Q, S), cor);
  }
  // prisma: perfil (y, z) puxado ao longo de x (empena, telhado, claraboia)
  prisma(p: Papel, perfil: [number, number][], larg: number, x: number, y: number, z: number, cor?: string, ry = 0) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(perfil.map(([py, pz]) => new THREE.Vector2(pz, py))), { depth: larg, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); g.translate(larg / 2, 0, 0);
    this.add(g, p, this.matriz(x, y, z, ry), cor);
  }
  // laje com contorno qualquer (x, z), de y0 a y0 + esp
  poligono(p: Papel, pts: [number, number][], y0: number, esp: number, cor?: string) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: esp, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    this.add(g, p, this.matriz(0, y0, 0), cor);
  }
  // na face: caixa com centro em (u, v, n); w ao longo da face, d na espessura
  fc(F: Face, p: Papel, u: number, v: number, n: number, w: number, h: number, d: number, cor?: string) {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return;
    const c = Math.cos(F.th), s = Math.sin(F.th);
    this.add(new THREE.BoxGeometry(w, h, d), p, this.matriz(F.cx + c * u + s * n, v, F.cz - s * u + c * n, F.th), cor);
  }
  // plano na face, virado para fora; uv próprio opcional (interior: um pedaço da textura)
  fp(F: Face, p: Papel, u: number, v: number, n: number, w: number, h: number, cor?: string, uv?: [number, number, number, number]) {
    if (w <= 0.001 || h <= 0.001) return;
    const g = new THREE.PlaneGeometry(w, h);
    if (uv) { const a = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1])); }
    const c = Math.cos(F.th), s = Math.sin(F.th);
    this.add(g, p, this.matriz(F.cx + c * u + s * n, v, F.cz - s * u + c * n, F.th), cor, !!uv);
  }
  montar(): Parte[] {
    const out: Parte[] = [];
    for (const [p, geos] of this.lotes) {
      const geo = mergeGeometries(geos, false); geos.forEach((g) => g.dispose()); if (!geo) continue;
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      out.push({ geo, mat: material(p), sombra: fazSombra(p), papel: p });
    }
    return out;
  }
}

// ---------------------------------------------------------------- peças
const hash = (a: number, b: number, c: number) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); };
interface Estilo { parede: Papel; corParede: string; caixilho: string; peitoril: string; int: IntTipo; seed: number; e: number }
// faces de um volume retangular
const faces = (w: number, z0: number, z1: number, x = 0) => ({
  frente: { cx: x, cz: z0, th: Math.PI } as Face, fundos: { cx: x, cz: z1, th: 0 } as Face,
  esq: { cx: x + w / 2, cz: (z0 + z1) / 2, th: Math.PI / 2 } as Face, dir: { cx: x - w / 2, cz: (z0 + z1) / 2, th: -Math.PI / 2 } as Face,
});
// vãos distribuídos por igual numa largura (vão w, passo p)
const distribuir = (u0: number, u1: number, w: number, p: number, pula?: (u: number) => boolean): [number, number][] => {
  const k = Math.max(1, Math.floor((u1 - u0 + p - w) / p)), sobra = u1 - u0 - (k - 1) * p, out: [number, number][] = [];
  for (let i = 0; i < k; i++) { const u = u0 + sobra / 2 + i * p; if (!pula?.(u)) out.push([u, w]); }
  return out;
};
// Faixa de um andar com janelas: parede com espessura em volta dos vãos (peitoril embaixo, verga em cima, pilaretes
// entre eles) e, em cada vão, caixilho, vidro, peitoril de pedra e o interior lá dentro. porta = [u, largura, altura].
function andarJanelas(M: Montador, F: Face, s: Estilo, o: { u0: number; u1: number; y: number; h: number; pe: number; alt: number; jan: [number, number][]; montantes?: number; travessa?: boolean; idx: number; porta?: [number, number, number] }) {
  const p = s.parede, cor = s.corParede, e = s.e, yJ0 = o.y + o.pe, yJ1 = yJ0 + o.alt, topo = o.y + o.h;
  const pt = o.porta;
  // embaixo das janelas (cortado na porta) e em cima delas
  if (pt) { const a = pt[0] - pt[1] / 2, b = pt[0] + pt[1] / 2; M.fc(F, p, (o.u0 + a) / 2, (o.y + yJ0) / 2, -e / 2, a - o.u0, yJ0 - o.y, e, cor); M.fc(F, p, (b + o.u1) / 2, (o.y + yJ0) / 2, -e / 2, o.u1 - b, yJ0 - o.y, e, cor); }
  else M.fc(F, p, (o.u0 + o.u1) / 2, (o.y + yJ0) / 2, -e / 2, o.u1 - o.u0, yJ0 - o.y, e, cor);
  M.fc(F, p, (o.u0 + o.u1) / 2, (yJ1 + topo) / 2, -e / 2, o.u1 - o.u0, topo - yJ1, e, cor);
  // pilaretes entre os vãos (a porta conta como vão)
  const vaos = [...o.jan, ...(pt ? [[pt[0], pt[1]] as [number, number]] : [])].sort((a, b) => a[0] - b[0]);
  let u = o.u0;
  for (const [cu, w] of vaos) { const a = cu - w / 2; M.fc(F, p, (u + a) / 2, (yJ0 + yJ1) / 2, -e / 2, a - u, o.alt, e, cor); u = cu + w / 2; }
  M.fc(F, p, (u + o.u1) / 2, (yJ0 + yJ1) / 2, -e / 2, o.u1 - u, o.alt, e, cor);
  o.jan.forEach(([cu, w], k) => janela(M, F, s, cu, yJ0, w, o.alt, o.idx * 31 + k, o.montantes ?? (w > 2.2 ? 2 : 1), o.travessa ?? false));
  if (pt) {
    const [pu, pw, ph] = pt;
    if (yJ1 > o.y + ph) M.fc(F, p, pu, (o.y + ph + yJ1) / 2, -e / 2, pw, yJ1 - o.y - ph, e, cor); // verga
    M.fc(F, "madeira", pu, o.y + ph / 2, -e * 0.55, pw - 0.1, ph - 0.05, 0.06, "#FFFFFF");
    M.fc(F, "metal", pu - pw / 2 + 0.03, o.y + ph / 2, -e * 0.5, 0.06, ph, e * 0.9, s.caixilho); M.fc(F, "metal", pu + pw / 2 - 0.03, o.y + ph / 2, -e * 0.5, 0.06, ph, e * 0.9, s.caixilho);
    M.fc(F, "metal", pu, o.y + ph - 0.03, -e * 0.5, pw, 0.06, e * 0.9, s.caixilho);
    if (M.detalhe) M.fc(F, "metal", pu + pw / 2 - 0.22, o.y + 1.05, -e * 0.55 + 0.05, 0.04, 0.5, 0.05, "#C2A35A");
  }
}
function janela(M: Montador, F: Face, s: Estilo, u: number, y0: number, w: number, h: number, chave: number, montantes = 1, travessa = false) {
  const e = s.e, aceso = hash(s.seed, chave, F.th) > 0.42 ? 1 : 0;
  // interior: um pedaço da textura (6 × 3 m) diferente para cada janela, um pouco maior que o vão
  const off = hash(chave, s.seed, 3) * 0.6, lw = Math.min(1, (w + 0.6) / 6), lh = Math.min(1, (h + 0.5) / 3);
  M.fp(F, `int:${s.int}:${aceso as 0 | 1}`, u, y0 + h / 2, -e - 0.55, w + 0.6, h + 0.5, undefined, [off, 0.5 - lh / 2, off + lw, 0.5 + lh / 2]);
  M.fp(F, "vidro", u, y0 + h / 2, -e * 0.6, w, h);
  if (M.detalhe) {
    const t = 0.06, d = 0.1, n = -e * 0.6 + 0.02, c = s.caixilho;
    M.fc(F, "metal", u, y0 + h - t / 2, n, w, t, d, c); M.fc(F, "metal", u, y0 + t / 2, n, w, t, d, c);
    M.fc(F, "metal", u - w / 2 + t / 2, y0 + h / 2, n, t, h, d, c); M.fc(F, "metal", u + w / 2 - t / 2, y0 + h / 2, n, t, h, d, c);
    for (let i = 1; i <= montantes; i++) M.fc(F, "metal", u - w / 2 + (i * w) / (montantes + 1), y0 + h / 2, n, 0.045, h, d * 0.8, c);
    if (travessa) M.fc(F, "metal", u, y0 + h * 0.7, n, w, 0.045, d * 0.8, c);
  }
  // peitoril com pingadeira, para fora
  M.fc(F, "liso", u, y0 - 0.03, 0.06, w + 0.22, 0.06, 0.2, s.peitoril);
}
// Vitrine do térreo: vidro do chão ao teto com montantes, rodapé, bandeira e portas; livres = onde vão os cartazes
// (sem montante na frente deles)
function vitrine(M: Montador, F: Face, s: Estilo, o: { u0: number; u1: number; y0: number; y1: number; portas: [number, number][]; n?: number; int?: IntTipo; passo?: number; corCaixilho?: string; livres?: number[] }) {
  const n = o.n ?? -0.2, cx = o.corCaixilho ?? s.caixilho, int = o.int ?? s.int;
  const w = o.u1 - o.u0, h = o.y1 - o.y0, uc = (o.u0 + o.u1) / 2, off = hash(s.seed, o.u0, 7) * 0.5;
  M.fp(F, `int:${int}:1`, uc, o.y0 + h / 2, n - 1.3, w + 0.4, h + 0.3, undefined, [off, 0.02, off + Math.min(1, w / 6), Math.min(1, 0.02 + h / 3)]);
  M.fp(F, "vidro", uc, o.y0 + h / 2, n, w, h);
  M.fc(F, "metal", uc, o.y0 + 0.11, n - 0.02, w, 0.22, 0.12, cx); // rodapé
  M.fc(F, "metal", uc, o.y1 - 0.05, n - 0.02, w, 0.1, 0.14, cx);
  M.fc(F, "metal", uc, o.y0 + Math.min(h - 0.5, 2.55), n - 0.02, w, 0.07, 0.12, cx); // bandeira
  const passo = o.passo ?? 1.5, k = Math.max(1, Math.round(w / passo));
  for (let i = 0; i <= k; i++) {
    const u = o.u0 + (i * w) / k;
    if (o.portas.some(([pu, pw]) => u > pu - pw / 2 - 0.05 && u < pu + pw / 2 + 0.05)) continue;
    if (i > 0 && i < k && o.livres?.some((lu) => Math.abs(u - lu) < 0.6)) continue;
    M.fc(F, "metal", u, o.y0 + h / 2, n - 0.02, 0.07, h, 0.14, cx);
  }
  for (const [pu, pw] of o.portas) {
    M.fc(F, "metal", pu - pw / 2, o.y0 + 1.15, n - 0.02, 0.07, 2.3, 0.14, cx); M.fc(F, "metal", pu + pw / 2, o.y0 + 1.15, n - 0.02, 0.07, 2.3, 0.14, cx);
    M.fc(F, "metal", pu, o.y0 + 2.3, n - 0.02, pw, 0.08, 0.14, cx);
    if (M.detalhe) for (const sg of [-1, 1]) M.fc(F, "metal", pu + sg * 0.12, o.y0 + 1.05, n + 0.05, 0.03, 0.9, 0.04, "#C9CED6");
    M.fc(F, "fosco", pu, o.y0 + 0.01, -0.35, pw + 0.4, 0.02, 1.0, "#4A4E54"); // capacho
  }
}
// condensadora de ar-condicionado com grade, presa na parede por mãos-francesas
function arCondicionado(M: Montador, F: Face, u: number, y: number) {
  if (!M.detalhe) return;
  M.fc(F, "liso", u, y, 0.2, 0.82, 0.56, 0.3, "#E9EAEC");
  M.fc(F, "metal", u + 0.12, y, 0.36, 0.4, 0.4, 0.02, "#6B7078");
  M.fc(F, "metal", u, y - 0.3, 0.18, 0.86, 0.04, 0.36, "#8A9098");
  M.fc(F, "liso", u - 0.3, y - 0.55, 0.06, 0.03, 0.5, 0.03, "#D9DCDF"); // dreno
}
// condutor de água pluvial descendo a fachada
function condutor(M: Montador, F: Face, u: number, y0: number, y1: number, cor = "#D9DCDF") {
  if (!M.detalhe) return;
  M.fc(F, "liso", u, (y0 + y1) / 2, 0.08, 0.1, y1 - y0, 0.1, cor);
}
// guarda-corpo de a até b (pode ser inclinado: escada e rampa): corrimão, travessa e balaústres (ou vidro)
function guardaCorpo(M: Montador, x0: number, z0: number, x1: number, z1: number, y0: number, y1 = y0, cor = "#3A3F47", vidro = false, alt = 1.05) {
  M.barra("metal", x0, y0 + alt, z0, x1, y1 + alt, z1, 0.05, cor);
  if (vidro) { M.barra("vidro", x0, y0 + alt / 2, z0, x1, y1 + alt / 2, z1, 0.02, undefined, alt - 0.1); return; }
  M.barra("metal", x0, y0 + 0.15, z0, x1, y1 + 0.15, z1, 0.03, cor);
  const len = Math.hypot(x1 - x0, z1 - z0), k = Math.max(1, Math.round(len / (M.detalhe ? 0.14 : 0.7)));
  for (let i = 0; i <= k; i++) { const t = i / k; M.caixa("metal", 0.025, alt, 0.025, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + alt / 2, z0 + (z1 - z0) * t, cor); }
}
// caixa d'água de fibra azul em cima de uma base
function caixaDagua(M: Montador, x: number, y: number, z: number) {
  M.caixa("concreto", 1.8, 0.5, 1.8, x, y + 0.25, z, "#D6D3CC");
  M.cil("liso", 0.85, 0.75, 1.2, x, y + 1.1, z, "#3E7FBF", 16);
  M.cil("liso", 0.88, 0.88, 0.1, x, y + 1.72, z, "#2E6DAA", 16);
}
// calçada de concreto em volta do prédio (fica acima do piso do lote)
const calcada = (M: Montador, w: number, z0: number, z1: number, x = 0) => M.caixa("concreto", w + 1.2, 0.08, z1 - z0 + 1.2, x, 0.04, (z0 + z1) / 2, "#CFCBC3");
const retangulo = (w: number, z0: number, z1: number, x = 0): [number, number][] => [[x - w / 2, z0], [x + w / 2, z0], [x + w / 2, z1], [x - w / 2, z1]];
// platibanda (mureta em volta da laje) com rufo de chapa por cima, seguindo um contorno fechado
function platibanda(M: Montador, s: Estilo, pts: [number, number][], y: number, alt = 0.9, cor?: string) {
  const c = cor ?? s.corParede, e = 0.22;
  pts.forEach(([ax, az], i) => {
    const [bx, bz] = pts[(i + 1) % pts.length], len = Math.hypot(bx - ax, bz - az), dx = ((bx - ax) / len) * (e / 2), dz = ((bz - az) / len) * (e / 2);
    M.barra(s.parede, ax - dx, y + alt / 2, az - dz, bx + dx, y + alt / 2, bz + dz, e, c, alt);
    M.barra("metal", ax - dx, y + alt + 0.025, az - dz, bx + dx, y + alt + 0.025, bz + dz, 0.32, "#A9AFB6", 0.05);
  });
}
// laje de cobertura com manta
function lajeTopo(M: Montador, pts: [number, number][], y: number) {
  M.poligono("concreto", pts, y - 0.3, 0.3, "#B9B5AD");
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  M.poligono("fosco", pts.map(([x, z]) => [cx + (x - cx) * 0.96, cz + (z - cz) * 0.96] as [number, number]), y, 0.02, "#8E8A83");
}
// casa de máquinas, caixa d'água, condensadoras e antena no telhado
function equipamentos(M: Montador, s: Estilo, x: number, y: number, z: number, w: number) {
  M.caixa(s.parede, 2.6, 2.4, 2.4, x - w * 0.22, y + 1.2, z + 1.2, s.corParede);
  M.caixa("metal", 2.8, 0.06, 2.6, x - w * 0.22, y + 2.43, z + 1.2, "#A9AFB6");
  caixaDagua(M, x + w * 0.2, y, z + 1.6);
  if (!M.detalhe) return;
  for (let i = 0; i < 3; i++) { M.caixa("liso", 1.0, 0.8, 0.45, x - 1.2 + i * 1.25, y + 0.45, z - 1.4, "#E6E7E9"); M.cil("metal", 0.3, 0.3, 0.04, x - 1.2 + i * 1.25, y + 0.87, z - 1.4, "#555B63", 12); }
  M.cil("metal", 0.03, 0.03, 3.2, x - w * 0.22 + 0.9, y + 4.0, z + 0.4, "#9AA1A9", 6);
}

// ---------------------------------------------------------------- revestimento escolhido pelo dono
function paredeDe(material: MaterialFachada, padrao: { parede: Papel; cor: string }): { parede: Papel; cor: string } {
  if (material === "original") return padrao;
  if (material === "vidro") return { parede: "espelho", cor: "#B9CCDA" };
  if (material === "tijolinho") return { parede: "tijolo", cor: "#FFFFFF" };
  if (material === "madeira") return { parede: "madeira", cor: "#FFFFFF" };
  if (material === "concreto") return { parede: "concreto", cor: "#FFFFFF" };
  return { parede: "pintura", cor: "#FFFFFF" }; // a cor vem do material (materialPintura)
}

// ---------------------------------------------------------------- os 8 tipos
interface Opcoes { id: KitId; n: number; duplo: boolean; material: MaterialFachada; corMarca: string; seed: number; plana: boolean }
type Plantas = { arbusto: ItemInstancia[]; azaleia: ItemInstancia[]; topiaria: ItemInstancia[] };
interface Feito { M: Montador; plantas: Plantas }
const novo = (): Feito => ({ M: new Montador(), plantas: { arbusto: [], azaleia: [], topiaria: [] } });
// u na frente (th = π) de uma face centrada em cx: x = cx − u
const livresFrente = (m: MedidasKit, cx = 0) => m.vitrine.map((v) => cx - v.x);

function comercial(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, terreo, andar, n } = m, d = z1 - z0, topo = terreo + (n - 1) * andar, recuo = 1.0;
  const P = paredeDe(o.material, { parede: "reboco", cor: "#E4DFD6" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#3A4048", peitoril: "#D7D2C8", int: "escritorio", seed: o.seed, e: 0.24 };
  const F = faces(w, z0, z1);
  calcada(M, w, z0, z1);
  // térreo recuado: recepção de vidro atrás da colunata, portaria no meio
  const ft: Face = { cx: 0, cz: z0 + recuo, th: Math.PI };
  vitrine(M, ft, s, { u0: -w / 2 + 0.5, u1: w / 2 - 0.5, y0: 0.08, y1: terreo - 0.3, portas: [[0, 2.2]], n: -0.05, livres: livresFrente(m) });
  for (const sg of [-1, 1]) M.fc(ft, s.parede, sg * (w / 2 - 0.25), terreo / 2, -0.12, 0.5, terreo, 0.24, s.corParede);
  M.caixa("concreto", w, 0.3, recuo + 0.3, 0, terreo - 0.15, z0 + recuo / 2, "#D9D5CD"); // forro do recuo
  const kc = Math.max(3, Math.round((w - 0.6) / 5));
  for (let i = 0; i <= kc; i++) M.caixa("concreto", 0.5, terreo, 0.5, -w / 2 + 0.3 + (i * (w - 0.6)) / kc, terreo / 2, z0 + 0.25, "#CFCAC0");
  // marquise na frente com luzes embaixo (o letreiro fica em cima dela)
  M.caixa("concreto", Math.max(m.letreiro.largura + 2.6, w * 0.62), 0.22, 1.4, 0, 3.86, z0 - 0.55, "#E9E5DE");
  if (M.detalhe) for (const x of [-3, -1, 1, 3]) M.caixa("luz", 0.3, 0.02, 0.3, x * (w / 15), 3.74, z0 - 0.6);
  // laterais e fundos do térreo, com janelas altas
  for (const L of [F.esq, F.dir]) andarJanelas(M, L, s, { u0: -d / 2 + 0.24, u1: d / 2 - recuo, y: 0, h: terreo, pe: 1.6, alt: 1.6, jan: distribuir(-d / 2 + 0.6, d / 2 - 1.6, 1.4, 2.6), idx: 900 + L.th });
  andarJanelas(M, F.fundos, s, { u0: -w / 2, u1: w / 2, y: 0, h: terreo, pe: 1.6, alt: 1.6, jan: distribuir(-w / 2 + 0.6, w / 2 - 0.6, 1.4, 2.6), idx: 950 });
  M.caixa("concreto", w + 0.3, 0.22, d + 0.3, 0, terreo - 0.02, (z0 + z1) / 2, "#C9C4BA");
  // andares de salas: janelas em fita na frente e nos fundos, menores nas laterais; laje aparente entre andares
  for (let a = 1; a < n; a++) {
    const y = terreo + (a - 1) * andar;
    andarJanelas(M, F.frente, s, { u0: -w / 2, u1: w / 2, y, h: andar, pe: 0.95, alt: 1.75, jan: distribuir(-w / 2 + 0.4, w / 2 - 0.4, 2.3, 2.5), montantes: 1, travessa: true, idx: a * 10 });
    andarJanelas(M, F.fundos, s, { u0: -w / 2, u1: w / 2, y, h: andar, pe: 0.95, alt: 1.6, jan: distribuir(-w / 2 + 0.6, w / 2 - 0.6, 1.8, 2.6), idx: a * 10 + 1 });
    for (const L of [F.esq, F.dir]) {
      andarJanelas(M, L, s, { u0: -d / 2 + 0.24, u1: d / 2 - 0.24, y, h: andar, pe: 1.05, alt: 1.4, jan: distribuir(-d / 2 + 1.2, d / 2 - 1.2, 1.3, 3.1), idx: a * 10 + 2 + L.th });
      arCondicionado(M, L, -d / 2 + 2.6 + (a % 2) * 3.4, y + 0.6);
    }
    M.caixa("concreto", w + 0.3, 0.2, d + 0.3, 0, y + andar - 0.02, (z0 + z1) / 2, "#C9C4BA");
  }
  // brises verticais de alumínio na frente dos andares
  if (M.detalhe && n > 1) { const kb = Math.round(w / 1.4); for (let i = 0; i <= kb; i++) M.caixa("metal", 0.06, (n - 1) * andar - 0.4, 0.42, -w / 2 + 0.2 + (i * (w - 0.4)) / kb, terreo + ((n - 1) * andar) / 2, z0 - 0.3, "#C3C8CE"); }
  condutor(M, F.esq, d / 2 - 0.4, 0, topo + 0.8); condutor(M, F.dir, -d / 2 + 0.4, 0, topo + 0.8);
  lajeTopo(M, retangulo(w, z0, z1), topo);
  if (!o.plana) { platibanda(M, s, retangulo(w, z0, z1), topo, 0.9); equipamentos(M, s, 0, topo, (z0 + z1) / 2 + 0.4, w); }
  // canteiros na frente
  for (const sx of [-1, 1]) { M.caixa("concreto", 2.6, 0.45, 0.8, sx * (w / 2 - 1.6), 0.22, z0 - 1.0, "#BDB7AC"); M.caixa("fosco", 2.4, 0.02, 0.6, sx * (w / 2 - 1.6), 0.45, z0 - 1.0, "#5A4632"); plantas.arbusto.push({ pos: [sx * (w / 2 - 2.3), 0.45, z0 - 1.0], altura: 0.9 }, { pos: [sx * (w / 2 - 1.0), 0.45, z0 - 1.0], altura: 0.8 }); }
  return { M, plantas };
}

function torre(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, terreo, andar, n } = m, d = z1 - z0, topo = terreo + (n - 1) * andar;
  const P = paredeDe(o.material, { parede: "espelho", cor: "#9FB6C8" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#2B3036", peitoril: "#8B939C", int: "escritorio", seed: o.seed, e: 0.2 };
  const F = faces(w, z0, z1);
  calcada(M, w, z0, z1);
  // saguão de pé-direito duplo, recuado, todo de vidro, com pilares redondos
  const fl: Face = { cx: 0, cz: z0 + 1.1, th: Math.PI };
  vitrine(M, fl, s, { u0: -w / 2 + 0.6, u1: w / 2 - 0.6, y0: 0.08, y1: terreo - 0.25, portas: [[-0.9, 1.6], [0.9, 1.6]], n: 0, passo: 1.6, corCaixilho: "#20252B", livres: livresFrente(m) });
  for (const sg of [-1, 1]) M.fc(fl, "concreto", sg * (w / 2 - 0.3), terreo / 2, -0.1, 0.6, terreo, 0.2, "#CBC8C1");
  for (const [L, lw] of [[F.esq, d], [F.dir, d], [F.fundos, w]] as [Face, number][]) M.fc(L, "concreto", 0, terreo / 2, -0.15, lw, terreo, 0.3, "#CBC8C1");
  M.caixa("concreto", w, 0.3, 1.4, 0, terreo - 0.15, z0 + 0.6, "#D2CFC8");
  const kc = Math.max(3, Math.round(w / 4.4));
  for (let i = 0; i <= kc; i++) M.cil("liso", 0.32, 0.32, terreo, -w / 2 + 0.4 + (i * (w - 0.8)) / kc, terreo / 2, z0 + 0.4, "#E1DED7", 20);
  // marquise metálica com cobertura de vidro na entrada
  const mw = m.letreiro.largura - 0.8;
  M.caixa("metal", mw, 0.18, 2.0, 0, 4.3, z0 - 0.6, "#2E343B"); M.caixa("vidro", mw - 0.2, 0.03, 1.9, 0, 4.42, z0 - 0.6);
  for (const sg of [-1, 1]) M.cil("metal", 0.08, 0.08, 4.3, sg * (mw / 2 - 0.2), 2.15, z0 - 1.45, "#2E343B", 10);
  if (M.detalhe) for (const x of [-2, 0, 2]) M.caixa("luz", 0.5, 0.02, 0.5, x, 4.2, z0 - 0.6);
  // miolo escuro (núcleo de elevadores): pela pele de vidro nunca se vê o outro lado vazio
  if (n > 1) M.caixa("fosco", w - 2.0, topo - terreo, d - 2.0, 0, terreo + (topo - terreo) / 2, 0, "#2B3036");
  // andares: faixa opaca na altura da laje + vidro de visão, montantes a cada ~1,5 m
  const esp = 0.85;
  for (let a = 1; a < n; a++) {
    const y = terreo + (a - 1) * andar;
    for (const [L, lw] of [[F.frente, w], [F.fundos, w], [F.esq, d], [F.dir, d]] as [Face, number][]) {
      M.fc(L, s.parede, 0, y + esp / 2, -0.12, lw, esp, 0.24, s.corParede);
      const k = Math.max(2, Math.round(lw / 1.5));
      for (let i = 0; i < k; i++) {
        const u = -lw / 2 + (i + 0.5) * (lw / k), aceso = hash(o.seed, a * 50 + i, L.th) > 0.4 ? 1 : 0, of = hash(i, a, o.seed) * 0.7;
        M.fp(L, `int:escritorio:${aceso as 0 | 1}`, u, y + esp + (andar - esp) / 2, -0.85, lw / k + 0.1, andar - esp + 0.1, undefined, [of, 0.1, of + 0.25, 0.9]);
      }
      M.fp(L, "vidro", 0, y + esp + (andar - esp) / 2, -0.05, lw, andar - esp);
      for (let i = 0; i <= k; i++) M.fc(L, "metal", -lw / 2 + i * (lw / k), y + andar / 2, 0.02, 0.07, andar, 0.18, "#2A2F35");
      M.fc(L, "metal", 0, y + esp, 0.02, lw, 0.05, 0.12, "#2A2F35");
    }
  }
  // pilares de canto em concreto claro até a coroa
  const hp = topo + (o.plana ? 0.3 : 2.6) - terreo;
  for (const [x, z] of [[-w / 2, z0], [w / 2, z0], [-w / 2, z1], [w / 2, z1]]) M.caixa("concreto", 0.7, hp, 0.7, x, terreo + hp / 2, z, "#D9D6CF");
  M.caixa("concreto", w + 0.4, 0.3, d + 0.4, 0, topo - 0.15, 0, "#C9C6BF");
  if (!o.plana) {
    // coroa de vidro escuro com uma linha de luz, equipamentos e heliponto
    for (const [cw, cd, x, z] of [[w + 0.2, 0.2, 0, z0], [w + 0.2, 0.2, 0, z1], [0.2, d, w / 2, 0], [0.2, d, -w / 2, 0]] as [number, number, number, number][]) M.caixa("espelho", cw, 2.6, cd, x, topo + 1.3, z, "#7E97AC");
    M.caixa("luz", w + 0.24, 0.06, 0.06, 0, topo + 2.5, z0 - 0.1);
    equipamentos(M, s, 0, topo, 0.5, w);
    if (M.detalhe) { M.cil("liso", 2.2, 2.2, 0.05, 0, topo + 0.03, -1.6, "#3C4148", 24); M.caixa("liso", 0.25, 0.02, 1.6, -0.5, topo + 0.07, -1.6, "#F2C230"); M.caixa("liso", 0.25, 0.02, 1.6, 0.5, topo + 0.07, -1.6, "#F2C230"); M.caixa("liso", 1.0, 0.02, 0.25, 0, topo + 0.07, -1.6, "#F2C230"); }
  }
  // espelho d'água e topiarias na frente do saguão
  M.caixa("concreto", 3.6, 0.35, 1.0, -w / 2 + 2.2, 0.17, z0 - 1.1, "#B5B0A6"); M.caixa("vidro", 3.4, 0.02, 0.8, -w / 2 + 2.2, 0.34, z0 - 1.1);
  plantas.topiaria.push({ pos: [w / 2 - 1.2, 0.08, z0 - 1.0], altura: 1.6 }, { pos: [w / 2 - 2.6, 0.08, z0 - 1.0], altura: 1.4 });
  return { M, plantas };
}

function esquina(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, terreo, andar, n } = m, d = z1 - z0, topo = terreo + (n - 1) * andar, ch = 2.2; // chanfro no canto esquerdo da frente
  const P = paredeDe(o.material, { parede: "reboco", cor: "#E8D3A2" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#2F3A33", peitoril: "#F1ECE2", int: "loja", seed: o.seed, e: 0.24 };
  const F = faces(w, z0, z1), fc: Face = { cx: w / 2 - ch / 2, cz: z0 + ch / 2, th: Math.PI * 0.75 }, lc = ch * Math.SQRT2;
  const contorno: [number, number][] = [[-w / 2, z0], [w / 2 - ch, z0], [w / 2, z0 + ch], [w / 2, z1], [-w / 2, z1]];
  const afasta = (k: number) => contorno.map(([x, z]) => [x + Math.sign(x) * k, z + (z === z1 ? k : -k)] as [number, number]);
  M.poligono("concreto", afasta(0.6), 0, 0.08, "#CFCBC3"); // calçada
  // térreo: vitrine em L (frente e lateral) com a porta principal no canto chanfrado
  vitrine(M, F.frente, s, { u0: -w / 2 + ch, u1: w / 2 - 0.4, y0: 0.08, y1: terreo - 0.4, portas: [[-1.0, 1.6]], n: -0.1, livres: livresFrente(m) });
  vitrine(M, F.esq, s, { u0: -d / 2 + 0.6, u1: d / 2 - ch, y0: 0.08, y1: terreo - 0.4, portas: [], n: -0.1 });
  vitrine(M, fc, s, { u0: -lc / 2 + 0.1, u1: lc / 2 - 0.1, y0: 0.08, y1: terreo - 0.4, portas: [[0, 1.8]], n: -0.1 });
  M.fc(F.frente, s.parede, w / 2 - 0.2, terreo / 2, -0.12, 0.4, terreo, 0.24, s.corParede);
  M.fc(F.esq, s.parede, -d / 2 + 0.3, terreo / 2, -0.12, 0.6, terreo, 0.24, s.corParede);
  M.fc(F.frente, s.parede, ch / 2, terreo - 0.2, -0.12, w - ch, 0.4, 0.24, s.corParede);
  M.fc(F.esq, s.parede, -ch / 2, terreo - 0.2, -0.12, d - ch, 0.4, 0.24, s.corParede);
  M.fc(fc, s.parede, 0, terreo - 0.2, -0.12, lc, 0.4, 0.24, s.corParede);
  // barrado de pastilha e janelas altas do estoque nos lados fechados
  andarJanelas(M, F.dir, s, { u0: -d / 2 + 0.24, u1: d / 2 - 0.24, y: 0, h: terreo, pe: 1.5, alt: 1.9, jan: distribuir(-d / 2 + 1, d / 2 - 1, 1.2, 3.2), idx: 700 });
  andarJanelas(M, F.fundos, s, { u0: -w / 2, u1: w / 2, y: 0, h: terreo, pe: 1.5, alt: 1.9, jan: [[w / 2 - 2, 1.2]], idx: 710 });
  M.fc(F.dir, "pastilha", 0, 0.62, 0.02, d, 1.2, 0.06, "#E4E9E4"); M.fc(F.fundos, "pastilha", 0, 0.62, 0.02, w, 1.2, 0.06, "#E4E9E4");
  M.poligono("concreto", afasta(0.15), terreo - 0.18, 0.25, "#F1ECE2");
  // marquise contornando a frente, o chanfro e a lateral; platibanda na frente para o letreiro
  M.poligono("concreto", [[-w / 2, z0], [w / 2 - ch, z0], [w / 2, z0 + ch], [w / 2, z1 - 0.3], [w / 2 + 1.5, z1 - 0.3], [w / 2 + 1.5, z0 + ch - 0.62], [w / 2 - ch + 0.62, z0 - 1.5], [-w / 2, z0 - 1.5]], 3.55, 0.22, "#F3EFE7");
  M.caixa(s.parede, w - ch, 0.75, 0.16, -ch / 2 + 0.3, 4.05, z0 - 1.46, s.corParede);
  if (M.detalhe) { for (let i = 0; i < 6; i++) M.caixa("luz", 0.25, 0.02, 0.25, -w / 2 + 1.5 + i * ((w - ch - 2) / 5), 3.53, z0 - 0.8); M.caixa("luz", 0.25, 0.02, 0.25, w / 2 - 0.3, 3.53, z0 + 0.2); }
  // sobreloja e andares (salas e apartamentos em cima da loja): janelas com sacadinhas de ferro, friso entre os andares
  const su: Estilo = { ...s, int: "escritorio" };
  for (let a = 1; a < n; a++) {
    const y = terreo + (a - 1) * andar;
    const janF = distribuir(-w / 2 + ch + 0.4, w / 2 - 0.6, 1.3, 2.4), janE = distribuir(-d / 2 + 0.6, d / 2 - ch - 0.4, 1.3, 2.4);
    andarJanelas(M, F.frente, su, { u0: -w / 2 + ch, u1: w / 2, y, h: andar, pe: 0.3, alt: 2.2, jan: janF, montantes: 1, idx: a * 10 });
    andarJanelas(M, F.esq, su, { u0: -d / 2, u1: d / 2 - ch, y, h: andar, pe: 0.3, alt: 2.2, jan: janE, montantes: 1, idx: a * 10 + 1 });
    andarJanelas(M, fc, su, { u0: -lc / 2, u1: lc / 2, y, h: andar, pe: 0.3, alt: 2.2, jan: [[0, 1.2]], idx: a * 10 + 2 });
    andarJanelas(M, F.dir, su, { u0: -d / 2 + 0.24, u1: d / 2 - 0.24, y, h: andar, pe: 1.0, alt: 1.3, jan: distribuir(-d / 2 + 1, d / 2 - 1, 1.1, 3.0), idx: a * 10 + 3 });
    andarJanelas(M, F.fundos, su, { u0: -w / 2, u1: w / 2, y, h: andar, pe: 1.0, alt: 1.3, jan: distribuir(-w / 2 + 1, w / 2 - 1, 1.1, 3.0), idx: a * 10 + 4 });
    for (const [u] of janF) { const x = -u; M.caixa("concreto", 1.6, 0.1, 0.45, x, y + 0.25, z0 - 0.22, "#F1ECE2"); if (M.detalhe) guardaCorpo(M, x - 0.75, z0 - 0.42, x + 0.75, z0 - 0.42, y + 0.3, y + 0.3, "#2B2F2C", false, 0.9); }
    for (const [u] of janE) { const z = (z0 + z1) / 2 - u; M.caixa("concreto", 0.45, 0.1, 1.6, w / 2 + 0.22, y + 0.25, z, "#F1ECE2"); if (M.detalhe) guardaCorpo(M, w / 2 + 0.42, z - 0.75, w / 2 + 0.42, z + 0.75, y + 0.3, y + 0.3, "#2B2F2C", false, 0.9); }
    M.barra("concreto", -w / 2 - 0.05, y + andar - 0.08, z0 - 0.06, w / 2 - ch, y + andar - 0.08, z0 - 0.06, 0.2, "#F1ECE2", 0.14);
    M.barra("concreto", w / 2 - ch, y + andar - 0.08, z0 - 0.06, w / 2 + 0.06, y + andar - 0.08, z0 + ch, 0.2, "#F1ECE2", 0.14);
    M.barra("concreto", w / 2 + 0.06, y + andar - 0.08, z0 + ch, w / 2 + 0.06, y + andar - 0.08, z1 + 0.05, 0.2, "#F1ECE2", 0.14);
  }
  lajeTopo(M, contorno, topo);
  if (!o.plana) { platibanda(M, s, contorno, topo, 1.1); caixaDagua(M, -w / 4, topo, (z0 + z1) / 2 + 1.5); }
  condutor(M, F.dir, d / 2 - 0.3, 0, topo + 1);
  plantas.azaleia.push({ pos: [-w / 2 + 1.0, 0.08, z0 - 1.0], altura: 0.9 }, { pos: [-w / 2 + 2.0, 0.08, z0 - 1.0], altura: 0.8 });
  return { M, plantas };
}

// escritório na frente do galpão (logístico e industrial): recepção de vidro no térreo, janelas em fita em cima
function anexoEscritorio(M: Montador, s: Estilo, m: MedidasKit, n: number, plana: boolean, corMarca: string, portaU: number) {
  const a = m.anexo!, aw = a.x1 - a.x0, cx = (a.x0 + a.x1) / 2, F = faces(aw, a.z0, a.z1, cx);
  calcada(M, aw, a.z0, a.z1, cx);
  vitrine(M, F.frente, s, { u0: -aw / 2 + 0.4, u1: aw / 2 - 0.4, y0: 0.08, y1: 2.95, portas: [[portaU, 1.4]], n: -0.18, int: "escritorio", livres: livresFrente(m, cx) });
  for (const sg of [-1, 1]) M.fc(F.frente, s.parede, sg * (aw / 2 - 0.2), 1.5, -0.12, 0.4, 3.0, 0.24, s.corParede);
  M.fc(F.frente, s.parede, 0, 3.15, -0.12, aw, 0.4, 0.24, s.corParede);
  for (let k = 1; k < n; k++) andarJanelas(M, F.frente, s, { u0: -aw / 2, u1: aw / 2, y: 3.3 * k, h: 3.3, pe: 0.9, alt: 1.6, jan: distribuir(-aw / 2 + 0.4, aw / 2 - 0.4, 2.0, 2.4), montantes: 1, idx: 300 + k });
  for (const L of [F.esq, F.dir]) for (let k = 0; k < n; k++) andarJanelas(M, L, s, { u0: -(a.z1 - a.z0) / 2 + 0.24, u1: (a.z1 - a.z0) / 2 - 0.24, y: 3.3 * k, h: 3.3, pe: 1.0, alt: 1.3, jan: [[0, 1.4]], idx: 320 + k + L.th });
  M.fc(F.frente, "liso", 0, a.h - 0.45, 0.04, aw + 0.06, 0.22, 0.06, corMarca); // faixa na cor da marca
  lajeTopo(M, retangulo(aw, a.z0, a.z1, cx), a.h - 0.7);
  if (!plana) platibanda(M, s, retangulo(aw, a.z0, a.z1, cx), a.h - 0.7, 0.7);
  arCondicionado(M, F.esq, 0.6, 1.8); arCondicionado(M, F.dir, -0.6, 1.8);
}

function logistico(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, n } = m, a = m.anexo!, d = z1 - z0, H = 9.0;
  const P = paredeDe(o.material, { parede: "chapa", cor: "#D3D8DD" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#2E3338", peitoril: "#C9CCD0", int: "galpao", seed: o.seed, e: 0.2 };
  const sa: Estilo = { ...s, parede: o.material === "original" ? "reboco" : P.parede, corParede: o.material === "original" ? "#EFECE6" : P.cor, int: "escritorio", e: 0.24 };
  const F = faces(w, z0, z1);
  calcada(M, w, z0, z1);
  // base de alvenaria (1,2 m) e chapa até o beiral; faixa alta de telha translúcida (acende à noite)
  for (const [L, lw] of [[F.frente, w], [F.fundos, w], [F.esq, d], [F.dir, d]] as [Face, number][]) {
    M.fc(L, "reboco", 0, 0.6, -0.12, lw, 1.2, 0.26, "#9EA5AD");
    M.fc(L, s.parede, 0, 1.2 + (H - 1.2) / 2, -0.1, lw, H - 1.2, 0.2, s.corParede);
    M.fc(L, "liso", 0, 1.22, 0.03, lw + 0.04, 0.06, 0.06, o.corMarca);
    if (L !== F.frente) for (const [u, jw] of distribuir(-lw / 2 + 1, lw / 2 - 1, 2.6, 3.4)) {
      const of = hash(u, 1, 2) * 0.6;
      M.fp(L, "int:galpao:1", u, H - 1.4, 0.006, jw, 0.9, undefined, [of, 0.62, of + 0.35, 0.8]);
      M.fp(L, "vidro", u, H - 1.4, 0.016, jw, 0.9); M.fc(L, "metal", u, H - 0.92, 0.04, jw + 0.1, 0.06, 0.08, "#8C939A");
    }
  }
  // telhado de duas águas (cumeeira no comprimento), frontões, rufo da cumeeira e exaustores eólicos
  const beiral = 0.5, alt = 1.8, ang = Math.atan2(alt, w / 2), lw = w / 2 + beiral;
  for (const sg of [-1, 1]) M.caixa("chapa", lw / Math.cos(ang), 0.08, d + 2 * beiral, sg * (lw / 2), H + alt - (lw / 2) * Math.tan(ang) + 0.04, (z0 + z1) / 2, "#B9C0C7", 0, 0, -sg * ang);
  for (const L of [F.frente, F.fundos]) M.prisma(s.parede, [[0, -w / 2], [0, w / 2], [alt, 0]], 0.2, 0, H, L.cz + (L === F.frente ? 0.1 : -0.1), s.corParede, Math.PI / 2);
  M.caixa("metal", 0.5, 0.06, d + 2 * beiral, 0, H + alt + 0.05, (z0 + z1) / 2, "#9AA1A9");
  if (M.detalhe) for (let i = 0; i < 3; i++) { const z = z0 + d * (0.25 + i * 0.25); M.cil("metal", 0.12, 0.12, 0.4, 0, H + alt + 0.2, z, "#B5BBC1", 8); M.cil("metal", 0.32, 0.22, 0.45, 0, H + alt + 0.6, z, "#C9CED3", 14); }
  // calhas nos beirais e condutores nos fundos
  for (const sg of [-1, 1]) M.caixa("metal", 0.2, 0.18, d + 2 * beiral, sg * (w / 2 + beiral - 0.05), H - beiral * Math.tan(ang) - 0.05, (z0 + z1) / 2, "#A9AFB6");
  condutor(M, F.fundos, w / 2 - 0.3, 0, H); condutor(M, F.fundos, -w / 2 + 0.3, 0, H);
  // doca na frente (à esquerda de quem olha): plataforma, portão de enrolar, para-choques de borracha e marquise
  const xd = w / 2 - 4.6;
  M.caixa("concreto", 6.0, 1.2, 1.8, xd, 0.6, z0 - 0.9, "#A8A59F");
  M.caixa("metal", 6.0, 0.08, 0.1, xd, 1.2, z0 - 1.82, "#E2B33A");
  M.caixa("enrolar", 4.0, 4.4, 0.12, xd, 1.2 + 2.2, z0 - 0.06, "#C7CCD2");
  M.caixa("metal", 4.4, 0.5, 0.4, xd, 1.2 + 4.65, z0 - 0.2, "#7D848B"); // caixa do rolo
  for (const sg of [-1, 1]) { M.caixa("metal", 0.14, 4.6, 0.16, xd + sg * 2.06, 1.2 + 2.3, z0 - 0.1, "#3A4047"); M.caixa("fosco", 0.3, 0.45, 0.25, xd + sg * 1.6, 0.9, z0 - 1.92, "#1F2124"); }
  M.caixa("metal", 6.6, 0.15, 3.2, xd, 6.1, z0 - 1.5, "#4A5057");
  for (const sg of [-1, 1]) M.barra("metal", xd + sg * 3.1, 6.15, z0 - 3.0, xd + sg * 3.1, 7.4, z0, 0.06, "#4A5057");
  if (M.detalhe) { M.caixa("luz", 0.5, 0.05, 0.3, xd, 6.0, z0 - 1.5); for (let i = 0; i < 4; i++) M.caixa("liso", 0.2, 0.02, 1.4, xd - 2.2 + i * 1.47, 0.075, z0 - 4.5, "#F2C230"); }
  // escadinha de serviço do lado e guarda-corpos
  for (let k = 0; k < 4; k++) { const h = 1.2 - k * 0.3; M.caixa("concreto", 0.3, h, 1.0, xd - 3.15 - k * 0.3, h / 2, z0 - 0.9, "#A8A59F"); }
  guardaCorpo(M, xd - 3.0, z0 - 1.4, xd - 4.2, z0 - 1.4, 1.2, 0.0, "#E2B33A");
  guardaCorpo(M, xd + 3.0, z0, xd + 3.0, z0 - 1.8, 1.2, 1.2, "#E2B33A");
  // caminhão baú de ré na doca, na cor da marca
  const zt = z0 - 1.95, cor = o.corMarca;
  M.caixa("liso", 2.4, 2.6, 4.2, xd, 2.4, zt - 2.1, "#F4F5F6"); M.caixa("liso", 2.42, 0.4, 4.22, xd, 1.25, zt - 2.1, cor);
  M.caixa("metal", 2.3, 0.3, 5.9, xd, 0.95, zt - 2.95, "#3A3F45");
  M.caixa("liso", 2.3, 1.9, 1.6, xd, 1.95, zt - 5.0, cor); M.caixa("vidro", 2.0, 0.8, 0.05, xd, 2.4, zt - 5.82); M.caixa("liso", 2.32, 0.5, 0.4, xd, 1.2, zt - 5.7, "#2B2F35");
  if (M.detalhe) {
    for (const zz of [zt - 0.8, zt - 1.9, zt - 5.0]) for (const sg of [-1, 1]) M.cil("fosco", 0.45, 0.45, 0.3, xd + sg * 1.05, 0.45, zz, "#1E2023", 14, Math.PI / 2);
    for (const sg of [-1, 1]) { M.caixa("metal", 0.05, 0.3, 0.2, xd + sg * 1.32, 2.3, zt - 5.55, "#2B2F35"); M.caixa("luz", 0.25, 0.12, 0.05, xd + sg * 0.85, 1.3, zt - 5.92); }
  }
  // escritório na frente (à direita de quem olha) e pátio
  anexoEscritorio(M, sa, m, n, o.plana, o.corMarca, -2.4);
  M.caixa("fosco", w - 8.2, 0.04, 7.0, xd + 0.6, 0.05, z0 - 3.4, "#B4B2AD");
  plantas.arbusto.push({ pos: [a.x0 + 0.8, 0.08, a.z0 - 0.9], altura: 0.9 }, { pos: [a.x1 - 0.8, 0.08, a.z0 - 0.9], altura: 0.9 });
  return { M, plantas };
}

function industrial(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, n } = m, a = m.anexo!, d = z1 - z0, H = 7.2;
  const P = paredeDe(o.material, { parede: "tijolo", cor: "#FFFFFF" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#24282C", peitoril: "#B9B2A6", int: "galpao", seed: o.seed, e: 0.26 };
  const sa: Estilo = { ...s, parede: o.material === "original" ? "concreto" : P.parede, corParede: o.material === "original" ? "#FFFFFF" : P.cor, int: "escritorio", e: 0.24 };
  const F = faces(w, z0, z1);
  calcada(M, w, z0, z1);
  // janelões de ferro altos entre pilares nos fundos e nas laterais
  for (const [L, lw] of [[F.fundos, w], [F.esq, d], [F.dir, d]] as [Face, number][]) {
    const lado = L !== F.fundos;
    andarJanelas(M, L, s, { u0: -lw / 2 + (lado ? 0.26 : 0), u1: lw / 2 - (lado ? 0.26 : 0), y: 0, h: H, pe: 1.4, alt: 4.2, jan: distribuir(-lw / 2 + 1, lw / 2 - 1, 2.0, 3.2), montantes: 2, travessa: true, idx: 500 + L.th });
  }
  // frente do galpão: parede inteira (o escritório fica na frente de uma parte), portão de enrolar e porta de serviço
  M.fc(F.frente, s.parede, 0, H / 2, -0.13, w, H, 0.26, s.corParede);
  const xp = (-w / 2 + a.x0) / 2;
  M.caixa("enrolar", 4.4, 4.8, 0.12, xp, 2.4, z0 - 0.07, "#8E98A2");
  M.caixa("metal", 4.8, 0.5, 0.4, xp, 5.05, z0 - 0.22, "#5F666D");
  for (const sg of [-1, 1]) M.caixa("metal", 0.14, 4.9, 0.16, xp + sg * 2.27, 2.45, z0 - 0.1, "#2E3338");
  M.caixa("metal", 1.0, 2.2, 0.06, xp - 3.3, 1.1, z0 - 0.03, "#4B5560"); // porta de serviço
  for (const x of [-w / 2 + 0.2, a.x0 - 0.2]) M.caixa("tijolo", 0.6, H + 0.4, 0.5, x, (H + 0.4) / 2, z0 - 0.1, "#E8DDD2");
  M.caixa("concreto", w + 0.3, 0.3, d + 0.3, 0, H + 0.1, (z0 + z1) / 2, "#C7C0B4");
  // telhado em dente de serra: 4 dentes com o vidro virado para a rua
  const nd = 4, passo = d / nd, alt = 2.4, y0 = H + 0.25;
  for (let i = 0; i < nd; i++) {
    const zi = z0 + i * passo, Fz: Face = { cx: 0, cz: zi, th: Math.PI };
    M.caixa("chapa", w, 0.1, Math.hypot(passo, alt), 0, y0 + alt / 2, zi + passo / 2, "#8F979F", 0, Math.atan2(alt, passo));
    for (const sg of [-1, 1]) M.prisma(s.parede, [[0, 0], [alt, 0], [0, passo]], 0.12, sg * (w / 2 - 0.06), y0, zi, s.corParede);
    M.fp(Fz, "int:galpao:1", 0, y0 + alt / 2, -0.6, w - 0.3, alt - 0.1, undefined, [0.1, 0.55, 0.9, 0.95]);
    M.fp(Fz, "vidro", 0, y0 + alt / 2, -0.02, w - 0.24, alt - 0.06);
    if (M.detalhe) {
      for (let k = 1; k < 9; k++) M.fc(Fz, "metal", -w / 2 + (k * w) / 9, y0 + alt / 2, 0.02, 0.05, alt, 0.08, "#2B2F33");
      M.fc(Fz, "metal", 0, y0 + alt / 2, 0.02, w, 0.04, 0.06, "#2B2F33");
      M.cil("metal", 0.28, 0.32, 0.5, -w / 4 + i * 1.5, y0 + alt * 0.45 + 0.3, zi + passo * 0.55, "#B6BCC2", 10);
    }
  }
  // chaminé de tijolo com anéis atrás do galpão, e tanques no fundo
  const cxm = -w / 2 + 2.2, czm = z1 + 1.0;
  M.cil("tijolo", 0.75, 1.05, 16.5, cxm, 8.25, czm, "#FFFFFF", 20);
  M.cil("concreto", 1.3, 1.3, 0.6, cxm, 0.3, czm, "#BDB6AA", 20);
  for (const y of [4, 8, 12, 16.2]) M.cil("metal", 1.12 - y * 0.02, 1.12 - y * 0.02, 0.18, cxm, y, czm, "#3E3E3E", 20);
  for (const tx of [w / 2 - 1.6, w / 2 - 3.8]) { M.cil("metal", 0.9, 0.9, 3.4, tx, 1.7, z1 + 1.1, "#C9CED3", 18); M.cil("metal", 0.92, 0.3, 0.5, tx, 3.65, z1 + 1.1, "#B5BBC1", 18); }
  if (M.detalhe) { M.barra("metal", w / 2 - 1.6, 3.0, z1 + 1.1, w / 2 - 1.6, 3.0, z1, 0.14, "#B03A2E"); M.fc(F.esq, "metal", 0, 5.8, 0.25, d - 1, 0.18, 0.18, "#B03A2E"); M.fc(F.esq, "metal", 0, 5.4, 0.25, d - 1, 0.12, 0.12, "#E2B33A"); }
  anexoEscritorio(M, sa, m, n, o.plana, o.corMarca, 2.4);
  plantas.arbusto.push({ pos: [a.x1 - 0.7, 0.08, a.z0 - 0.9], altura: 0.9 }, { pos: [a.x0 + 0.7, 0.08, a.z0 - 0.9], altura: 0.9 });
  return { M, plantas };
}

function coworking(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, terreo, andar, n } = m, d = z1 - z0, topo = terreo + (n - 1) * andar;
  const P = paredeDe(o.material, { parede: "tijolo", cor: "#FFFFFF" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#1C1F22", peitoril: "#BDB4A7", int: "cowork", seed: o.seed, e: 0.3 };
  const F = faces(w, z0, z1), xs = -w / 2 - 0.65, uPorta = -1.3;
  calcada(M, w, z0, z1);
  for (let a = 0; a < n; a++) {
    const y = a === 0 ? 0 : terreo + (a - 1) * andar, h = a === 0 ? terreo : andar;
    // frente: térreo com janelões de ferro e porta de madeira; andares com janelões industriais (grade de vidrinhos)
    if (a === 0) andarJanelas(M, F.frente, s, { u0: -w / 2, u1: w / 2, y, h, pe: 0.5, alt: 2.6, jan: distribuir(-w / 2 + 0.6, w / 2 - 0.6, 2.8, 3.4, (u) => Math.abs(u) < 2.2), montantes: 2, travessa: true, idx: 1, porta: [0, 1.6, 2.6] });
    else andarJanelas(M, F.frente, s, { u0: -w / 2, u1: w / 2, y, h, pe: 0.6, alt: 2.6, jan: distribuir(-w / 2 + 0.6, w / 2 - 0.6, 2.4, 3.0), montantes: 3, travessa: true, idx: a * 10 });
    andarJanelas(M, F.fundos, s, { u0: -w / 2, u1: w / 2, y, h, pe: 0.8, alt: 2.2, jan: distribuir(-w / 2 + 0.6, w / 2 - 0.6, 2.0, 3.0), montantes: 2, travessa: true, idx: a * 10 + 1 });
    andarJanelas(M, F.esq, s, { u0: -d / 2 + 0.3, u1: d / 2 - 0.3, y, h, pe: 0.8, alt: 2.2, jan: distribuir(-d / 2 + 1, d / 2 - 1, 1.8, 3.2), montantes: 2, travessa: true, idx: a * 10 + 2 });
    // lado da escada: no 1º andar tem a porta do patamar
    const temPorta = a === 1 && n > 1;
    andarJanelas(M, F.dir, s, { u0: -d / 2 + 0.3, u1: d / 2 - 0.3, y, h, pe: 0.8, alt: 2.2, jan: distribuir(-d / 2 + 1, d / 2 - 1, 1.8, 3.2, temPorta ? (u) => Math.abs(u - uPorta) < 2.0 : undefined), montantes: 2, travessa: true, idx: a * 10 + 3, porta: temPorta ? [uPorta, 1.0, 2.2] : undefined });
    M.caixa("concreto", w + 0.24, 0.28, d + 0.24, 0, y + h - 0.1, (z0 + z1) / 2, "#D3CDC3"); // friso de concreto
  }
  // marquise de aço sobre a porta, com mãos-francesas
  M.caixa("metal", 3.4, 0.12, 1.6, 0, 2.8, z0 - 0.8, "#1E2226");
  for (const sg of [-1, 1]) M.barra("metal", sg * 1.5, 2.74, z0 - 1.25, sg * 1.5, 2.1, z0, 0.06, "#1E2226");
  if (M.detalhe) M.caixa("luz", 2.8, 0.03, 0.1, 0, 2.73, z0 - 1.3);
  // escada externa metálica pela lateral direita (de quem olha), com patamar na porta do 1º andar
  if (n > 1) {
    const hs = terreo, k = Math.ceil(hs / 0.18), passoE = 0.27, zA = z1 - 0.8, zB = zA - k * passoE, uz = (z0 + z1) / 2 + uPorta;
    for (let i = 0; i < k; i++) M.caixa("metal", 1.1, 0.05, 0.3, xs, (hs / k) * (i + 1), zA - i * passoE - passoE / 2, "#2A2E32");
    for (const sg of [-1, 1]) M.barra("metal", xs + sg * 0.56, 0.1, zA, xs + sg * 0.56, hs - 0.05, zB, 0.05, "#2A2E32", 0.26);
    M.caixa("metal", 1.2, 0.08, Math.abs(uz - zB) + 1.0, xs, hs, (uz + zB) / 2 - 0.3, "#2A2E32");
    guardaCorpo(M, xs - 0.56, zA, xs - 0.56, zB, 0.15, hs, "#2A2E32");
    guardaCorpo(M, xs - 0.56, zB, xs - 0.56, uz - 0.8, hs, hs, "#2A2E32");
    for (const zz of [zB - 0.3, uz - 0.7]) M.caixa("metal", 0.08, hs, 0.08, xs - 0.5, hs / 2, zz, "#2A2E32");
  }
  // jardim vertical na outra lateral, telhado com claraboias e caixa d'água
  if (M.detalhe) {
    // jardim vertical: módulos de plantas em tons de verde, com a calha de rega embaixo
    const rr = rnd(o.seed + 5), verdes = ["#3D7A3F", "#4E9B47", "#2F6B35", "#5BA84E", "#6DBA5E", "#3A6E2E"];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) M.fc(F.esq, "fosco", d / 2 - 3.5 + i * 0.4, 0.75 + j * 0.38, 0.08 + rr() * 0.08, 0.44, 0.42, 0.16 + rr() * 0.1, verdes[Math.floor(rr() * verdes.length)]);
    M.fc(F.esq, "metal", d / 2 - 2.5, 0.5, 0.1, 2.6, 0.1, 0.24, "#2A2E32");
  }
  lajeTopo(M, retangulo(w, z0, z1), topo);
  if (!o.plana) {
    platibanda(M, s, retangulo(w, z0, z1), topo, 0.8);
    for (const x of [-w / 4, 0, w / 4]) { M.prisma("vidro", [[0, 0], [0.9, 0], [0, 1.6]], 2.2, x, topo, (z0 + z1) / 2 - 0.8); M.caixa("metal", 2.25, 0.08, 1.65, x, topo + 0.04, (z0 + z1) / 2 - 0.02, "#1C1F22"); }
    caixaDagua(M, w / 2 - 2, topo, z1 - 1.6);
  }
  // floreiras de madeira na calçada
  for (const sx of [-1, 1]) { M.caixa("madeira", 1.8, 0.5, 0.6, sx * (w / 2 - 1.4), 0.25, z0 - 0.6, "#FFFFFF"); plantas.arbusto.push({ pos: [sx * (w / 2 - 1.4), 0.5, z0 - 0.6], altura: 0.75 }); }
  return { M, plantas };
}

function cafeteria(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, terreo, andar, n } = m, d = z1 - z0, topo = terreo + (n - 1) * andar;
  const P = paredeDe(o.material, { parede: "reboco", cor: "#F2E6D3" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#5A3B26", peitoril: "#E9DDC9", int: "cafe", seed: o.seed, e: 0.24 };
  const F = faces(w, z0, z1), zv0 = -7.6, zv1 = z0;
  calcada(M, w, z0, z1);
  // frente: portas de vidro com caixilho de madeira abrindo para a varanda; ripado de madeira nas pontas
  vitrine(M, F.frente, s, { u0: -w / 2 + 1.4, u1: w / 2 - 1.4, y0: 0.12, y1: 2.9, portas: [[0, 1.8]], n: -0.12, passo: 1.4, corCaixilho: "#5A3B26", livres: livresFrente(m) });
  M.fc(F.frente, s.parede, 0, (2.9 + terreo) / 2, -0.12, w, terreo - 2.9, 0.24, s.corParede);
  for (const sg of [-1, 1]) M.fc(F.frente, "madeira", sg * (w / 2 - 0.7), 1.45, -0.12, 1.4, 2.9, 0.24, "#FFFFFF");
  for (const L of [F.esq, F.dir]) andarJanelas(M, L, s, { u0: -d / 2 + 0.24, u1: d / 2 - 0.24, y: 0, h: terreo, pe: 0.9, alt: 1.8, jan: distribuir(-d / 2 + 1, d / 2 - 1, 1.4, 2.8), montantes: 1, idx: 40 + L.th });
  andarJanelas(M, F.fundos, s, { u0: -w / 2, u1: w / 2, y: 0, h: terreo, pe: 1.4, alt: 1.0, jan: distribuir(-w / 2 + 1, w / 2 - 1, 1.2, 3.2), idx: 45 });
  for (let a = 1; a < n; a++) {
    const y = terreo + (a - 1) * andar;
    M.caixa("concreto", w + 0.2, 0.18, d + 0.2, 0, y - 0.05, (z0 + z1) / 2, "#E9DDC9");
    for (const [L, lw] of [[F.frente, w], [F.fundos, w], [F.esq, d], [F.dir, d]] as [Face, number][]) {
      const lado = L === F.esq || L === F.dir;
      andarJanelas(M, L, s, { u0: -lw / 2 + (lado ? 0.24 : 0), u1: lw / 2 - (lado ? 0.24 : 0), y, h: andar, pe: 0.9, alt: 1.5, jan: distribuir(-lw / 2 + 1, lw / 2 - 1, 1.3, 2.6), montantes: 1, idx: a * 10 + L.th });
    }
  }
  if (o.plana) lajeTopo(M, retangulo(w, z0, z1), topo);
  else {
    // telhado de barro de duas águas com beiral, empenas, cumeeira e testeira; coifa da cozinha
    const beiral = 0.7, alt = 2.6, ang = Math.atan2(alt, d / 2), lz = d / 2 + beiral, cz = (z0 + z1) / 2;
    for (const sg of [-1, 1]) M.caixa("telha", w + 2 * beiral, 0.12, lz / Math.cos(ang), 0, topo + alt - (lz / 2) * Math.tan(ang) + 0.08, cz + sg * (lz / 2), "#FFFFFF", 0, sg * ang);
    for (const L of [F.esq, F.dir]) M.prisma(s.parede, [[0, -d / 2], [0, d / 2], [alt, 0]], 0.24, L.cx + (L === F.esq ? -0.12 : 0.12), topo, cz, s.corParede);
    M.caixa("telha", w + 2 * beiral, 0.18, 0.32, 0, topo + alt + 0.1, cz, "#C7C7C7");
    const yb = topo - beiral * Math.tan(ang) + 0.02;
    for (const sg of [-1, 1]) M.caixa("madeira", w + 2 * beiral, 0.2, 0.06, 0, yb, cz + sg * lz, "#FFFFFF");
    if (M.detalhe) { M.caixa("metal", 0.5, 1.6, 0.5, w / 4, topo + alt * 0.6, cz + d / 4, "#9AA1A9"); M.caixa("metal", 0.8, 0.12, 0.8, w / 4, topo + alt * 0.6 + 0.85, cz + d / 4, "#7D848B"); }
  }
  // varanda: deck de madeira, pérgola (o letreiro fica na viga da frente), mesinhas, cadeiras e varal de luzes
  M.caixa("madeira", w, 0.12, zv1 - zv0, 0, 0.06, (zv0 + zv1) / 2, "#FFFFFF");
  const kp = Math.max(3, Math.round(w / 4.5));
  for (let i = 0; i <= kp; i++) M.caixa("madeira", 0.2, 2.9, 0.2, -w / 2 + 0.2 + (i * (w - 0.4)) / kp, 1.45 + 0.06, zv0 + 0.2, "#FFFFFF");
  M.caixa("madeira", w, 0.25, 0.2, 0, 2.95, zv0 + 0.2, "#FFFFFF");
  M.caixa("madeira", w, 0.2, 0.15, 0, 3.0, zv1 - 0.1, "#FFFFFF");
  const kv = Math.round(w / 1.1);
  for (let i = 0; i <= kv; i++) M.caixa("madeira", 0.08, 0.2, zv1 - zv0, -w / 2 + 0.1 + (i * (w - 0.2)) / kv, 3.17, (zv0 + zv1) / 2, "#FFFFFF");
  const mesas = Math.max(4, Math.round(w / 3.5));
  for (let i = 0; i < mesas; i++) {
    const x = -w / 2 + 1.6 + (i * (w - 3.2)) / (mesas - 1), mz = i % 2 ? -5.5 : -6.4;
    if (Math.abs(x) < 1.2 && mz > -6) continue; // passagem da porta
    M.cil("liso", 0.42, 0.42, 0.05, x, 0.86, mz, "#F4F0E8", 16); M.cil("metal", 0.04, 0.04, 0.72, x, 0.5, mz, "#2B2F35", 6);
    for (const sg of [-1, 1]) {
      M.caixa("madeira", 0.42, 0.05, 0.42, x + sg * 0.72, 0.54, mz, "#FFFFFF"); M.caixa("madeira", 0.05, 0.5, 0.42, x + sg * 0.92, 0.79, mz, "#FFFFFF");
      if (M.detalhe) for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) M.caixa("metal", 0.03, 0.42, 0.03, x + sg * 0.72 + lx, 0.33, mz + lz, "#2B2F35");
    }
  }
  if (M.detalhe) {
    const lamp = 16;
    for (const zl of [zv0 + 1.2, zv0 + 2.4]) for (let i = 0; i < lamp; i++) M.caixa("luz", 0.09, 0.12, 0.09, -w / 2 + 0.5 + (i * (w - 1)) / (lamp - 1), 2.98 - Math.sin((i / (lamp - 1)) * Math.PI) * 0.22, zl);
  }
  plantas.azaleia.push({ pos: [-w / 2 + 0.5, 0.12, zv0 + 0.6], altura: 0.9 }, { pos: [w / 2 - 0.5, 0.12, zv0 + 0.6], altura: 0.9 });
  plantas.arbusto.push({ pos: [-w / 2 + 0.6, 0.12, z0 - 0.5], altura: 1.0 }, { pos: [w / 2 - 0.6, 0.12, z0 - 0.5], altura: 1.0 });
  return { M, plantas };
}

function consultorio(o: Opcoes, m: MedidasKit): Feito {
  const { M, plantas } = novo();
  const { w, z0, z1, terreo, andar, n } = m, d = z1 - z0, pod = 0.45, topo = pod + terreo + (n - 1) * andar, verde = "#4FA88A";
  const P = paredeDe(o.material, { parede: "reboco", cor: "#F6F6F3" });
  const s: Estilo = { parede: P.parede, corParede: P.cor, caixilho: "#C9CFD5", peitoril: "#E3E6E8", int: "clinica", seed: o.seed, e: 0.24 };
  const F = faces(w, z0, z1), vh = o.duplo ? 4.0 : 2.4;
  // pódio (o prédio fica 45 cm acima da calçada), patamar, escada e rampa acessível (8 %) com corrimão
  M.caixa("concreto", w + 0.6, pod, d + 0.6, 0, pod / 2, (z0 + z1) / 2, "#E6E3DD");
  M.caixa("concreto", 3.4, pod, 1.4, 0, pod / 2, z0 - 0.7, "#E6E3DD");
  for (let k = 0; k < 3; k++) M.caixa("concreto", 2.2, pod - k * 0.15, 0.3, 0, (pod - k * 0.15) / 2, z0 - 1.55 - k * 0.3, "#DAD6CF");
  const rl = pod / 0.08, rx0 = -1.7 - rl;
  M.caixa("concreto", rl, 0.12, 1.3, rx0 + rl / 2, pod / 2, z0 - 0.75, "#D6D2CA", 0, 0, Math.atan2(pod, rl));
  M.caixa("liso", rl, 0.01, 0.3, rx0 + rl / 2, pod / 2 + 0.065, z0 - 0.75, verde, 0, 0, Math.atan2(pod, rl)); // faixa tátil
  for (const zg of [z0 - 1.4, z0 - 0.1]) guardaCorpo(M, rx0, zg, -1.7, zg, 0.06, pod, "#9AA3AB", false, 0.92);
  // térreo: recepção de vidro no meio, janelas largas dos lados, faixa verde
  vitrine(M, F.frente, s, { u0: -vh, u1: vh, y0: pod, y1: pod + 2.95, portas: [[0, 1.8]], n: -0.1, livres: livresFrente(m) });
  andarJanelas(M, F.frente, s, { u0: -w / 2, u1: -vh, y: pod, h: terreo, pe: 0.9, alt: 1.6, jan: distribuir(-w / 2 + 0.5, -vh - 0.5, 2.2, 2.6), montantes: 1, idx: 1 });
  andarJanelas(M, F.frente, s, { u0: vh, u1: w / 2, y: pod, h: terreo, pe: 0.9, alt: 1.6, jan: distribuir(vh + 0.5, w / 2 - 0.5, 2.2, 2.6), montantes: 1, idx: 2 });
  M.fc(F.frente, s.parede, 0, pod + (2.95 + terreo) / 2, -0.12, 2 * vh, terreo - 2.95, 0.24, s.corParede);
  for (const L of [F.esq, F.dir]) andarJanelas(M, L, s, { u0: -d / 2 + 0.24, u1: d / 2 - 0.24, y: pod, h: terreo, pe: 0.9, alt: 1.5, jan: distribuir(-d / 2 + 1, d / 2 - 1, 1.6, 3.0), montantes: 1, idx: 3 + L.th });
  andarJanelas(M, F.fundos, s, { u0: -w / 2, u1: w / 2, y: pod, h: terreo, pe: 0.9, alt: 1.5, jan: distribuir(-w / 2 + 1, w / 2 - 1, 1.6, 3.0), montantes: 1, idx: 6 });
  M.fc(F.frente, "liso", 0, pod + terreo - 0.1, 0.03, w + 0.04, 0.16, 0.06, verde);
  // marquise branca sobre a entrada (o letreiro fica em cima dela)
  const mw = m.letreiro.largura + 0.4;
  M.caixa("concreto", mw, 0.2, 1.8, 0, pod + 3.1, z0 - 0.9, "#FBFBF9"); M.caixa("liso", mw + 0.02, 0.42, 0.06, 0, pod + 3.0, z0 - 1.8, "#FBFBF9");
  if (M.detalhe) for (const x of [-2, 0, 2]) M.caixa("luz", 0.35, 0.02, 0.35, x, pod + 2.99, z0 - 0.9);
  // andares de consultórios com brises horizontais na frente
  for (let a = 1; a < n; a++) {
    const y = pod + terreo + (a - 1) * andar;
    M.caixa("concreto", w + 0.24, 0.18, d + 0.24, 0, y - 0.02, (z0 + z1) / 2, "#ECEAE6");
    for (const [L, lw] of [[F.frente, w], [F.fundos, w], [F.esq, d], [F.dir, d]] as [Face, number][]) {
      const lado = L === F.esq || L === F.dir;
      andarJanelas(M, L, s, { u0: -lw / 2 + (lado ? 0.24 : 0), u1: lw / 2 - (lado ? 0.24 : 0), y, h: andar, pe: 0.9, alt: 1.6, jan: distribuir(-lw / 2 + 0.6, lw / 2 - 0.6, lado ? 1.6 : 2.4, lado ? 3.0 : 2.8), montantes: 1, idx: a * 10 + L.th });
    }
    if (M.detalhe) for (let k = 0; k < 4; k++) M.fc(F.frente, "metal", 0, y + 0.95 + k * 0.42, 0.32, w - 0.4, 0.05, 0.42, "#DDE2E6");
    arCondicionado(M, F.esq, -1 + (a % 2) * 2, y + 0.5);
  }
  M.caixa("concreto", w + 0.24, 0.18, d + 0.24, 0, pod + terreo - 0.02, (z0 + z1) / 2, "#ECEAE6");
  lajeTopo(M, retangulo(w, z0, z1), topo);
  if (!o.plana) { platibanda(M, s, retangulo(w, z0, z1), topo, 0.8); caixaDagua(M, -w / 4, topo, (z0 + z1) / 2 + 1); }
  // jardim na frente: canteiros com arbustos e azaleias
  for (const [x0, x1] of [[2.6, w / 2 - 0.4], [-w / 2 + 0.4, rx0 - 0.4]] as [number, number][]) {
    if (x1 - x0 < 0.8) continue;
    M.caixa("concreto", x1 - x0, 0.35, 1.3, (x0 + x1) / 2, 0.17, z0 - 1.2, "#DCD8D0"); M.caixa("fosco", x1 - x0 - 0.2, 0.02, 1.1, (x0 + x1) / 2, 0.355, z0 - 1.2, "#5E4A36");
    let i = 0; for (let x = x0 + 0.5; x < x1 - 0.3; x += 1.1, i++) (i % 2 ? plantas.azaleia : plantas.arbusto).push({ pos: [x, 0.35, z0 - 1.2], altura: 0.8 });
  }
  return { M, plantas };
}

const CONSTRUTORES: Record<KitId, (o: Opcoes, m: MedidasKit) => Feito> = { comercial, torre, esquina, logistico, industrial, coworking, cafeteria, consultorio };
const semente = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);

// ?medir=1: quantos prédios do kit foram montados e quanto tempo isso levou (window.__kit)
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");
const MEDIDA = { montados: 0, ms: 0, maiorMs: 0 };
if (MEDIR) (window as unknown as { __kit?: typeof MEDIDA }).__kit = MEDIDA;

// Monta uma vez por combinação e guarda: o mesmo prédio (mesma empresa, mesmos ajustes) reaproveita as malhas
const CACHE = new Map<string, { partes: Parte[]; plantas: Plantas }>();
// ---------- guardado no aparelho (v67) ----------
// cada prédio montado vira números (posição, normal, uv, cor, índices por material) no IndexedDB; na próxima visita, o
// mesmo prédio (mesmas opções) é só remontado com esses números, sem refazer paredes, janelas e telhados
const VERSAO_KIT = "v67-1", MAX_GUARDADOS = 60;
interface ParteCrua { papel: Papel; attrs: { nome: string; a: ArrayLike<number>; n: number; norm: boolean }[]; idx: ArrayLike<number> | null }
interface PredioCru { partes: ParteCrua[]; plantas: Plantas }
const GUARDADOS = new Map<string, PredioCru>();
if (typeof window !== "undefined") void lerVarios<PredioCru>("kit|").then((m) => { for (const [k, v] of m) if (k.endsWith("@" + VERSAO_KIT)) GUARDADOS.set(k, v); });
function paraCru(p: Parte): ParteCrua {
  const attrs = Object.entries(p.geo.attributes).map(([nome, at]) => { const b = at as THREE.BufferAttribute; return { nome, a: b.array, n: b.itemSize, norm: b.normalized }; });
  return { papel: p.papel, attrs, idx: p.geo.index ? p.geo.index.array : null };
}
function deCru(c: ParteCrua): Parte {
  const geo = new THREE.BufferGeometry();
  for (const at of c.attrs) geo.setAttribute(at.nome, new THREE.BufferAttribute(at.a as THREE.TypedArray, at.n, at.norm));
  if (c.idx) geo.setIndex(new THREE.BufferAttribute(c.idx as THREE.TypedArray, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return { geo, mat: material(c.papel), sombra: fazSombra(c.papel), papel: c.papel };
}
function predio(o: Opcoes) {
  const k = `${o.id}|${o.n}|${o.duplo}|${o.material}|${o.corMarca}|${o.seed}|${o.plana}|${leve()}`;
  let c = CACHE.get(k); if (c) return c;
  const t0 = MEDIR ? performance.now() : 0;
  const chaveGuardada = `kit|${k}@${VERSAO_KIT}`, cru = GUARDADOS.get(chaveGuardada);
  if (cru) { c = { partes: cru.partes.map(deCru), plantas: cru.plantas }; contar("prédio do kit: do aparelho"); CACHE.set(k, c); return c; }
  const f = CONSTRUTORES[o.id](o, medidasKit(o.id, o.n, o.duplo, o.plana));
  c = { partes: f.M.montar(), plantas: f.plantas };
  if (GUARDADOS.size < MAX_GUARDADOS) { const novo = { partes: c.partes.map(paraCru), plantas: c.plantas }; GUARDADOS.set(chaveGuardada, novo); guardar(chaveGuardada, novo); }
  if (MEDIR) { const ms = performance.now() - t0; MEDIDA.montados++; MEDIDA.ms += ms; MEDIDA.maiorMs = Math.max(MEDIDA.maiorMs, ms); }
  // guarda no máximo 40 combinações; a mais antiga libera a memória de vídeo (se ainda estiver na tela, o three.js
  // simplesmente envia de novo no próximo quadro)
  if (CACHE.size >= 40) { const velho = CACHE.keys().next().value as string; CACHE.get(velho)?.partes.forEach((x) => x.geo.dispose()); CACHE.delete(velho); }
  CACHE.set(k, c); return c;
}

// semente = a chave do lote: as janelas acesas à noite são sempre as mesmas naquele prédio (e digitar o nome da empresa
// no painel não refaz a malha)
export function PredioKit({ id, andares, duplo, material, corFachada, corMarca, semente: chave, plana }: { id: KitId; andares: number; duplo: boolean; material: MaterialFachada; corFachada: string; corMarca: string; semente: string; plana: boolean }) {
  const p = useMemo(() => predio({ id, n: andares, duplo, material, corMarca, seed: semente(chave), plana }), [id, andares, duplo, material, corMarca, chave, plana]);
  const pintura = useMemo(() => materialPintura(corFachada), [corFachada]);
  const sombra = !leve();
  return (
    <group>
      {p.partes.map((x) => <mesh key={x.papel} geometry={x.geo} material={x.papel === "pintura" ? pintura : x.mat} castShadow={sombra && x.sombra} receiveShadow={x.papel !== "vidro"} renderOrder={x.papel === "vidro" ? 2 : 0} />)}
      {p.plantas.arbusto.length > 0 && <ArvoresInstanciadas especie="arbusto" itens={p.plantas.arbusto} sombra={false} />}
      {p.plantas.azaleia.length > 0 && <ArvoresInstanciadas especie="azaleia" itens={p.plantas.azaleia} sombra={false} />}
      {p.plantas.topiaria.length > 0 && <ArvoresInstanciadas especie="topiaria" itens={p.plantas.topiaria} sombra={false} />}
    </group>
  );
}
