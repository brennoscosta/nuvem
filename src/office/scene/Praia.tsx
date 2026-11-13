"use client";
// Orla e praia (v63, 12/11/2026): calçadão de pedra portuguesa em ondas a leste e ao sul da cidade, com ciclovia, mureta
// (com descidas para a areia), postes que acendem à noite, coqueiros, quiosques de palha, guarda-sóis com cangas e dois
// postos de salva-vidas. As peças paradas vão para o <Estatico> (poucos draw calls); coqueiros e postes são instanciados.
// Para trocar o modelo do coqueiro: MODELO_COQUEIRO (a frente das árvores pode pôr um coqueiro próprio).
import { useMemo } from "react";
import { caixa, cilindro, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, type ItemInstancia, type NomeModelo } from "./Modelos";
import { Estatico } from "./Estatico";
import { LuzesPostes } from "./CicloDia";
import { materialPiso, planoMetros, metrosDoPiso } from "./Bairros";
import { alturaTerreno } from "./Serra";
import { BORDAS, MUNDO, NORTE, costaLeste, costaSul } from "../data/mundo";
import { leve } from "./qualidade";

export const MODELO_COQUEIRO: NomeModelo = "palmeira";
const O = BORDAS.orla, XL = MUNDO.x, ZS = MUNDO.z; // orla leste: x de 92 a 99; orla sul: z de 92 a 99
const Z_NORTE_ORLA = NORTE.calcadao.z0; // a orla leste começa no calçadão da beira-rio
const DESCIDAS = 36; // a cada 36 m uma descida para a areia (sem mureta)

// sorteio fixo (a praia é a mesma em todo aparelho)
function sorteio(semente: number) { let s = semente; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
// ponto na areia: t de 0 (pé da mureta) a 1 (linha d'água), ao longo de uma das praias
function naAreia(lado: "leste" | "sul", ao: number, t: number): [number, number, number] {
  if (lado === "leste") { const x0 = XL + O + 1.2, x1 = costaLeste(ao) - 1.5, x = x0 + (x1 - x0) * t; return [x, alturaTerreno(x, ao), ao]; }
  const z0 = ZS + O + 1.2, z1 = costaSul(ao) - 1.5, z = z0 + (z1 - z0) * t; return [ao, alturaTerreno(ao, z), z];
}

// ---------- calçadão, ciclovia e mureta ----------
function Orla() {
  const m = metrosDoPiso("ondas");
  const comp = ZS + O - Z_NORTE_ORLA; // leste: do calçadão da beira-rio até o canto sul
  const pedra = mat("#C9C2B4", { rough: 0.95 }), ciclo = mat("#B4473B", { rough: 0.9 }), faixa = mat("#F2EEE4", { rough: 0.9 });
  // mureta em trechos (as descidas ficam abertas)
  const trechos = (a: number, b: number) => { const t: [number, number][] = []; for (let s = a; s < b; s += DESCIDAS) t.push([s + 1.6, Math.min(b, s + DESCIDAS) - 1.6]); return t.filter(([p, q]) => q - p > 2); };
  const leste = trechos(Z_NORTE_ORLA, ZS + O), sul = trechos(-XL, XL + O);
  return (
    <group>
      {/* pedra portuguesa em ondas (preta e branca) */}
      <mesh geometry={planoMetros(O, comp, m)} material={materialPiso("ondas")} rotation={[-Math.PI / 2, 0, 0]} position={[XL + O / 2, 0.012, Z_NORTE_ORLA + comp / 2]} receiveShadow />
      <mesh geometry={planoMetros(2 * XL, O, m)} material={materialPiso("ondas")} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, ZS + O / 2]} receiveShadow />
      {/* ciclovia vermelha junto da grama, com a faixa branca do meio */}
      <mesh geometry={plano(1.7, comp)} material={ciclo} rotation={[-Math.PI / 2, 0, 0]} position={[XL + 0.85, 0.02, Z_NORTE_ORLA + comp / 2]} receiveShadow />
      <mesh geometry={plano(2 * XL, 1.7)} material={ciclo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, ZS + 0.85]} receiveShadow />
      <mesh geometry={plano(0.08, comp)} material={faixa} rotation={[-Math.PI / 2, 0, 0]} position={[XL + 0.85, 0.025, Z_NORTE_ORLA + comp / 2]} />
      <mesh geometry={plano(2 * XL, 0.08)} material={faixa} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, ZS + 0.85]} />
      {/* meio-fio do lado da grama */}
      <mesh geometry={caixa(0.18, 0.1, comp)} material={mat("#C3BFB6")} position={[XL + 0.09, 0.04, Z_NORTE_ORLA + comp / 2]} />
      <mesh geometry={caixa(2 * XL, 0.1, 0.18)} material={mat("#C3BFB6")} position={[0, 0.04, ZS + 0.09]} />
      {/* mureta da areia */}
      {leste.map(([a, b], i) => <mesh key={"l" + i} geometry={caixa(0.32, 0.5, b - a)} material={pedra} position={[XL + O - 0.16, 0.22, (a + b) / 2]} castShadow receiveShadow />)}
      {sul.map(([a, b], i) => <mesh key={"s" + i} geometry={caixa(b - a, 0.5, 0.32)} material={pedra} position={[(a + b) / 2, 0.22, ZS + O - 0.16]} castShadow receiveShadow />)}
    </group>
  );
}

