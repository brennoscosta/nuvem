"use client";
// Outdoors nas avenidas e placa de esquina (12/11/2026). A arte é desenhada num canvas com a marca da empresa: fundo na
// cor, logo, nome, frase e o endereço da loja. Clicar no outdoor abre o cartão (alugar ou ver a loja). À noite acendem.
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat } from "./geo";
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

function PainelOutdoor({ o, preco }: { o: OutdoorPublico | undefined; preco: number }) {
  const dados: DadosMarca | null = o?.status === "ativo" && o.empresa ? { nome: o.empresa.nome, cor: o.empresa.cor, nicho: o.empresa.nicho, frase: o.frase, numero: o.empresa.numero, logo: o.empresa.logo } : null;
  const livre = { titulo: o?.status === "reservado" ? "Reservado" : "Anuncie aqui", sub: o?.status === "reservado" ? "Uma empresa está pagando este outdoor agora." : `A sua marca vista pela cidade inteira por R$ ${preco.toFixed(2).replace(".", ",")} a cada 30 dias.`, chamada: o?.status === "reservado" ? "" : "Clique neste outdoor" };
  const tex = useTexturaMarca(dados, 1024, 512, false, livre);
  const m = useMemo(() => materialAceso(tex), [tex]);
  useEffect(() => registrarAceso(m), [m]);
  return <mesh material={m} position={[0, 7, 0.17]}><planeGeometry args={[8, 4]} /></mesh>;
}

export function Outdoors() {
  const outdoors = useMundo((s) => s.outdoors), preco = useMundo((s) => s.precoOutdoor), abrir = useMundo((s) => s.abrirOutdoor);
  const metal = mat("#3A3F47", { metal: 0.45, rough: 0.5 }), fundo = mat("#2B2F36", { rough: 0.8 });
  useFrame(() => acender());
  return (
    <group>
      <Estatico>
        {OUTDOORS.map((v) => (
          <group key={v.id} position={[v.pos[0], 0, v.pos[1]]} rotation={[0, v.rot, 0]}>
            {[-2.6, 2.6].map((x) => <mesh key={x} geometry={caixa(0.35, 5, 0.35)} material={metal} position={[x, 2.5, -0.2]} castShadow />)}
            <mesh geometry={caixa(8.5, 4.5, 0.25)} material={fundo} position={[0, 7, 0]} castShadow />
            <mesh geometry={caixa(8.6, 0.12, 0.9)} material={metal} position={[0, 4.75, 0.3]} />
            {[-2.8, 0, 2.8].map((x) => <mesh key={x} geometry={cilindro(0.03, 0.03, 0.9, 5)} material={metal} position={[x, 9.6, 0.4]} rotation={[0.9, 0, 0]} />)}
          </group>
        ))}
      </Estatico>
      {OUTDOORS.map((v) => (
        <group key={v.id} position={[v.pos[0], 0, v.pos[1]]} rotation={[0, v.rot, 0]}
          onClick={(e) => { e.stopPropagation(); abrir(v.id); }} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
          <PainelOutdoor o={outdoors.find((x) => x.slot === v.id)} preco={preco} />
          {/* refletores em cima, acesos à noite */}
          {[-2.8, 0, 2.8].map((x) => <mesh key={x} geometry={caixa(0.5, 0.18, 0.28)} material={mat("#F5F3EA", { emissive: "#FFF1C9", ei: 1.4 })} position={[x, 9.95, 0.75]} />)}
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
