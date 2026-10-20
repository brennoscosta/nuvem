"use client";
// Piso, paredes, salas e a parede "Nuvem" em letras 3D.
import * as THREE from "three";
import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { SALAS, salaGerente, MESAS, PONTOS, PREDIO, type Sala } from "../data/layout";
import { AREAS } from "../data/org";
import { caixa, capsula, cilindro, esfera, mat, plano, COR } from "./geo";
import { Balcao, Cadeira, Copa, Elevador, Fliperama, Impressora, Mesa, MesaBaixa, MesaReuniao, Planta, Puff, Quadro, Sinuca, Sirene, Sofa } from "./Moveis";
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

// Ícone de nuvem em 3D (esferas sobre uma base arredondada) — a marca, sem depender do SVG traçado
export function IconeNuvem({ position, escala = 1, cor = "#FFFFFF", ei = 0.25 }: { position: [number, number, number]; escala?: number; cor?: string; ei?: number }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4, emissive: cor, emissiveIntensity: ei }), [cor, ei]);
  return (
    <group position={position} scale={escala}>
      <mesh geometry={esfera(0.42, 24)} material={m} position={[0.05, 0.62, 0]} castShadow />
      <mesh geometry={esfera(0.3, 20)} material={m} position={[-0.42, 0.42, 0]} castShadow />
      <mesh geometry={esfera(0.32, 20)} material={m} position={[0.5, 0.44, 0]} castShadow />
      <mesh geometry={capsula(0.26, 0.75)} material={m} position={[0.02, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
    </group>
  );
}

// Letreiro "Nuvem": texto limpo com profundidade (camadas) + ícone de nuvem, sobre painel escuro iluminado
export function LetreiroNuvem({ largura = 7.8, altura = 2.6, tamanho = 1.05, cor = "#FFFFFF", fundo = true }: { largura?: number; altura?: number; tamanho?: number; cor?: string; fundo?: boolean }) {
  const camadas = 6;
  return (
    <group>
      {fundo && (
        <>
          <mesh geometry={caixa(largura, altura, 0.28)} material={mat("#1F2630", { rough: 0.95 })} position={[0, altura / 2 + 0.2, 0]} receiveShadow />
          {Array.from({ length: Math.round(largura / 0.3) }).map((_, i) => (
            <mesh key={i} geometry={caixa(0.06, altura - 0.2, 0.03)} material={mat("#2C3544", { rough: 0.9 })} position={[-largura / 2 + 0.3 + i * 0.3, altura / 2 + 0.2, 0.15]} />
          ))}
          <mesh geometry={caixa(largura, 0.08, 0.3)} material={mat("#4F7DF3", { emissive: "#4F7DF3", ei: 0.6 })} position={[0, 0.3, 0]} />
        </>
      )}
      <IconeNuvem position={[-tamanho * 2.55, altura / 2 - tamanho * 0.45 + 0.2, 0.2]} escala={tamanho * 0.95} cor={cor} />
      {/* camadas de trás pra frente dão a profundidade; a da frente é branca e levemente emissiva */}
      {Array.from({ length: camadas }).map((_, i) => {
        const frente = i === camadas - 1;
        return (
          <Text key={i} font={FONTE} fontSize={tamanho} letterSpacing={-0.02} anchorX="center" anchorY="middle" position={[tamanho * 0.55, altura / 2 + 0.2, 0.16 + i * 0.035]} color={frente ? cor : "#8EA3C7"}>
            Nuvem
            {frente ? <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={0.3} roughness={0.4} /> : <meshStandardMaterial color="#7F93B5" roughness={0.6} />}
          </Text>
        );
      })}
      <pointLight position={[-2, altura * 0.7, 1.3]} intensity={5} distance={7} color="#DCE8FF" />
      <pointLight position={[2, altura * 0.7, 1.3]} intensity={5} distance={7} color="#DCE8FF" />
    </group>
  );
}

function ParedeNuvem() {
  return <group position={[-14, 0, -8.9]}><LetreiroNuvem /></group>;
}

function Luminaria({ position, r = 0.8 }: { position: [number, number, number]; r?: number }) {
  return <mesh geometry={new THREE.TorusGeometry(r, 0.05, 8, 40)} material={mat("#FFFFFF", { emissive: "#FFF4D6", ei: 1.4 })} position={position} rotation={[Math.PI / 2, 0, 0]} />;
}

// Estante de livros (hall/biblioteca do 1º andar)
function Estante({ position, rotation = 0, largura = 2.4 }: { position: [number, number, number]; rotation?: number; largura?: number }) {
  const cores = ["#E2575B", "#4F7DF3", "#22A86B", "#D9A23A", "#8B6CF0", "#F2913D", "#3FBFA8", "#EC6B8D"];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(largura, 2.1, 0.35)} material={mat("#8D6E63", { rough: 0.85 })} position={[0, 1.05, 0]} castShadow />
      {[0.45, 0.95, 1.45, 1.95].map((y) => <mesh key={y} geometry={caixa(largura - 0.1, 0.04, 0.33)} material={mat("#A1887F")} position={[0, y, 0.01]} />)}
      {[0.45, 0.95, 1.45].flatMap((y, r) => Array.from({ length: Math.floor((largura - 0.3) / 0.16) }).map((_, i) => (
        <mesh key={`${r}-${i}`} geometry={caixa(0.12, 0.3 + ((i * 7 + r) % 3) * 0.05, 0.22)} material={mat(cores[(i + r * 3) % cores.length], { rough: 0.9 })} position={[-largura / 2 + 0.25 + i * 0.16, y + 0.19, 0.03]} />
      )))}
    </group>
  );
}