// ---------- quiosque de palha ----------
function Quiosque({ position, rot, cor }: { position: [number, number, number]; rot: number; cor: string }) {
  const madeira = mat("#9C6B3F", { rough: 0.9 }), palha = mat("#D8B46A", { rough: 1 }), escura = mat("#6E4A2A", { rough: 0.9 });
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh geometry={caixa(5.2, 0.25, 4.4)} material={madeira} position={[0, 0.12, 0]} receiveShadow castShadow />
      <mesh geometry={caixa(3.4, 1.1, 1.1)} material={escura} position={[0, 0.8, -0.9]} castShadow />
      <mesh geometry={caixa(3.6, 0.1, 1.3)} material={madeira} position={[0, 1.38, -0.9]} />
      <mesh geometry={caixa(3.4, 0.28, 0.06)} material={mat(cor)} position={[0, 1.05, -0.33]} />
      {[[-2.3, -1.9], [2.3, -1.9], [-2.3, 1.9], [2.3, 1.9]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.09, 0.11, 2.7, 6)} material={madeira} position={[x, 1.6, z]} castShadow />)}
      {/* telhado de palha em pirâmide, com a "franja" */}
      <mesh geometry={cilindro(0.2, 4.3, 1.7, 4)} material={palha} position={[0, 3.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
      <mesh geometry={cilindro(4.3, 4.4, 0.3, 4)} material={palha} position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]} />
      {/* banquinhos e mesas */}
      {[-1.2, 0, 1.2].map((x) => <mesh key={x} geometry={cilindro(0.22, 0.22, 0.6, 8)} material={madeira} position={[x, 0.55, 0.15]} />)}
      {[-1.6, 1.6].map((x) => <group key={x} position={[x, 0, 1.4]}><mesh geometry={cilindro(0.5, 0.5, 0.06, 10)} material={madeira} position={[0, 0.85, 0]} /><mesh geometry={cilindro(0.06, 0.06, 0.8, 6)} material={escura} position={[0, 0.45, 0]} /></group>)}
    </group>
  );
}

