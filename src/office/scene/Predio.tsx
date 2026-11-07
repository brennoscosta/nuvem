"use client";
// Piso, paredes, salas, móveis e o letreiro "Nuvem" da recepção.
// Tudo que é fixo vai pro <Estatico> (vira poucas malhas). Fora dele: os textos (letreiro e nomes das salas)
// e o que muda com o trabalho dos agentes (telas acesas, impressoras imprimindo, sirene).
import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { SALAS, salaGerente, MESAS, PONTOS, PREDIO, RAIO_REUNIAO, type Sala } from "../data/layout";
import { AREAS } from "../data/org";
import { caixa, capsula, cilindro, esfera, mat, plano, COR } from "./geo";
import { Balcao, Cafe, Impressora, ImpressoraAtiva, Mesa, MesaBaixa, MesaReuniao, Planta, Puff, Quadro, Sirene, Sofa, TelasAcesas } from "./Moveis";
import { Estatico } from "./Estatico";
import { useEscritorio } from "../store";

const FONTE = "/fonts/inter-700.woff";
export const ALT_PAREDE = 1.15;

function Parede({ de, ate, altura = ALT_PAREDE, vidro = false, espessura = 0.12 }: { de: [number, number]; ate: [number, number]; altura?: number; vidro?: boolean; espessura?: number }) {
  const dx = ate[0] - de[0], dz = ate[1] - de[1];
  const len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const cx = (de[0] + ate[0]) / 2, cz = (de[1] + ate[1]) / 2;
  if (vidro) {
    const n = Math.max(1, Math.round(len / 1.6));
    return (
      <group position={[cx, 0, cz]} rotation={[0, ang, 0]}>
        <mesh geometry={caixa(espessura, 0.1, len)} material={mat(COR.preto, { rough: 0.5 })} position={[0, 0.05, 0]} />
        <mesh geometry={caixa(0.04, 2.2, len)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.28 })} position={[0, 1.1, 0]} />
        <mesh geometry={caixa(espessura, 0.08, len)} material={mat(COR.preto, { rough: 0.5 })} position={[0, 2.2, 0]} />
        {Array.from({ length: n + 1 }).map((_, i) => (
          <mesh key={i} geometry={caixa(0.08, 2.2, 0.06)} material={mat(COR.preto, { rough: 0.5 })} position={[0, 1.1, -len / 2 + (i * len) / n]} />
        ))}
      </group>
    );
  }
  return <mesh geometry={caixa(espessura, altura, len)} material={mat("#F4F1EB", { rough: 0.9 })} position={[cx, altura / 2, cz]} rotation={[0, ang, 0]} castShadow receiveShadow />;
}

