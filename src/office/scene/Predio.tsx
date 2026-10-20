"use client";
// Piso, paredes, salas e a parede "Nuvem" em letras 3D.
import * as THREE from "three";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { SALAS, salaGerente, MESAS, PONTOS, type Sala } from "../data/layout";
import { AREAS } from "../data/org";
import { caixa, cilindro, mat, plano, COR } from "./geo";
import { Balcao, Copa, Elevador, Fliperama, Impressora, Mesa, MesaBaixa, MesaReuniao, Planta, Puff, Quadro, Sinuca, Sirene, Sofa } from "./Moveis";
import { useEscritorio } from "../store";

const FONTE = "/fonts/inter-700.woff";
const ALT_PAREDE = 1.15;

function Parede({ de, ate, altura = ALT_PAREDE, vidro = false, espessura = 0.12 }: { de: [number, number]; ate: [number, number]; altura?: number; vidro?: boolean; espessura?: number }) {
  const dx = ate[0] - de[0], dz = ate[1] - de[1];
  const len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const cx = (de[0] + ate[0]) / 2, cz = (de[1] + ate[1]) / 2;
  if (vidro) {
    return (
      <group position={[cx, 0, cz]} rotation={[0, ang, 0]}>
        <mesh geometry={caixa(espessura, 0.1, len)} material={mat(COR.preto, { rough: 0.5 })} position={[0, 0.05, 0]} />
        <mesh geometry={caixa(0.04, 2.2, len)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.28 })} position={[0, 1.1, 0]} />
        <mesh geometry={caixa(espessura, 0.08, len)} material={mat(COR.preto, { rough: 0.5 })} position={[0, 2.2, 0]} />
        {Array.from({ length: Math.max(1, Math.round(len / 1.6)) + 1 }).map((_, i) => (
          <mesh key={i} geometry={caixa(0.08, 2.2, 0.06)} material={mat(COR.preto, { rough: 0.5 })} position={[0, 1.1, -len / 2 + (i * len) / Math.max(1, Math.round(len / 1.6))]} />
        ))}
      </group>
    );
  }
  return <mesh geometry={caixa(espessura, altura, len)} material={mat("#F4F1EB", { rough: 0.9 })} position={[cx, altura / 2, cz]} rotation={[0, ang, 0]} castShadow receiveShadow />;
}

function Piso({ s }: { s: Sala }) {
  const w = s.x1 - s.x0, d = Math.abs(s.z1 - s.z0);
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  return <mesh geometry={plano(w, d)} material={mat(s.piso, { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.001, cz]} receiveShadow />;
}

function Etiqueta({ s }: { s: Sala }) {
  const norte = s.z1 <= 0;
  const cx = (s.x0 + s.x1) / 2, z = norte ? s.z1 + 0.9 : s.z0 - 0.9;
  const cor = s.area ? AREAS[s.area].cor : "#5B6472";
  return (
    <group position={[cx, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={plano(s.nome.length * 0.26 + 0.6, 0.5)} material={mat(cor, { rough: 0.9 })} />
      <Text font={FONTE} fontSize={0.3} color="#FFFFFF" anchorX="center" anchorY="middle" position={[0, 0, 0.01]}>
        {s.nome.toUpperCase()}
      </Text>
    </group>
  );
}

// Parede com "Nuvem" em letras 3D (SVG do logo extrudado)
function ParedeNuvem() {
  const svg = useLoader(SVGLoader, "/brand/nuvem.svg");
  const geo = useMemo(() => {
    const shapes = svg.paths.flatMap((p) => p.toShapes());
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 60, bevelEnabled: true, bevelThickness: 6, bevelSize: 4, bevelSegments: 2 });
    g.computeBoundingBox();
    const b = g.boundingBox!; const w = b.max.x - b.min.x;
    const esc = 5.2 / w; // 5,2 m de largura
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, 0);
    g.scale(esc, -esc, esc); // SVG tem y pra baixo
    g.computeVertexNormals();
    return g;
  }, [svg]);
  return (
    <group position={[-14, 0, -8.9]}>
      {/* painel de fundo em pedra escura + faixa colorida */}
      <mesh geometry={caixa(7.6, 2.5, 0.25)} material={mat("#2A3340", { rough: 0.95 })} position={[0, 1.5, 0]} receiveShadow />
      <mesh geometry={caixa(7.6, 0.08, 0.27)} material={mat("#4F7DF3", { emissive: "#4F7DF3", ei: 0.4 })} position={[0, 0.3, 0]} />
      <mesh geometry={geo} material={mat("#FFFFFF", { rough: 0.35 })} position={[0, 1.65, 0.16]} castShadow />
      {/* spots */}
      {[-2.2, 0, 2.2].map((x) => <spotLight key={x} position={[x, 2.9, 1.6]} target-position={[x, 1.4, 0]} angle={0.7} penumbra={0.6} intensity={6} color="#FFF3E0" />)}
    </group>
  );
}

