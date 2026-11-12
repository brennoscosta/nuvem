"use client";
// Horizonte fechado: quatro painéis grandes nas bordas do mundo com arte panorâmica (praia ao sul e leste,
// cidade ao norte e oeste) e palmeiras na faixa de areia pra dar profundidade quando a câmera gira.
// As artes (geradas no Higgsfield, 07/11) ficam no site em JPG leve: public/horizonte.
import * as THREE from "three";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { cilindro, caixa, esfera, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { Estatico } from "./Estatico";
import { MUNDO } from "../data/mundo";
import { leve } from "./qualidade";
import { registrarHorizonte } from "./CicloDia";

const R = MUNDO.x + 6; // distância dos painéis ao centro
const RZ = MUNDO.z + 6;
const LARG = 2 * R + 20; // largura do painel (sobra nos cantos)
const REPETE = 2; // a arte repete 2x na largura (foi gerada pra emendar)
const ALT = (LARG / REPETE) * (9 / 16); // altura mantém a proporção 16:9 de cada repetição
const Y0 = -0.6;

function Painel({ textura, position, rotation }: { textura: THREE.Texture; position: [number, number, number]; rotation: number }) {
  // registrado no ciclo de dia e noite: a foto escurece à noite
  const m = useMemo(() => { const mm = new THREE.MeshBasicMaterial({ map: textura, fog: false, toneMapped: false }); registrarHorizonte(mm); return mm; }, [textura]);
  return <mesh geometry={plano(LARG, ALT)} material={m} position={position} rotation={[0, rotation, 0]} />;
}

function Palmeira({ position, escala = 1 }: { position: [number, number, number]; escala?: number }) {
  return (
    <group position={position} scale={escala}>
      <mesh geometry={cilindro(0.18, 0.3, 7, 8)} material={mat("#9A7B52", { rough: 0.95 })} position={[0, 3.5, 0]} rotation={[0, 0, 0.06]} castShadow />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} geometry={caixa(4.2, 0.12, 0.9)} material={mat(i % 2 ? "#3E9B5B" : "#58B06A")} position={[Math.cos((i / 6) * Math.PI * 2) * 1.9, 7.1 - (i % 2) * 0.2, Math.sin((i / 6) * Math.PI * 2) * 1.9]} rotation={[0.25 * Math.sin((i / 6) * Math.PI * 2), -(i / 6) * Math.PI * 2, -0.35]} />
      ))}
      <mesh geometry={esfera(0.5, 8)} material={mat("#6B4F2A")} position={[0, 6.9, 0]} />
    </group>
  );
}

export function Horizonte() {
  const [praia, cidade] = useLoader(THREE.TextureLoader, ["/horizonte/praia.jpg", "/horizonte/cidade.jpg"]);
  useMemo(() => { for (const t of [praia, cidade]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; t.repeat.set(REPETE, 1); } }, [praia, cidade]);
  const palmeiras = useMemo(() => {
    const lista: [number, number, number][] = [];
    const passo = leve() ? 16 : 11;
    for (let x = -R + 8; x <= R - 6; x += passo) lista.push([x + ((x * 7) % 5) - 2, 0, RZ - 7 - ((x * 3) % 4)]);
    for (let z = -RZ + 10; z <= RZ - 10; z += passo) lista.push([R - 7 - ((z * 5) % 4), 0, z + ((z * 3) % 5) - 2]);
    return lista;
  }, []);
  const palmeirasInst: ItemInstancia[] = useMemo(() => palmeiras.map((p, i) => ({ pos: p, rot: (i * 2.1) % (Math.PI * 2), altura: 7 + (i % 3) * 1.2 })), [palmeiras]);
  return (
    <group>
      <Painel textura={praia} position={[0, Y0 + ALT / 2, RZ]} rotation={Math.PI} />
      <Painel textura={praia} position={[R, Y0 + ALT / 2, 0]} rotation={-Math.PI / 2} />
      <Painel textura={cidade} position={[0, Y0 + ALT / 2, -RZ]} rotation={0} />
      <Painel textura={cidade} position={[-R, Y0 + ALT / 2, 0]} rotation={Math.PI / 2} />
      {/* faixa de areia junto aos painéis da praia */}
      <Estatico>
        <mesh geometry={plano(LARG, 12)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, RZ - 6]} />
        <mesh geometry={plano(12, LARG)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[R - 6, -0.04, 0]} />
      </Estatico>
      <ComFallback fallback={<Estatico>{palmeiras.map((p, i) => <Palmeira key={i} position={p} escala={0.9 + (i % 3) * 0.15} />)}</Estatico>}>
        <ModeloInstanciado nome="palmeira" itens={palmeirasInst} sombra={false} />
      </ComFallback>
    </group>
  );
}
