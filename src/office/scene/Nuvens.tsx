"use client";
// Nuvens no horizonte (v63, 12/11/2026): duas camadas de nuvens (baixas, quase no mar e na serra, e altas), desenhadas em
// canvas uma vez só e viradas para a câmera. Ficam sempre longe (acompanham a câmera, como a cúpula do céu) e andam devagar
// em volta. A cor vem do céu do CicloDia (brancas de dia, rosadas no pôr do sol, azul-escuras à noite, cinza na chuva);
// com céu limpo aparecem poucas, nublado aparecem todas; a neblina esconde. Dois draw calls.
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { UNIFORMES_CEU, ceu } from "./CicloDia";
import { clima } from "../clima";
import { leve } from "./qualidade";

function sorteio(semente: number) { let s = semente; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
// cúmulo: muitas bolhas macias, base mais reta e mais escura (dá volume)
function texturaNuvem(semente: number) {
  if (typeof document === "undefined") return null;
  const W = 512, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  const r = sorteio(semente);
  for (let i = 0; i < 46; i++) {
    const t = r(), x = W * (0.12 + 0.76 * t), meio = 1 - Math.abs(t - 0.5) * 1.6;
    const raio = (28 + r() * 46) * (0.55 + meio * 0.7), y = H * 0.64 - r() * 60 * meio - raio * 0.25;
    const gr = g.createRadialGradient(x, y, raio * 0.1, x, y, raio);
    gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.55, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, raio, 0, Math.PI * 2); g.fill();
  }
  // sombra da base e corte reto embaixo
  g.globalCompositeOperation = "source-atop";
  const base = g.createLinearGradient(0, H * 0.35, 0, H * 0.78); base.addColorStop(0, "rgba(255,255,255,0)"); base.addColorStop(1, "rgba(150,160,178,0.55)");
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-in";
  const corte = g.createLinearGradient(0, H * 0.66, 0, H * 0.82); corte.addColorStop(0, "rgba(0,0,0,1)"); corte.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = corte; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

interface Nuvem { ang: number; dist: number; y: number; larg: number; vel: number; corte: number; nitidez: number }
function criarCamada(n: number, semente: number, baixa: boolean): Nuvem[] {
  const r = sorteio(semente); const out: Nuvem[] = [];
  for (let i = 0; i < n; i++) out.push({
    ang: (i / n) * Math.PI * 2 + r() * 0.5, dist: baixa ? 250 + r() * 70 : 280 + r() * 60, y: baixa ? 6 + r() * 22 : 60 + r() * 70,
    larg: baixa ? 70 + r() * 70 : 90 + r() * 90, vel: (0.004 + r() * 0.004) * (r() < 0.5 ? 1 : -1) * 0.5, corte: r(),
    nitidez: baixa ? 0.7 + r() * 0.12 : 0.86 + r() * 0.1, // as baixas somem mais na névoa do horizonte; as altas ficam brancas no azul
  });
  return out;
}
const GEO = new THREE.PlaneGeometry(1, 0.5);
const aux = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), cor: new THREE.Color(), nevoa: new THREE.Color(), tmp: new THREE.Color() };
const corNoite = new THREE.Color("#1B2336"), corChuva = new THREE.Color("#8C949E");
function animar(im: THREE.InstancedMesh, lista: Nuvem[], t: number, cam: THREE.Vector3, fundo: THREE.Color | null) {
  const cobertura = 0.5 + clima.nuvens * 0.5 + clima.chuva * 0.3; // fração de nuvens que aparecem (céu limpo: metade)
  const some = 1 - Math.min(1, clima.neblina * 1.3);
  aux.cor.copy(UNIFORMES_CEU.uNuvemCor.value).lerp(corChuva, clima.chuva * 0.6).lerp(corNoite, ceu.noite * 0.55);
  if (fundo) aux.nevoa.copy(fundo);
  lista.forEach((c, i) => {
    const a = c.ang + t * c.vel, vis = c.corte < cobertura ? some : 0;
    aux.p.set(cam.x + Math.cos(a) * c.dist, c.y, cam.z + Math.sin(a) * c.dist);
    aux.e.set(0, Math.atan2(cam.x - aux.p.x, cam.z - aux.p.z), 0); aux.q.setFromEuler(aux.e);
    aux.s.set(c.larg * vis, c.larg * vis, 1);
    im.setMatrixAt(i, aux.m.compose(aux.p, aux.q, aux.s));
    // longe, a nuvem puxa para a cor do fundo do céu (como a névoa faria)
    im.setColorAt(i, aux.tmp.copy(aux.nevoa).lerp(aux.cor, c.nitidez));
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
}

function criarMalha(semente: number, n: number) {
  const mat = new THREE.MeshBasicMaterial({ map: texturaNuvem(semente) ?? undefined, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  const im = new THREE.InstancedMesh(GEO, mat, n);
  im.frustumCulled = false; im.renderOrder = -2;
  for (let i = 0; i < n; i++) im.setColorAt(i, aux.cor.set("#FFFFFF"));
  return im;
}

export function Nuvens() {
  const poucos = leve();
  const camadas = useMemo(() => {
    const nb = poucos ? 8 : 16, na = poucos ? 5 : 10;
    return [{ im: criarMalha(11, nb), lista: criarCamada(nb, 21, true) }, { im: criarMalha(57, na), lista: criarCamada(na, 83, false) }];
  }, [poucos]);
  useFrame(({ clock, camera, scene }) => {
    const fundo = scene.fog ? (scene.fog as THREE.Fog).color : scene.background instanceof THREE.Color ? scene.background : null;
    for (const c of camadas) animar(c.im, c.lista, clock.elapsedTime, camera.position, fundo);
  });
  return <group>{camadas.map((c, i) => <primitive key={i} object={c.im} />)}</group>;
}
