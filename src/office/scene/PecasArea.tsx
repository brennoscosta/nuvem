"use client";
// Peças por área (12/11/2026, lote visual): cada loja ganha uma peça marcante na frente, pela área da empresa, para ser
// reconhecida de longe. Barbearia com o poste listrado girando, café com mesinhas e guarda-sol, clínica com a cruz verde
// acesa, academia com halteres e saco de pancada, e uma peça para cada outra área. O dono troca ou desliga no Montar
// escritório. Coordenadas locais do prédio: frente para -z; zf = onde fica a fachada; sx = largura do lote duplo.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, toro, capsula } from "./geo";
import type { PecaArea as TipoPeca } from "../data/escritorio";

type Peca = Exclude<TipoPeca, "auto" | "nenhuma">;
const ferro = () => mat("#2B2F36", { metal: 0.5, rough: 0.45 });
const cromo = () => mat("#D9DEE5", { metal: 0.85, rough: 0.2 });
const madeira = () => mat("#8A5A33", { rough: 0.9 });
// cones guardados (orelhas do cofrinho, telhado da casinha, guarda-sol)
const cones = new Map<string, THREE.ConeGeometry>();
const cone = (r: number, h: number, seg: number) => { const k = `${r},${h},${seg}`; let g = cones.get(k); if (!g) { g = new THREE.ConeGeometry(r, h, seg); cones.set(k, g); } return g; };
const FMT_HORA = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// texturas desenhadas uma vez
const texs = new Map<string, THREE.CanvasTexture>();
function tex(chave: string, w: number, h: number, desenhar: (g: CanvasRenderingContext2D) => void, repetir?: [number, number]) {
  let t = texs.get(chave); if (t || typeof document === "undefined") return t ?? null;
  const c = document.createElement("canvas"); c.width = w; c.height = h; desenhar(c.getContext("2d")!);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repetir); }
  texs.set(chave, t); return t;
}
const listras = () => tex("barbeiro", 64, 128, (g) => {
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 64, 128);
  const cores = ["#D7263D", "#FFFFFF", "#1B4FA8", "#FFFFFF"];
  for (let i = -4; i < 12; i++) { g.fillStyle = cores[((i % 4) + 4) % 4]; g.beginPath(); g.moveTo(0, i * 16); g.lineTo(64, i * 16 - 32); g.lineTo(64, i * 16 - 16); g.lineTo(0, i * 16 + 16); g.fill(); }
}, [1, 2]);
const quadroNegro = (linhas: string[], chave: string) => tex(chave, 256, 320, (g) => {
  g.fillStyle = "#6B4A2B"; g.fillRect(0, 0, 256, 320); g.fillStyle = "#23312A"; g.fillRect(14, 14, 228, 292);
  g.fillStyle = "#F4F1E8"; g.textAlign = "center"; g.textBaseline = "middle";
  linhas.forEach((l, i) => { g.font = i === 0 ? "bold 46px Georgia, serif" : "28px Georgia, serif"; g.fillText(l, 128, 70 + i * 62, 210); });
  g.strokeStyle = "#F4F1E8"; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 112); g.lineTo(196, 112); g.stroke();
});
const textoNeon = () => tex("neon-codigo", 128, 256, (g) => {
  g.fillStyle = "#06090F"; g.fillRect(0, 0, 128, 256);
  g.shadowColor = "#22D3EE"; g.shadowBlur = 14; g.fillStyle = "#A5F3FC"; g.font = "bold 54px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("</>", 64, 70); g.font = "bold 22px monospace"; g.fillText("TECH", 64, 140); g.fillText("{ }", 64, 190);
});
const placaImovel = (cor: string) => tex(`imovel${cor}`, 256, 160, (g) => {
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 256, 160); g.fillStyle = cor; g.fillRect(0, 0, 256, 50);
  g.fillStyle = "#FFFFFF"; g.font = "bold 30px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("IMÓVEIS", 128, 27);
  g.fillStyle = "#1D2128"; g.font = "bold 34px Arial"; g.fillText("VENDE · ALUGA", 128, 102, 236);
  g.fillStyle = cor; g.beginPath(); g.moveTo(26, 140); g.lineTo(46, 122); g.lineTo(66, 140); g.fill(); g.fillRect(31, 140, 30, 14);
});
const mostrador = () => tex("relogio", 256, 256, (g) => {
  g.fillStyle = "#FFFDF5"; g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#1D2128"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#1D2128"; g.font = "bold 30px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  for (let h = 1; h <= 12; h++) { const a = (h / 12) * Math.PI * 2; g.fillText(String(h), 128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); }
});
const globoTex = () => tex("globo", 256, 128, (g) => {
  g.fillStyle = "#2F7FD1"; g.fillRect(0, 0, 256, 128); g.fillStyle = "#4CAF50";
  for (const [x, y, rx, ry] of [[40, 40, 26, 18], [70, 80, 18, 26], [130, 36, 30, 16], [150, 70, 22, 30], [200, 50, 30, 20], [215, 95, 16, 12]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); g.fill(); }
});