function Piso({ s }: { s: Sala }) {
  const w = s.x1 - s.x0, d = Math.abs(s.z1 - s.z0);
  return <mesh geometry={plano(w, d)} material={mat(s.piso, { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[(s.x0 + s.x1) / 2, 0.001, (s.z0 + s.z1) / 2]} receiveShadow />;
}

// Placa com o nome da sala, pintada no chão do corredor em frente à porta (a parte fixa; o texto vai em TextosPredio).
// As das salas do sul ficam no meio do corredor: coladas na parede, a própria parede esconde a placa da câmera.
const posEtiqueta = (s: Sala): [number, number, number] => [(s.x0 + s.x1) / 2, 0.012, s.z1 <= 0 ? s.z1 + 0.85 : s.z0 - 1.6];
const corEtiqueta = (s: Sala) => (s.area ? AREAS[s.area].cor : "#5B6472");
function PlacaEtiqueta({ s }: { s: Sala }) {
  return <mesh geometry={plano(s.nome.length * 0.26 + 0.6, 0.5)} material={mat(corEtiqueta(s), { rough: 0.9 })} position={posEtiqueta(s)} rotation={[-Math.PI / 2, 0, 0]} />;
}

// ---------- marca ----------
// Ícone de nuvem em 3D (esferas sobre uma base arredondada)
export function IconeNuvem({ position, escala = 1, cor = "#FFFFFF", ei = 0.25 }: { position: [number, number, number]; escala?: number; cor?: string; ei?: number }) {
  const m = mat(cor, { rough: 0.4, emissive: cor, ei });
  return (
    <group position={position} scale={escala}>
      <mesh geometry={esfera(0.42, 24)} material={m} position={[0.05, 0.62, 0]} castShadow />
      <mesh geometry={esfera(0.3, 20)} material={m} position={[-0.42, 0.42, 0]} castShadow />
      <mesh geometry={esfera(0.32, 20)} material={m} position={[0.5, 0.44, 0]} castShadow />
      <mesh geometry={capsula(0.26, 0.75)} material={m} position={[0.02, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
    </group>
  );
}

// Letreiro "Nuvem" = painel escuro (opcional) + ícone (parte fixa) + texto com profundidade (LetreiroTexto, fora do Estatico)
export function LetreiroFixo({ largura = 7.8, altura = 2.6, tamanho = 1.05, cor = "#FFFFFF", fundo = true }: { largura?: number; altura?: number; tamanho?: number; cor?: string; fundo?: boolean }) {
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
    </group>
  );
}
export function LetreiroTexto({ altura = 2.6, tamanho = 1.05, cor = "#FFFFFF" }: { altura?: number; tamanho?: number; cor?: string }) {
  // 3 camadas (de trás pra frente) dão a profundidade; a da frente é branca e levemente emissiva
  const camadas = [0.16, 0.25, 0.335];
  return (
    <group>
      {camadas.map((z, i) => {
        const frente = i === camadas.length - 1;
        return (
          <Text key={i} font={FONTE} fontSize={tamanho} letterSpacing={-0.02} anchorX="center" anchorY="middle" position={[tamanho * 0.55, altura / 2 + 0.2, z]} color={frente ? cor : "#8EA3C7"}>
            Nuvem
            {frente ? <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={0.3} roughness={0.4} /> : <meshStandardMaterial color="#7F93B5" roughness={0.6} />}
          </Text>
        );
      })}
    </group>
  );
}

// letreiro da parede do fundo da recepção, atrás da recepcionista
const LETREIRO_RECEPCAO = { pos: [-6, 0.95, -8.88] as [number, number, number], largura: 4.8, altura: 1.5, tamanho: 0.62 };

// ---------- tudo que não se mexe ----------
function PredioFixo() {
  const { x0, x1, z0, z1 } = PREDIO;
  const corDaMesa = (sala: string) => { const s = SALAS.find((x) => x.id === sala); return s?.area ? AREAS[s.area].cor : "#D9A23A"; };
  return (
    <group>
      {/* chão do corredor + pisos das salas + placas */}
      <mesh geometry={plano(x1 - x0, 3.2)} material={mat("#E6E3DC", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow />
      <mesh geometry={plano(x1 - x0 - 0.4, 0.7)} material={mat("#F3F0E9", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow />
      {SALAS.map((s) => <Piso key={s.id} s={s} />)}
      {SALAS.map((s) => <PlacaEtiqueta key={s.id} s={s} />)}

      {/* paredes externas: a do fundo (norte) é alta; as outras são baixas pra câmera ver dentro */}
      <Parede de={[x0, z0]} ate={[x1, z0]} altura={2.6} espessura={0.2} />
      <Parede de={[x0, z0]} ate={[x0, -3.2]} espessura={0.2} />
      <Parede de={[x0, -0.8]} ate={[x0, z1]} espessura={0.2} />
      {/* porta de vidro da entrada (oeste) */}
      <mesh geometry={caixa(0.06, 2.2, 2.4)} material={mat(COR.vidro, { rough: 0.1, opacity: 0.35 })} position={[x0, 1.1, -2]} />
      <mesh geometry={caixa(0.12, 2.3, 0.08)} material={mat(COR.preto)} position={[x0, 1.15, -2]} />
      <Parede de={[x1, z0]} ate={[x1, z1]} espessura={0.2} />
      <Parede de={[x0, z1]} ate={[x1, z1]} espessura={0.2} />

      {/* divisórias entre salas e paredes do corredor (com a porta de 2,4 m no meio) */}
      {SALAS.map((s) => {
        const norte = s.z1 <= 0;
        const zc = norte ? s.z1 : s.z0; // lado do corredor
        const zf = norte ? s.z0 : s.z1; // fundo
        const vidro = !!s.vidro;
        return (
          <group key={s.id}>
            {s.x0 > x0 && <Parede de={[s.x0, zf]} ate={[s.x0, zc]} vidro={vidro} />}
            <Parede de={[s.x0, zc]} ate={[(s.x0 + s.x1) / 2 - 1.2, zc]} vidro={vidro} />
            <Parede de={[(s.x0 + s.x1) / 2 + 1.2, zc]} ate={[s.x1, zc]} vidro={vidro} />
            {/* sala de vidro do sênior, no canto do fundo */}
            {s.tipo === "area" && (() => { const g = salaGerente(s); const zg = norte ? g.z1 : g.z0; return (
              <group>
                <Parede de={[g.x0, Math.min(g.z0, g.z1)]} ate={[g.x0, Math.max(g.z0, g.z1)]} vidro />
                <Parede de={[g.x0, zg]} ate={[g.x0 + 1.0, zg]} vidro />
                <Parede de={[g.x0 + 2.2, zg]} ate={[g.x1, zg]} vidro />
              </group>); })()}
          </group>
        );
      })}

      {/* mesas (a tela acesa é desenhada à parte, só quando alguém trabalha) */}
      {MESAS.filter((m) => m.tipo !== "balcao").map((m) => <Mesa key={m.id} def={m} cor={corDaMesa(m.sala)} />)}

      {/* equipamentos de cada setor: impressora, planta e quadro */}
      {SALAS.filter((s) => s.tipo === "area").map((s) => {
        const norte = s.z1 <= 0; const zf = norte ? s.z0 : s.z1; const d = norte ? 1 : -1;
        return (
          <group key={s.id}>
            <Impressora position={[s.x0 + 0.5, 0, zf + d * 0.6]} rotation={norte ? 0 : Math.PI} />
            <Planta position={[s.x0 + 0.6, 0, zf + d * 7.0]} />
            {norte
              ? <Quadro position={[s.x0 + 1.5, 1.5, zf + 0.11]} rotation={0} largura={1.6} cor={AREAS[s.area!].piso} />
              : <Quadro position={[s.x0 + 0.08, 1.0, zf - 2.5]} rotation={Math.PI / 2} largura={1.6} cor={AREAS[s.area!].piso} />}
          </group>
        );
      })}

      {/* recepção: balcão, letreiro na parede do fundo, sofá de espera, tapete e plantas */}
      <Balcao position={[-6, 0, -7.0]} />
      <group position={LETREIRO_RECEPCAO.pos}><LetreiroFixo largura={LETREIRO_RECEPCAO.largura} altura={LETREIRO_RECEPCAO.altura} tamanho={LETREIRO_RECEPCAO.tamanho} /></group>
      <Sofa position={[-8.45, 0, -5.2]} rotation={Math.PI / 2} cor="#FF7043" largura={2} />
      <MesaBaixa position={[-7.35, 0, -5.2]} />
      <Puff position={[-6.5, 0, -4.4]} cor="#40C4FF" />
      <Puff position={[-6.5, 0, -5.9]} cor="#FFD600" />
      <mesh geometry={plano(3.4, 2.8)} material={mat("#4F7DF3", { rough: 1, opacity: 0.35 })} rotation={[-Math.PI / 2, 0, 0]} position={[-7.2, 0.004, -4.8]} />
      <Planta position={[-8.4, 0, -8.35]} />
      <Planta position={[-3.6, 0, -8.35]} />

      {/* diretoria: plantas nos cantos do fundo */}
      <Planta position={[-2.4, 0, 8.4]} />
      <Planta position={[2.4, 0, 8.4]} />

      {/* sala do CEO: mesa de reunião (é aqui que as reuniões acontecem) e plantas */}
      <MesaReuniao position={PONTOS.mesaReuniao} raioCadeiras={RAIO_REUNIAO} />
      <Planta position={[3.6, 0, 8.4]} />
      <Planta position={[8.4, 0, 8.4]} />

      {/* corredor: jardineiras, puffs, luminárias e o cantinho do café no fim (leste) */}
      {[-3, 3].map((x) => (
        <group key={"j" + x}>
          <mesh geometry={caixa(1.1, 0.42, 0.42)} material={mat("#D8D3CA", { rough: 0.9 })} position={[x, 0.21, -1.25]} castShadow />
          <Planta position={[x - 0.3, 0.3, -1.25]} pequena /><Planta position={[x + 0.3, 0.3, -1.25]} pequena />
          <mesh geometry={caixa(1.1, 0.42, 0.42)} material={mat("#D8D3CA", { rough: 0.9 })} position={[x, 0.21, 1.25]} castShadow />
          <Planta position={[x - 0.3, 0.3, 1.25]} pequena /><Planta position={[x + 0.3, 0.3, 1.25]} pequena />
        </group>
      ))}
      <Puff position={[-4.6, 0, 1.2]} cor="#FFD600" r={0.3} />
      <Puff position={[4.6, 0, -1.2]} cor="#40C4FF" r={0.3} />
      <Cafe position={[8.55, 0, 0]} rotation={-Math.PI / 2} />
      {/* coluna discreta no fim do corredor, ao lado do café */}
      <mesh geometry={cilindro(0.18, 0.18, 2.8, 12)} material={mat("#CFD3D9", { rough: 0.6 })} position={[8.6, 1.4, 1.35]} castShadow />
    </group>
  );
}

// Textos (não entram no Estatico: são malhas especiais que carregam a fonte depois)
function TextosPredio() {
  return (
    <group>
      {SALAS.map((s) => (
        <Text key={s.id} font={FONTE} fontSize={0.3} color="#FFFFFF" anchorX="center" anchorY="middle" position={[posEtiqueta(s)[0], 0.013, posEtiqueta(s)[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          {s.nome.toUpperCase()}
        </Text>
      ))}
      <group position={LETREIRO_RECEPCAO.pos}><LetreiroTexto altura={LETREIRO_RECEPCAO.altura} tamanho={LETREIRO_RECEPCAO.tamanho} /></group>
    </group>
  );
}

// O que muda com o trabalho: telas acesas, impressoras imprimindo, sirene
function PredioVivo() {
  const agentes = useEscritorio((s) => s.agentes);
  const sirene = useEscritorio((s) => s.sirene);
  const { telas, setoresAtivos } = useMemo(() => {
    const ligadas = new Set<string>(); const ativos = new Set<string>();
    for (const a of Object.values(agentes)) if (a.status === "trabalhando") { ligadas.add(a.mesaId); ativos.add(a.sala); }
    return { telas: MESAS.filter((m) => m.tipo !== "balcao" && ligadas.has(m.id)), setoresAtivos: ativos };
  }, [agentes]);
  return (
    <group>
      <TelasAcesas mesas={telas} />
      {SALAS.filter((s) => s.tipo === "area" && setoresAtivos.has(s.id)).map((s) => {
        const norte = s.z1 <= 0; const zf = norte ? s.z0 : s.z1; const d = norte ? 1 : -1;
        return <ImpressoraAtiva key={s.id} position={[s.x0 + 0.5, 0, zf + d * 0.6]} rotation={norte ? 0 : Math.PI} />;
      })}
      <Sirene ligada={sirene} position={[PREDIO.x0 + 0.05, ALT_PAREDE + 0.05, -4.3]} />
    </group>
  );
}

export function Predio() {
  return (
    <group>
      <Estatico><PredioFixo /></Estatico>
      <TextosPredio />
      <PredioVivo />
    </group>
  );
}
