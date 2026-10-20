"use client";
// Entorno do prédio: grama, calçada, rua, árvores, bancos, postes e pedestres passando.
// Pedestres usam o mesmo boneco procedural (leve) com a animação de andar.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano, COR } from "./geo";
import { BonecoProcedural, HIPS, useAnimacao, type BonecoHandle } from "./Boneco";
import { BONECOS } from "../data/bonecos";

// Prédio ocupa x -18..18, z -9..9. Entorno vai até ±60 x ±45.
const T = { x: 64, z: 48 };

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
  useFrame((_, dt) => { const g = ref.current; if (!g) return; g.position.x += sentido * v * Math.min(dt, 0.1); if (g.position.x > 34) g.position.x = -34; if (g.position.x < -34) g.position.x = 34; });
  return (
    <group ref={ref} position={position} rotation={[0, sentido > 0 ? 0 : Math.PI, 0]}>
      <mesh geometry={caixa(2.2, 0.55, 1.1)} material={mat(cor, { rough: 0.4, metal: 0.2 })} position={[0, 0.5, 0]} castShadow />
      <mesh geometry={caixa(1.2, 0.45, 1.0)} material={mat(cor, { rough: 0.4, metal: 0.2 })} position={[-0.1, 0.98, 0]} castShadow />
      <mesh geometry={caixa(1.1, 0.35, 1.02)} material={mat("#A7D3F0", { rough: 0.1, metal: 0.3 })} position={[-0.1, 1.0, 0]} />
      {[[-0.75, 0.5], [0.75, 0.5], [-0.75, -0.5], [0.75, -0.5]].map(([x, z], i) => <mesh key={i} geometry={cilindro(0.22, 0.22, 0.2, 10)} material={mat("#222")} position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]} />)}
      <mesh geometry={caixa(0.08, 0.12, 0.25)} material={mat("#FFF8D0", { emissive: "#FFF8D0", ei: 1 })} position={[1.1, 0.55, 0.35]} />
      <mesh geometry={caixa(0.08, 0.12, 0.25)} material={mat("#FFF8D0", { emissive: "#FFF8D0", ei: 1 })} position={[1.1, 0.55, -0.35]} />
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
  return <group ref={g} position={trajeto[0]}><BonecoProcedural ref={h} def={def} camisa={camisa} cracha="#B8C0CC" /></group>;
}