export function PecaArea({ tipo, cor, zf, zw, sx }: { tipo: Peca; cor: string; zf: number; zw?: number; sx: number }) {
  const parede = zw ?? zf; // plano da fachada (o vidro), para o que fica preso na parede
  // a peça fica à esquerda da porta, entre a fachada e a calçada; as de parede ficam presas na fachada
  const x = -3.1 * sx, z = zf - 1.35;
  switch (tipo) {
    case "barbearia": return <PosteBarbeiro x={2.5 * sx} z={parede - 0.3} />;
    case "cafe": return <Cafe cor={cor} sx={sx} zf={zf} />;
    case "clinica": return <CruzVerde x={4.2 * sx} z={parede - 0.75} />;
    case "academia": return <Academia x={x} z={z} />;
    case "tecnologia": return <TotemTech x={x} z={z} />;
    case "estudio": return <Estudio x={x} z={z} />;
    case "megafone": return <Megafone x={x} z={z} cor={cor} />;
    case "lousa": return <Lousa x={x} z={z} />;
    case "balanca": return <Balanca x={x} z={z} />;
    case "cofrinho": return <Cofrinho x={x} z={z} />;
    case "relogio": return <RelogioRua x={x} z={z} />;
    case "ferramentas": return <Ferramentas x={x} z={z} />;
    case "arara": return <Arara x={x} z={z} cor={cor} />;
    case "imobiliaria": return <Imobiliaria x={x} z={z} cor={cor} />;
    case "baloes": return <Baloes cor={cor} zf={zf} sx={sx} />;
    case "malas": return <Malas x={x} z={z} />;
    case "pneus": return <Pneus x={x} z={z} />;
  }
}

