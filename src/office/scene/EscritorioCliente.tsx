"use client";
// O escritório de um cliente no lote dele: prédio por fora (3 layouts, na cor e com a logo da empresa) e, na vista
// por dentro, a planta com recepção, sala do CEO e os setores que o dono escolheu — com a equipe sentada nas mesas.
// Enquanto o painel "Montar escritório" está aberto, desenha o rascunho ao vivo.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { Html, Text } from "@react-three/drei";
import { caixa, cilindro, mat, plano, COR } from "./geo";
import { Estatico } from "./Estatico";
import { Mesa, Sofa, Planta, Balcao, MesaBaixa, Quadro, Cafe } from "./Moveis";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle, type Pose } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { LOTE_POR_CHAVE, frenteDoLote } from "../data/mundo";
import { plantaCliente, PREDIO_CLIENTE, ALT_PAREDE_CLIENTE, LAYOUT, type Escritorio, type Membro, type SalaCliente } from "../data/escritorio";
import { useMundo } from "../mundoStore";
import { useEscritorio } from "../store";

const FONTE = "/fonts/inter-700.woff";
const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = PREDIO_CLIENTE;
const LARG = X1 - X0, PROF = Z1 - Z0;

// ---------- lado de fora ----------
// Partes com textura/texto ficam fora do Estatico (toldo listrado, letreiro com texto 3D e logo)
function ExteriorExtras({ e, cor, nome, logo }: { e: Escritorio; cor: string; nome: string; logo: string | null }) {
  const h = LAYOUT[e.layout].altura;
  return (
    <group>
      {e.layout === "loja" && <Toldo cor={cor} h={h} />}
      <Letreiro nome={nome} cor={cor} logo={logo} y={e.layout === "sobrado" ? h - 1.2 : e.layout === "loja" ? h - 0.55 : h - 0.95} z={Z0 - 0.2} largura={e.layout === "sobrado" ? 9 : 7.5} />
    </group>
  );
}
function Exterior({ e, cor }: { e: Escritorio; cor: string }) {
  const L = LAYOUT[e.layout]; const h = L.altura;
  const parede = e.layout === "loja" ? "#F3E9D8" : "#F7F5F0";
  return (
    <group>
      {/* laje do piso + corpo do prédio */}
      <mesh geometry={caixa(LARG + 0.6, 0.18, PROF + 0.6)} material={mat("#D8D4CC", { rough: 0.95 })} position={[0, 0.09, 0]} receiveShadow />
      <mesh geometry={caixa(LARG, h, PROF)} material={mat(parede, { rough: 0.85 })} position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow />
      {/* vitrine/porta de vidro na frente */}
      <mesh geometry={caixa(e.layout === "sobrado" ? 7 : 10, e.layout === "sobrado" ? 2.6 : h - 1.1, 0.08)} material={mat(COR.vidro, { rough: 0.15, metal: 0.1 })} position={[0, (e.layout === "sobrado" ? 2.6 : h - 1.1) / 2 + 0.2, Z0 - 0.05]} />
      <mesh geometry={caixa(2.2, 2.6, 0.12)} material={mat("#2B2E35", { rough: 0.6 })} position={[0, 1.5, Z0 - 0.08]} />
      <mesh geometry={caixa(0.9, 2.3, 0.06)} material={mat(COR.vidro, { rough: 0.1 })} position={[-0.5, 1.33, Z0 - 0.14]} />
      <mesh geometry={caixa(0.9, 2.3, 0.06)} material={mat(COR.vidro, { rough: 0.1 })} position={[0.5, 1.33, Z0 - 0.14]} />
      {/* laje de cima */}
      <mesh geometry={caixa(LARG + 0.5, 0.3, PROF + 0.5)} material={mat("#CFCAC0", { rough: 0.9 })} position={[0, h + 0.3, 0]} castShadow />
      {e.layout === "moderno" && (
        <>
          <mesh geometry={caixa(LARG + 0.56, 0.5, PROF + 0.56)} material={mat(cor, { rough: 0.6 })} position={[0, h - 0.2, 0]} />
          {[[-5, Z0], [5, Z0], [X0, 0], [X1, 0]].map(([x, z], i) => <mesh key={i} geometry={caixa(z === 0 ? 0.08 : 2.6, 1.6, z === 0 ? 2.6 : 0.08)} material={mat("#9CC9DA", { rough: 0.2 })} position={[x + (z === 0 ? (x < 0 ? -0.02 : 0.02) : 0), h / 2 + 0.4, z + (z === Z0 ? -0.02 : 0)]} />)}
        </>
      )}
      {e.layout === "sobrado" && (
        <>
          <mesh geometry={caixa(LARG + 0.56, 0.4, PROF + 0.56)} material={mat(cor, { rough: 0.6 })} position={[0, h / 2 + 0.2, 0]} />
          {/* janelas em fita nos dois andares, frente e laterais */}
          {[1.6, h / 2 + 1.6].map((y, j) => (
            <group key={j}>
              <mesh geometry={caixa(LARG - 2, 1.3, 0.08)} material={mat("#9CC9DA", { rough: 0.2 })} position={[0, y + (j ? 0.3 : 1.2), Z1 + 0.02]} />
              <mesh geometry={caixa(0.08, 1.3, PROF - 2)} material={mat("#9CC9DA", { rough: 0.2 })} position={[X0 - 0.02, y + (j ? 0.3 : 1.2), 0]} />
              <mesh geometry={caixa(0.08, 1.3, PROF - 2)} material={mat("#9CC9DA", { rough: 0.2 })} position={[X1 + 0.02, y + (j ? 0.3 : 1.2), 0]} />
              {j === 1 && <mesh geometry={caixa(LARG - 3, 1.3, 0.08)} material={mat("#9CC9DA", { rough: 0.2 })} position={[0, y + 0.3, Z0 - 0.02]} />}
            </group>
          ))}
        </>
      )}
      {/* ar-condicionado e caixa d'água na laje */}
      <mesh geometry={caixa(1.2, 0.7, 0.8)} material={mat("#D6D9DE", { rough: 0.7 })} position={[X1 - 2, h + 0.8, Z1 - 2]} castShadow />
      <mesh geometry={cilindro(0.8, 0.8, 1.1, 14)} material={mat("#E9ECF0", { rough: 0.7 })} position={[X0 + 2.2, h + 1.0, Z1 - 2.2]} castShadow />
    </group>
  );
}