function Luminaria({ position, r = 0.8 }: { position: [number, number, number]; r?: number }) {
  return <mesh geometry={new THREE.TorusGeometry(r, 0.05, 8, 40)} material={mat("#FFFFFF", { emissive: "#FFF4D6", ei: 1.4 })} position={position} rotation={[Math.PI / 2, 0, 0]} />;
}

export function Predio() {
  const agentes = useEscritorio((s) => s.agentes);
  const sirene = useEscritorio((s) => s.sirene);
  const mesasLigadas = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const a of Object.values(agentes)) m.set(a.mesaId, a.status === "trabalhando");
    return m;
  }, [agentes]);
  const corDaMesa = (sala: string) => { const s = SALAS.find((x) => x.id === sala); return s?.area ? AREAS[s.area].cor : "#D9A23A"; };
  const areaAtiva = (sala: string) => Object.values(agentes).some((a) => a.sala === sala && a.status === "trabalhando");

  return (
    <group>
      {/* chão geral + corredor */}
      <mesh geometry={plano(36, 3.2)} material={mat("#E6E3DC", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow />
      {SALAS.map((s) => <Piso key={s.id} s={s} />)}
      {SALAS.map((s) => <Etiqueta key={s.id} s={s} />)}

      {/* paredes externas */}
      <Parede de={[-18, -9]} ate={[18, -9]} altura={2.6} espessura={0.2} />
      <Parede de={[-18, -9]} ate={[-18, -3.2]} altura={ALT_PAREDE} espessura={0.2} />
      <Parede de={[-18, -0.8]} ate={[-18, 9]} altura={ALT_PAREDE} espessura={0.2} />
      {/* porta de vidro da entrada (lado oeste, junto à recepção) */}
      <mesh geometry={caixa(0.06, 2.2, 2.4)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.35 })} position={[-18, 1.1, -2]} />
      <mesh geometry={caixa(0.12, 2.3, 0.08)} material={mat(COR.preto)} position={[-18, 1.15, -2]} />
      <Parede de={[18, -9]} ate={[18, 9]} altura={ALT_PAREDE} espessura={0.2} />
      <Parede de={[-18, 9]} ate={[18, 9]} altura={ALT_PAREDE} espessura={0.2} />

      {/* divisórias entre salas (deixando a abertura pro corredor) */}
      {SALAS.map((s) => {
        const norte = s.z1 <= 0;
        const zc = norte ? s.z1 : s.z0; // lado do corredor
        const zf = norte ? s.z0 : s.z1; // fundo
        const vidro = !!s.vidro;
        return (
          <group key={s.id}>
            {s.x0 > -18 && <Parede de={[s.x0, zf]} ate={[s.x0, zc]} vidro={vidro} />}
            {/* parede do corredor com abertura central de 2,4 m */}
            <Parede de={[s.x0, zc]} ate={[(s.x0 + s.x1) / 2 - 1.2, zc]} vidro={vidro} />
            <Parede de={[(s.x0 + s.x1) / 2 + 1.2, zc]} ate={[s.x1, zc]} vidro={vidro} />
            {/* sala de vidro do gerente */}
            {s.tipo === "area" && (() => { const g = salaGerente(s); const zg = norte ? g.z1 : g.z0; return (
              <group>
                <Parede de={[g.x0, Math.min(g.z0, g.z1)]} ate={[g.x0, Math.max(g.z0, g.z1)]} vidro />
                <Parede de={[g.x0, zg]} ate={[g.x0 + 1.0, zg]} vidro />
                <Parede de={[g.x0 + 2.2, zg]} ate={[g.x1, zg]} vidro />
              </group>); })()}
          </group>
        );
      })}

      {/* mesas */}
      {MESAS.map((m) => <Mesa key={m.id} def={m} ligada={!!mesasLigadas.get(m.id)} cor={corDaMesa(m.sala)} />)}

      {/* equipamentos por área: impressora + planta + quadro */}
      {SALAS.filter((s) => s.tipo === "area").map((s) => {
        const norte = s.z1 <= 0; const zf = norte ? s.z0 : s.z1; const d = norte ? 1 : -1;
        return (
          <group key={s.id}>
            <Impressora position={[s.x0 + 0.5, 0, zf + d * 0.6]} rotation={norte ? 0 : Math.PI} ativa={areaAtiva(s.id)} />
            <Planta position={[s.x0 + 0.6, 0, zf + d * 7.0]} />
            {norte
              ? <Quadro position={[(s.x0 + s.x1) / 2, 1.5, zf + 0.11]} rotation={0} cor={AREAS[s.area!].piso} />
              : <Quadro position={[s.x0 + 0.08, 1.0, (zf + 1.6) / 2 + 1.2]} rotation={Math.PI / 2} largura={1.6} cor={AREAS[s.area!].piso} />}
          </group>
        );
      })}

      {/* recepção */}
      <ParedeNuvem />
      <Elevador />
      <Balcao />
      <Sofa position={[-11.2, 0, -3.2]} rotation={-Math.PI / 2} cor="#FF7043" largura={2} />
      <MesaBaixa position={[-12.6, 0, -3.2]} />
      <Puff position={[-13.8, 0, -4.2]} cor="#40C4FF" />
      <Puff position={[-13.8, 0, -2.4]} cor="#FFD600" />
      <Planta position={[-10.6, 0, -8.2]} />
      <Sirene ligada={sirene} position={[-17.5, ALT_PAREDE + 0.05, -2.4]} />
      <Luminaria position={[-14, 2.75, -5]} r={1.1} />

      {/* reunião, CEO, diretoria */}
      <MesaReuniao />
      <Quadro position={[16.5, 1.5, -8.88]} largura={2.4} />
      <Planta position={[12.7, 0, -8.2]} />
      <Sofa position={[17.0, 0, -4.0]} rotation={-Math.PI / 2} cor="#8D6E63" largura={1.6} />
      <Planta position={[5.4, 0, 8.3]} />
      <Quadro position={[0.08, 1.0, 5.3]} rotation={Math.PI / 2} largura={2.4} />

      {/* copa */}
      <Copa />

      {/* lounge & jogos */}
      <Sinuca position={PONTOS.loungeSinuca} rotation={0} />
      <Fliperama position={PONTOS.loungeFliperama} rotation={Math.PI} />
      <Sofa position={[13.5, 0, 7.2]} rotation={Math.PI} cor="#7C4DFF" largura={2.2} />
      <Puff position={[12.2, 0, 5.3]} cor="#64DD17" />
      <Puff position={[14.8, 0, 5.4]} cor="#FF4081" />
      <MesaBaixa position={[13.5, 0, 5.4]} />
      <Planta position={[17.3, 0, 8.3]} />
      <Luminaria position={[14.5, 2.75, 5.5]} r={1.2} />
      <Luminaria position={[14.5, 2.4, 5.5]} r={0.7} />
      {/* TV do lounge */}
      <mesh geometry={caixa(0.06, 1.1, 2.0)} material={mat(COR.preto, { rough: 0.3 })} position={[17.9, 1.8, 6.5]} />
      <mesh geometry={caixa(0.01, 1.0, 1.9)} material={mat("#CFE6FF", { emissive: "#7FB4FF", ei: 0.7 })} position={[17.86, 1.8, 6.5]} />

      {/* colunas e luminárias do corredor */}
      {[-9, 0, 9].map((x) => <mesh key={x} geometry={cilindro(0.18, 0.18, 2.8, 12)} material={mat("#CFD3D9", { rough: 0.6 })} position={[x, 1.4, 0]} castShadow />)}
      {[-13.5, -4.5, 4.5, 13.5].map((x) => <Luminaria key={x} position={[x, 2.75, 0]} r={0.6} />)}
    </group>
  );
}