export function Entorno() {
  const pedestres = useMemo(() => {
    const cores = ["#F2913D", "#3FBFA8", "#E2575B", "#FFD600", "#40C4FF", "#8B6CF0", "#22A86B", "#EC6B8D"];
    const lista: { trajeto: [number, number, number][]; velocidade: number; boneco: number; camisa: string; fase: number }[] = [];
    // calçada da frente (z = 12.5) e de trás (z = -12.5), laterais (x = ±21.5)
    for (let i = 0; i < 5; i++) lista.push({ trajeto: [[-28 + i * 3, 0, 12.5 + (i % 2) * 0.8], [28 - i * 2, 0, 12.5 + (i % 2) * 0.8]], velocidade: 1.1 + Math.random() * 0.5, boneco: i, camisa: cores[i % cores.length], fase: i * 1.7 });
    for (let i = 0; i < 3; i++) lista.push({ trajeto: [[26 - i * 4, 0, -12.5 - (i % 2) * 0.8], [-26 + i * 3, 0, -12.5 - (i % 2) * 0.8]], velocidade: 1.0 + Math.random() * 0.5, boneco: i + 3, camisa: cores[(i + 4) % cores.length], fase: i * 2.3 });
    for (let i = 0; i < 2; i++) lista.push({ trajeto: [[-21.5 - i * 0.8, 0, -11 + i], [-21.5 - i * 0.8, 0, 11 - i]], velocidade: 1.0, boneco: i + 1, camisa: cores[(i + 2) % cores.length], fase: i * 3.1 });
    for (let i = 0; i < 2; i++) lista.push({ trajeto: [[21.5 + i * 0.8, 0, 11 - i], [21.5 + i * 0.8, 0, -11 + i]], velocidade: 1.2, boneco: i + 5, camisa: cores[(i + 6) % cores.length], fase: i * 2.9 });
    // quem entra e sai da empresa pela porta oeste (x=-18, z=-2)
    lista.push({ trajeto: [[-22, 0, 8], [-22, 0, -2], [-18.8, 0, -2]], velocidade: 0.9, boneco: 6, camisa: "#8B6CF0", fase: 4 });
    return lista;
  }, []);

  return (
    <group>
      {/* grama geral */}
      <mesh geometry={plano(T.x * 2, T.z * 2)} material={mat("#7CBF6A", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
      {/* manchas de grama mais escura pra textura */}
      {[[-40, -30, 14], [38, 28, 11], [-35, 30, 9], [42, -28, 13], [0, 36, 10], [-5, -38, 12]].map(([x, z, r], i) => (
        <mesh key={i} geometry={new THREE.CircleGeometry(r, 24)} material={mat("#6FB15F", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.02, z]} />
      ))}
      {/* calçada ao redor do prédio */}
      <mesh geometry={plano(48, 30)} material={mat("#D9D5CC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow />
      {/* laje do prédio (base) */}
      <mesh geometry={caixa(37, 0.3, 19)} material={mat("#C9C5BC", { rough: 0.9 })} position={[0, -0.16, 0]} receiveShadow />
      {/* rua na frente (z 16..22) e atrás */}
      <mesh geometry={plano(130, 6)} material={mat("#4A4E55", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 19]} receiveShadow />
      <mesh geometry={plano(130, 6)} material={mat("#4A4E55", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, -19]} receiveShadow />
      {/* faixas da rua */}
      {Array.from({ length: 26 }).map((_, i) => (
        <group key={i}>
          <mesh geometry={plano(2.2, 0.16)} material={mat("#E8E4D8")} rotation={[-Math.PI / 2, 0, 0]} position={[-62 + i * 5, 0.0, 19]} />
          <mesh geometry={plano(2.2, 0.16)} material={mat("#E8E4D8")} rotation={[-Math.PI / 2, 0, 0]} position={[-62 + i * 5, 0.0, -19]} />
        </group>
      ))}
      {/* faixa de pedestres na frente da entrada */}
      {Array.from({ length: 7 }).map((_, i) => <mesh key={i} geometry={plano(0.6, 5.4)} material={mat("#F2EFE6")} rotation={[-Math.PI / 2, 0, 0]} position={[-23 + i * 0.95, 0.001, 19]} />)}
      {/* caminho da calçada até a entrada (lado oeste) */}
      <mesh geometry={plano(4.5, 3.2)} material={mat("#E6E2D8", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[-20.3, 0.0, -2]} />
      {/* carros */}
      <Carro position={[-20, 0, 17.7]} cor="#E53935" sentido={1} />
      <Carro position={[12, 0, 17.7]} cor="#1E88E5" sentido={1} />
      <Carro position={[25, 0, 20.3]} cor="#FDD835" sentido={-1} />
      <Carro position={[-8, 0, -20.3]} cor="#FFFFFF" sentido={-1} />
      <Carro position={[18, 0, -17.7]} cor="#43A047" sentido={1} />
      {/* árvores */}
      {[[-30, -8], [-30, 6], [30, -6], [30, 8], [-10, 14.2], [8, 14.2], [20, 14.2], [-6, -14.2], [14, -14.2], [-24, -14.2], [-44, -25], [-50, 10], [48, -20], [52, 14], [-38, 34], [36, 36], [-20, -34], [22, -36], [-55, -36], [56, 34], [0, 40], [-46, 40]].map(([x, z], i) => (
        <Arvore key={i} position={[x, 0, z]} escala={0.9 + ((i * 7) % 5) * 0.12} />
      ))}
      {/* bancos e postes */}
      <Banco position={[-6, 0, 13.3]} rotation={Math.PI} />
      <Banco position={[4, 0, 13.3]} rotation={Math.PI} />
      <Banco position={[14, 0, 13.3]} rotation={Math.PI} />
      <Banco position={[-22.6, 0, 3.5]} rotation={Math.PI / 2} />
      <Banco position={[22.3, 0, -3]} rotation={-Math.PI / 2} />
      <Banco position={[2, 0, -13.3]} rotation={0} />
      {[-26, -2, 22].map((x) => <Poste key={"f" + x} position={[x, 0, 15.2]} />)}
      {[-14, 12].map((x) => <Poste key={"t" + x} position={[x, 0, -15.2]} />)}
      {/* canteiros de flores na frente */}
      <Canteiro position={[-9, 0, 11.2]} w={5} d={0.9} cor="#EC6B8D" />
      <Canteiro position={[9, 0, 11.2]} w={5} d={0.9} cor="#FFD600" />
      <Canteiro position={[-19.5, 0, -11.2]} w={4} d={0.9} cor="#F2913D" />
      {/* letreiro da fachada (sobre a porta oeste) */}
      <mesh geometry={caixa(0.2, 0.9, 4.6)} material={mat("#2A3340", { rough: 0.9 })} position={[-18.2, 2.4, -2]} />
      <mesh geometry={caixa(0.05, 0.4, 3.8)} material={mat("#FFFFFF", { emissive: "#FFFFFF", ei: 0.6 })} position={[-18.32, 2.4, -2]} />
      {/* pedestres */}
      {pedestres.map((p, i) => <Pedestre key={i} {...p} />)}
    </group>
  );
}
