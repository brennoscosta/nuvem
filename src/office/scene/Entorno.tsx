"use client";
// Entorno do prédio (18 x 18 m): grama, calçada, ruas na frente e atrás, árvores, bancos, postes, canteiros,
// carros e pedestres. O chão, as ruas e os canteiros vão pro <Estatico>. No modo leve: menos carros e pedestres.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, COR } from "./geo";
import { BonecoProcedural, HIPS, useAnimacao, type BonecoHandle } from "./Boneco";
import { BONECOS } from "../data/bonecos";
import { ComFallback, Modelo, ModeloInstanciado } from "./Modelos";
import { Estatico } from "./Estatico";
import { SombraContato } from "./SombraContato";
import { leve } from "./qualidade";

// Prédio ocupa x -9..9, z -9..9 (vidro até ±9,8). Terreno vai até ±40 x ±34; ruas em z = ±19.
export const TERRENO = { x: 40, z: 34 };
const T = TERRENO;
const RUA_Z = 19;

const ARVORES = [[-13, -6], [-13, 7], [13, -7], [13, 6], [-11.5, 14.2], [12, 14.2], [-8, -14.2], [1, -14.2], [10, -14.2], [-6, 25.5], [7, 26],
  [-26, -9], [-28, 9], [26, -10], [27, 8], [-20, -28], [18, -27], [-30, 26], [31, 25], [0, 28], [-12, 29], [14, 29], [-34, -20], [35, -22]]
  .map(([x, z], i) => ({ pos: [x, 0, z] as [number, number, number], rot: (i * 1.3) % (Math.PI * 2), altura: 4.2 + ((i * 7) % 5) * 0.45 }));
// banco: o encosto do modelo fica no -z local; rot vira a frente pra calçada
const BANCOS = [
  { pos: [-7, 0, 13.3], rot: Math.PI }, { pos: [8.5, 0, 13.3], rot: Math.PI }, { pos: [-3, 0, -13.3], rot: 0 }, { pos: [6, 0, -13.3], rot: 0 },
  { pos: [-12.4, 0, 2.5], rot: Math.PI / 2 }, { pos: [12.3, 0, -2], rot: -Math.PI / 2 },
].map((b) => ({ ...b, pos: b.pos as [number, number, number], altura: 0.95 }));
const POSTES = [[-14, 15.2, Math.PI], [0, 15.2, Math.PI], [14, 15.2, Math.PI], [-12, -15.2, 0], [4, -15.2, 0], [-24, 22.5, Math.PI], [24, 22.5, Math.PI]]
  .map(([x, z, rot]) => ({ pos: [x, 0, z] as [number, number, number], rot, altura: 5 }));

function Arvore({ position, escala = 1 }: { position: [number, number, number]; escala?: number }) {
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

function Poste({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={cilindro(0.06, 0.08, 4, 8)} material={mat(COR.grafite, { metal: 0.3, rough: 0.6 })} position={[0, 2, 0]} castShadow />
      <mesh geometry={caixa(0.5, 0.12, 0.25)} material={mat(COR.grafite)} position={[0.2, 4, 0]} />
      <mesh geometry={caixa(0.4, 0.04, 0.2)} material={mat("#FFF4D6", { emissive: "#FFF4D6", ei: 0.8 })} position={[0.25, 3.93, 0]} />
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

function Carro({ position, cor, sentido }: { position: [number, number, number]; cor: string; sentido: 1 | -1 }) {
  const ref = useRef<THREE.Group>(null);
  const v = useMemo(() => 3 + Math.random() * 2, []);
  const lim = T.x - 1;
  useFrame((_, dt) => { const g = ref.current; if (!g) return; g.position.x += sentido * v * Math.min(dt, 0.1); if (g.position.x > lim) g.position.x = -lim; if (g.position.x < -lim) g.position.x = lim; });
  return (
    <group ref={ref} position={position} rotation={[0, sentido > 0 ? 0 : Math.PI, 0]}>
      <ComFallback fallback={<CarroProcedural cor={cor} />}>
        {/* modelo: comprimento no eixo z → gira 90° pra andar no eixo x. Carro andando não entra no mapa de sombras (fixo). */}
        <Modelo nome="carro" position={[0, 0, 0]} rotation={Math.PI / 2} altura={1.45} cor={cor} sombra={false} />
      </ComFallback>
      <SombraContato r={1.5} />
    </group>
  );
}

function CarroProcedural({ cor }: { cor: string }) {
  return (
    <group>
      <mesh geometry={caixa(2.2, 0.55, 1.1)} material={mat(cor, { rough: 0.4, metal: 0.2 })} position={[0, 0.5, 0]} />
      <mesh geometry={caixa(1.2, 0.45, 1.0)} material={mat(cor, { rough: 0.4, metal: 0.2 })} position={[-0.1, 0.98, 0]} />
      <mesh geometry={caixa(1.1, 0.35, 1.02)} material={mat("#A7D3F0", { rough: 0.1, metal: 0.3 })} position={[-0.1, 1.0, 0]} />
      {[[-0.75, 0.5], [0.75, 0.5], [-0.75, -0.5], [0.75, -0.5]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.22, 0.22, 0.2, 10)} material={mat("#222")} position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]} />)}
    </group>
  );
}

