"use client";
// Modelos 3D gerados no Higgsfield (otimizados em scripts/cidade/otimizar.mjs).
// Cada arquivo é carregado uma vez e instanciado várias; altura normalizada = 1, base no y = 0.
import * as THREE from "three";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

// Se o GLB não carregar (ex.: ambiente sem os arquivos em public/modelos), mostra o fallback procedural em vez de quebrar a cena.
export class ComFallback extends Component<{ fallback: ReactNode; children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() { return this.state.erro ? this.props.fallback : <Suspense fallback={null}>{this.props.children}</Suspense>; }
}

export const MODELO = {
  predioEscritorio: "/modelos/predio-escritorio.glb",
  predioResidencial: "/modelos/predio-residencial.glb",
  carro: "/modelos/carro.glb",
  arvore: "/modelos/arvore.glb",
  palmeira: "/modelos/palmeira.glb",
  banco: "/modelos/banco.glb",
  poste: "/modelos/poste.glb",
} as const;
export type NomeModelo = keyof typeof MODELO;

export function precarregarModelos() { for (const u of Object.values(MODELO)) useGLTF.preload(u); }

// Uma instância de um modelo. altura = altura real em metros. cor = tinge o material (ex.: carro de outra cor).
export function Modelo({ nome, position, rotation = 0, altura = 1, cor, escalaXZ = 1, sombra = true }: { nome: NomeModelo; position: [number, number, number]; rotation?: number; altura?: number; cor?: string; escalaXZ?: number; sombra?: boolean }) {
  const gltf = useGLTF(MODELO[nome]);
  const cena = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = sombra; m.receiveShadow = false;
        if (cor) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color = new THREE.Color(cor); m.material = mat; }
      }
    });
    return c;
  }, [gltf.scene, cor, sombra]);
  return <primitive object={cena} position={position} rotation={[0, rotation, 0]} scale={[altura * escalaXZ, altura, altura * escalaXZ]} />;
}

// Muitas cópias do mesmo modelo com um só draw call por material (InstancedMesh). Pra árvores, postes etc.
export type ItemInstancia = { pos: [number, number, number]; rot?: number; altura?: number; escalaXZ?: number };
export function ModeloInstanciado({ nome, itens, sombra = true }: { nome: NomeModelo; itens: ItemInstancia[]; sombra?: boolean }) {
  const gltf = useGLTF(MODELO[nome]);
  const partes = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) out.push({ geo: m.geometry, mat: m.material as THREE.Material }); });
    return out;
  }, [gltf.scene]);
  const matrizes = useMemo(() => {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    return itens.map((it) => { const h = it.altura ?? 1, xz = h * (it.escalaXZ ?? 1); e.set(0, it.rot ?? 0, 0); q.setFromEuler(e); return M.compose(new THREE.Vector3(...it.pos), q.clone(), new THREE.Vector3(xz, h, xz)).clone(); });
  }, [itens]);
  return (
    <group>
      {partes.map((p, i) => (
        <instancedMesh key={i} args={[p.geo, p.mat, itens.length]} castShadow={sombra} ref={(im) => { if (!im) return; matrizes.forEach((m, k) => im.setMatrixAt(k, m)); im.instanceMatrix.needsUpdate = true; }} />
      ))}
    </group>
  );
}
