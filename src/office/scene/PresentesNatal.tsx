"use client";
// Presentes de Natal escondidos pela cidade (20/11/2026, frente "visitante"; só na época, data/natal.ts). Os do dia são os
// mesmos para todo mundo (data/passaporte.ts › presentesDoDia); quem já achou deixa de ver o seu. Leve de propósito:
// 3 malhas instanciadas para todos os presentes juntos (caixa, fita com laço e um brilho alto para achar de longe), sem
// sombra, e o balanço mexe só 3 matrizes por quadro (no celular, a cada 3 quadros). Tocar num presente leva até ele.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { usePassaporte } from "../passaporteStore";
import { usePersonagem } from "../personagemStore";
import { celular } from "./qualidade";

let GEO: { caixa: THREE.BufferGeometry; fita: THREE.BufferGeometry; brilho: THREE.BufferGeometry } | null = null;
function geometrias() {
  if (GEO) return GEO;
  const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) => {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s))); return g;
  };
  const caixa = mergeGeometries([at(new THREE.BoxGeometry(0.56, 0.44, 0.56), 0, 0.22, 0), at(new THREE.BoxGeometry(0.62, 0.11, 0.62), 0, 0.49, 0)]);
  const fita = mergeGeometries([
    at(new THREE.BoxGeometry(0.58, 0.45, 0.1), 0, 0.225, 0), at(new THREE.BoxGeometry(0.1, 0.45, 0.58), 0, 0.225, 0),
    at(new THREE.BoxGeometry(0.64, 0.12, 0.11), 0, 0.49, 0), at(new THREE.BoxGeometry(0.11, 0.12, 0.64), 0, 0.49, 0),
    at(new THREE.TorusGeometry(0.09, 0.035, 6, 12), -0.08, 0.6, 0, 0, 0, 0.5, [1, 0.8, 1]), at(new THREE.TorusGeometry(0.09, 0.035, 6, 12), 0.08, 0.6, 0, 0, 0, -0.5, [1, 0.8, 1]),
  ]);
  const brilho = at(new THREE.CylinderGeometry(0.42, 0.42, 7, 12, 1, true), 0, 3.6, 0);
  GEO = { caixa, fita, brilho };
  return GEO;
}
let MAT: { caixa: THREE.MeshStandardMaterial; fita: THREE.MeshStandardMaterial; brilho: THREE.MeshBasicMaterial } | null = null;
function materiais() {
  MAT ??= {
    caixa: new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.55, emissive: "#2A0A00", emissiveIntensity: 0.6 }),
    fita: new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.35, metalness: 0.25, emissive: "#3A2A00", emissiveIntensity: 0.5 }),
    brilho: new THREE.MeshBasicMaterial({ color: "#FFE7A3", transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  };
  return MAT;
}

// objetos de conta reaproveitados (nenhuma alocação por quadro)
const AUX = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color() };

export function PresentesNatal() {
  const natal = usePassaporte((s) => s.natal);
  const lista = useMemo(() => (natal?.ativo ? natal.hoje.filter((p) => !p.achado) : []), [natal]);
  const caixa = useRef<THREE.InstancedMesh>(null), fita = useRef<THREE.InstancedMesh>(null), brilho = useRef<THREE.InstancedMesh>(null);
  const cel = useMemo(() => celular(), []);
  const quadro = useRef(0);
  useEffect(() => {
    const c = caixa.current, f = fita.current, b = brilho.current; if (!c || !f || !b) return;
    const aux = AUX;
    lista.forEach((p, i) => {
      c.setColorAt(i, aux.c.set(p.caixa)); f.setColorAt(i, aux.c.set(p.fita));
      b.setMatrixAt(i, aux.m.makeTranslation(p.x, 0, p.z));
    });
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
    if (f.instanceColor) f.instanceColor.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true; b.computeBoundingSphere();
  }, [lista]);
  useFrame(({ clock }) => {
    if (!lista.length) return;
    const n = quadro.current++;
    if (cel && n % 3 !== 0) return;
    const c = caixa.current, f = fita.current; if (!c || !f) return;
    const aux = AUX;
    const t = clock.elapsedTime;
    lista.forEach((p, i) => {
      aux.q.setFromEuler(aux.e.set(0, t * 0.6 + i * 2.1, 0));
      aux.m.compose(aux.v.set(p.x, 0.04 + Math.max(0, Math.sin(t * 2.2 + i)) * 0.12, p.z), aux.q, aux.s);
      c.setMatrixAt(i, aux.m); f.setMatrixAt(i, aux.m);
    });
    c.instanceMatrix.needsUpdate = true; f.instanceMatrix.needsUpdate = true;
    if (n < 4) { c.computeBoundingSphere(); f.computeBoundingSphere(); }
  });
  if (!lista.length) return null;
  const g = geometrias(), mt = materiais();
  const tocar = (e: ThreeEvent<MouseEvent>) => {
    const p = e.instanceId != null ? lista[e.instanceId] : null; if (!p) return;
    e.stopPropagation();
    const st = usePersonagem.getState();
    if (!st.ativo) { st.abrir("montar"); return; }
    if (st.predio) return;
    st.irPara(p.x, p.z);
  };
  return (
    <group name="natal-presentes">
      {/* a cor de cada presente já nasce com a malha (o material compila com a cor por instância desde o 1º quadro) */}
      <instancedMesh key={`c${lista.length}`} ref={caixa} args={[g.caixa, mt.caixa, lista.length]} onClick={tocar} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(lista.length * 3).fill(1), 3]} />
      </instancedMesh>
      <instancedMesh key={`f${lista.length}`} ref={fita} args={[g.fita, mt.fita, lista.length]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(lista.length * 3).fill(1), 3]} />
      </instancedMesh>
      <instancedMesh key={`b${lista.length}`} ref={brilho} args={[g.brilho, mt.brilho, lista.length]} raycast={() => null} />
    </group>
  );
}
