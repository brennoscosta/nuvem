"use client";
// O escritório de um cliente no lote dele: prédio por fora (3 layouts, na cor e com a logo da empresa) e, na vista
// por dentro, a planta com recepção, sala do CEO e os setores que o dono escolheu — com a equipe sentada nas mesas.
// Enquanto o painel "Montar escritório" está aberto, desenha o rascunho ao vivo.
import * as THREE from "three";
import { useMemo, useRef, useState } from "react";
import { Html, Text } from "@react-three/drei";
import { caixa, cilindro, esfera, mat, plano, toro } from "./geo";
import { Arvore } from "./Entorno";
import { Estatico } from "./Estatico";
import { Modelo, ComFallback, type NomeModelo } from "./Modelos";
import { Mesa, Sofa, Planta, Balcao, MesaBaixa, Quadro, Cafe } from "./Moveis";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle, type Pose } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { LOTE_POR_CHAVE, frenteDoLote } from "../data/mundo";
import { plantaCliente, PREDIO_CLIENTE, ALT_PAREDE_CLIENTE, LAYOUT, DECOR_PADRAO, type Escritorio, type Membro, type SalaCliente, type Decoracao, type EstiloLetreiro, type PisoLote, type ExtraLote } from "../data/escritorio";
import { useMundo } from "../mundoStore";
import { useEscritorio } from "../store";

const FONTE = "/fonts/inter-700.woff";
const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = PREDIO_CLIENTE;
const LARG = X1 - X0, PROF = Z1 - Z0;

// ---------- lado de fora ----------
// Prédio gerado no Higgsfield (GLB normalizado: altura 1, base em y=0; frente do Tripo olha pra +x → giramos pra -z)
function Exterior({ e, cor, nome, logo }: { e: Escritorio; cor: string; nome: string; logo: string | null }) {
  const L = LAYOUT[e.layout];
  const d = e.decor ?? DECOR_PADRAO;
  return (
    <group>
      <mesh geometry={caixa(LARG + 1.2, 0.16, PROF + 1.2)} material={mat("#D8D4CC", { rough: 0.95 })} position={[0, 0.08, 0]} receiveShadow />
      <ComFallback fallback={<mesh geometry={caixa(LARG, L.altura * 0.8, PROF)} material={mat("#F1EFEA", { rough: 0.9 })} position={[0, L.altura * 0.4 + 0.16, 0]} />}>
        <Modelo nome={L.modelo as NomeModelo} position={[0, 0.16, 0]} rotation={Math.PI / 2} altura={L.altura} />
      </ComFallback>
      <Letreiro nome={nome} cor={cor} logo={logo} y={L.letreiro.y} z={L.letreiro.z} largura={L.letreiro.largura} estilo={d.letreiro} />
      {/* a Loja de rua já vem com toldo listrado no modelo */}
      {d.toldo && e.layout !== "loja" && <Toldo cor={d.toldo} y={L.letreiro.y - 1.05} z={L.letreiro.z} largura={L.letreiro.largura} />}
    </group>
  );
}

