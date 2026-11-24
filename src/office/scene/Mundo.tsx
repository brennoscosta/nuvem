"use client";
// O mundo: grade de ruas, calçadas dos quarteirões, postes, árvores de rua, carros andando e os quarteirões
// (Nuvem, restaurante e lotes à venda). Cada quarteirão só é desenhado quando está perto da câmera.
import * as THREE from "three";
import { Personagens } from "./Personagens";
import { EscritoriosClientes } from "./EscritorioCliente";
import { PortasPredios } from "./Portas";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, precarregarModelo, type ItemInstancia } from "./Modelos";
import { Depois, Isolado, MarcadorEtapas, SoDePerto } from "./etapas";
import { LAYOUT } from "../data/escritorio";
import { Estatico } from "./Estatico";
import { leve } from "./qualidade";
import { Entorno, GentePraia } from "./Entorno";
import { ArvoresMistas, MISTURA_RUA, type Mistura } from "./Arvores";
const MISTURA_PRAIA: Mistura = { coqueiro: 0.62, palmeiraImperial: 0.2, frondosa: 0.18 };
import { Restaurante } from "./Restaurante";
import { SedeHQ } from "./OneStateHQ";
import { SEDES } from "../data/sedes";
import { Lotes } from "./Lotes";
import { Quiosques, QuiosquesDosLotes } from "./Quiosques";
import { RealceExpansao } from "./RealceExpansao";
import { RealceReserva } from "./RealceReserva"; // câmera e realce do terreno no formulário de reserva (WE-07)
import { Horizonte } from "./Horizonte";
import { Fauna } from "./Fauna";
import { SomCena } from "./SomCena";
import { Semaforos, Trafego, Passantes, PontosOnibus } from "./Transito";
import { Moradores } from "./Moradores";
import { PresentesNatal } from "./PresentesNatal";
import { LuzesPostes } from "./CicloDia";
import { natalAtivo, ArvoreNatal, LuzesNatalPostes, LacosPostes, NatalSedes, NatalPraca, LuzesRioNatal } from "./Natal";
import { Outdoors } from "./Anuncios";
import { Praca } from "./Praca";
import { CalcadaBairro, ArvoresDeRua, Galhardetes, PlacasBairro, HalosPostes, planoMetros } from "./Bairros";
import { materialGrama, METROS_GRAMA } from "./Gramado";
import { ARVORE_TERRENO, noLote, arvoreDoTerrenoFica } from "./PontoDisponivel";
import { PlacasDeRua } from "./RuasPlacas";
import { Rio } from "./Rio";
import { Parque, ParqueChao, LAGO } from "./Parque";
import { useMundo, type Terreno } from "../mundoStore";
import { ehKit } from "../data/predios";
import { EditorPosicao3D } from "./EditorPosicao"; // modo "Editar posição" (frente editor, 21/11/2026)

