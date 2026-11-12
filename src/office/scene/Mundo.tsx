"use client";
// O mundo: grade de ruas, calçadas dos quarteirões, postes, árvores de rua, carros andando e os quarteirões
// (Nuvem, restaurante e lotes à venda). Cada quarteirão só é desenhado quando está perto da câmera.
import * as THREE from "three";
import { Personagens } from "./Personagens";
import { EscritoriosClientes } from "./EscritorioCliente";
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { Estatico } from "./Estatico";
import { leve } from "./qualidade";
import { Entorno, Arvore, GentePraia } from "./Entorno";
import { Restaurante } from "./Restaurante";
import { Lotes } from "./Lotes";
import { Horizonte } from "./Horizonte";
import { Semaforos, Trafego, Passantes, PontosOnibus } from "./Transito";
import { LuzesPostes } from "./CicloDia";
import { natalAtivo, ArvoreNatal, LuzesNatalPostes } from "./Natal";
import { Outdoors } from "./Anuncios";
import { Praca } from "./Praca";
import { QUARTEIROES, centroQuarteirao, centroLote, EIXOS_RUA, COMPRIMENTO_RUA, RUA, CALCADA, MEIO_Q, BORDA_CALCADA, MUNDO, PASSO, N, EIXO_RUA } from "../data/mundo";

const ASFALTO = "#4A4E55", FAIXA = "#E8E4D8", CALC = "#D9D5CC";