// ---------- guarda-sol com canga ----------
const CORES_SOL = ["#E2575B", "#F2C14E", "#2DA6D6", "#FFFFFF", "#3FBF7F", "#F08A3C", "#7B61D9"];
function GuardaSol({ position, cor, cor2, inclina, canga }: { position: [number, number, number]; cor: string; cor2: string; inclina: number; canga: string }) {
  return (
    <group position={position}>
      <group rotation={[inclina, 0, inclina * 0.6]}>
        <mesh geometry={cilindro(0.035, 0.035, 2.5, 6)} material={mat("#EDEDED", { metal: 0.3, rough: 0.5 })} position={[0, 1.25, 0]} />
        <mesh geometry={cilindro(0.05, 1.35, 0.5, 8)} material={mat(cor)} position={[0, 2.45, 0]} castShadow />
        <mesh geometry={cilindro(0.04, 0.7, 0.26, 8)} material={mat(cor2)} position={[0, 2.62, 0]} />
      </group>
      <mesh geometry={plano(1.0, 1.8)} material={mat(canga)} rotation={[-Math.PI / 2, 0, 0.4]} position={[0.9, 0.03, 0.4]} receiveShadow />
    </group>
  );
}

// ---------- posto de salva-vidas ----------
function SalvaVidas({ position, rot }: { position: [number, number, number]; rot: number }) {
  const branco = mat("#F4F1EA", { rough: 0.8 }), verm = mat("#D8433A", { rough: 0.7 });
  return (
    <group position={position} rotation={[0, rot, 0]}>
      {[[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.08, 0.1, 2.6, 6)} material={branco} position={[x, 1.3, z]} castShadow />)}
      <mesh geometry={caixa(2.4, 1.5, 2.2)} material={branco} position={[0, 3.3, 0]} castShadow />
      <mesh geometry={caixa(2.5, 0.3, 2.3)} material={verm} position={[0, 2.45, 0]} />
      <mesh geometry={caixa(2.8, 0.14, 2.6)} material={verm} position={[0, 4.12, 0]} castShadow />
      <mesh geometry={caixa(1.6, 0.6, 0.05)} material={mat("#2A3340")} position={[0, 3.45, 1.12]} />
      <mesh geometry={caixa(0.4, 0.06, 2.8)} material={mat("#B0835A")} position={[0, 1.3, 2.1]} rotation={[0.75, 0, 0]} />
      <mesh geometry={cilindro(0.03, 0.03, 2.2, 6)} material={branco} position={[1.1, 5.2, -0.9]} />
      <mesh geometry={plano(0.9, 0.55)} material={mat("#D8433A", { rough: 0.9 })} position={[1.55, 5.95, -0.9]} />
    </group>
  );
}

