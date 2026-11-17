"use client";
// Portas dos prédios (17/11/2026, pedido do dono: "que apareça uma porta ou se direcione para a recepção"): um tapete verde
// que pulsa, com uma seta para dentro, na porta de cada prédio com escritório e na sede da Social RP. Tocar nele leva o
// personagem pela rua até a porta e para dentro, até o balcão da recepção (personagemStore.entrarNoPredio). Sem
// personagem, abre a criação dele. Posições em data/entradas.ts.
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMundo } from "../mundoStore";
import { usePersonagem } from "../personagemStore";
import { entradasDaCidade, type Entrada } from "../data/entradas";

const MAT = new THREE.MeshBasicMaterial({ color: "#22C55E", transparent: true, opacity: 0.5, depthWrite: false });
const MAT_SETA = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.92, depthWrite: false });
const GEO_TAPETE = new THREE.PlaneGeometry(1.9, 1.3);
const GEO_SETA = new THREE.CircleGeometry(0.3, 3);
const cursor = (v: string) => () => { document.body.style.cursor = v; };

function entrar(e: Entrada, ev: ThreeEvent<MouseEvent>) {
  ev.stopPropagation();
  const st = usePersonagem.getState();
  if (!st.ativo) { st.abrir("montar"); return; }
  st.entrarNoPredio(e);
}

function Porta({ e }: { e: Entrada }) {
  // virada para quem entra: da calçada para a porta
  const ang = Math.atan2(e.porta[0] - e.fora[0], e.porta[1] - e.fora[1]);
  return (
    <group position={[e.porta[0], 0.14, e.porta[1]]} rotation={[0, ang, 0]}>
      <mesh geometry={GEO_TAPETE} material={MAT} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}
        onClick={(ev) => entrar(e, ev)} onPointerOver={cursor("pointer")} onPointerOut={cursor("")} />
      {/* seta para dentro (o triângulo nasce apontando para +x; o giro de -90° aponta para +z, a direção de quem entra) */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={GEO_SETA} material={MAT_SETA} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} renderOrder={3} />
      </group>
    </group>
  );
}

export function PortasPredios() {
  const terrenos = useMundo((s) => s.terrenos);
  const entradas = useMemo(() => entradasDaCidade(terrenos), [terrenos]);
  useFrame(({ clock }) => { MAT.opacity = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4)); });
  return <group>{entradas.map((e) => <Porta key={e.chave} e={e} />)}</group>;
}
