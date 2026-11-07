"use client";
// Quarteirão da Nuvem (40 x 40 m, 4 lotes): grama, calçada em volta, laje e praça do prédio, árvores, bancos,
// canteiros e pedestres. As ruas, os postes, os carros e os outros quarteirões ficam em Mundo.tsx.
// O chão e os canteiros vão pro <Estatico>. No modo leve: menos pedestres.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, COR } from "./geo";
import { BonecoProcedural, HIPS, useAnimacao, type BonecoHandle } from "./Boneco";
import { BONECOS } from "../data/bonecos";
import { ComFallback, ModeloInstanciado } from "./Modelos";
import { Estatico } from "./Estatico";
import { SombraContato } from "./SombraContato";
import { leve } from "./qualidade";
import { MEIO_Q, BORDA_CALCADA } from "../data/mundo";

const ARVORES = [[-13, -6], [-13, 7], [13, -7], [13, 6], [-11.5, 14.2], [12, 14.2], [-8, -14.2], [1, -14.2], [10, -14.2], [-6, 17.5], [7, 17.8], [-17, -17], [17.5, -16.5], [17.5, 17.5]]
  .map(([x, z], i) => ({ pos: [x, 0, z] as [number, number, number], rot: (i * 1.3) % (Math.PI * 2), altura: 4.2 + ((i * 7) % 5) * 0.45 }));
// banco: o encosto do modelo fica no -z local; rot vira a frente pra calçada
const BANCOS = [
  { pos: [-7, 0, 13.3], rot: Math.PI }, { pos: [8.5, 0, 13.3], rot: Math.PI }, { pos: [-3, 0, -13.3], rot: 0 }, { pos: [6, 0, -13.3], rot: 0 },
  { pos: [-12.4, 0, 2.5], rot: Math.PI / 2 }, { pos: [12.3, 0, -2], rot: -Math.PI / 2 },
].map((b) => ({ ...b, pos: b.pos as [number, number, number], altura: 0.95 }));

export function Arvore({ position, escala = 1 }: { position: [number, number, number]; escala?: number }) {
  return (
    <group position={position} scale={escala}>
      <mesh geometry={cilindro(0.12, 0.18, 1.6, 8)} material={mat("#7A5A3A", { rough: 0.95 })} position={[0, 0.8, 0]} castShadow />
      <mesh geometry={esfera(1.1, 12)} material={mat("#3E9B5B")} position={[0, 2.1, 0]} castShadow />
      <mesh geometry={esfera(0.8, 10)} material={mat("#58B06A")} position={[0.6, 2.5, 0.3]} castShadow />
      <mesh geometry={esfera(0.7, 10)} material={mat("#2F8A4C")} position={[-0.6, 2.4, -0.3]} castShadow />
    </group>
  );
}

function Banco({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={caixa(1.6, 0.06, 0.45)} material={mat("#B07A4A", { rough: 0.8 })} position={[0, 0.45, 0]} castShadow />
      <mesh geometry={caixa(1.6, 0.4, 0.05)} material={mat("#B07A4A", { rough: 0.8 })} position={[0, 0.7, -0.2]} castShadow />
      {[-0.65, 0.65].map((x) => <mesh key={x} geometry={caixa(0.06, 0.45, 0.4)} material={mat(COR.grafite, { metal: 0.4, rough: 0.5 })} position={[x, 0.22, 0]} />)}
    </group>
  );
}

function Canteiro({ position, w, d, cor }: { position: [number, number, number]; w: number; d: number; cor: string }) {
  return (
    <group position={position}>
      <mesh geometry={caixa(w, 0.3, d)} material={mat("#D8D3CA", { rough: 0.9 })} position={[0, 0.15, 0]} receiveShadow />
      <mesh geometry={caixa(w - 0.3, 0.1, d - 0.3)} material={mat("#5C4634", { rough: 1 })} position={[0, 0.33, 0]} />
      {Array.from({ length: Math.max(2, Math.round(w / 0.8)) }).map((_, i) => (
        <mesh key={i} geometry={esfera(0.22, 8)} material={mat(i % 2 ? cor : "#58B06A")} position={[-w / 2 + 0.5 + i * 0.8, 0.5, 0]} />
      ))}
    </group>
  );
}

// Pedestre: anda num trajeto de ida e volta pela calçada
export function Pedestre({ trajeto, velocidade, boneco, camisa, fase }: { trajeto: [number, number, number][]; velocidade: number; boneco: number; camisa: string; fase: number }) {
  const g = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const st = useRef({ i: 0, dir: 1, parado: 0 });
  useAnimacao(h, () => (st.current.parado > 0 ? "idle" : "walk"), fase, HIPS.procedural.base);
  useFrame((_, dt) => {
    const o = g.current; if (!o) return; dt = Math.min(dt, 0.1);
    const s = st.current;
    if (s.parado > 0) { s.parado -= dt; return; }
    const alvo = trajeto[s.i];
    const dx = alvo[0] - o.position.x, dz = alvo[2] - o.position.z; const dist = Math.hypot(dx, dz);
    if (dist < 0.05) { s.i += s.dir; if (s.i >= trajeto.length || s.i < 0) { s.dir *= -1; s.i += 2 * s.dir; s.parado = 1 + Math.random() * 3; } return; }
    const p = velocidade * dt; o.position.x += (dx / dist) * p; o.position.z += (dz / dist) * p;
    const r = Math.atan2(dx, dz); let d = r - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 8);
  });
  const def = BONECOS[boneco % BONECOS.length];
  return <group ref={g} position={trajeto[0]}><BonecoProcedural ref={h} def={def} camisa={camisa} cracha="#B8C0CC" /><SombraContato r={0.36} /></group>;
}

