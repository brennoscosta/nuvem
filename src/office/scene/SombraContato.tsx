"use client";
// Sombra de contato: mancha suave no chão embaixo de quem se mexe (bonecos, carros). Quem anda não entra no mapa de
// sombras, que é calculado de vez em quando (não a cada quadro) — então a mancha faz esse papel, quase de graça.
import * as THREE from "three";
import { circulo } from "./geo";

let matSombra: THREE.MeshBasicMaterial | null = null;
function materialSombra() {
  if (matSombra) return matSombra;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!; const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, "rgba(0,0,0,0.42)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  matSombra = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false });
  return matSombra;
}

export function SombraContato({ r = 0.42 }: { r?: number }) {
  return <mesh geometry={circulo(r, 20)} material={materialSombra()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={() => null} />;
}
