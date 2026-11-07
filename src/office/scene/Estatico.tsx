"use client";
// Junta as peças que não se mexem (paredes, pisos, móveis, calçada...) em poucas malhas.
// Antes: um draw call por peça (milhares por quadro). Agora: um por "acabamento" — as cores viram cor de vértice,
// então peças de cores diferentes com o mesmo acabamento caem na mesma malha. Materiais especiais (vidro, telas acesas,
// textura) ficam agrupados por material. Fica de fora daqui quem anima ou muda de estado (telas, impressora, bonecos, textos).
import * as THREE from "three";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";

const basicos = new Map<string, THREE.Material>();
function materialDeVertice(rough: number, metal: number) {
  const k = `${rough}|${metal}`; let m = basicos.get(k);
  if (!m) { m = leve() ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal }); basicos.set(k, m); }
  return m;
}

type Lote = { mat: THREE.Material; geos: THREE.BufferGeometry[]; sombra: boolean; recebe: boolean };

function juntar(fonte: THREE.Object3D): THREE.Group {
  fonte.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(fonte.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  const lotes = new Map<string, Lote>();
  fonte.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material) || !m.visible) return;
    const g0 = m.geometry as THREE.BufferGeometry & { isInstancedBufferGeometry?: boolean };
    if (!g0?.attributes?.position || g0.isInstancedBufferGeometry) return;
    const mat = m.material as THREE.MeshStandardMaterial & { isMeshLambertMaterial?: boolean };
    const semEmissao = !mat.emissive || mat.emissiveIntensity === 0 || mat.emissive.getHex() === 0;
    const simples = (mat.isMeshStandardMaterial || mat.isMeshLambertMaterial) && !mat.map && !mat.transparent && semEmissao && mat.side === THREE.FrontSide;
    const rough = mat.isMeshStandardMaterial ? mat.roughness : 1, metal = mat.isMeshStandardMaterial ? mat.metalness : 0;
    const chave = simples ? `v|${rough}|${metal}|${m.castShadow}|${m.receiveShadow}` : `m|${mat.uuid}|${m.castShadow}|${m.receiveShadow}`;
    const geo = g0.index ? g0.toNonIndexed() : g0.clone();
    for (const nome of Object.keys(geo.attributes)) if (nome !== "position" && nome !== "normal" && nome !== "uv") geo.deleteAttribute(nome);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    m4.multiplyMatrices(inv, m.matrixWorld);
    geo.applyMatrix4(m4);
    if (simples) {
      geo.deleteAttribute("uv");
      const n = geo.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b; }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    } else if (!geo.attributes.uv) {
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    let l = lotes.get(chave);
    if (!l) { l = { mat: simples ? materialDeVertice(rough, metal) : mat, geos: [], sombra: m.castShadow, recebe: m.receiveShadow }; lotes.set(chave, l); }
    l.geos.push(geo);
  });
  const out = new THREE.Group();
  out.name = "estatico";
  for (const l of lotes.values()) {
    const geo = mergeGeometries(l.geos, false);
    l.geos.forEach((g) => g.dispose());
    if (!geo) continue;
    geo.computeBoundingSphere();
    const malha = new THREE.Mesh(geo, l.mat);
    malha.castShadow = l.sombra; malha.receiveShadow = l.recebe;
    malha.matrixAutoUpdate = false;
    out.add(malha);
  }
  return out;
}

// Monta os filhos uma vez, junta tudo e troca pelos lotes. Os filhos não podem depender de estado (não re-renderizam).
export function Estatico({ children, visivel = true }: { children: ReactNode; visivel?: boolean }) {
  const fonte = useRef<THREE.Group>(null);
  const [lote, setLote] = useState<THREE.Group | null>(null);
  useLayoutEffect(() => {
    if (lote || !fonte.current) return;
    setLote(juntar(fonte.current));
  }, [lote]);
  useEffect(() => () => { lote?.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose()); }, [lote]);
  return lote ? <primitive object={lote} visible={visivel} /> : <group ref={fonte}>{children}</group>;
}