// Auditório: telão no fundo, palco baixo e fileiras de cadeiras viradas pra ele
function Auditorio({ s }: { s: Sala }) {
  const cx = (s.x0 + s.x1) / 2, fundo = s.z1; // sala ao sul: fundo em z1
  const cadeiras: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) cadeiras.push([s.x0 + 1.1 + c * 1.0, fundo - 2.6 - r * 1.1]);
  return (
    <group>
      <mesh geometry={caixa(s.x1 - s.x0 - 0.6, 0.18, 1.8)} material={mat("#4A4E55", { rough: 0.8 })} position={[cx, 0.09, fundo - 1.1]} receiveShadow />
      <mesh geometry={caixa(4.6, 2.3, 0.08)} material={mat(COR.preto, { rough: 0.3 })} position={[cx, 1.7, fundo - 0.14]} />
      <mesh geometry={caixa(4.4, 2.1, 0.02)} material={mat("#CFE6FF", { emissive: "#7FB4FF", ei: 0.6 })} position={[cx, 1.7, fundo - 0.09]} />
      <mesh geometry={caixa(0.6, 1.1, 0.4)} material={mat("#B07A4A", { rough: 0.8 })} position={[s.x1 - 1.6, 0.73, fundo - 1.2]} castShadow />
      {cadeiras.map(([x, z], i) => <Cadeira key={i} position={[x, 0, z]} cor={i % 2 ? "#5C6BC0" : "#3F51B5"} />)}
      <Planta position={[s.x0 + 0.6, 0, fundo - 0.6]} />
      <Planta position={[s.x1 - 0.6, 0, s.z0 + 0.6]} />
    </group>
  );
}

