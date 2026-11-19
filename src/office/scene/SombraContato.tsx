"use client";
// Sombra de contato: mancha suave no chão embaixo de quem se mexe (bonecos, carros). Quem anda não entra no mapa de
// sombras, que é calculado de vez em quando (não a cada quadro) — então a mancha faz esse papel, quase de graça.
// 18/11/2026 (acabamento): o desenho da mancha imita a oclusão de verdade: miolo mais escuro e estreito bem embaixo do
// objeto e uma penumbra larga que some devagar (curva parecida com a de Gauss), em vez do cone reto de antes. A textura é
// maior (128 px) para não ficar serrilhada de perto. Mesma malha, mesmo material: nenhum desenho a mais.
import * as THREE from "three";
import { circulo } from "./geo";

let matSombra: THREE.MeshBasicMaterial | null = null;
function materialSombra() {
  if (matSombra) return matSombra;
  const T = 128, c = document.createElement("canvas"); c.width = c.height = T;
  const x = c.getContext("2d")!;
  const img = x.createImageData(T, T);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const r = Math.hypot(i + 0.5 - T / 2, j + 0.5 - T / 2) / (T / 2); // 0 no centro, 1 na borda
    // penumbra larga (gaussiana) + miolo de contato; chega a zero antes da borda (sem degrau no fim do círculo)
    const a = r >= 1 ? 0 : (0.36 * Math.exp(-r * r * 2.6) + 0.22 * Math.exp(-r * r * 14)) * (1 - Math.pow(r, 6));
    const k = (j * T + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = Math.round(a * 255);
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  matSombra = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  return matSombra;
}

export function SombraContato({ r = 0.42 }: { r?: number }) {
  return <mesh geometry={circulo(r, 20)} material={materialSombra()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={() => null} />;
}
