"use client";
// Horizonte fechado: painéis verticais com arte (praia / cidade) nas bordas do terreno,
// prédios 3D simples na frente da cidade e palmeiras na frente da praia pra dar profundidade quando a câmera gira.
import * as THREE from "three";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano } from "./geo";

const URL_PRAIA = "https://d8j0ntlcm91z4.cloudfront.net/user_3G8dEWeMTBjKBPczsWg5GO9dSEE/hf_20261020_085619_9de3aa3d-6498-4907-9a5f-3d209b24c519.png";
const URL_CIDADE = "https://d8j0ntlcm91z4.cloudfront.net/user_3G8dEWeMTBjKBPczsWg5GO9dSEE/hf_20261020_085619_cb643064-b8dd-45dd-affd-770f30bb09ba.png";
const R = 66; // distância dos painéis ao centro (o terreno vai até ±64 x ±48)
const RZ = 50;
const ALT = 34; // altura do painel
const Y0 = -0.5;

function Painel({ textura, position, rotation, largura }: { textura: THREE.Texture; position: [number, number, number]; rotation: number; largura: number }) {
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: textura, fog: false, toneMapped: false }), [textura]);
  return <mesh geometry={plano(largura, ALT)} material={m} position={position} rotation={[0, rotation, 0]} />;
}

function Predio({ position, w, h, d, cor }: { position: [number, number, number]; w: number; h: number; d: number; cor: string }) {
  const janelas = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9CC9F0", roughness: 0.2, metalness: 0.3, emissive: "#B9DBF5", emissiveIntensity: 0.15 }), []);
  return (
    <group position={position}>
      <mesh geometry={caixa(w, h, d)} material={mat(cor, { rough: 0.8 })} position={[0, h / 2, 0]} castShadow />
      {/* faixas de janela */}
      {Array.from({ length: Math.max(2, Math.floor(h / 3.2)) }).map((_, i) => (
        <mesh key={i} geometry={caixa(w * 0.92, 1.1, d + 0.04)} material={janelas} position={[0, 2 + i * 3.2, 0]} />
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
  // Artes geradas no Higgsfield (CDN público). Se existirem cópias locais em /public/cenario, elas têm prioridade.
  const local = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cenlocal");
  const [praia, cidade] = useLoader(THREE.TextureLoader, local ? ["/cenario/praia.jpg", "/cenario/cidade.jpg"] : [URL_PRAIA, URL_CIDADE]);
  useMemo(() => { for (const t of [praia, cidade]) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; } }, [praia, cidade]);
  const predios = useMemo(() => {
    const cores = ["#E8EDF3", "#CFD8E3", "#DDE6EE", "#B9C6D4", "#EEF2F6", "#C5D2DF"];
    const lista: { x: number; z: number; w: number; h: number; d: number; cor: string }[] = [];
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    // fileira norte (atrás, z negativo)
    for (let x = -62; x <= 62; x += 7 + rnd() * 4) lista.push({ x, z: -RZ + 4 + rnd() * 6, w: 4 + rnd() * 5, h: 10 + rnd() * 22, d: 4 + rnd() * 4, cor: cores[Math.floor(rnd() * cores.length)] });
    // fileira oeste (x negativo)
    for (let z = -44; z <= 44; z += 7 + rnd() * 4) lista.push({ x: -R + 4 + rnd() * 6, z, w: 4 + rnd() * 4, h: 8 + rnd() * 20, d: 4 + rnd() * 5, cor: cores[Math.floor(rnd() * cores.length)] });
    return lista;
  }, []);
  const palmeiras = useMemo(() => {
    const lista: [number, number, number][] = [];
    for (let x = -60; x <= 60; x += 9) lista.push([x + ((x * 7) % 5) - 2, 0, RZ - 6 - ((x * 3) % 7)]);
    for (let z = -40; z <= 40; z += 9) lista.push([R - 6 - ((z * 5) % 7), 0, z + ((z * 3) % 5) - 2]);
    return lista;
  }, []);
  return (
    <group>
      {/* painéis: sul (praia), leste (praia), norte (cidade), oeste (cidade). largura cobre a borda inteira + sobra nos cantos */}
      <Painel textura={praia} position={[0, Y0 + ALT / 2, RZ]} rotation={Math.PI} largura={2 * R + 8} />
      <Painel textura={praia} position={[R, Y0 + ALT / 2, 0]} rotation={-Math.PI / 2} largura={2 * RZ + 8} />
      <Painel textura={cidade} position={[0, Y0 + ALT / 2, -RZ]} rotation={0} largura={2 * R + 8} />
      <Painel textura={cidade} position={[-R, Y0 + ALT / 2, 0]} rotation={Math.PI / 2} largura={2 * RZ + 8} />
      {/* faixa de areia junto ao painel da praia e calçadão */}
      <mesh geometry={plano(2 * R + 8, 10)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, RZ - 5]} />
      <mesh geometry={plano(10, 2 * RZ + 8)} material={mat("#EFE3C2", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[R - 5, -0.02, 0]} />
      {/* prédios e palmeiras */}
      {predios.map((p, i) => <Predio key={i} position={[p.x, 0, p.z]} w={p.w} h={p.h} d={p.d} cor={p.cor} />)}
      {palmeiras.map((p, i) => <Palmeira key={i} position={p} escala={0.9 + (i % 3) * 0.15} />)}
    </group>
  );
}