// Pedestre: anda num trajeto de ida e volta pela calçada
function Pedestre({ trajeto, velocidade, boneco, camisa, fase }: { trajeto: [number, number, number][]; velocidade: number; boneco: number; camisa: string; fase: number }) {
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

// Chão, ruas, faixas, calçada e canteiros (fixos)
function EntornoFixo() {
  return (
    <group>
      {/* grama geral + manchas mais escuras */}
      <mesh geometry={plano(T.x * 2, T.z * 2)} material={mat("#7CBF6A", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
      {[[-24, -20, 9], [24, 18, 8], [-22, 20, 7], [26, -18, 9], [2, 27, 6]].map(([x, z, r], i) => (
        <mesh key={i} geometry={new THREE.CircleGeometry(r, 24)} material={mat("#6FB15F", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.02, z]} receiveShadow />
      ))}
      {/* calçada em volta do prédio e laje (base) */}
      <mesh geometry={plano(30, 30)} material={mat("#D9D5CC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={caixa(19, 0.3, 19)} material={mat("#C9C5BC", { rough: 0.9 })} position={[0, -0.16, 0]} receiveShadow />
      {/* ruas na frente e atrás + faixas */}
      {[RUA_Z, -RUA_Z].map((z) => <mesh key={z} geometry={plano(T.x * 2, 6)} material={mat("#4A4E55", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, z]} receiveShadow />)}
      {Array.from({ length: Math.floor((T.x * 2) / 5) }).map((_, i) => (
        <group key={i}>
          <mesh geometry={plano(2.2, 0.16)} material={mat("#E8E4D8")} rotation={[-Math.PI / 2, 0, 0]} position={[-T.x + 2.5 + i * 5, 0.0, RUA_Z]} />
          <mesh geometry={plano(2.2, 0.16)} material={mat("#E8E4D8")} rotation={[-Math.PI / 2, 0, 0]} position={[-T.x + 2.5 + i * 5, 0.0, -RUA_Z]} />
        </group>
      ))}
      {/* faixa de pedestres na frente, perto da entrada (lado oeste) */}
      {Array.from({ length: 7 }).map((_, i) => <mesh key={i} geometry={plano(0.6, 5.4)} material={mat("#F2EFE6")} rotation={[-Math.PI / 2, 0, 0]} position={[-14.5 + i * 0.95, 0.001, RUA_Z]} />)}
      {/* caminho da calçada até a porta de vidro (oeste) */}
      <mesh geometry={plano(4.5, 3.2)} material={mat("#E6E2D8", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[-11.3, 0.0, -2]} receiveShadow />
      {/* canteiros de flores na frente e atrás */}
      <Canteiro position={[-5, 0, 11.2]} w={4} d={0.9} cor="#EC6B8D" />
      <Canteiro position={[5, 0, 11.2]} w={4} d={0.9} cor="#FFD600" />
      <Canteiro position={[0, 0, -11.2]} w={4} d={0.9} cor="#8B6CF0" />
      {/* letreiro sobre a porta de entrada */}
      <mesh geometry={caixa(0.2, 0.7, 3.2)} material={mat("#2A3340", { rough: 0.9 })} position={[-9.2, 2.4, -2]} />
      <mesh geometry={caixa(0.05, 0.3, 2.6)} material={mat("#FFFFFF", { emissive: "#FFFFFF", ei: 0.6 })} position={[-9.32, 2.4, -2]} />
    </group>
  );
}

export function Entorno() {
  const poucos = leve();
  const pedestres = useMemo(() => {
    const cores = ["#F2913D", "#3FBFA8", "#E2575B", "#FFD600", "#40C4FF", "#8B6CF0", "#22A86B", "#EC6B8D"];
    const lista: { trajeto: [number, number, number][]; velocidade: number; boneco: number; camisa: string; fase: number }[] = [];
    // calçada da frente (z ≈ 12,6), de trás (z ≈ -12,6) e lateral oeste; um entra e sai pela porta
    lista.push({ trajeto: [[-22, 0, 12.6], [22, 0, 12.6]], velocidade: 1.2, boneco: 0, camisa: cores[0], fase: 0 });
    lista.push({ trajeto: [[20, 0, 13.4], [-20, 0, 13.4]], velocidade: 1.0, boneco: 3, camisa: cores[4], fase: 1.7 });
    lista.push({ trajeto: [[-14, 0, 8], [-14, 0, -1.1], [-9.9, 0, -1.1]], velocidade: 0.9, boneco: 6, camisa: "#8B6CF0", fase: 4 });
    if (!poucos) {
      lista.push({ trajeto: [[18, 0, -12.6], [-18, 0, -12.6]], velocidade: 1.1, boneco: 2, camisa: cores[2], fase: 2.3 });
      lista.push({ trajeto: [[-12.8, 0, -11], [-12.8, 0, 11]], velocidade: 1.0, boneco: 1, camisa: cores[6], fase: 3.1 });
      lista.push({ trajeto: [[12.8, 0, 11], [12.8, 0, -11]], velocidade: 1.2, boneco: 5, camisa: cores[7], fase: 2.9 });
    }
    return lista;
  }, [poucos]);

  return (
    <group>
      <Estatico><EntornoFixo /></Estatico>
      {/* carros (2 no modo leve) */}
      <Carro position={[-12, 0, RUA_Z - 1.3]} cor="#E53935" sentido={1} />
      <Carro position={[18, 0, -RUA_Z - 1.3]} cor="#FFFFFF" sentido={-1} />
      {!poucos && <Carro position={[14, 0, RUA_Z + 1.3]} cor="#FDD835" sentido={-1} />}
      {!poucos && <Carro position={[-20, 0, -RUA_Z + 1.3]} cor="#1E88E5" sentido={1} />}
      {/* árvores, bancos e postes: modelos do Higgsfield instanciados (um draw call por modelo); procedural se o GLB faltar */}
      <ComFallback fallback={<Estatico>{(poucos ? ARVORES.slice(0, 11) : ARVORES).map((a, i) => <Arvore key={i} position={a.pos} escala={a.altura / 4.2} />)}</Estatico>}>
        <ModeloInstanciado nome="arvore" itens={poucos ? ARVORES.slice(0, 11) : ARVORES} />
      </ComFallback>
      <ComFallback fallback={<Estatico>{BANCOS.map((b, i) => <Banco key={i} position={b.pos} rotation={b.rot} />)}</Estatico>}>
        <ModeloInstanciado nome="banco" itens={BANCOS} />
      </ComFallback>
      <ComFallback fallback={<Estatico>{POSTES.map((p, i) => <Poste key={i} position={p.pos} />)}</Estatico>}>
        <ModeloInstanciado nome="poste" itens={POSTES} />
      </ComFallback>
      {pedestres.map((p, i) => <Pedestre key={i} {...p} />)}
    </group>
  );
}