const DX = -18; // a ala oeste foi desenhada com o prédio centrado em 0; agora ela vai de -36 a 0

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
  const { x0, x1 } = PREDIO;

  return (
    <group>
      {/* chão geral + corredor */}
      <mesh geometry={plano(x1 - x0, 3.2)} material={mat("#E6E3DC", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow />
      {SALAS.map((s) => <Piso key={s.id} s={s} />)}
      {SALAS.map((s) => <Etiqueta key={s.id} s={s} />)}

      {/* paredes externas */}
      <Parede de={[x0, -9]} ate={[x1, -9]} altura={2.6} espessura={0.2} />
      <Parede de={[x0, -9]} ate={[x0, -3.2]} altura={ALT_PAREDE} espessura={0.2} />
      <Parede de={[x0, -0.8]} ate={[x0, 9]} altura={ALT_PAREDE} espessura={0.2} />
      {/* porta de vidro da entrada (lado oeste, junto à recepção) */}
      <mesh geometry={caixa(0.06, 2.2, 2.4)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.35 })} position={[x0, 1.1, -2]} />
      <mesh geometry={caixa(0.12, 2.3, 0.08)} material={mat(COR.preto)} position={[x0, 1.15, -2]} />
      <Parede de={[x1, -9]} ate={[x1, 9]} altura={ALT_PAREDE} espessura={0.2} />
      <Parede de={[x0, 9]} ate={[x1, 9]} altura={ALT_PAREDE} espessura={0.2} />

      {/* divisórias entre salas (deixando a abertura pro corredor) */}
      {SALAS.map((s) => {
        const norte = s.z1 <= 0;
        const zc = norte ? s.z1 : s.z0; // lado do corredor
        const zf = norte ? s.z0 : s.z1; // fundo
        const vidro = !!s.vidro;
        return (
          <group key={s.id}>
            {s.x0 > x0 && <Parede de={[s.x0, zf]} ate={[s.x0, zc]} vidro={vidro} />}
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

      {/* auditório (ala leste) */}
      {SALAS.filter((s) => s.tipo === "auditorio").map((s) => <Auditorio key={s.id} s={s} />)}

      {/* corredor: faixa central, colunas, luminárias, jardineiras e banquinhos (dá vida à circulação) */}
      <mesh geometry={plano(x1 - x0 - 0.4, 0.7)} material={mat("#F3F0E9", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} />
      {[-27, -18, -9, 0, 9, 18, 27].map((x) => <mesh key={x} geometry={cilindro(0.18, 0.18, 2.8, 12)} material={mat("#CFD3D9", { rough: 0.6 })} position={[x, 1.4, 0]} castShadow />)}
      {[-31.5, -22.5, -13.5, -4.5, 4.5, 13.5, 22.5, 31.5].map((x) => <Luminaria key={x} position={[x, 2.75, 0]} r={0.6} />)}
      {[-27, -18, -9, 0, 9, 18, 27].map((x) => (
        <group key={"j" + x}>
          <mesh geometry={caixa(1.1, 0.42, 0.42)} material={mat("#D8D3CA", { rough: 0.9 })} position={[x, 0.21, -1.25]} castShadow />
          <Planta position={[x - 0.3, 0.3, -1.25]} pequena /><Planta position={[x + 0.3, 0.3, -1.25]} pequena />
          <mesh geometry={caixa(1.1, 0.42, 0.42)} material={mat("#D8D3CA", { rough: 0.9 })} position={[x, 0.21, 1.25]} castShadow />
          <Planta position={[x - 0.3, 0.3, 1.25]} pequena /><Planta position={[x + 0.3, 0.3, 1.25]} pequena />
        </group>
      ))}
      {[-22.5, -4.5, 13.5, 31.5].map((x) => <Puff key={"p" + x} position={[x, 0, 1.2]} cor={["#FFD600", "#40C4FF", "#FF4081", "#64DD17"][Math.abs(Math.round(x / 9)) % 4]} r={0.3} />)}
      {[-13.5, 4.5, 22.5].map((x) => <Puff key={"q" + x} position={[x, 0, -1.2]} cor={["#64DD17", "#FFD600", "#40C4FF"][Math.abs(Math.round(x / 9)) % 3]} r={0.3} />)}
      {/* tapete da recepção */}
      <mesh geometry={plano(5.5, 3.2)} material={mat("#4F7DF3", { rough: 1, opacity: 0.35 })} rotation={[-Math.PI / 2, 0, 0]} position={[-32.5, 0.004, -4]} />

      {/* móveis fixos da ala oeste (desenhados com o prédio centrado; deslocados em DX) */}
      <group position={[DX, 0, 0]}>
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
        <Luminaria position={[-14, 2.75, -3.2]} r={0.9} />

        {/* reunião, CEO, diretoria */}
        <MesaReuniao />
        <Quadro position={[16.5, 1.5, -8.88]} largura={2.4} />
        <Planta position={[12.7, 0, -8.2]} />
        <Sofa position={[17.0, 0, -4.0]} rotation={-Math.PI / 2} cor="#8D6E63" largura={1.6} />
        <Planta position={[5.4, 0, 8.3]} />
        <Quadro position={[0.08, 1.0, 5.3]} rotation={Math.PI / 2} largura={2.4} />

        {/* copa */}
        <Copa />

        {/* lounge & jogos (+ cantinho de leitura) */}
        <Sofa position={[13.5, 0, 7.2]} rotation={Math.PI} cor="#7C4DFF" largura={2.2} />
        <Puff position={[12.2, 0, 5.3]} cor="#64DD17" />
        <Puff position={[14.8, 0, 5.4]} cor="#FF4081" />
        <MesaBaixa position={[13.5, 0, 5.4]} />
        <Planta position={[17.3, 0, 8.3]} />
        <Estante position={[11.6, 0, 8.72]} rotation={0} largura={1.6} />
        <Luminaria position={[14.5, 2.75, 5.5]} r={1.2} />
        <Luminaria position={[14.5, 2.4, 5.5]} r={0.7} />
        {/* TV do lounge */}
        <mesh geometry={caixa(0.06, 1.1, 2.0)} material={mat(COR.preto, { rough: 0.3 })} position={[17.9, 1.8, 6.5]} />
        <mesh geometry={caixa(0.01, 1.0, 1.9)} material={mat("#CFE6FF", { emissive: "#7FB4FF", ei: 0.7 })} position={[17.86, 1.8, 6.5]} />
      </group>
      {/* sinuca e fliperama usam PONTOS (já deslocados) */}
      <Sinuca position={PONTOS.loungeSinuca} rotation={0} />
      <Fliperama position={PONTOS.loungeFliperama} rotation={Math.PI} />
    </group>
  );
}
