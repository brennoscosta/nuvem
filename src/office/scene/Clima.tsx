"use client";
// Chuva, chão molhado e poças (12/11/2026, "vida e clima"). O clima vem de src/office/clima.ts (o mesmo para todos).
//  - Chuva: milhares de riscos numa malha só, movidos na placa de vídeo (sombreador). As gotas ficam paradas no mundo e
//    a caixa de chuva acompanha a câmera, então a chuva não "anda junto" quando a câmera se mexe.
//  - Respingos: anéis pequenos que abrem e somem no chão perto da câmera.
//  - Chão molhado: asfalto, calçada e grama escurecem e o asfalto fica mais liso (brilha com a luz).
//  - Poças: manchas irregulares nas ruas e calçadas que refletem a cor do céu (as luzes dos postes ficam com o reflexo
//    esticado de scene/CicloDia).
// Modo leve: menos gotas, sem respingos e menos poças.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import { clima } from "../clima";
import { ceu } from "./CicloDia";
import { EIXOS_RUA, RUA, QUARTEIROES, PASSO, BORDA_CALCADA, CALCADA } from "../data/mundo";

// ---------- chuva ----------
// Cada gota é uma tira fina (2 triângulos) sempre virada para a câmera. A caixa de chuva fica em volta do ponto que a
// câmera olha, inclusive na altura (com a câmera lá no alto, a chuva também passa perto dela).
const CAIXA = new THREE.Vector3(70, 34, 70);
function geometriaChuva(n: number) {
  const semente = new Float32Array(n * 4 * 3), canto = new Float32Array(n * 4 * 2), idx = new Uint32Array(n * 6);
  let s = 97; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const x = r(), y = r(), z = r();
    for (let k = 0; k < 4; k++) { semente.set([x, y, z], (i * 4 + k) * 3); canto.set([k & 1 ? 1 : -1, k >> 1], (i * 4 + k) * 2); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(semente, 3)); // a posição de verdade sai do sombreador
  g.setAttribute("canto", new THREE.BufferAttribute(canto, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
const MAT_CHUVA = new THREE.ShaderMaterial({
  uniforms: { uTempo: { value: 0 }, uCentro: { value: new THREE.Vector3() }, uCaixa: { value: CAIXA }, uForca: { value: 0 }, uCor: { value: new THREE.Color("#C9D6E4") }, uLarg: { value: 0.025 } },
  vertexShader: `attribute vec2 canto; uniform float uTempo; uniform vec3 uCentro; uniform vec3 uCaixa; uniform float uLarg; varying float vA;
void main() {
  vec3 p = position * uCaixa;
  vec3 vento = vec3(1.8, 0.0, 0.9);
  // gota parada no mundo, embrulhada numa caixa que acompanha o olhar (x, y e z)
  vec3 w = p + vec3(vento.x, -19.0, vento.z) * uTempo;
  w = uCentro + mod(w - uCentro + uCaixa * 0.5, uCaixa) - uCaixa * 0.5;
  // risco de 0,85 m, inclinado pelo vento, com largura virada para a câmera
  vec3 dir = normalize(vec3(vento.x, 19.0, vento.z));
  vec3 lado = normalize(cross(dir, normalize(cameraPosition - w))) * uLarg;
  w += dir * 0.85 * canto.y + lado * canto.x;
  float d = distance(w, cameraPosition);
  // some longe e também colada na câmera (gota a 1 m vira uma barra grossa na tela)
  vA = (1.0 - smoothstep(uCaixa.x * 0.28, uCaixa.x * 0.5, d)) * smoothstep(3.0, 9.0, d) * smoothstep(0.0, 0.6, w.y) * mix(0.25, 1.0, canto.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,
  fragmentShader: `uniform float uForca; uniform vec3 uCor; varying float vA;
void main() {
  gl_FragColor = vec4(uCor, vA * uForca);
  #include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
});
function Gotas() {
  const n = leve() ? 3500 : 11000;
  const geo = useMemo(() => geometriaChuva(n), [n]);
  const ref = useRef<THREE.Mesh>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }) => {
    const f = clima.chuva;
    if (ref.current) ref.current.visible = f > 0.02;
    if (f <= 0.02) return;
    MAT_CHUVA.uniforms.uTempo.value = clock.elapsedTime;
    // centro: 18 m à frente da câmera, sem descer do chão
    camera.getWorldDirection(dir);
    const c = MAT_CHUVA.uniforms.uCentro.value as THREE.Vector3;
    c.set(camera.position.x + dir.x * 18, Math.max(CAIXA.y * 0.5, camera.position.y + dir.y * 18), camera.position.z + dir.z * 18);
    // a gota fica mais larga quando a câmera está longe (senão some), mais forte na chuva pesada
    MAT_CHUVA.uniforms.uLarg.value = 0.02 + Math.min(0.05, camera.position.y * 0.0006);
    MAT_CHUVA.uniforms.uForca.value = Math.min(1, f * 1.2) * (ceu.noite > 0.5 ? 0.5 : 0.5);
    (MAT_CHUVA.uniforms.uCor.value as THREE.Color).set(ceu.noite > 0.5 ? "#A9B9CC" : "#E4ECF4");
  });
  return <mesh ref={ref} geometry={geo} material={MAT_CHUVA} frustumCulled={false} renderOrder={5} visible={false} />;
}

// ---------- respingos ----------
const N_RESP = 140;
const MAT_RESP = new THREE.MeshBasicMaterial({ color: "#DDE6EF", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
function Respingos() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.RingGeometry(0.06, 0.1, 12).rotateX(-Math.PI / 2), []);
  const estado = useMemo(() => Array.from({ length: N_RESP }, (_, i) => ({ x: 0, z: 0, t0: -i * 0.03 })), []);
  const aux = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), dir: new THREE.Vector3() }), []);
  useFrame(({ camera, clock }) => {
    const im = ref.current; if (!im) return;
    const f = clima.chuva; im.visible = f > 0.1; if (!im.visible) return;
    MAT_RESP.opacity = Math.min(0.7, f * 0.8);
    const t = clock.elapsedTime; camera.getWorldDirection(aux.dir);
    const cx = camera.position.x + aux.dir.x * 22, cz = camera.position.z + aux.dir.z * 22;
    estado.forEach((e, i) => {
      let idade = t - e.t0;
      // cada respingo dura 0,45 s; depois renasce num ponto novo perto do centro (sorteio determinístico pelo índice e o tempo)
      if (idade > 0.45 || idade < 0) { const k = Math.floor(t * 7 + i * 13.7); e.x = cx + (((k * 7919) % 1000) / 1000 - 0.5) * 50; e.z = cz + (((k * 104729) % 1000) / 1000 - 0.5) * 50; e.t0 = t; idade = 0; }
      const sc = 0.4 + idade * 4.5;
      aux.p.set(e.x, 0.04, e.z); aux.s.set(sc, sc, sc);
      im.setMatrixAt(i, aux.m.compose(aux.p, aux.q, aux.s));
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, MAT_RESP, N_RESP]} frustumCulled={false} renderOrder={4} visible={false} />;
}

// ---------- chão molhado ----------
// As ruas e calçadas são juntadas numa malha só (scene/Estatico, com a cor gravada nos vértices), então não dá para
// trocar a cor delas. Em vez disso, uma camada fina por cima das ruas e calçadas escurece e deixa o chão liso (o sol e as
// luzes brilham nela). Sem sobreposição: os cruzamentos e as esquinas entram uma vez só.
const MAT_MOLHADO = new THREE.MeshStandardMaterial({ color: "#07090C", transparent: true, opacity: 0, roughness: 0.14, metalness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
function geometriaMolhado() {
  const pecas: THREE.BufferGeometry[] = [];
  const L = 2 * (Math.max(...EIXOS_RUA) + RUA / 2);
  const tira = (w: number, h: number, x: number, z: number) => { const g = new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2); g.translate(x, 0.012, z); pecas.push(g); };
  // ruas: as horizontais inteiras; as verticais só entre os cruzamentos
  for (const e of EIXOS_RUA) tira(L, RUA, 0, e);
  const ordem = [...EIXOS_RUA].sort((a, b) => a - b);
  for (const e of EIXOS_RUA) {
    tira(RUA, ordem[0] - RUA / 2 + L / 2, e, (-L / 2 + ordem[0] - RUA / 2) / 2);
    for (let k = 0; k < ordem.length - 1; k++) { const a = ordem[k] + RUA / 2, b = ordem[k + 1] - RUA / 2; tira(RUA, b - a, e, (a + b) / 2); }
    tira(RUA, L / 2 - (ordem[ordem.length - 1] + RUA / 2), e, (L / 2 + ordem[ordem.length - 1] + RUA / 2) / 2);
  }
  // calçadas: norte e sul inteiras, leste e oeste sem os cantos
  const a = BORDA_CALCADA - CALCADA / 2, Lc = 2 * BORDA_CALCADA;
  for (const q of QUARTEIROES) {
    const cx = q.i * PASSO, cz = q.j * PASSO;
    tira(Lc, CALCADA, cx, cz - a); tira(Lc, CALCADA, cx, cz + a);
    tira(CALCADA, Lc - 2 * CALCADA, cx - a, cz); tira(CALCADA, Lc - 2 * CALCADA, cx + a, cz);
  }
  const g = mergeGeometries(pecas, false); pecas.forEach((p) => p.dispose());
  return g;
}
// para pisos que não passam pela malha juntada (ex.: pisos de bairro com material próprio): escurecem junto
interface Molhavel { m: THREE.MeshStandardMaterial; cor: THREE.Color; rough: number; escurece: number; liso: number }
const MOLHAVEIS = new Map<THREE.MeshStandardMaterial, Molhavel>();
export function registrarMolhavel(m: THREE.Material, o: { escurece?: number; liso?: number } = {}) {
  if (!(m instanceof THREE.MeshStandardMaterial) || MOLHAVEIS.has(m)) return;
  MOLHAVEIS.set(m, { m, cor: m.color.clone(), rough: m.roughness, escurece: o.escurece ?? 0.35, liso: o.liso ?? 0.4 });
}
let ultimoMolhado = -1;
function ChaoMolhado() {
  const geo = useMemo(() => geometriaMolhado(), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const w = clima.molhado;
    if (ref.current) ref.current.visible = w > 0.01;
    MAT_MOLHADO.opacity = w * (ceu.noite > 0.5 ? 0.42 : 0.36);
    if (Math.abs(w - ultimoMolhado) < 0.004) return;
    ultimoMolhado = w;
    for (const x of MOLHAVEIS.values()) { x.m.color.copy(x.cor).multiplyScalar(1 - x.escurece * w); x.m.roughness = THREE.MathUtils.lerp(x.rough, x.liso, w); }
  });
  return geo ? <mesh ref={ref} geometry={geo} material={MAT_MOLHADO} renderOrder={1} receiveShadow visible={false} /> : null;
}

// ---------- poças ----------
let TEX_POCA: THREE.CanvasTexture | null = null;
function texturaPoca() {
  if (TEX_POCA || typeof document === "undefined") return TEX_POCA;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128);
  // mancha irregular: vários círculos borrados juntos
  g.filter = "blur(3px)"; g.fillStyle = "#fff";
  for (const [x, y, r] of [[64, 64, 34], [44, 58, 22], [86, 70, 24], [62, 44, 18], [70, 86, 16], [36, 76, 12]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  TEX_POCA = new THREE.CanvasTexture(c); return TEX_POCA;
}
// lugares das poças: junto ao meio-fio das ruas (entre os cruzamentos) e nas calçadas, sempre os mesmos
function lugaresPocas(n: number) {
  const lista: { x: number; z: number; sx: number; sz: number; rot: number }[] = [];
  let s = 31; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let tent = 0;
  while (lista.length < n && tent++ < n * 20) {
    const naRua = r() < 0.7;
    const eixo = EIXOS_RUA[Math.floor(r() * EIXOS_RUA.length)];
    const ao = (r() - 0.5) * 2 * (Math.max(...EIXOS_RUA) - 4);
    if (EIXOS_RUA.some((e) => Math.abs(ao - e) < RUA / 2 + 4)) continue; // fora dos cruzamentos e das faixas de pedestre
    const lado = r() < 0.5 ? -1 : 1;
    const lat = naRua ? lado * (RUA / 2 - 0.9 - r() * 0.8) : lado * (RUA / 2 + CALCADA * 0.5);
    const horizontal = r() < 0.5;
    const x = horizontal ? ao : eixo + lat, z = horizontal ? eixo + lat : ao;
    // calçada só onde existe quarteirão
    if (!naRua && !QUARTEIROES.some((q) => Math.abs(x - q.i * PASSO) <= BORDA_CALCADA && Math.abs(z - q.j * PASSO) <= BORDA_CALCADA)) continue;
    const comp = naRua ? 2.6 + r() * 3.6 : 1.4 + r() * 1.6, larg = naRua ? 1.2 + r() * 1.3 : 0.9 + r() * 0.9;
    lista.push({ x, z, sx: horizontal ? comp : larg, sz: horizontal ? larg : comp, rot: (r() - 0.5) * 0.5 });
  }
  return lista;
}
const NOITE_POCA = new THREE.Color("#3A4A6A");
const MAT_POCA = new THREE.MeshStandardMaterial({ color: "#1C2127", roughness: 0.05, metalness: 0.85, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const MAT_POCA_CEU = new THREE.MeshBasicMaterial({ color: "#CFE3F5", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3 });
function Pocas() {
  const n = leve() ? 22 : 60;
  const lugares = useMemo(() => lugaresPocas(n), [n]);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const a = useRef<THREE.InstancedMesh>(null), b = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { const t = texturaPoca(); if (t) { MAT_POCA.alphaMap = t; MAT_POCA_CEU.alphaMap = t; MAT_POCA.needsUpdate = true; MAT_POCA_CEU.needsUpdate = true; } }, []);
  const prontas = useRef(false);
  useFrame(({ scene }) => {
    const w = clima.molhado;
    if (a.current) a.current.visible = w > 0.02; if (b.current) b.current.visible = w > 0.02;
    if (w <= 0.02) return;
    if (!prontas.current) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      lugares.forEach((l, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.rot); m.compose(p.set(l.x, 0.018, l.z), q, sc.set(l.sx, 1, l.sz)); a.current?.setMatrixAt(i, m); b.current?.setMatrixAt(i, m); });
      for (const im of [a.current, b.current]) if (im) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
      prontas.current = true;
    }
    // a poça aparece devagar quando molha e some quando seca; reflete a cor do céu de agora
    const v = Math.max(0, (w - 0.15) / 0.85);
    MAT_POCA.opacity = v * 0.85;
    // de dia a poça é o céu claro; à noite, azul-escuro com um brilho morno das luzes da rua
    if (scene.fog) MAT_POCA_CEU.color.copy((scene.fog as THREE.Fog).color).lerp(NOITE_POCA, ceu.noite).multiplyScalar(ceu.noite > 0.5 ? 0.7 : 0.62);
    MAT_POCA_CEU.opacity = v;
  });
  return (
    <>
      <instancedMesh ref={a} args={[geo, MAT_POCA, lugares.length]} frustumCulled={false} renderOrder={1} visible={false} />
      <instancedMesh ref={b} args={[geo, MAT_POCA_CEU, lugares.length]} frustumCulled={false} renderOrder={1} visible={false} />
    </>
  );
}

// Tudo do clima na cena: montar dentro do <Mundo> (scene/Mundo.tsx)
export function Clima() {
  const simples = leve();
  return (
    <>
      <ChaoMolhado />
      <Pocas />
      <Gotas />
      {!simples && <Respingos />}
    </>
  );
}