// Lotes com prédio do kit modular (v66, 13/11/2026), inclusive o rascunho aberto no painel e a ampliação do lote duplo:
// a árvore do terreno vazio ou do quintal da casa antiga ficaria dentro do prédio novo (mais baixo ou mais largo que os
// modelos). Ela fica com tamanho zero, sem mudar a quantidade de árvores (a malha instanciada não é recriada).
function lotesComKit(terrenos: Record<string, Terreno>, sel: string | null, rascunho: { layout: string } | null) {
  const kit = (t: Terreno | undefined) => !!t && t.status === "ativo" && !!t.escritorio && ehKit(t.escritorio.layout);
  const out: string[] = [];
  for (const t of Object.values(terrenos)) if (kit(t) || (t.anexoDe && kit(terrenos[t.anexoDe]))) out.push(t.chave);
  if (sel && rascunho && ehKit(rascunho.layout)) { out.push(sel); for (const t of Object.values(terrenos)) if (t.anexoDe === sel) out.push(t.chave); }
  return out.sort().join("|");
}
import { QUARTEIROES, LOTES, centroQuarteirao, EIXOS_RUA, COMPRIMENTO_RUA, RUA, CALCADA, MEIO_Q, BORDA_CALCADA, MUNDO, PASSO, N, EIXO_RUA, NORTE, BAIRRO_DO_QUARTEIRAO } from "../data/mundo";

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
      {/* do calçadão da beira-rio até a borda sul; ao norte, o rio e o parque têm chão próprio (12/11/2026) */}
      {/* 18/11/2026: grama com textura (manchas, folhinhas e trevos, scene/Gramado.tsx) no lugar do verde chapado */}
      <mesh geometry={planoMetros(MUNDO.x * 2, MUNDO.z - NORTE.calcadao.z0, METROS_GRAMA)} material={materialGrama() ?? mat("#79B968", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, (MUNDO.z + NORTE.calcadao.z0) / 2]} receiveShadow />
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
  const lotesKit = useMundo((s) => lotesComKit(s.terrenos, s.loteSelecionado, s.rascunhoEscritorio));
  const versaoSedes = useMundo((s) => s.versaoSedes); // a conta admin girou uma sede: ela e as guirlandas montam de novo (editor)
  // 20/11/2026: a câmera afasta 30% mais (até 155 m; 180 no celular): lá de cima o lado de lá da cidade continua desenhado
  const raio = poucos ? 200 : 270;
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
  // árvores: nos terrenos vazios marcados, nos fundos dos lotes com casa e na borda do mundo.
  // 20/11/2026 (pedido do dono: "50% a menos de arborização"): metade, espalhada. Cada casa fica com a árvore do fundo
  // (a do lado saiu), metade dos terrenos vazios fica com a sua (arvoreDoTerrenoFica, a mesma regra dos tufos do quintal),
  // a lanchonete fica com 2 cantos verdes e a fileira da borda do mundo fica com uma árvore sim, outra não.
  const arvores: ItemInstancia[] = useMemo(() => {
    const lista: ItemInstancia[] = []; let n = 0; const comKit = new Set(lotesKit.split("|"));
    const add = (x: number, z: number, h = 4.5) => lista.push({ pos: [x, 0, z], rot: (n++ * 1.7) % (Math.PI * 2), altura: h });
    // pela lista de lotes (k e centro físicos; a chave pode não ser a posição: data/mundo.ts › chaveDoLote)
    for (const lt of LOTES) {
      const l = lt.lote, k = lt.k, [x, z] = lt.centro; const fundo = k >= 2 ? -1 : 1, kit = comKit.has(lt.chave);
      // a árvore do terreno vazio fica no canto do fundo (18/11/2026): o meio fica livre para o prédio (PontoDisponivel.tsx)
      if (l.tipo === "vazio" && l.arvore) { if (arvoreDoTerrenoFica(lt)) { const [ax, az] = noLote(lt, ...ARVORE_TERRENO(k)); add(ax, az, kit ? 0 : 6.5); } }
      else if (l.tipo === "casa" && (!poucos || lt.numero % 2 === 0)) add(x - 7, z + fundo * 7, kit ? 0 : 4.8); // leve: uma casa sim, outra não
    }
    // cantos verdes do quarteirão do restaurante
    for (const [dx, dz] of [[-18, -18], [18, 18]]) add(PASSO + dx, dz, 5.5);
    // fileira na borda do mundo (depois da última rua)
    const B = N * PASSO + EIXO_RUA + 7;
    // (a fileira do norte agora fica no calçadão da beira-rio, em Rio.tsx)
    for (let s = -B + 6, f = 0; s <= B - 6; s += poucos ? 24 : 14, f++) { if (f % 2) continue; add(s, B, 5 + (n % 3)); add(-B, s, 5 + (n % 3)); add(B, s, 5 + (n % 3)); }
    return lista;
  }, [poucos, lotesKit]);
  const [arvoresPraia, arvoresRua] = useMemo(() => {
    const B = N * PASSO + EIXO_RUA + 7, praia = (a: ItemInstancia) => a.pos[2] >= B - 1 || a.pos[0] >= B - 1;
    return [arvores.filter(praia), arvores.filter((a) => !praia(a))];
  }, [arvores]);

  // os prédios GLB que os lotes ativos usam começam a baixar já (os do kit são feitos em código)
  const terrenosUsados = useMundo((s) => Object.values(s.terrenos).map((t) => (t.status === "ativo" && t.escritorio ? t.escritorio.layout : "")).join("|"));
  useEffect(() => { for (const id of terrenosUsados.split("|")) { const m = (LAYOUT as Record<string, { modelo?: string }>)[id]?.modelo; if (m) precarregarModelo(m); } }, [terrenosUsados]);

  return (
    <group>
      {/* v67: abertura em etapas (scene/etapas.tsx). 0 = perto (ruas, calçadas, postes, Nuvem, lanchonete, lotes, prédios);
          1 = logo depois (árvores, luzes, trânsito, gente); 2 = longe (mar, serra, praia, nuvens, rio, parque, bichos, som) */}
      <MarcadorEtapas />
      <Depois etapa={2}><Horizonte /><SomCena /></Depois>
      <Estatico>
        <Ruas />
        {calcadas.map(([cx, cz], i) => { const b = BAIRRO_DO_QUARTEIRAO[`${Math.round(cx / PASSO)},${Math.round(cz / PASSO)}`]; return b ? <CalcadaBairro key={i} cx={cx} cz={cz} b={b} /> : <Calcada key={i} cx={cx} cz={cz} />; })}
      </Estatico>
      <ComFallback fallback={<Estatico>{postes.map((p, i) => <Poste key={i} position={p.pos} />)}</Estatico>}>
        <ModeloInstanciado nome="poste" itens={postes} />
      </ComFallback>
      {/* à noite os postes acendem (luz no chão e lâmpada) e ganham um halo na cor do bairro */}
      <Depois etapa={1}><LuzesPostes itens={postes} /><HalosPostes postes={postes} /></Depois>
      {/* bairros com identidade (12/11/2026): galhardetes, árvores de rua e a placa de cada bairro; placas com o nome das ruas */}
      <Depois etapa={1}><SoDePerto nome="galhardetes"><Galhardetes postes={postes} /></SoDePerto><ArvoresDeRua /></Depois>
      {/* SoDePerto (20/11/2026): no celular, com o zoom bem afastado, o que vira um ponto na tela não é desenhado (etapas.tsx) */}
      <SoDePerto nome="placas"><Isolado><PlacasBairro /></Isolado><Isolado><PlacasDeRua /></Isolado></SoDePerto>
      {/* além da Avenida Beira-Rio: calçadão, rio, pontes e o Parque da Cidade (o chão aparece sempre; o resto, de perto) */}
      <Depois etapa={2}><Rio /><ParqueChao /><Perto cx={LAGO.x} cz={LAGO.z} raio={raio + 10}><Parque /></Perto></Depois>
      {/* Natal (20/11 a 6/1, scene/Natal.tsx): árvores na praça da Nuvem e na Praça de Eventos, trenó, guirlandas nas sedes,
          laço e pisca-pisca nos postes e fios de luz no calçadão e nas pontes. ?natal=0 desliga (prévias) */}
      {natal && <Isolado key={`natal-${versaoSedes}`}><group name="natal"><ArvoreNatal /><NatalPraca /><SoDePerto nome="natal-miudo"><LuzesNatalPostes itens={postes} /><LacosPostes itens={postes} /><NatalSedes /></SoDePerto></group></Isolado>}
      {natal && <Depois etapa={2}><group name="natal-rio"><SoDePerto><LuzesRioNatal /></SoDePerto></group></Depois>}
      {/* caça aos presentes de Natal (frente visitante): 3 presentes do dia, 3 malhas instanciadas (scene/PresentesNatal.tsx) */}
      {natal && <Depois etapa={1}><SoDePerto nome="natal-presentes-perto"><PresentesNatal /></SoDePerto></Depois>}
      {/* árvores do mundo (v63): espécies brasileiras desenhadas em código (scene/Arvores.tsx), sorteadas pela posição;
          na borda da praia (sul e leste) entram coqueiros e palmeiras imperiais */}
      <Depois etapa={2}><ArvoresMistas itens={arvoresPraia} mistura={MISTURA_PRAIA} grupo="praia" /></Depois>
      <Depois etapa={1}><ArvoresMistas itens={arvoresRua} mistura={MISTURA_RUA} grupo="lotes" /></Depois>
      {/* trânsito: semáforos, faixas de pedestre e carros que obedecem (11/11/2026) */}
      <SoDePerto nome="semaforos"><Semaforos /></SoDePerto>
      <Depois etapa={1}><SoDePerto nome="trafego"><Trafego /></SoDePerto></Depois>
      {/* vida na rua (12/11/2026): pedestres que atravessam na faixa e o ônibus com pontos */}
      <Depois etapa={1}><SoDePerto nome="passantes"><Passantes /><PontosOnibus /></SoDePerto></Depois>
      {/* moradores da cidade (19/11/2026): gente fixa com nome, casa e rotina pela hora da cidade; clicar abre a conversa */}
      <Depois etapa={1}><SoDePerto nome="moradores"><Moradores /></SoDePerto></Depois>
      <Depois etapa={2}><SoDePerto nome="fauna"><Fauna /></SoDePerto></Depois>
      {/* outdoors nas avenidas da borda (aluguel de 30 dias) */}
      <Depois etapa={2}><Outdoors /></Depois>
      {/* quarteirões */}
      <Perto cx={0} cz={0} raio={raio + 60}><Isolado><Entorno /></Isolado></Perto>
      <Perto cx={PASSO} cz={0} raio={raio}><Isolado><Restaurante /></Isolado></Perto>
      {/* sedes (data/sedes.ts): cada uma num lote de esquina virado para o centro; nenhuma desde 24/11/2026 */}
      {SEDES.map((sd) => <Perto key={`${sd.id}-${versaoSedes}`} cx={sd.lote.x} cz={sd.lote.z} raio={raio}><Isolado><SedeHQ sede={sd} /></Isolado></Perto>)}
      <Depois etapa={2}><SoDePerto nome="gente-praia"><GentePraia /></SoDePerto></Depois>
      <Depois etapa={1}><Personagens /></Depois>
      <Perto cx={0} cz={0} raio={raio + 100}><Isolado><Lotes /></Isolado>
      {/* quiosques, quiosques dos lotes em quartos, o realce do vizinho ao expandir o terreno (20/11/2026) e o do terreno em reserva (WE-07, 21/11/2026) */}
      <Isolado><Quiosques /><QuiosquesDosLotes /><RealceExpansao /><RealceReserva /></Isolado>
      <Isolado><EscritoriosClientes /></Isolado>
      <Isolado><PortasPredios /></Isolado>
      <EditorPosicao3D />
      {/* praça de eventos e feira de sábado no lote 0,1,1 (12/11/2026) */}
      <Isolado><Praca /></Isolado></Perto>
    </group>
  );
}