function PosteBarbeiro({ x, z }: { x: number; z: number }) {
  const t = useMemo(() => listras(), []);
  const listra = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => { const m = listra.current?.map; if (m) m.offset.y = (m.offset.y + dt * 0.35) % 1; });
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.08, 0.08, 0.32)} material={ferro()} position={[0, 2.95, 0.16]} />
      <mesh geometry={caixa(0.08, 0.08, 0.32)} material={ferro()} position={[0, 1.15, 0.16]} />
      <mesh geometry={cilindro(0.17, 0.17, 1.6, 20)} position={[0, 2.05, 0]}>{t ? <meshBasicMaterial ref={listra} map={t} toneMapped={false} /> : <meshBasicMaterial color="#D7263D" />}</mesh>
      <mesh geometry={cilindro(0.19, 0.19, 1.62, 20)} position={[0, 2.05, 0]}><meshStandardMaterial color="#FFFFFF" transparent opacity={0.18} roughness={0.05} /></mesh>
      <mesh geometry={esfera(0.2, 14)} material={cromo()} position={[0, 2.95, 0]} />
      <mesh geometry={cilindro(0.2, 0.15, 0.16, 14)} material={cromo()} position={[0, 1.18, 0]} />
    </group>
  );
}
function Cafe({ cor, sx, zf }: { cor: string; sx: number; zf: number }) {
  const lousa = useMemo(() => quadroNegro(["CAFÉ", "Espresso", "Pão de queijo", "Bolo do dia"], "lousa-cafe"), []);
  const guarda = cone(1.0, 0.4, 12);
  return (
    <group>
      {[-3.3 * sx, 3.3 * sx].map((x) => (
        <group key={x} position={[x, 0, zf - 1.55]}>
          <mesh geometry={cilindro(0.38, 0.38, 0.04, 18)} material={mat("#2B2F36", { rough: 0.4, metal: 0.3 })} position={[0, 0.74, 0]} castShadow />
          <mesh geometry={cilindro(0.03, 0.03, 0.74, 6)} material={ferro()} position={[0, 0.37, 0]} />
          <mesh geometry={cilindro(0.22, 0.22, 0.03, 12)} material={ferro()} position={[0, 0.02, 0]} />
          <mesh geometry={cilindro(0.025, 0.025, 2.2, 6)} material={ferro()} position={[0, 1.1, 0]} />
          <mesh geometry={guarda} material={mat(cor, { rough: 0.7 })} position={[0, 2.25, 0]} castShadow />
          {[-0.62, 0.62].map((cx) => (
            <group key={cx} position={[cx, 0, 0]} rotation={[0, cx > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
              <mesh geometry={cilindro(0.2, 0.2, 0.04, 12)} material={madeira()} position={[0, 0.46, 0]} />
              <mesh geometry={caixa(0.36, 0.42, 0.04)} material={ferro()} position={[0, 0.7, 0.18]} />
              {[-0.14, 0.14].map((p) => <mesh key={p} geometry={cilindro(0.015, 0.015, 0.46, 5)} material={ferro()} position={[p, 0.23, 0]} />)}
            </group>
          ))}
          {/* xícaras */}
          <mesh geometry={cilindro(0.05, 0.04, 0.08, 10)} material={mat("#FFFFFF")} position={[0.12, 0.8, 0.05]} />
        </group>
      ))}
      {/* cavalete com o cardápio ao lado da porta */}
      <group position={[-1.6 * sx, 0, zf - 0.85]} rotation={[0, 0.25, 0]}>
        {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.62, 0.86, 0.03)} position={[0, 0.48, s * 0.12]} rotation={[s * 0.16, 0, 0]}>{lousa ? <meshStandardMaterial map={lousa} roughness={0.9} /> : <meshStandardMaterial color="#23312A" />}</mesh>)}
      </group>
    </group>
  );
}
function CruzVerde({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.color.setRGB(0.1, 0.75 + 0.2 * Math.sin(clock.elapsedTime * 2.2), 0.3); });
  return (
    <group position={[x, 3.6, z]}>
      <mesh geometry={caixa(0.08, 0.08, 0.7)} material={ferro()} position={[0, 0, 0.35]} />
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={caixa(1.06, 0.4, 0.12)} material={mat("#FFFFFF")} />
        <mesh geometry={caixa(0.4, 1.06, 0.12)} material={mat("#FFFFFF")} />
        <mesh geometry={caixa(0.92, 0.28, 0.14)}><meshBasicMaterial ref={ref} color="#22C55E" toneMapped={false} /></mesh>
        <mesh geometry={caixa(0.28, 0.92, 0.14)}><meshBasicMaterial color="#22C55E" toneMapped={false} /></mesh>
      </group>
    </group>
  );
}
function Academia({ x, z }: { x: number; z: number }) {
  const halter = (px: number, py: number, r: number) => (
    <group key={`${px}${py}`} position={[px, py, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={cilindro(0.025, 0.025, 0.42, 8)} material={cromo()} />
      {[-0.17, 0.17].map((d) => <mesh key={d} geometry={cilindro(r, r, 0.07, 12)} material={mat("#1D2128", { rough: 0.6 })} position={[0, d, 0]} />)}
    </group>
  );
  return (
    <group position={[x, 0, z]}>
      {/* suporte de halteres */}
      <mesh geometry={caixa(1.3, 0.06, 0.4)} material={ferro()} position={[0, 0.5, 0]} />
      <mesh geometry={caixa(1.3, 0.06, 0.4)} material={ferro()} position={[0, 0.85, -0.05]} />
      {[-0.6, 0.6].map((p) => <mesh key={p} geometry={caixa(0.06, 0.9, 0.06)} material={ferro()} position={[p, 0.45, 0]} />)}
      {[-0.4, 0, 0.4].map((p, i) => halter(p, 0.6, 0.08 + i * 0.015))}
      {[-0.4, 0, 0.4].map((p, i) => halter(p, 0.95, 0.07 + i * 0.012))}
      {/* saco de pancada no cavalete */}
      <group position={[-1.6, 0, 0.1]}>
        {[-0.55, 0.55].map((p) => <mesh key={p} geometry={cilindro(0.04, 0.05, 2.5, 6)} material={ferro()} position={[p, 1.2, 0]} rotation={[0, 0, p > 0 ? -0.12 : 0.12]} />)}
        <mesh geometry={caixa(1.2, 0.07, 0.07)} material={ferro()} position={[0, 2.38, 0]} />
        <mesh geometry={cilindro(0.012, 0.012, 0.35, 4)} material={cromo()} position={[0, 2.18, 0]} />
        <mesh geometry={capsula(0.24, 0.8)} material={mat("#B91C1C", { rough: 0.55 })} position={[0, 1.45, 0]} castShadow />
      </group>
      {/* kettlebell */}
      <group position={[0.85, 0, 0.35]}>
        <mesh geometry={esfera(0.16, 12)} material={mat("#1D2128", { rough: 0.5 })} position={[0, 0.16, 0]} />
        <mesh geometry={toro(0.1, 0.025, 12, Math.PI)} material={mat("#1D2128", { rough: 0.5 })} position={[0, 0.3, 0]} />
      </group>
    </group>
  );
}
function TotemTech({ x, z }: { x: number; z: number }) {
  const t = useMemo(() => textoNeon(), []);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.62, 2.5, 0.22)} material={mat("#0B0F17", { rough: 0.4, metal: 0.3 })} position={[0, 1.25, 0]} castShadow />
      {[-0.115, 0.115].map((d) => <mesh key={d} geometry={plano(0.52, 2.2)} position={[0, 1.3, d]} rotation={[0, d < 0 ? Math.PI : 0, 0]}>{t ? <meshBasicMaterial map={t} toneMapped={false} /> : <meshBasicMaterial color="#22D3EE" />}</mesh>)}
      <mesh geometry={caixa(0.66, 0.05, 0.26)} material={mat("#22D3EE", { emissive: "#22D3EE", ei: 2 })} position={[0, 2.52, 0]} />
    </group>
  );
}
function Estudio({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* câmera no tripé */}
      {[0, 2.1, 4.2].map((a) => <mesh key={a} geometry={cilindro(0.02, 0.02, 1.5, 5)} material={ferro()} position={[Math.sin(a) * 0.22, 0.7, Math.cos(a) * 0.22]} rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]} />)}
      <mesh geometry={caixa(0.36, 0.26, 0.5)} material={mat("#1D2128", { rough: 0.5 })} position={[0, 1.55, 0]} rotation={[0, 0.6, 0]} castShadow />
      <mesh geometry={cilindro(0.09, 0.11, 0.28, 12)} material={mat("#111")} position={[Math.sin(0.6) * -0.36, 1.57, Math.cos(0.6) * -0.36]} rotation={[Math.PI / 2, 0, -0.6]} />
      <mesh geometry={esfera(0.04, 8)} material={mat("#EF4444", { emissive: "#EF4444", ei: 2 })} position={[0.1, 1.72, 0.1]} />
      {/* softbox */}
      <group position={[1.2, 0, 0.2]}>
        <mesh geometry={cilindro(0.025, 0.025, 1.9, 6)} material={ferro()} position={[0, 0.95, 0]} />
        <mesh geometry={caixa(0.8, 0.6, 0.35)} material={mat("#1D2128")} position={[0, 2.05, 0]} rotation={[0, -0.7, 0]} />
        <mesh geometry={plano(0.74, 0.54)} position={[Math.sin(-0.7) * -0.18, 2.05, Math.cos(-0.7) * -0.18]} rotation={[0, -0.7 + Math.PI, 0]}><meshBasicMaterial color="#FFF7E6" toneMapped={false} /></mesh>
      </group>
    </group>
  );
}
function Megafone({ x, z, cor }: { x: number; z: number; cor: string }) {
  const corneta = useMemo(() => new THREE.CylinderGeometry(0.55, 0.12, 1.2, 20, 1, true), []);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={cilindro(0.35, 0.42, 0.7, 16)} material={mat("#E5E7EB", { rough: 0.6 })} position={[0, 0.35, 0]} />
      <group position={[0, 1.3, 0]} rotation={[-0.5, 0.4, 0]}>
        <mesh geometry={corneta} position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]} castShadow><meshStandardMaterial color={cor} roughness={0.5} side={THREE.DoubleSide} /></mesh>
        <mesh geometry={cilindro(0.14, 0.14, 0.5, 12)} material={mat("#1D2128")} position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={caixa(0.1, 0.36, 0.12)} material={mat("#1D2128")} position={[0, -0.25, 0.4]} />
      </group>
    </group>
  );
}
function Lousa({ x, z }: { x: number; z: number }) {
  const t = useMemo(() => quadroNegro(["AULAS", "hoje", "matrículas", "abertas"], "lousa-aula"), []);
  return (
    <group position={[x, 0, z]} rotation={[0, 0.3, 0]}>
      {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.8, 1.1, 0.04)} position={[0, 0.6, s * 0.16]} rotation={[s * 0.17, 0, 0]}>{t ? <meshStandardMaterial map={t} roughness={0.9} /> : <meshStandardMaterial color="#23312A" />}</mesh>)}
      {/* pilha de livros */}
      {[["#1D4ED8", 0.09], ["#DC2626", 0.21], ["#16A34A", 0.33]].map(([c, y], i) => <mesh key={i} geometry={caixa(0.42, 0.11, 0.3)} material={mat(c as string, { rough: 0.8 })} position={[0.85, y as number, 0]} rotation={[0, i * 0.25, 0]} />)}
      <mesh geometry={esfera(0.12, 10)} material={mat("#E11D48", { rough: 0.5 })} position={[0.85, 0.5, 0]} />
    </group>
  );
}
function Balanca({ x, z }: { x: number; z: number }) {
  const ouro = mat("#D4A017", { metal: 0.85, rough: 0.3 });
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.7, 0.7, 0.7)} material={mat("#E7E2D8", { rough: 0.9 })} position={[0, 0.35, 0]} castShadow />
      <mesh geometry={cilindro(0.05, 0.07, 1.4, 10)} material={ouro} position={[0, 1.4, 0]} />
      <mesh geometry={caixa(1.3, 0.06, 0.06)} material={ouro} position={[0, 2.08, 0]} />
      <mesh geometry={esfera(0.09, 10)} material={ouro} position={[0, 2.16, 0]} />
      {[-0.6, 0.6].map((p) => (
        <group key={p} position={[p, 2.05, 0]}>
          {[-0.12, 0.12].map((q) => <mesh key={q} geometry={cilindro(0.008, 0.008, 0.5, 4)} material={ouro} position={[q, -0.25, 0]} rotation={[0, 0, q > 0 ? 0.24 : -0.24]} />)}
          <mesh geometry={cilindro(0.22, 0.16, 0.05, 16)} material={ouro} position={[0, -0.5, 0]} />
        </group>
      ))}
    </group>
  );
}
function Cofrinho({ x, z }: { x: number; z: number }) {
  const rosa = mat("#F9A8D4", { rough: 0.45 });
  return (
    <group position={[x, 0, z]} rotation={[0, 0.5, 0]}>
      <mesh geometry={esfera(0.6, 20)} material={rosa} position={[0, 0.85, 0]} scale={[1.25, 1, 1]} castShadow />
      <mesh geometry={cilindro(0.2, 0.22, 0.18, 16)} material={rosa} position={[-0.78, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} />
      {[[-0.6, -0.08], [-0.6, 0.08]].map(([sx, sz], i) => <mesh key={i} geometry={esfera(0.035, 6)} material={mat("#831843")} position={[sx - 0.27, 0.86, sz]} />)}
      {[-0.22, 0.22].map((s) => <mesh key={s} geometry={cone(0.13, 0.22, 8)} material={rosa} position={[-0.35, 1.38, s]} rotation={[0, 0, 0.3]} />)}
      {[[-0.4, -0.3], [-0.4, 0.3], [0.4, -0.3], [0.4, 0.3]].map(([a, b], i) => <mesh key={i} geometry={cilindro(0.11, 0.11, 0.34, 10)} material={rosa} position={[a, 0.17, b]} />)}
      <mesh geometry={caixa(0.3, 0.03, 0.06)} material={mat("#831843")} position={[0.1, 1.45, 0]} />
      <mesh geometry={cilindro(0.16, 0.16, 0.04, 18)} material={mat("#F5C542", { metal: 0.8, rough: 0.3 })} position={[0.1, 1.6, 0]} rotation={[Math.PI / 2, 0, 0.2]} />
    </group>
  );
}
function RelogioRua({ x, z }: { x: number; z: number }) {
  const t = useMemo(() => mostrador(), []);
  const hora = useRef<THREE.Group>(null), minuto = useRef<THREE.Group>(null);
  // horário de Brasília de verdade
  useFrame(() => {
    if (!hora.current || !minuto.current) return;
    const p = FMT_HORA.formatToParts(new Date());
    const h = Number(p[0].value) % 12, m = Number(p[2].value);
    minuto.current.rotation.z = -(m / 60) * Math.PI * 2; hora.current.rotation.z = -((h + m / 60) / 12) * Math.PI * 2;
  });
  const verde = mat("#1F4D3A", { metal: 0.4, rough: 0.5 });
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={cilindro(0.08, 0.12, 3.0, 10)} material={verde} position={[0, 1.5, 0]} castShadow />
      <mesh geometry={cilindro(0.2, 0.25, 0.3, 10)} material={verde} position={[0, 0.15, 0]} />
      <mesh geometry={cilindro(0.48, 0.48, 0.2, 24)} material={verde} position={[0, 3.35, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 3.35, s * 0.105]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
          <mesh geometry={plano(0.84, 0.84)}>{t ? <meshBasicMaterial map={t} transparent toneMapped={false} /> : <meshBasicMaterial color="#FFFDF5" />}</mesh>
          <group ref={s > 0 ? hora : undefined} position={[0, 0, 0.01]}><mesh geometry={caixa(0.035, 0.22, 0.01)} material={mat("#1D2128")} position={[0, 0.1, 0]} /></group>
          <group ref={s > 0 ? minuto : undefined} position={[0, 0, 0.012]}><mesh geometry={caixa(0.025, 0.32, 0.01)} material={mat("#1D2128")} position={[0, 0.15, 0]} /></group>
        </group>
      ))}
      <mesh geometry={esfera(0.12, 10)} material={mat("#D4A017", { metal: 0.8, rough: 0.3 })} position={[0, 3.9, 0]} />
    </group>
  );
}
function Ferramentas({ x, z }: { x: number; z: number }) {
  const alu = mat("#C7CDD4", { metal: 0.7, rough: 0.35 });
  return (
    <group position={[x, 0, z]}>
      {/* escada em A */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 0.32]} rotation={[s * 0.22, 0, 0]}>
          {[-0.25, 0.25].map((p) => <mesh key={p} geometry={caixa(0.05, 2.0, 0.05)} material={alu} position={[p, 1.0, 0]} />)}
          {[0.35, 0.8, 1.25, 1.7].map((y) => <mesh key={y} geometry={caixa(0.5, 0.04, 0.06)} material={alu} position={[0, y, 0]} />)}
        </group>
      ))}
      {/* caixa de ferramentas e cone */}
      <mesh geometry={caixa(0.6, 0.3, 0.3)} material={mat("#DC2626", { rough: 0.45 })} position={[0.9, 0.15, 0.1]} castShadow />
      <mesh geometry={caixa(0.36, 0.05, 0.05)} material={ferro()} position={[0.9, 0.36, 0.1]} />
      <Cone x={-0.9} z={0.3} />
    </group>
  );
}
export function Cone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.42, 0.04, 0.42)} material={mat("#1D2128")} position={[0, 0.02, 0]} />
      <mesh geometry={cilindro(0.04, 0.17, 0.62, 12)} material={mat("#F97316", { rough: 0.5 })} position={[0, 0.34, 0]} castShadow />
      <mesh geometry={cilindro(0.095, 0.115, 0.1, 12)} material={mat("#FFFFFF", { rough: 0.5 })} position={[0, 0.4, 0]} />
    </group>
  );
}
function Arara({ x, z, cor }: { x: number; z: number; cor: string }) {
  const roupas = [cor, "#F4F1EA", "#1D2128", "#E11D48", "#0EA5A4"];
  return (
    <group position={[x, 0, z]}>
      {[-0.75, 0.75].map((p) => (
        <group key={p} position={[p, 0, 0]}>
          <mesh geometry={cilindro(0.025, 0.025, 1.6, 6)} material={cromo()} position={[0, 0.8, 0]} />
          <mesh geometry={caixa(0.06, 0.03, 0.5)} material={cromo()} position={[0, 0.02, 0]} />
        </group>
      ))}
      <mesh geometry={cilindro(0.02, 0.02, 1.5, 6)} material={cromo()} position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} />
      {roupas.map((c, i) => (
        <group key={i} position={[-0.6 + i * 0.3, 1.18, 0]}>
          <mesh geometry={caixa(0.06, 0.8, 0.5)} material={mat(c, { rough: 0.85 })} />
          <mesh geometry={caixa(0.06, 0.14, 0.72)} material={mat(c, { rough: 0.85 })} position={[0, 0.3, 0]} />
        </group>
      ))}
      {/* manequim */}
      <group position={[1.4, 0, 0.1]}>
        <mesh geometry={cilindro(0.02, 0.02, 1.0, 6)} material={cromo()} position={[0, 0.5, 0]} />
        <mesh geometry={capsula(0.2, 0.45)} material={mat(cor, { rough: 0.7 })} position={[0, 1.28, 0]} castShadow />
        <mesh geometry={esfera(0.13, 12)} material={mat("#F1E7DA", { rough: 0.6 })} position={[0, 1.83, 0]} />
      </group>
    </group>
  );
}
function Imobiliaria({ x, z, cor }: { x: number; z: number; cor: string }) {
  const t = useMemo(() => placaImovel(cor), [cor]);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.08, 2.4, 0.08)} material={mat("#F4F1EA")} position={[0, 1.2, 0]} />
      <mesh geometry={caixa(1.1, 0.06, 0.06)} material={mat("#F4F1EA")} position={[0.5, 2.3, 0]} />
      {[-1, 1].map((s) => <mesh key={s} geometry={plano(0.95, 0.6)} position={[0.55, 1.88, s * 0.012]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>{t ? <meshStandardMaterial map={t} roughness={0.7} side={THREE.FrontSide} /> : <meshStandardMaterial color="#FFFFFF" />}</mesh>)}
      {/* casinha em miniatura */}
      <group position={[0.9, 0, 0.5]}>
        <mesh geometry={caixa(0.6, 0.45, 0.5)} material={mat("#F4F1EA", { rough: 0.8 })} position={[0, 0.23, 0]} castShadow />
        <mesh geometry={cone(0.5, 0.35, 4)} material={mat(cor, { rough: 0.7 })} position={[0, 0.63, 0]} rotation={[0, Math.PI / 4, 0]} />
      </group>
    </group>
  );
}
function Baloes({ cor, zf, sx }: { cor: string; zf: number; sx: number }) {
  const lista = useMemo(() => {
    const out: { p: [number, number, number]; c: string; r: number }[] = [];
    const cores = [cor, "#FFFFFF", "#F5C542"];
    const n = 26, larg = 2.4 * sx, alt = 3.2;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; out.push({ p: [-Math.cos(a) * larg, Math.sin(a) * alt, 0], c: cores[i % 3], r: 0.22 + ((i * 7) % 3) * 0.03 }); }
    return out;
  }, [cor, sx]);
  return <group position={[0, 0, zf - 1.3]}>{lista.map((b, i) => <mesh key={i} geometry={esfera(b.r, 12)} material={mat(b.c, { rough: 0.25 })} position={b.p} castShadow />)}</group>;
}
function Malas({ x, z }: { x: number; z: number }) {
  const t = useMemo(() => globoTex(), []);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={caixa(0.7, 0.5, 0.3)} material={mat("#B45309", { rough: 0.6 })} position={[0, 0.25, 0]} castShadow />
      <mesh geometry={caixa(0.55, 0.42, 0.26)} material={mat("#0F766E", { rough: 0.6 })} position={[0.02, 0.71, 0]} rotation={[0, 0.15, 0]} castShadow />
      <mesh geometry={toro(0.08, 0.018, 10, Math.PI)} material={ferro()} position={[0.02, 0.93, 0]} />
      <group position={[1.0, 0, 0]}>
        <mesh geometry={cilindro(0.12, 0.2, 0.08, 12)} material={madeira()} position={[0, 0.04, 0]} />
        <mesh geometry={cilindro(0.03, 0.03, 0.9, 6)} material={madeira()} position={[0, 0.5, 0]} />
        <mesh geometry={esfera(0.36, 20)} position={[0, 1.2, 0]} rotation={[0.4, 0, 0.3]} castShadow>{t ? <meshStandardMaterial map={t} roughness={0.5} /> : <meshStandardMaterial color="#2F7FD1" />}</mesh>
        <mesh geometry={toro(0.4, 0.015, 24, Math.PI)} material={mat("#D4A017", { metal: 0.8, rough: 0.3 })} position={[0, 1.2, 0]} rotation={[0, Math.PI / 2, 0.3]} />
      </group>
    </group>
  );
}
function Pneus({ x, z }: { x: number; z: number }) {
  const borracha = mat("#1A1A1A", { rough: 0.85 }), aro = mat("#B8BEC6", { metal: 0.8, rough: 0.3 });
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.13 + i * 0.25, 0]} rotation={[Math.PI / 2, 0, i * 0.3]}>
          <mesh geometry={toro(0.32, 0.13, 18)} material={borracha} castShadow />
        </group>
      ))}
      <group position={[0.95, 0.44, 0.1]} rotation={[0, 0.3, 0.15]}>
        <mesh geometry={toro(0.32, 0.13, 18)} material={borracha} castShadow />
        <mesh geometry={cilindro(0.22, 0.22, 0.12, 16)} material={aro} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}
