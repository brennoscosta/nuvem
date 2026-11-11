"use client";
// Vitrine 3D da página inicial: um trecho de rua do mundo WorkEnd com o prédio de quem visita no centro.
// O nome digitado vira o letreiro do prédio e o balão; o tipo de prédio e a cor da marca mudam ao vivo.
// Usa os mesmos modelos, materiais e bonecos do mapa (src/office/scene). Leve no celular: sem sombras e 1x de resolução.
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Modelo, ComFallback, type NomeModelo } from "@/office/scene/Modelos";
import { caixa, cilindro, mat, plano } from "@/office/scene/geo";
import { Arvore } from "@/office/scene/Entorno";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle } from "@/office/scene/Boneco";
import { TODOS_BONECOS } from "@/office/data/bonecos";
import { LAYOUT, PREDIO_CLIENTE, type LayoutId } from "@/office/data/escritorio";
import { leve } from "@/office/scene/qualidade";

const FONTE = "/fonts/inter-700.woff";
const CEU = "#DCEBFA"; // igual ao pé do degradê do céu no CSS: a névoa some no horizonte
const LARG = PREDIO_CLIENTE.x1 - PREDIO_CLIENTE.x0, PROF = PREDIO_CLIENTE.z1 - PREDIO_CLIENTE.z0;
const Z_CALCADA = -11.25, Z_RUA = -16, Z_CALCADA_2 = -20.75;
const reduzir = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface PropsVitrine { nome: string; cor: string; layout: LayoutId; subtitulo: string; ativa: boolean; onPronto?: () => void }

// ---------- prédio de quem visita ----------
function Letreiro({ nome, cor, y, z, largura }: { nome: string; cor: string; y: number; z: number; largura: number }) {
  const texto = (nome.trim() || "Sua empresa").slice(0, 22);
  const tamanho = Math.min(0.78, (largura - 0.8) / Math.max(6, texto.length * 0.62));
  return (
    <group position={[0, y, z]}>
      <mesh geometry={caixa(largura, 1.3, 0.16)} material={mat("#1F2630", { rough: 0.9 })} castShadow />
      <mesh geometry={caixa(largura, 0.07, 0.2)} material={mat(cor, { emissive: cor, ei: 0.6 })} position={[0, -0.6, 0]} />
      <Text font={FONTE} fontSize={tamanho} anchorX="center" anchorY="middle" position={[0, 0.02, -0.14]} color="#FFFFFF" maxWidth={largura - 0.6} rotation={[0, Math.PI, 0]}>
        {texto}
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.25} roughness={0.4} />
      </Text>
    </group>
  );
}

// O prédio nasce do chão com uma mola quando troca de modelo
function Predio({ layout, nome, cor }: { layout: LayoutId; nome: string; cor: string }) {
  const L = LAYOUT[layout];
  const g = useRef<THREE.Group>(null);
  const t0 = useRef(0);
  useEffect(() => { t0.current = performance.now(); }, [layout]);
  useFrame(() => {
    if (!g.current) return;
    if (reduzir()) { g.current.scale.set(1, 1, 1); return; }
    const t = Math.min(1, (performance.now() - t0.current) / 900);
    const mola = 1 - Math.exp(-7 * t) * Math.cos(9 * t); // sobe passando um pouco e assenta
    g.current.scale.set(1, Math.max(0.001, mola), 1);
  });
  return (
    <group>
      <mesh geometry={caixa(LARG + 1.2, 0.16, PROF + 1.2)} material={mat("#D8D4CC", { rough: 0.95 })} position={[0, 0.08, 0]} receiveShadow />
      <group ref={g}>
        <ComFallback key={layout} fallback={<mesh geometry={caixa(LARG, L.altura * 0.8, PROF)} material={mat("#F1EFEA", { rough: 0.9 })} position={[0, L.altura * 0.4 + 0.16, 0]} />}>
          <Modelo nome={L.modelo as NomeModelo} position={[0, 0.16, 0]} rotation={Math.PI / 2} altura={L.altura} />
        </ComFallback>
        <Letreiro nome={nome} cor={cor} y={L.letreiro.y} z={L.letreiro.z} largura={L.letreiro.largura} />
      </group>
    </group>
  );
}