// Grama do quarteirão, praça e laje do prédio, caminho até a porta, canteiros (fixos). A calçada em volta é do Mundo.
function EntornoFixo() {
  const Q = MEIO_Q;
  return (
    <group>
      <mesh geometry={plano(Q * 2, Q * 2)} material={mat("#7CBF6A", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
      {[[-16, -16, 5], [16, 15, 4.5], [-15, 16, 4]].map(([x, z, r], i) => (
        <mesh key={i} geometry={new THREE.CircleGeometry(r, 20)} material={mat("#6FB15F", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.02, z]} receiveShadow />
      ))}
      {/* praça em volta do prédio e laje (base) */}
      <mesh geometry={plano(30, 30)} material={mat("#D9D5CC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={caixa(19, 0.3, 19)} material={mat("#C9C5BC", { rough: 0.9 })} position={[0, -0.16, 0]} receiveShadow />
      {/* caminho da calçada (oeste) até a porta de vidro */}
      <mesh geometry={plano(BORDA_CALCADA - 9.8 + 0.2, 3.2)} material={mat("#E6E2D8", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[-(9.8 + BORDA_CALCADA) / 2, 0.0, -1.1]} receiveShadow />
      {/* canteiros de flores na frente e atrás */}
      <Canteiro position={[-5, 0, 11.2]} w={4} d={0.9} cor="#EC6B8D" />
      <Canteiro position={[5, 0, 11.2]} w={4} d={0.9} cor="#FFD600" />
      <Canteiro position={[0, 0, -11.2]} w={4} d={0.9} cor="#8B6CF0" />
      {/* letreiro sobre a porta de entrada */}
      <mesh geometry={caixa(0.2, 0.7, 3.2)} material={mat("#2A3340", { rough: 0.9 })} position={[-9.2, 2.4, -1.1]} />
      <mesh geometry={caixa(0.05, 0.3, 2.6)} material={mat("#FFFFFF", { emissive: "#FFFFFF", ei: 0.6 })} position={[-9.32, 2.4, -1.1]} />
    </group>
  );
}

export function Entorno() {
  const poucos = leve();
  const pedestres = useMemo(() => {
    const cores = ["#F2913D", "#3FBFA8", "#E2575B", "#FFD600", "#40C4FF", "#8B6CF0", "#22A86B", "#EC6B8D"];
    const C = MEIO_Q + 1.2; // meio da calçada
    const lista: { trajeto: [number, number, number][]; velocidade: number; boneco: number; camisa: string; fase: number }[] = [];
    // calçada da frente (sul), de trás (norte) e lateral oeste; um entra e sai pela porta
    lista.push({ trajeto: [[-C, 0, C], [C, 0, C]], velocidade: 1.2, boneco: 0, camisa: cores[0], fase: 0 });
    lista.push({ trajeto: [[C, 0, -C], [-C, 0, -C]], velocidade: 1.0, boneco: 3, camisa: cores[4], fase: 1.7 });
    lista.push({ trajeto: [[-C, 0, 12], [-C, 0, -1.1], [-9.9, 0, -1.1]], velocidade: 0.9, boneco: 6, camisa: "#8B6CF0", fase: 4 });
    if (!poucos) {
      lista.push({ trajeto: [[C, 0, -C], [C, 0, C]], velocidade: 1.1, boneco: 2, camisa: cores[2], fase: 2.3 });
      lista.push({ trajeto: [[-12.8, 0, -11], [-12.8, 0, 11]], velocidade: 1.0, boneco: 1, camisa: cores[6], fase: 3.1 });
      lista.push({ trajeto: [[12.8, 0, 11], [12.8, 0, -11]], velocidade: 1.2, boneco: 5, camisa: cores[7], fase: 2.9 });
    }
    return lista;
  }, [poucos]);

  return (
    <group>
      <Estatico><EntornoFixo /></Estatico>
      {/* árvores e bancos: modelos do Higgsfield instanciados (um draw call por modelo); procedural se o GLB faltar */}
      <ComFallback fallback={<Estatico>{(poucos ? ARVORES.slice(0, 9) : ARVORES).map((a, i) => <Arvore key={i} position={a.pos} escala={a.altura / 4.2} />)}</Estatico>}>
        <ModeloInstanciado nome="arvore" itens={poucos ? ARVORES.slice(0, 9) : ARVORES} />
      </ComFallback>
      <ComFallback fallback={<Estatico>{BANCOS.map((b, i) => <Banco key={i} position={b.pos} rotation={b.rot} />)}</Estatico>}>
        <ModeloInstanciado nome="banco" itens={BANCOS} />
      </ComFallback>
      {pedestres.map((p, i) => <Pedestre key={i} {...p} />)}
    </group>
  );
}