function Toldo({ cor, h }: { cor: string; h: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#FFFFFF" : cor; g.fillRect(i * 32, 0, 32, 64); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
  }, [cor]);
  const larg = LARG - 2, prof = 2.2;
  return (
    <group position={[0, h - 1.3, Z0 - prof / 2]} rotation={[0.35, 0, 0]}>
      <mesh geometry={plano(larg, prof)} rotation={[-Math.PI / 2, 0, 0]} castShadow><meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.8} /></mesh>
      <mesh geometry={caixa(larg, 0.35, 0.04)} position={[0, -0.17, -prof / 2]}><meshStandardMaterial map={tex} roughness={0.8} /></mesh>
    </group>
  );
}

// Nome da empresa (texto 3D) sobre um painel escuro, com a logo ao lado quando tem
function Letreiro({ nome, cor, logo, y, z, largura }: { nome: string; cor: string; logo: string | null; y: number; z: number; largura: number }) {
  const texto = (nome.trim() || "Sua empresa").slice(0, 22);
  const tamanho = Math.min(0.78, (largura - (logo ? 2.2 : 0.8)) / Math.max(6, texto.length * 0.62));
  return (
    <group position={[0, y, z]}>
      <mesh geometry={caixa(largura, 1.5, 0.22)} material={mat("#1F2630", { rough: 0.9 })} castShadow />
      <mesh geometry={caixa(largura, 0.08, 0.26)} material={mat(cor, { emissive: cor, ei: 0.5 })} position={[0, -0.7, 0]} />
      {logo && <LogoPlano url={logo} position={[-largura / 2 + 0.95, 0, -0.14]} tamanho={1.15} />}
      <Text font={FONTE} fontSize={tamanho} anchorX="center" anchorY="middle" position={[logo ? 0.7 : 0, 0.02, -0.14]} color="#FFFFFF" maxWidth={largura - 1} rotation={[0, Math.PI, 0]}>
        {texto}
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.25} roughness={0.4} />
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

function InteriorFixo({ e, cor }: { e: Escritorio; cor: string }) {
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
  return (
    <group position={lugar.pos} rotation={[0, lugar.rot, 0]}>
      <BonecoProcedural ref={h} def={def} camisa={m.camisa} headset={m.papel === "atendente"} cracha={m.papel === "ceo" ? "#D4A017" : "#1D4ED8"} />
      <Html position={[0, 1.65, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div data-rotulo="" className="pointer-events-auto flex w-max cursor-pointer select-none flex-col items-center" onClick={(ev) => { ev.stopPropagation(); useMundo.getState().selecionarLote(chave); }}>
          <div className="rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-[#1D2128] shadow-md">{m.nome}<span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase text-white" style={{ background: m.papel === "ceo" ? "#D4A017" : m.papel === "atendente" ? "#16A34A" : "#1D4ED8" }}>{m.papel === "ceo" ? "CEO" : m.papel === "atendente" ? "Atendente" : m.cargo.slice(0, 14)}</span></div>
        </div>
      </Html>
    </group>
  );
}

// ---------- um escritório no lote ----------
function EscritorioLote({ chave, e, cor, nome, logo, fora }: { chave: string; e: Escritorio; cor: string; nome: string; logo: string | null; fora: boolean }) {
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const [x, z] = l.centro;
  const rot = frenteDoLote(l.k) + Math.PI; // nossa frente local é -z; frenteDoLote usa rot 0 = frente pra +z
  const planta = plantaCliente(e);
  const assinatura = JSON.stringify(e) + cor + nome + (logo ?? "");
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <group visible={fora}>
        <Estatico key={"f" + assinatura}><Exterior e={e} cor={cor} /></Estatico>
        <ExteriorExtras e={e} cor={cor} nome={nome} logo={logo} />
      </group>
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