function Balao({ nome, cor, subtitulo, altura }: { nome: string; cor: string; subtitulo: string; altura: number }) {
  return (
    <Html position={[0, altura + 2.2, -2]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div className="wi-balao" style={{ ["--cor" as string]: cor }}>
        <div className="wi-balao-caixa"><b>{nome.trim() || "Sua empresa"}</b><small>{subtitulo}</small></div>
        <i />
      </div>
    </Html>
  );
}

// ---------- vizinhança ----------
let texVenda: THREE.CanvasTexture | null = null;
function materialVenda() {
  if (!texVenda && typeof document !== "undefined") {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d")!;
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 512, 256); g.fillStyle = "#0A6CFF"; g.fillRect(0, 0, 512, 56);
    g.fillStyle = "#FFFFFF"; g.font = "bold 30px Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("WORKEND", 256, 29);
    g.fillStyle = "#0F172A"; g.font = "bold 96px Inter, Arial, sans-serif"; g.fillText("À VENDA", 256, 146);
    g.fillStyle = "#475569"; g.font = "28px Inter, Arial, sans-serif"; g.fillText("o seu endereço no mapa", 256, 218);
    texVenda = new THREE.CanvasTexture(c); texVenda.colorSpace = THREE.SRGBColorSpace; texVenda.anisotropy = 4;
  }
  return new THREE.MeshBasicMaterial({ map: texVenda ?? undefined, toneMapped: false });
}
function PlacaVenda({ position }: { position: [number, number, number] }) {
  const m = useMemo(() => materialVenda(), []);
  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      {[-0.7, 0.7].map((x) => <mesh key={x} geometry={caixa(0.08, 1.9, 0.08)} material={mat("#6B4F2A", { rough: 0.9 })} position={[x, 0.95, 0]} castShadow />)}
      <mesh geometry={caixa(1.9, 1.0, 0.06)} material={mat("#F7F7F5")} position={[0, 1.5, 0]} castShadow />
      <mesh geometry={plano(1.8, 0.9)} material={m} position={[0, 1.5, 0.035]} />
    </group>
  );
}
function LoteVizinho({ x, modelo, altura, rot }: { x: number; modelo: NomeModelo; altura: number; rot: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={plano(18.5, 18.5)} material={mat("#8CC978", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow />
      <ComFallback fallback={null}><Modelo nome={modelo} position={[0, 0, 1]} rotation={rot} altura={altura} /></ComFallback>
      <PlacaVenda position={[5.5, 0, -8.4]} />
    </group>
  );
}

function Rua() {
  const tracos = useMemo(() => Array.from({ length: 24 }, (_, i) => -69 + i * 6), []);
  return (
    <group>
      <mesh geometry={plano(420, 420)} material={mat("#79B968", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow />
      <mesh geometry={plano(20, 20)} material={mat("#8CC978", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
      {[Z_CALCADA, Z_CALCADA_2].map((z) => <mesh key={z} geometry={plano(160, 2.5)} material={mat("#D9D5CC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]} receiveShadow />)}
      {[-12.4, -19.6].map((z) => <mesh key={z} geometry={caixa(160, 0.12, 0.2)} material={mat("#C3BFB6")} position={[0, 0, z]} />)}
      <mesh geometry={plano(160, 7)} material={mat("#4A4E55", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, Z_RUA]} receiveShadow />
      {tracos.map((x) => <mesh key={x} geometry={plano(2.4, 0.16)} material={mat("#E8E4D8")} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, Z_RUA]} />)}
      {/* faixa de pedestre em frente ao prédio */}
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} geometry={plano(0.6, 6.4)} material={mat("#F2EFE6")} rotation={[-Math.PI / 2, 0, 0]} position={[-2.85 + i * 0.95, 0.003, Z_RUA]} />)}
      {/* postes */}
      {[-24, 0.01, 24].map((x) => (
        <group key={x} position={[x === 0.01 ? 11 : x, 0, -10.4]}>
          <mesh geometry={cilindro(0.06, 0.08, 4, 8)} material={mat("#3A3F47", { metal: 0.3, rough: 0.6 })} position={[0, 2, 0]} castShadow />
          <mesh geometry={caixa(0.25, 0.12, 0.5)} material={mat("#3A3F47")} position={[0, 4, -0.2]} />
        </group>
      ))}
      {/* árvores dos dois lados da rua */}
      {[-30, -14, 14, 30].map((x) => <Arvore key={"a" + x} position={[x, 0, -10.1]} escala={1.05} />)}
      {[-34, -20, -6, 8, 22, 36].map((x) => <Arvore key={"b" + x} position={[x, 0, -22]} escala={0.95 + ((x + 40) % 3) * 0.1} />)}
      {/* quarteirões do outro lado: volumes baixos que somem na névoa */}
    </group>
  );
}

// Carro dando a volta na rua (dois sentidos)
function Carro({ z, sentido, x0, v, cor }: { z: number; sentido: 1 | -1; x0: number; v: number; cor: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current || reduzir()) return;
    let x = g.current.position.x + sentido * v * Math.min(dt, 0.05);
    if (x > 70) x = -70; if (x < -70) x = 70;
    g.current.position.x = x;
  });
  return <group ref={g} position={[x0, 0, z]}><ComFallback fallback={null}><Modelo nome="carroHatch" position={[0, 0, 0]} rotation={sentido > 0 ? 0 : Math.PI} altura={1.5} cor={cor} /></ComFallback></group>;
}

// Pessoa indo e voltando na calçada
function Pedestre({ boneco, camisa, x0, alcance, v, fase }: { boneco: string; camisa: string; x0: number; alcance: number; v: number; fase: number }) {
  const h = useRef<BonecoHandle>(null);
  const g = useRef<THREE.Group>(null);
  const t = useRef(fase);
  useAnimacao(h, () => (reduzir() ? "idle" : "walk"), fase, HIPS.procedural.base);
  useFrame((_, dt) => {
    if (!g.current || reduzir()) return;
    t.current += Math.min(dt, 0.05) * v / alcance;
    const s = Math.sin(t.current), c = Math.cos(t.current);
    g.current.position.x = x0 + s * alcance;
    g.current.rotation.y = c >= 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={g} position={[x0, 0, Z_CALCADA]}>
      <BonecoProcedural ref={h} def={TODOS_BONECOS[boneco] ?? TODOS_BONECOS.classico} camisa={camisa} cracha="#B8C0CC" />
    </group>
  );
}

// Câmera: vista de quem está na rua, balançando devagar e seguindo um pouco o ponteiro
function Camera() {
  const { camera, size } = useThree();
  const alvo = useMemo(() => new THREE.Vector3(), []);
  const ponteiro = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const f = (e: PointerEvent) => { ponteiro.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 }; };
    window.addEventListener("pointermove", f, { passive: true });
    return () => window.removeEventListener("pointermove", f);
  }, []);
  useFrame(({ clock }) => {
    const estreito = size.width / size.height < 1.1;
    // no computador o painel cobre o pé da vitrine: a câmera mira na calçada e o prédio sobe na tela
    if (estreito) alvo.set(0, 5.9, -3.5); else alvo.set(0, 5.4, -9.5); // alto o bastante para o balão caber no quadro
    const R = estreito ? 56 : 54;
    const a = (reduzir() ? 0 : Math.sin(clock.elapsedTime * 0.12) * 0.32) + ponteiro.current.x * 0.08 - 0.28;
    const e = 0.40 + ponteiro.current.y * 0.03;
    camera.position.set(alvo.x + Math.sin(a) * R * Math.cos(e), alvo.y + R * Math.sin(e), alvo.z - Math.cos(a) * R * Math.cos(e));
    camera.lookAt(alvo);
  });
  return null;
}

function Avisa({ onPronto }: { onPronto?: () => void }) {
  useEffect(() => { const t = setTimeout(() => onPronto?.(), 60); return () => clearTimeout(t); }, [onPronto]);
  return null;
}

export default function Vitrine3D({ nome, cor, layout, subtitulo, ativa, onPronto }: PropsVitrine) {
  const simples = leve();
  return (
    <Canvas
      dpr={simples ? 1 : [1, 1.75]}
      shadows={simples ? false : { enabled: true, type: THREE.PCFSoftShadowMap }}
      frameloop={ativa ? "always" : "never"}
      camera={{ position: [-10, 20, -50], fov: 32, near: 0.5, far: 300 }}
      gl={{ antialias: !simples, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <fog attach="fog" args={[CEU, 85, 175]} />
      <hemisphereLight args={["#FFFFFF", "#CDD3DB", 0.95]} />
      <directionalLight position={[-18, 30, -22]} intensity={1.35} color="#FFF4E0" castShadow={!simples}
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0004} />
      <directionalLight position={[16, 10, 12]} intensity={0.45} color="#DCE8FF" />
      <Camera />
      <Rua />
      <Suspense fallback={null}>
        <Predio layout={layout} nome={nome} cor={cor} />
        <Balao nome={nome} cor={cor} subtitulo={subtitulo} altura={LAYOUT[layout].altura} />
        <LoteVizinho x={-21} modelo="casaTerrea" altura={5} rot={-Math.PI / 2} />
        <LoteVizinho x={21} modelo="casaModerna" altura={5.6} rot={-Math.PI / 2} />
        <Carro z={-14.3} sentido={1} x0={-40} v={9} cor="#E9504F" />
        <Carro z={-17.7} sentido={-1} x0={25} v={7.5} cor="#F4F4F2" />
        {!simples && <Carro z={-14.3} sentido={1} x0={18} v={9} cor="#2F6FE4" />}
        <Pedestre boneco="coque" camisa="#0A6CFF" x0={-6} alcance={9} v={1.6} fase={0.3} />
        <Pedestre boneco="oculos" camisa="#F59E0B" x0={12} alcance={7} v={1.4} fase={2.1} />
        {!simples && <Pedestre boneco="ruivo" camisa="#16A34A" x0={-22} alcance={6} v={1.5} fase={4.2} />}
        <Avisa onPronto={onPronto} />
      </Suspense>
    </Canvas>
  );
}