// Ruas (linhas e colunas), faixas tracejadas e faixas de pedestre nos cruzamentos perto da Nuvem
function Ruas() {
  const L = COMPRIMENTO_RUA;
  const tracos: ReactNode[] = [];
  for (const e of EIXOS_RUA) {
    for (let s = -L / 2 + 2.5; s < L / 2 - 2; s += 6) {
      // pula o trecho dentro dos cruzamentos
      if (EIXOS_RUA.some((c) => Math.abs(s - c) < RUA / 2 + 4.2)) continue; // nem dentro do cruzamento nem sobre a faixa de pedestre
      tracos.push(<mesh key={`h${e}-${s}`} geometry={plano(2.4, 0.16)} material={mat(FAIXA)} rotation={[-Math.PI / 2, 0, 0]} position={[s, 0.002, e]} />);
      tracos.push(<mesh key={`v${e}-${s}`} geometry={plano(0.16, 2.4)} material={mat(FAIXA)} rotation={[-Math.PI / 2, 0, 0]} position={[e, 0.002, s]} />);
    }
  }
  return (
    <group>
      {/* chão geral (grama) até a borda do mundo */}
      <mesh geometry={plano(MUNDO.x * 2, MUNDO.z * 2)} material={mat("#79B968", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow />
      {EIXOS_RUA.map((e) => <mesh key={"h" + e} geometry={plano(L, RUA)} material={mat(ASFALTO, { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, e]} receiveShadow />)}
      {EIXOS_RUA.map((e) => <mesh key={"v" + e} geometry={plano(RUA, L)} material={mat(ASFALTO, { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[e, -0.004, 0]} receiveShadow />)}
      {tracos}
    </group>
  );
}

// Calçada em volta de um quarteirão (quatro tiras com meio-fio)
function Calcada({ cx, cz }: { cx: number; cz: number }) {
  const a = MEIO_Q + CALCADA / 2, L = 2 * BORDA_CALCADA;
  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={plano(L, CALCADA)} material={mat(CALC, { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -a]} receiveShadow />
      <mesh geometry={plano(L, CALCADA)} material={mat(CALC, { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, a]} receiveShadow />
      <mesh geometry={plano(CALCADA, L)} material={mat(CALC, { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[-a, 0.0, 0]} receiveShadow />
      <mesh geometry={plano(CALCADA, L)} material={mat(CALC, { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[a, 0.0, 0]} receiveShadow />
      {/* meio-fio */}
      <mesh geometry={caixa(L, 0.12, 0.2)} material={mat("#C3BFB6")} position={[0, 0.0, -BORDA_CALCADA + 0.1]} />
      <mesh geometry={caixa(L, 0.12, 0.2)} material={mat("#C3BFB6")} position={[0, 0.0, BORDA_CALCADA - 0.1]} />
      <mesh geometry={caixa(0.2, 0.12, L)} material={mat("#C3BFB6")} position={[-BORDA_CALCADA + 0.1, 0.0, 0]} />
      <mesh geometry={caixa(0.2, 0.12, L)} material={mat("#C3BFB6")} position={[BORDA_CALCADA - 0.1, 0.0, 0]} />
    </group>
  );
}

function Poste({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.06, 0.08, 4, 8)} material={mat("#3A3F47", { metal: 0.3, rough: 0.6 })} position={[0, 2, 0]} castShadow />
      <mesh geometry={caixa(0.5, 0.12, 0.25)} material={mat("#3A3F47")} position={[0.2, 4, 0]} />
    </group>
  );
}

// Só desenha o conteúdo quando o centro está a menos de `raio` da câmera (quarteirões longe somem)
function Perto({ cx, cz, raio, children }: { cx: number; cz: number; raio: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const n = useRef(0);
  useFrame(({ camera }) => {
    if ((n.current++ & 7) !== 0 || !g.current) return; // confere a cada 8 quadros
    const dx = camera.position.x - cx, dz = camera.position.z - cz;
    g.current.visible = dx * dx + dz * dz < raio * raio;
  });
  return <group ref={g} position={[0, 0, 0]}>{children}</group>;
}

export function Mundo() {
  const poucos = leve();
  const natal = useMemo(() => natalAtivo(), []);
  const raio = poucos ? 150 : 220;
  const calcadas = useMemo(() => QUARTEIROES.map((q) => centroQuarteirao(q.i, q.j)), []);
  // postes nas esquinas e no meio de cada lado dos quarteirões, do lado de fora da calçada
  const postes: ItemInstancia[] = useMemo(() => {
    const lista: ItemInstancia[] = []; const a = BORDA_CALCADA - 0.5;
    for (const [cx, cz] of calcadas) {
      const pontos: [number, number, number][] = [[cx - a, 0, cz - a], [cx + a, 0, cz - a], [cx - a, 0, cz + a], [cx + a, 0, cz + a]];
      if (!poucos) pontos.push([cx, 0, cz - a], [cx, 0, cz + a], [cx - a, 0, cz], [cx + a, 0, cz]);
      for (const p of pontos) lista.push({ pos: p, rot: Math.atan2(cx - p[0], cz - p[2]), altura: 5 });
    }
    return lista;
  }, [calcadas, poucos]);
  // árvores: nos terrenos vazios marcados, nos fundos dos lotes com casa e na borda do mundo
  const arvores: ItemInstancia[] = useMemo(() => {
    const lista: ItemInstancia[] = []; let n = 0;
    const add = (x: number, z: number, h = 4.5) => lista.push({ pos: [x, 0, z], rot: (n++ * 1.7) % (Math.PI * 2), altura: h });
    for (const q of QUARTEIROES) {
      if (!q.lotes) continue;
      q.lotes.forEach((l, k) => {
        const [x, z] = centroLote(q.i, q.j, k); const fundo = k >= 2 ? -1 : 1;
        if (l.tipo === "vazio" && l.arvore) add(x + 1.5, z - fundo * 1, 6.5);
        else if (l.tipo === "casa") { add(x - 7, z + fundo * 7, 4.8); if (!poucos) add(x + 7.5, z + fundo * 6, 4.2); }
      });
    }
    // cantos verdes do quarteirão do restaurante
    for (const [dx, dz] of [[-18, -18], [18, 18], [18, -18]]) add(PASSO + dx, dz, 5.5);
    // fileira na borda do mundo (depois da última rua)
    const B = N * PASSO + EIXO_RUA + 7;
    for (let s = -B + 6; s <= B - 6; s += poucos ? 24 : 14) { add(s, -B, 5 + (n % 3)); add(s, B, 5 + (n % 3)); add(-B, s, 5 + (n % 3)); add(B, s, 5 + (n % 3)); }
    return lista;
  }, [poucos]);

  return (
    <group>
      <Horizonte />
      <Estatico>
        <Ruas />
        {calcadas.map(([cx, cz], i) => <Calcada key={i} cx={cx} cz={cz} />)}
      </Estatico>
      <ComFallback fallback={<Estatico>{postes.map((p, i) => <Poste key={i} position={p.pos} />)}</Estatico>}>
        <ModeloInstanciado nome="poste" itens={postes} />
      </ComFallback>
      {/* à noite os postes acendem (luz no chão e lâmpada) */}
      <LuzesPostes itens={postes} />
      {/* Natal (1º/12 a 6/1): árvore na praça da Nuvem e pisca-pisca nos postes */}
      {natal && <><ArvoreNatal /><LuzesNatalPostes itens={postes} /></>}
      {/* árvores do mundo: modelo do Higgsfield (5 mil triângulos cada) no modo completo; no leve, a árvore desenhada em código (600) juntada num lote só */}
      {poucos ? (
        <Estatico>{arvores.map((a, i) => <Arvore key={i} position={a.pos} escala={(a.altura ?? 4.5) / 4.2} />)}</Estatico>
      ) : (
        <ComFallback fallback={<Estatico>{arvores.map((a, i) => <Arvore key={i} position={a.pos} escala={(a.altura ?? 4.5) / 4.2} />)}</Estatico>}>
          <ModeloInstanciado nome="arvore" itens={arvores} />
        </ComFallback>
      )}
      {/* trânsito: semáforos, faixas de pedestre e carros que obedecem (11/11/2026) */}
      <Semaforos />
      <Trafego />
      {/* vida na rua (12/11/2026): pedestres que atravessam na faixa e o ônibus com pontos */}
      <Passantes />
      <PontosOnibus />
      {/* outdoors nas avenidas da borda (aluguel de 30 dias) */}
      <Outdoors />
      {/* quarteirões */}
      <Perto cx={0} cz={0} raio={raio + 60}><Entorno /></Perto>
      <Perto cx={PASSO} cz={0} raio={raio}><Restaurante /></Perto>
      <GentePraia />
      <Personagens />
      <Perto cx={0} cz={0} raio={raio + 100}><Lotes />
      <EscritoriosClientes />
      {/* praça de eventos e feira de sábado no lote 0,1,1 (12/11/2026) */}
      <Praca /></Perto>
    </group>
  );
}
