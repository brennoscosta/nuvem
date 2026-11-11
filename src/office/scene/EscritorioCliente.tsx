"use client";
// O escritório de um cliente no lote dele: prédio por fora (3 layouts, na cor e com a logo da empresa) e, na vista
// por dentro, a planta com recepção, sala do CEO e os setores que o dono escolheu — com a equipe sentada nas mesas.
// Enquanto o painel "Montar escritório" está aberto, desenha o rascunho ao vivo.
import * as THREE from "three";
import { useMemo, useRef, useState } from "react";
import { Html, Text } from "@react-three/drei";
import { caixa, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { Modelo, ComFallback, type NomeModelo } from "./Modelos";
import { Mesa, Sofa, Planta, Balcao, MesaBaixa, Quadro, Cafe } from "./Moveis";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle, type Pose } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { LOTE_POR_CHAVE, frenteDoLote } from "../data/mundo";
import { plantaCliente, PREDIO_CLIENTE, ALT_PAREDE_CLIENTE, LAYOUT, type Escritorio, type Membro, type SalaCliente } from "../data/escritorio";
import { useMundo } from "../mundoStore";
import { usePersonagem } from "../personagemStore";
import { useEscritorio } from "../store";

const FONTE = "/fonts/inter-700.woff";
const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = PREDIO_CLIENTE;
const LARG = X1 - X0, PROF = Z1 - Z0;

// ---------- lado de fora ----------
// Prédio gerado no Higgsfield (GLB normalizado: altura 1, base em y=0; frente do Tripo olha pra +x → giramos pra -z)
function Exterior({ e, cor, nome, logo }: { e: Escritorio; cor: string; nome: string; logo: string | null }) {
  const L = LAYOUT[e.layout];
  return (
    <group>
      <mesh geometry={caixa(LARG + 1.2, 0.16, PROF + 1.2)} material={mat("#D8D4CC", { rough: 0.95 })} position={[0, 0.08, 0]} receiveShadow />
      <ComFallback fallback={<mesh geometry={caixa(LARG, L.altura * 0.8, PROF)} material={mat("#F1EFEA", { rough: 0.9 })} position={[0, L.altura * 0.4 + 0.16, 0]} />}>
        <Modelo nome={L.modelo as NomeModelo} position={[0, 0.16, 0]} rotation={Math.PI / 2} altura={L.altura} />
      </ComFallback>
      <Letreiro nome={nome} cor={cor} logo={logo} y={L.letreiro.y} z={L.letreiro.z} largura={L.letreiro.largura} />
    </group>
  );
}

// Nome da empresa (texto 3D) sobre um painel escuro, com a logo ao lado quando tem
function Letreiro({ nome, cor, logo, y, z, largura }: { nome: string; cor: string; logo: string | null; y: number; z: number; largura: number }) {
  const texto = (nome.trim() || "Sua empresa").slice(0, 22);
  const tamanho = Math.min(0.78, (largura - (logo ? 2.2 : 0.8)) / Math.max(6, texto.length * 0.62));
  return (
    <group position={[0, y, z]}>
      <mesh geometry={caixa(largura, 1.3, 0.16)} material={mat("#1F2630", { rough: 0.9 })} castShadow />
      <mesh geometry={caixa(largura, 0.07, 0.2)} material={mat(cor, { emissive: cor, ei: 0.5 })} position={[0, -0.6, 0]} />
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
  // NPC: sem balão de nome (só com o mouse em cima). Clicar: quem tem personagem abre a loja; quem não tem, cria o seu.
  const clicar = () => { if (!usePersonagem.getState().ativo) { usePersonagem.getState().abrir("montar"); return; } useMundo.getState().selecionarLote(chave); };
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
  const rot = frenteDoLote(l.k) + Math.PI; // nossa frente local é -z; frenteDoLote usa rot 0 = frente pra +z
  const planta = plantaCliente(e);
  const assinatura = JSON.stringify(e) + cor + nome + (logo ?? "");
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <group visible={fora}><Exterior e={e} cor={cor} nome={nome} logo={logo} /></group>
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