export function Praia() {
  const poucos = leve();
  const pecas = useMemo(() => {
    const r = sorteio(777);
    // quiosques: espalhados nas duas praias, perto da mureta (de frente para o mar)
    const quiosques: { pos: [number, number, number]; rot: number; cor: string }[] = [];
    for (const z of [-60, -12, 40]) { const p = naAreia("leste", z, 0.16); quiosques.push({ pos: p, rot: -Math.PI / 2, cor: CORES_SOL[quiosques.length % CORES_SOL.length] }); }
    for (const x of [-70, -20, 34, 78]) { const p = naAreia("sul", x, 0.16); quiosques.push({ pos: p, rot: Math.PI, cor: CORES_SOL[(quiosques.length + 2) % CORES_SOL.length] }); }
    // guarda-sóis com canga, no meio da areia (fora dos quiosques)
    const sois: { pos: [number, number, number]; cor: string; cor2: string; inclina: number; canga: string }[] = [];
    const n = poucos ? 16 : 40;
    for (let i = 0; i < n * 3 && sois.length < n; i++) {
      const lado = r() < 0.5 ? "leste" : "sul", ao = lado === "leste" ? Z_NORTE_ORLA + 8 + r() * (ZS - Z_NORTE_ORLA - 4) : -XL + 6 + r() * (2 * XL + 2);
      const p = naAreia(lado, ao, 0.32 + r() * 0.42);
      if (quiosques.some((q) => Math.hypot(q.pos[0] - p[0], q.pos[2] - p[2]) < 7) || sois.some((s) => Math.hypot(s.pos[0] - p[0], s.pos[2] - p[2]) < 4)) continue;
      sois.push({ pos: p, cor: CORES_SOL[Math.floor(r() * CORES_SOL.length)], cor2: CORES_SOL[Math.floor(r() * CORES_SOL.length)], inclina: (r() - 0.5) * 0.22, canga: CORES_SOL[Math.floor(r() * CORES_SOL.length)] });
    }
    const salva = [{ pos: naAreia("leste", 10, 0.58), rot: -Math.PI / 2 }, { pos: naAreia("sul", -45, 0.58), rot: Math.PI }];
    // coqueiros: fileira junto da mureta e alguns soltos na areia (inclinados para o mar pelo vento)
    const coqueiros: ItemInstancia[] = [];
    const passo = poucos ? 15 : 9;
    for (let z = Z_NORTE_ORLA + 4; z < ZS + O; z += passo + r() * 4) { const p = naAreia("leste", z, 0.06 + r() * 0.05); coqueiros.push({ pos: p, rot: r() * Math.PI * 2, altura: 7.5 + r() * 3 }); }
    for (let x = -XL + 3; x < XL; x += passo + r() * 4) { const p = naAreia("sul", x, 0.06 + r() * 0.05); coqueiros.push({ pos: p, rot: r() * Math.PI * 2, altura: 7.5 + r() * 3 }); }
    for (let i = 0; i < (poucos ? 6 : 16); i++) { const lado = i % 2 ? "leste" : "sul", ao = lado === "leste" ? -70 + r() * 160 : -80 + r() * 170; coqueiros.push({ pos: naAreia(lado, ao, 0.2 + r() * 0.25), rot: r() * Math.PI * 2, altura: 6 + r() * 3.5 }); }
    // ao norte do calçadão da beira-rio a praia leste continua (sem orla), até a névoa
    for (let z = Z_NORTE_ORLA - 26; z > -320; z -= passo * 1.6 + r() * 8) { if (Math.abs(z - BORDAS.rioZ) < BORDAS.rioMeia + 5) continue; const x = 90 + r() * 10; coqueiros.push({ pos: [x, alturaTerreno(x, z), z], rot: r() * Math.PI * 2, altura: 7 + r() * 3 }); }
    // postes da orla: no lado da grama, a cada 20 m (o braço aponta para o calçadão)
    const postes: ItemInstancia[] = [];
    for (let z = Z_NORTE_ORLA + 8; z <= ZS + O - 4; z += poucos ? 30 : 20) postes.push({ pos: [XL + 2.2, 0, z], rot: Math.PI / 2, altura: 5 });
    for (let x = -XL + 8; x <= XL - 4; x += poucos ? 30 : 20) postes.push({ pos: [x, 0, ZS + 2.2], rot: 0, altura: 5 });
    return { quiosques, sois, salva, coqueiros, postes };
  }, [poucos]);
  return (
    <group>
      <Estatico>
        <Orla />
        {pecas.quiosques.map((q, i) => <Quiosque key={i} position={q.pos} rot={q.rot} cor={q.cor} />)}
        {pecas.sois.map((s, i) => <GuardaSol key={i} position={s.pos} cor={s.cor} cor2={s.cor2} inclina={s.inclina} canga={s.canga} />)}
        {pecas.salva.map((s, i) => <SalvaVidas key={i} position={s.pos} rot={s.rot} />)}
      </Estatico>
      <ComFallback fallback={null}><ModeloInstanciado nome={MODELO_COQUEIRO} itens={pecas.coqueiros} sombra={!poucos} /></ComFallback>
      <ComFallback fallback={null}><ModeloInstanciado nome="poste" itens={pecas.postes} /></ComFallback>
      <LuzesPostes itens={pecas.postes} />
    </group>
  );
}
