"use client";
// Horizonte fechado: painéis verticais com arte (praia / cidade) nas bordas do terreno,
// prédios 3D na frente da cidade e palmeiras na frente da praia pra dar profundidade quando a câmera gira.
// As artes (geradas no Higgsfield) ficam no próprio site em JPG leve: public/horizonte (~50 KB cada; o PNG original tinha ~870 KB).
import * as THREE from "three";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { Estatico } from "./Estatico";
import { TERRENO } from "./Entorno";
import { leve } from "./qualidade";

const R = TERRENO.x + 2; // distância dos painéis ao centro (o terreno vai até ±40 x ±34)
const RZ = TERRENO.z + 2;
const ALT = 26; // altura do painel
const Y0 = -0.5;

function Painel({ textura, position, rotation, largura }: { textura: THREE.Texture; position: [number, number, number]; rotation: number; largura: number }) {
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: textura, fog: false, toneMapped: false }), [textura]);
  return <mesh geometry={plano(largura, ALT)} material={m} position={position} rotation={[0, rotation, 0]} />;
}

function Predio({ position, w, h, d, cor }: { position: [number, number, number]; w: number; h: number; d: number; cor: string }) {
  return (
    <group position={position}>
      <mesh geometry={caixa(w, h, d)} material={mat(cor, { rough: 0.8 })} position={[0, h / 2, 0]} castShadow />
      {Array.from({ length: Math.max(2, Math.floor(h / 3.2)) }).map((_, i) => (
        <mesh key={i} geometry={caixa(w * 0.92, 1.1, d + 0.04)} material={mat("#9CC9F0", { rough: 0.2, metal: 0.3, emissive: "#B9DBF5", ei: 0.15 })} position={[0, 2 + i * 3.2, 0]} />
      ))}
      <mesh geometry={caixa(w * 0.4, 1.2, d * 0.4)} material={mat("#B6BDC7")} position={[0, h + 0.6, 0]} />
    </group>
  );
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
  useMemo(() => { for (const t of [praia, cidade]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; } }, [praia, cidade]);
  const predios = useMemo(() => {
    const cores = ["#E8EDF3", "#CFD8E3", "#DDE6EE", "#B9C6D4", "#EEF2F6", "#C5D2DF"];
    const lista: { x: number; z: number; w: number; h: number; d: number; cor: string; rot: number }[] = [];
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    // fileira norte (atrás, z negativo) — duas linhas, a de trás mais alta
    for (let x = -R + 4; x <= R - 4; x += 9 + rnd() * 4) lista.push({ x, z: -RZ + 4 + rnd() * 3, w: 6 + rnd() * 4, h: 12 + rnd() * 14, d: 6 + rnd() * 3, cor: cores[Math.floor(rnd() * cores.length)], rot: Math.floor(rnd() * 4) * Math.PI / 2 });
    if (!leve()) for (let x = -R + 8; x <= R - 8; x += 12 + rnd() * 5) lista.push({ x, z: -RZ + 11 + rnd() * 3, w: 5 + rnd() * 3, h: 8 + rnd() * 8, d: 5 + rnd() * 3, cor: cores[Math.floor(rnd() * cores.length)], rot: Math.floor(rnd() * 4) * Math.PI / 2 });
    // fileira oeste (x negativo)
    for (let z = -RZ + 10; z <= RZ - 6; z += 9 + rnd() * 4) lista.push({ x: -R + 4 + rnd() * 3, z, w: 5 + rnd() * 3, h: 10 + rnd() * 12, d: 5 + rnd() * 3, cor: cores[Math.floor(rnd() * cores.length)], rot: Math.floor(rnd() * 4) * Math.PI / 2 });
    return lista;
  }, []);
  // prédios altos = torre de escritório; baixos = residencial. escalaXZ mantém a base proporcional à largura pedida.
  const torres: ItemInstancia[] = useMemo(() => predios.filter((p) => p.h >= 17).map((p) => ({ pos: [p.x, 0, p.z], rot: p.rot, altura: p.h, escalaXZ: (p.w / 0.52) / p.h })), [predios]);
  const residenciais: ItemInstancia[] = useMemo(() => predios.filter((p) => p.h < 17).map((p) => ({ pos: [p.x, 0, p.z], rot: p.rot, altura: p.h, escalaXZ: (p.w / 0.66) / p.h })), [predios]);
  const palmeiras = useMemo(() => {
    const lista: [number, number, number][] = [];
    const passo = leve() ? 14 : 10;
    for (let x = -R + 6; x <= R - 4; x += passo) lista.push([x + ((x * 7) % 5) - 2, 0, RZ - 5 - ((x * 3) % 4)]);
    for (let z = -RZ + 8; z <= RZ - 8; z += passo) lista.push([R - 5 - ((z * 5) % 4), 0, z + ((z * 3) % 5) - 2]);
    return lista;
  }, []);
  const palmeirasInst: ItemInstancia[] = useMemo(() => palmeiras.map((p, i) => ({ pos: p, rot: (i * 2.1) % (Math.PI * 2), altura: 7 + (i % 3) * 1.2 })), [palmeiras]);
  return (
    <group>
      {/* painéis: sul (praia), leste (praia), norte (cidade), oeste (cidade). largura cobre a borda inteira + sobra nos cantos */}
      <Painel textura={praia} position={[0, Y0 + ALT / 2, RZ]} rotation={Math.PI} largura={2 * R + 8} />
      <Painel textura={praia} position={[R, Y0 + ALT / 2, 0]} rotation={-Math.PI / 2} largura={2 * RZ + 8} />
      <Painel textura={cidade} position={[0, Y0 + ALT / 2, -RZ]} rotation={0} largura={2 * R + 8} />
      <Painel textura={cidade} position={[-R, Y0 + ALT / 2, 0]} rotation={Math.PI / 2} largura={2 * RZ + 8} />
      {/* faixa de areia junto ao painel da praia */}
      <Estatico>
        <mesh geometry={plano(2 * R + 8, 8)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, RZ - 4]} />
        <mesh geometry={plano(8, 2 * RZ + 8)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[R - 4, -0.02, 0]} />
      </Estatico>
      {/* prédios e palmeiras: modelos do Higgsfield instanciados; se não carregarem, caem no procedural */}
      <ComFallback fallback={<Estatico>{predios.map((p, i) => <Predio key={i} position={[p.x, 0, p.z]} w={p.w} h={p.h} d={p.d} cor={p.cor} />)}</Estatico>}>
        <ModeloInstanciado nome="predioEscritorio" itens={torres} sombra={false} />
        <ModeloInstanciado nome="predioResidencial" itens={residenciais} sombra={false} />
      </ComFallback>
      <ComFallback fallback={<Estatico>{palmeiras.map((p, i) => <Palmeira key={i} position={p} escala={0.9 + (i % 3) * 0.15} />)}</Estatico>}>
        <ModeloInstanciado nome="palmeira" itens={palmeirasInst} sombra={false} />
      </ComFallback>
    </group>
  );
}