// Nome da empresa (texto 3D) no letreiro, com a logo ao lado quando tem. Estilos (11/11/2026): painel escuro com faixa na
// cor da marca, neon (borda e letras acesas na cor), madeira (letras claras) e metal escovado (letras escuras)
const ESTILO: Record<EstiloLetreiro, { fundo: string; rough: number; metal: number; texto: (cor: string) => string; brilho: (cor: string) => [string, number] }> = {
  painel: { fundo: "#1F2630", rough: 0.9, metal: 0, texto: () => "#FFFFFF", brilho: () => ["#FFFFFF", 0.25] },
  neon: { fundo: "#0E1014", rough: 0.5, metal: 0, texto: (c) => c, brilho: (c) => [c, 1.8] },
  madeira: { fundo: "#8A5A33", rough: 0.95, metal: 0, texto: () => "#FFF4DE", brilho: () => ["#000000", 0] },
  metal: { fundo: "#C9CED6", rough: 0.32, metal: 0.75, texto: () => "#1D2128", brilho: () => ["#000000", 0] },
};
function Letreiro({ nome, cor, logo, y, z, largura, estilo = "painel" }: { nome: string; cor: string; logo: string | null; y: number; z: number; largura: number; estilo?: EstiloLetreiro }) {
  const texto = (nome.trim() || "Sua empresa").slice(0, 22);
  const tamanho = Math.min(0.78, (largura - (logo ? 2.2 : 0.8)) / Math.max(6, texto.length * 0.62));
  const E = ESTILO[estilo] ?? ESTILO.painel; const [brilhoCor, brilho] = E.brilho(cor);
  return (
    <group position={[0, y, z]}>
      <mesh geometry={caixa(largura, 1.3, 0.16)} material={mat(E.fundo, { rough: E.rough, metal: E.metal })} castShadow />
      {estilo === "neon" ? (
        <>
          {[-0.6, 0.6].map((by) => <mesh key={by} geometry={caixa(largura - 0.1, 0.06, 0.2)} material={mat(cor, { emissive: cor, ei: 2.2 })} position={[0, by, 0]} />)}
          {[-1, 1].map((bx) => <mesh key={bx} geometry={caixa(0.06, 1.24, 0.2)} material={mat(cor, { emissive: cor, ei: 2.2 })} position={[bx * (largura / 2 - 0.08), 0, 0]} />)}
        </>
      ) : estilo === "madeira" ? (
        <mesh geometry={caixa(largura + 0.12, 1.42, 0.1)} material={mat("#5E3B1F", { rough: 0.95 })} position={[0, 0, 0.05]} />
      ) : (
        <mesh geometry={caixa(largura, 0.07, 0.2)} material={mat(cor, { emissive: cor, ei: estilo === "metal" ? 0.2 : 0.5 })} position={[0, -0.6, 0]} />
      )}
      {logo && <LogoPlano url={logo} position={[-largura / 2 + 0.95, 0, -0.14]} tamanho={1.15} />}
      <Text font={FONTE} fontSize={tamanho} anchorX="center" anchorY="middle" position={[logo ? 0.7 : 0, 0.02, -0.14]} color="#FFFFFF" maxWidth={largura - 1} rotation={[0, Math.PI, 0]}>
        {texto}
        <meshStandardMaterial color={E.texto(cor)} emissive={brilhoCor} emissiveIntensity={brilho} roughness={0.4} />
      </Text>
    </group>
  );
}
// Logo em textura (carrega a imagem direto; sem suspense pra não derrubar o prédio se a imagem falhar)
function LogoPlano({ url, position, tamanho }: { url: string; position: [number, number, number]; tamanho: number }) {
  const tex = useMemo(() => { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }, [url]);
  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <mesh geometry={plano(tamanho + 0.16, tamanho + 0.16)} material={mat("#FFFFFF", { rough: 0.5 })} position={[0, 0, -0.01]} />
      <mesh geometry={plano(tamanho, tamanho)}><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>
    </group>
  );
}

// ---------- lado de dentro ----------
function ParedeBaixa({ de, ate, cor = "#F4F1EB", altura = ALT_PAREDE_CLIENTE }: { de: [number, number]; ate: [number, number]; cor?: string; altura?: number }) {
  const dx = ate[0] - de[0], dz = ate[1] - de[1]; const len = Math.hypot(dx, dz); if (len < 0.05) return null;
  return <mesh geometry={caixa(0.12, altura, len)} material={mat(cor, { rough: 0.9 })} position={[(de[0] + ate[0]) / 2, altura / 2, (de[1] + ate[1]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]} castShadow receiveShadow />;
}
// Parede com um vão (porta) no meio
function ParedeComPorta({ de, ate, vao = 1.6 }: { de: [number, number]; ate: [number, number]; vao?: number }) {
  const dx = ate[0] - de[0], dz = ate[1] - de[1]; const len = Math.hypot(dx, dz);
  if (len <= vao + 0.4) return <ParedeBaixa de={de} ate={ate} />;
  const ux = dx / len, uz = dz / len; const a = (len - vao) / 2;
  return (
    <>
      <ParedeBaixa de={de} ate={[de[0] + ux * a, de[1] + uz * a]} />
      <ParedeBaixa de={[ate[0] - ux * a, ate[1] - uz * a]} ate={ate} />
    </>
  );
}

export function InteriorFixo({ e, cor }: { e: Escritorio; cor: string }) {
  const planta = useMemo(() => plantaCliente(e), [e]);
  const zMeio = planta.salas[0].z1;
  return (
    <group>
      {/* pisos por sala */}
      {planta.salas.map((s) => (
        <mesh key={s.id} geometry={plano(s.x1 - s.x0, s.z1 - s.z0)} material={mat(s.cor, { rough: 0.95 })} position={[(s.x0 + s.x1) / 2, 0.06, (s.z0 + s.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      ))}
      <mesh geometry={caixa(LARG + 0.6, 0.1, PROF + 0.6)} material={mat("#D8D4CC", { rough: 0.95 })} position={[0, 0, 0]} receiveShadow />
      {/* paredes externas (frente com a porta) */}
      <ParedeComPorta de={[X0, Z0]} ate={[X1, Z0]} vao={2.2} />
      <ParedeBaixa de={[X0, Z1]} ate={[X1, Z1]} />
      <ParedeBaixa de={[X0, Z0]} ate={[X0, Z1]} />
      <ParedeBaixa de={[X1, Z0]} ate={[X1, Z1]} />
      {/* divisórias da frente: recepção | hall | CEO (vidro na do CEO) */}
      <ParedeBaixa de={[-2.2, Z0]} ate={[-2.2, zMeio]} />
      <ParedeBaixa de={[2.2, Z0]} ate={[2.2, zMeio]} cor="#CFE6EE" />
      {/* divisa frente/fundo com porta pra cada sala do fundo */}
      {planta.salas.filter((s) => s.tipo === "setor").map((s) => (
        <group key={s.id}>
          {s.z0 === zMeio && <ParedeComPorta de={[s.x0, zMeio]} ate={[s.x1, zMeio]} />}
          {s.z0 !== zMeio && <ParedeComPorta de={[s.x0, s.z0]} ate={[s.x1, s.z0]} />}
          {s.x0 !== X0 && <ParedeComPorta de={[s.x0, s.z0]} ate={[s.x0, s.z1]} vao={1.2} />}
        </group>
      ))}
      {/* recepção: balcão, sofá, mesinha, planta, quadro com a cor da empresa */}
      <Balcao position={[planta.balcao[0], 0, planta.balcao[1]]} />
      <Sofa position={[X0 + 1.0, 0, -2.6]} rotation={Math.PI / 2} cor={cor} largura={1.8} />
      <MesaBaixa position={[X0 + 2.2, 0, -2.6]} />
      <Planta position={[X0 + 0.6, 0, Z0 + 0.7]} />
      <Quadro position={[X0 + 0.07, 1.0, -4.6]} rotation={Math.PI / 2} largura={1.4} cor={cor} />
      {/* hall: café */}
      <Cafe position={[0, 0, zMeio - 0.6]} rotation={Math.PI} />
      {/* sala do CEO */}
      <Planta position={[X1 - 0.7, 0, Z0 + 0.7]} />
      <Quadro position={[X1 - 0.07, 1.0, -4.4]} rotation={-Math.PI / 2} largura={1.6} cor="#F6EEDF" />
      {/* mesas de todas as salas */}
      {planta.salas.flatMap((s) => s.mesas.map((m, i) => <Mesa key={`${s.id}-${i}`} def={{ id: `${s.id}-${i}`, sala: s.id, pos: m.pos, rot: m.rot, tipo: m.tipo }} cor={s.setor?.cor ?? cor} />))}
      {/* plantinhas nos setores */}
      {planta.salas.filter((s) => s.tipo === "setor").map((s) => <Planta key={s.id} position={[s.x1 - 0.6, 0, s.z1 - 0.6]} pequena />)}
    </group>
  );
}

// Nome da sala flutuando (só na vista por dentro)
function NomeSala({ s }: { s: SalaCliente }) {
  return (
    <Html position={[(s.x0 + s.x1) / 2, 1.9, (s.z0 + s.z1) / 2]} center zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
      <div className="select-none whitespace-nowrap rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{s.nome}</div>
    </Html>
  );
}

// Um membro da equipe no lugar dele, com crachá flutuante
function MembroCena({ m, lugar, chave }: { m: Membro; lugar: { pos: [number, number, number]; rot: number; emPe?: boolean }; chave: string }) {
  const h = useRef<BonecoHandle>(null);
  const fase = useMemo(() => (m.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97) / 10, [m.id]); // fase fixa por pessoa (sem aleatório no render)
  const pose: Pose = lugar.emPe ? "idle" : m.papel === "ceo" ? "think" : "type";
  useAnimacao(h, () => pose, fase, HIPS.procedural.base);
  const def = BONECO[m.boneco] ?? BONECO.classico;
  const [hover, setHover] = useState(false);
  // NPC: sem balão de nome (só com o mouse em cima). Clicar abre o cartão da loja, com a conversa com a atendente de IA
  // (desde 11/11/2026 não precisa de personagem: basta a conta; no próprio lote, o cartão leva à Minha equipe)
  const clicar = () => { useMundo.getState().selecionarLote(chave); };
  return (
    <group position={lugar.pos} rotation={[0, lugar.rot, 0]}>
      <BonecoProcedural ref={h} def={def} camisa={m.camisa} headset={m.papel === "atendente"} cracha={m.papel === "ceo" ? "#D4A017" : "#1D4ED8"} />
      <mesh position={[0, 0.7, 0]} onClick={(e) => { e.stopPropagation(); clicar(); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
        <cylinderGeometry args={[0.4, 0.4, 1.5, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hover && (
        <Html position={[0, 1.65, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max select-none rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-[#1D2128] shadow-md">{m.nome}<span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase text-white" style={{ background: m.papel === "ceo" ? "#D4A017" : m.papel === "atendente" ? "#16A34A" : "#1D4ED8" }}>{m.papel === "ceo" ? "CEO" : m.papel === "atendente" ? "Atendente" : m.cargo.slice(0, 14)}</span></div>
        </Html>
      )}
    </group>
  );
}

// ---------- um escritório no lote ----------
function EscritorioLote({ chave, e, cor, nome, logo, fora }: { chave: string; e: Escritorio; cor: string; nome: string; logo: string | null; fora: boolean }) {
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const [x, z] = l.centro;
  // nossa frente local é -z; frenteDoLote usa rot 0 = frente pra +z. O dono pode girar o prédio em quartos de volta (decor.giro)
  const rot = frenteDoLote(l.k) + Math.PI + (e.decor?.giro ?? 0) * (Math.PI / 2);
  const planta = plantaCliente(e);
  const assinatura = JSON.stringify(e) + cor + nome + (logo ?? "");
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <group visible={fora}><Exterior e={e} cor={cor} nome={nome} logo={logo} /></group>
      <DecorLote d={e.decor ?? DECOR_PADRAO} cor={cor} logo={logo} />
      {!fora && (
        <>
          <Estatico key={"d" + assinatura}><InteriorFixo e={e} cor={cor} /></Estatico>
          {planta.salas.filter((s) => s.tipo !== "hall").map((s) => <NomeSala key={s.id} s={s} />)}
          {e.equipe.map((m) => { const lugar = planta.lugares[m.id]; return lugar ? <MembroCena key={m.id} m={m} lugar={lugar} chave={chave} /> : null; })}
        </>
      )}
    </group>
  );
}

export function EscritoriosClientes() {
  const terrenos = useMundo((s) => s.terrenos);
  const selecionado = useMundo((s) => s.loteSelecionado);
  const rascunho = useMundo((s) => s.rascunhoEscritorio);
  const rascunhoPlaca = useMundo((s) => s.rascunho);
  const fora = useEscritorio((s) => s.vista === "fora");
  return (
    <group>
      {Object.values(terrenos).map((t) => {
        const e = t.chave === selecionado && rascunho ? rascunho : t.escritorio;
        if (t.status !== "ativo" || !e) return null;
        const placa = t.chave === selecionado && rascunhoPlaca ? rascunhoPlaca : null;
        const logo = placa ? placa.logoDataUrl : t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null;
        return <EscritorioLote key={t.chave} chave={t.chave} e={e} cor={placa?.cor ?? t.cor} nome={placa?.empresaNome ?? t.empresaNome} logo={logo} fora={fora} />;
      })}
    </group>
  );
}

// Lotes que têm escritório montado (a casa original some e o tapume não aparece)
export function useLotesComEscritorio() {
  const terrenos = useMundo((s) => s.terrenos);
  return useMemo(() => new Set(Object.values(terrenos).filter((t) => t.status === "ativo" && t.escritorio).map((t) => t.chave)), [terrenos]);
}

// ---------- decoração do lote (11/11/2026) ----------
// Texturas desenhadas em canvas (uma por tipo, guardadas): deck, pedra portuguesa em ondas, concreto com juntas e o
// listrado do toldo. Tudo o que não mexe vai para o <Estatico> (poucas malhas por lote).
const texturas = new Map<string, THREE.CanvasTexture>();
function textura(chave: string, desenhar: (g: CanvasRenderingContext2D, n: number) => void, repetir = 1) {
  let t = texturas.get(chave);
  if (t) return t;
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d")!; desenhar(g, n);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repetir, repetir); t.anisotropy = 4;
  texturas.set(chave, t); return t;
}
function texturaPiso(p: PisoLote) {
  if (p === "deck") return textura("deck", (g, n) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = ["#B98A5A", "#AF7F50", "#C29464", "#B3855A"][i % 4]; g.fillRect(0, i * (n / 8), n, n / 8); }
    g.strokeStyle = "rgba(60,35,15,.55)"; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * (n / 8)); g.lineTo(n, i * (n / 8)); g.stroke(); }
    for (let i = 0; i < 8; i++) { const x = ((i * 97) % n); g.beginPath(); g.moveTo(x, i * (n / 8)); g.lineTo(x, (i + 1) * (n / 8)); g.stroke(); }
  }, 5);
  if (p === "pedra") return textura("pedra", (g, n) => {
    g.fillStyle = "#EDE7DA"; g.fillRect(0, 0, n, n);
    // pedrinhas irregulares; as escuras desenham as ondas de calçadão
    for (let y = 0; y < n; y += 8) for (let x = 0; x < n; x += 8) {
      const onda = Math.sin((x / n) * Math.PI * 4) * 30 + n / 2;
      const escura = Math.abs(((y - onda + n * 4) % 64) - 32) < 10;
      g.fillStyle = escura ? (((x + y) / 8) % 2 ? "#2B2B2B" : "#3A3A38") : (((x * 7 + y * 3) / 8) % 3 ? "#F2EDE2" : "#E2DBCC");
      g.fillRect(x + 1, y + 1, 6 + ((x + y) % 2), 6);
    }
  }, 3);
  if (p === "concreto") return textura("concreto", (g, n) => {
    g.fillStyle = "#C4C8CC"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${i % 2 ? 255 : 90},${i % 2 ? 255 : 95},${i % 2 ? 255 : 100},.08)`; g.fillRect((i * 53) % n, (i * 97) % n, 2, 2); }
    g.strokeStyle = "rgba(80,85,92,.5)"; g.lineWidth = 2; g.strokeRect(1, 1, n - 2, n - 2);
  }, 4);
  return null;
}
function texturaToldo(cor: string) {
  return textura(`toldo${cor}`, (g, n) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#FFFFFF" : cor; g.fillRect(i * (n / 8), 0, n / 8, n); } });
}

let CONE: THREE.ConeGeometry | null = null;
const coneGuardaSol = () => (CONE ??= new THREE.ConeGeometry(1.15, 0.45, 12));
// fio fino entre dois pontos (do varal de luzinhas)
function Fio({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const meio = va.clone().add(vb).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return <mesh geometry={cilindro(0.012, 0.012, va.distanceTo(vb), 4)} material={mat("#2B2F36")} position={meio.toArray()} quaternion={q} />;
}
function Varal({ de, ate, flecha = 0.55, n = 11 }: { de: [number, number, number]; ate: [number, number, number]; flecha?: number; n?: number }) {
  const pts: [number, number, number][] = Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [de[0] + (ate[0] - de[0]) * t, de[1] + (ate[1] - de[1]) * t - flecha * 4 * t * (1 - t), de[2] + (ate[2] - de[2]) * t]; });
  return (
    <>
      {pts.slice(1).map((p, i) => <Fio key={`f${i}`} a={pts[i]} b={p} />)}
      {pts.slice(1, -1).map((p, i) => <mesh key={`l${i}`} geometry={esfera(0.07, 8)} material={mat("#FFE6A8", { emissive: "#FFD27A", ei: 1.8 })} position={[p[0], p[1] - 0.08, p[2]]} />)}
    </>
  );
}

function Toldo({ cor, y, z, largura }: { cor: string; y: number; z: number; largura: number }) {
  const tex = useMemo(() => texturaToldo(cor), [cor]);
  return (
    <group position={[0, y, z - 0.62]} rotation={[0.38, 0, 0]}>
      <mesh geometry={caixa(largura + 0.5, 0.05, 1.3)} castShadow><meshStandardMaterial map={tex} roughness={0.8} /></mesh>
      <mesh geometry={caixa(largura + 0.5, 0.26, 0.04)} position={[0, -0.14, -0.66]}><meshStandardMaterial map={tex} roughness={0.8} /></mesh>
    </group>
  );
}

// Piso, cerca, árvores e itens da frente. Coordenadas locais do lote: frente da loja para -z; lote de 20 × 20.
export function DecorLote({ d, cor, logo }: { d: Decoracao; cor: string; logo: string | null }) {
  const H = 9.62; // meio lado do lote (menos o meio-fio)
  const tex = typeof document !== "undefined" ? texturaPiso(d.piso) : null;
  const tem = (x: ExtraLote) => d.extras.includes(x);
  const madeira = mat("#A0703C", { rough: 0.9 }), metal = mat("#2B2F36", { metal: 0.4, rough: 0.5 });
  // árvores: primeiro nos fundos, depois na frente
  const arvores: [number, number][] = [[-8.5, 8.5], [8.5, 8.5], [-9.0, -9.0], [9.0, -9.0]].slice(0, d.arvores) as [number, number][];
  const lados: { de: [number, number]; ate: [number, number] }[] = [
    { de: [-H, -H], ate: [-2.1, -H] }, { de: [2.1, -H], ate: [H, -H] }, // frente, com a passagem da entrada
    { de: [-H, H], ate: [H, H] }, { de: [-H, -H], ate: [-H, H] }, { de: [H, -H], ate: [H, H] },
  ];
  return (
    <group>
      {tex && (
        <mesh geometry={plano(2 * H, 2 * H)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
          <meshStandardMaterial map={tex} roughness={0.92} />
        </mesh>
      )}
      <Estatico key={JSON.stringify(d) + cor}>
        {/* cerca */}
        {d.cerca !== "nenhuma" && lados.map(({ de, ate }, i) => {
          const dx = ate[0] - de[0], dz = ate[1] - de[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
          const mx = (de[0] + ate[0]) / 2, mz = (de[1] + ate[1]) / 2;
          if (d.cerca === "viva") return <mesh key={i} geometry={caixa(0.6, 0.95, len)} material={mat("#3E8E41", { rough: 1 })} position={[mx, 0.48, mz]} rotation={[0, ang, 0]} castShadow />;
          if (d.cerca === "muro") return (
            <group key={i} position={[mx, 0, mz]} rotation={[0, ang, 0]}>
              <mesh geometry={caixa(0.26, 0.85, len)} material={mat("#ECE6DA", { rough: 0.95 })} position={[0, 0.43, 0]} castShadow />
              <mesh geometry={caixa(0.34, 0.08, len + 0.08)} material={mat("#D3CBBB", { rough: 0.9 })} position={[0, 0.89, 0]} />
            </group>
          );
          const postes = Math.max(2, Math.round(len / 1.2) + 1);
          return (
            <group key={i} position={[mx, 0, mz]} rotation={[0, ang, 0]}>
              {[0.42, 0.82].map((y) => <mesh key={y} geometry={caixa(0.06, 0.09, len)} material={mat("#D9B48A", { rough: 0.9 })} position={[0, y, 0]} />)}
              {Array.from({ length: postes }, (_, k) => <mesh key={k} geometry={caixa(0.1, 1.05, 0.1)} material={mat("#C99B6B", { rough: 0.9 })} position={[0, 0.52, -len / 2 + (k * len) / (postes - 1)]} />)}
            </group>
          );
        })}
        {/* vasos com plantas ao lado da porta */}
        {tem("vasos") && [-1.9, 1.9].map((x) => (
          <group key={x} position={[x, 0, -8.25]}>
            <mesh geometry={cilindro(0.34, 0.26, 0.6, 14)} material={mat("#C0663E", { rough: 0.85 })} position={[0, 0.3, 0]} castShadow />
            <mesh geometry={esfera(0.48, 12)} material={mat("#4E9B47", { rough: 1 })} position={[0, 0.95, 0]} castShadow />
          </group>
        ))}
        {/* bancos de praça */}
        {tem("bancos") && [-5, 5].map((x) => (
          <group key={x} position={[x, 0, -9.0]}>
            <mesh geometry={caixa(1.6, 0.07, 0.46)} material={madeira} position={[0, 0.46, 0]} castShadow />
            <mesh geometry={caixa(1.6, 0.42, 0.06)} material={madeira} position={[0, 0.74, 0.22]} />
            {[-0.68, 0.68].map((lx) => <mesh key={lx} geometry={caixa(0.07, 0.46, 0.46)} material={metal} position={[lx, 0.23, 0]} />)}
          </group>
        ))}
        {/* mesas com guarda-sol na cor da marca */}
        {tem("mesas") && [-7.3, 7.3].map((x) => (
          <group key={x} position={[x, 0, -8.7]}>
            <mesh geometry={cilindro(0.48, 0.48, 0.05, 18)} material={mat("#F4F1EA", { rough: 0.6 })} position={[0, 0.76, 0]} castShadow />
            <mesh geometry={cilindro(0.04, 0.04, 2.3, 6)} material={metal} position={[0, 1.15, 0]} />
            <mesh geometry={coneGuardaSol()} material={mat(cor, { rough: 0.7 })} position={[0, 2.45, 0]} castShadow />
            {[-0.8, 0.8].map((sx) => <mesh key={sx} geometry={cilindro(0.2, 0.2, 0.45, 10)} material={madeira} position={[sx, 0.23, 0]} />)}
          </group>
        ))}
        {/* totem na calçada com a cor (a logo vai por cima, fora do Estatico) */}
        {tem("totem") && (
          <group position={[-3.2, 0, -9.25]}>
            <mesh geometry={caixa(0.8, 2.4, 0.3)} material={mat("#1F2630", { rough: 0.6 })} position={[0, 1.2, 0]} castShadow />
            <mesh geometry={caixa(0.84, 0.12, 0.34)} material={mat(cor, { emissive: cor, ei: 0.6 })} position={[0, 2.35, 0]} />
          </group>
        )}
        {/* bandeiras nos cantos da frente */}
        {tem("bandeiras") && [-9.2, 9.2].map((x) => (
          <group key={x} position={[x, 0, -6.2]}>
            <mesh geometry={cilindro(0.04, 0.05, 5, 6)} material={mat("#D9DDE3", { metal: 0.6, rough: 0.35 })} position={[0, 2.5, 0]} />
            <mesh geometry={caixa(0.02, 0.85, 1.4)} material={mat(cor, { rough: 0.8 })} position={[0, 4.45, -0.72]} castShadow />
            <mesh geometry={caixa(0.025, 0.16, 1.4)} material={mat("#FFFFFF", { rough: 0.8 })} position={[0, 4.45, -0.72]} />
          </group>
        ))}
        {/* varal de luzinhas: postes na frente e fios até a fachada */}
        {tem("luzes") && (
          <>
            {[-8.6, 8.6].map((x) => <mesh key={x} geometry={cilindro(0.04, 0.05, 3.2, 6)} material={metal} position={[x, 1.6, -9.3]} />)}
            <Varal de={[-8.6, 3.15, -9.3]} ate={[8.6, 3.15, -9.3]} />
            <Varal de={[-8.6, 3.15, -9.3]} ate={[-4, 3.7, -7.6]} n={6} flecha={0.3} />
            <Varal de={[8.6, 3.15, -9.3]} ate={[4, 3.7, -7.6]} n={6} flecha={0.3} />
          </>
        )}
        {/* bicicletário na lateral */}
        {tem("bicicletario") && [-4.8, -3.6, -2.4].map((z) => (
          <mesh key={z} geometry={toro(0.36, 0.035, 12, Math.PI)} material={metal} position={[9.1, 0, z]} rotation={[0, Math.PI / 2, 0]} />
        ))}
      </Estatico>
      {tem("totem") && logo && <LogoPlano url={logo} position={[-3.2, 1.45, -9.42]} tamanho={0.62} />}
      {arvores.map(([x, z]) => <Arvore key={`${x},${z}`} position={[x, 0, z]} escala={1.15} />)}
    </group>
  );
}
