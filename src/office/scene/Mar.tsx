"use client";
// Mar de verdade a leste e ao sul (v63, 12/11/2026, pedido do dono: "as laterais do mapa mais originais e realistas").
// Um plano só, grande, desenhado por um sombreador próprio: ondas que andam para a praia (normais somadas no fragmento,
// sem mexer nos vértices), reflexo do céu (as mesmas cores da cúpula do CicloDia), brilho do sol e da lua, verde-água
// perto da areia e azul fundo longe (mar do Nordeste), espuma na beira e nas cristas que quebram. Neblina da cena junto.
// Material criado uma vez só (nada de recompilar com a cena aberta); os uniformes mudam a cada quadro.
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BORDAS } from "../data/mundo";
import { UNIFORMES_CEU, ceu } from "./CicloDia";
import { clima } from "../clima";
import { leve } from "./qualidade";

const TAM = BORDAS.extensao * 2.2;
const LUA = new THREE.Vector3(-160, 150, -200).normalize(); // a lua do CicloDia fica nesse lado do céu

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vMundo;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vMundo = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTempo, uNoite, uCrep, uFechado, uChuva, uLeve, uSol, uLuz;
uniform vec3 uCeuBaixo, uCeuAlto, uSolDir, uSolCor, uLuaDir, uRaso, uMedio, uFundo, uAreia, uRio;
varying vec3 vMundo;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
// distância (m) até a linha da água: > 0 no mar. Mesma conta de costaLeste/costaSul em data/mundo.ts
float costa(vec2 p) {
  float cx = ${BORDAS.costa.toFixed(1)} + 3.0 * sin(p.y * 0.06) + 1.6 * sin(p.y * 0.17 + 1.3);
  float cz = ${BORDAS.costa.toFixed(1)} + 3.0 * sin(p.x * 0.05 + 0.7) + 1.6 * sin(p.x * 0.19);
  return max(p.x - cx, p.y - cz);
}
// uma onda: direção, número de onda, velocidade e altura → soma a inclinação (derivada) em g
void onda(vec2 p, vec2 d, float k, float w, float a, inout vec2 g) { float f = dot(d, p) * k - uTempo * w; g += d * (k * a * cos(f)); }

void main() {
  vec2 p = vMundo.xz;
  // dentro da terra (cidade, serra) não tem mar: o terreno cobre, mas assim não sobra nada embaixo do rio e do lago
  if (p.x < 80.0 && p.y < 100.0) discard;
  float d = costa(p);
  vec3 V = normalize(cameraPosition - vMundo);
  float longe = length(cameraPosition.xz - p);
  // ondas: o swell vem de sudeste e leste (anda para a praia) + marolas cruzadas; de longe, menos detalhe (não cintila)
  float det = 1.0 - smoothstep(120.0, 320.0, longe);
  vec2 g = vec2(0.0);
  float mar = 1.0 + uChuva * 0.8;
  onda(p, normalize(vec2(-0.8, -0.6)), 0.075, 1.1, 0.55 * mar, g);
  onda(p, normalize(vec2(-0.55, -0.85)), 0.11, 1.45, 0.35 * mar, g);
  onda(p, normalize(vec2(-0.95, 0.3)), 0.19, 1.9, 0.16 * mar, g);
  if (uLeve < 0.5) {
    onda(p, normalize(vec2(0.3, -0.95)), 0.33, 2.6, 0.08 * mar * det, g);
    onda(p, normalize(vec2(-0.2, 0.98)), 0.52, 3.3, 0.045 * mar * det, g);
    // marolinhas de vento (ruído rolando)
    vec2 q = p * 0.55 + vec2(uTempo * 0.35, uTempo * 0.22);
    g += (vec2(ruido(q + 3.1), ruido(q.yx - 7.7)) - 0.5) * 0.22 * det * (1.0 + uChuva);
  }
  vec3 n = normalize(vec3(-g.x * 0.12, 1.0, -g.y * 0.12));

  // cor da água: areia por baixo na beira, verde-água no raso, azul-turquesa e azul fundo longe
  float dd = max(d, 0.0);
  vec3 agua = mix(uAreia, uRaso, smoothstep(0.0, 7.0, dd));
  agua = mix(agua, uMedio, smoothstep(10.0, 55.0, dd));
  agua = mix(agua, uFundo, smoothstep(60.0, 220.0, dd));
  // foz: no canal do rio (antes da linha da água) a cor puxa para a do rio
  agua = mix(agua, uRio, smoothstep(2.0, -26.0, d));
  // luz: o céu claro de dia, quase nada à noite; nuvens e chuva apagam
  float luz = uLuz;
  agua *= luz;
  // reflexo do céu (Fresnel): rasante = espelho; olhando de cima = cor da água
  vec3 R = reflect(-V, n);
  vec3 ceuR = mix(uCeuBaixo, uCeuAlto, smoothstep(0.0, 0.45, R.y));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 c = mix(agua, ceuR, clamp(fres * 0.9, 0.0, 0.95));
  // brilho do sol (de dia) e da lua (de noite) nas ondas
  float sol = pow(max(dot(R, uSolDir), 0.0), 220.0) * 3.2 + pow(max(dot(R, uSolDir), 0.0), 18.0) * 0.12;
  c += uSolCor * sol * uSol;
  float lua = pow(max(dot(R, uLuaDir), 0.0), 320.0) * 1.6;
  c += vec3(0.75, 0.82, 1.0) * lua * uNoite * (1.0 - uFechado);
  // espuma: beira (vai e vem) e cristas quebrando em faixas que chegam na praia
  float vaivem = 1.6 + 1.1 * sin(uTempo * 0.7 + p.x * 0.03 + p.y * 0.05);
  float beira = (1.0 - smoothstep(0.0, vaivem, d)) * step(-0.5, d);
  float fase = fract((d + uTempo * 1.7 + ruido(p * 0.05) * 6.0) / 13.0);
  float crista = smoothstep(0.86, 0.97, fase) * (1.0 - smoothstep(4.0, 34.0, d)) * step(0.0, d);
  float rendas = ruido(p * 0.9 + uTempo * 0.25) * ruido(p * 0.37 - uTempo * 0.1);
  float espuma = clamp(beira * (0.55 + rendas * 0.9) + crista * (0.25 + rendas * 1.1), 0.0, 1.0);
  // carneirinhos longe (mais com chuva/vento)
  if (uLeve < 0.5) espuma += smoothstep(0.82, 0.95, ruido(p * 0.08 + uTempo * 0.05)) * smoothstep(40.0, 120.0, d) * (0.18 + uChuva * 0.4) * det;
  vec3 corEspuma = mix(vec3(0.95, 0.97, 0.98), uCeuBaixo, 0.25) * max(luz, 0.18);
  c = mix(c, corEspuma, clamp(espuma, 0.0, 1.0) * 0.85);
  // chuva: mar mais cinza e fosco
  c = mix(c, uCeuBaixo * 0.85, uChuva * 0.35);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// cores (convertidas para o espaço linear do three)
const COR = { raso: "#2FC6BD", medio: "#1798B8", fundo: "#0C4F80", areia: "#B9C9A7", rio: "#2B6E9F" };
export const MAT_MAR = new THREE.ShaderMaterial({
  vertexShader: VERT, fragmentShader: FRAG, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTempo: { value: 0 }, uNoite: { value: 0 }, uCrep: { value: 0 }, uFechado: { value: 0 }, uChuva: { value: 0 }, uLeve: { value: 0 }, uSol: { value: 1 }, uLuz: { value: 1 },
    uCeuBaixo: { value: new THREE.Color() }, uCeuAlto: { value: new THREE.Color() }, uSolDir: { value: new THREE.Vector3(12, 6, 10).normalize() }, uSolCor: { value: new THREE.Color("#FFF2D8") },
    uLuaDir: { value: LUA }, uRaso: { value: new THREE.Color(COR.raso) }, uMedio: { value: new THREE.Color(COR.medio) }, uFundo: { value: new THREE.Color(COR.fundo) },
    uAreia: { value: new THREE.Color(COR.areia) }, uRio: { value: new THREE.Color(COR.rio) },
  }]),
});
const solDia = new THREE.Color("#FFF2D8"), solTarde = new THREE.Color("#FF9A52");
// fora do componente (regra do React: nada de mexer em objeto do three dentro do render)
let qualidadeLida = false;
function animarMar(t: number) {
  const u = MAT_MAR.uniforms;
  if (!qualidadeLida) { u.uLeve.value = leve() ? 1 : 0; qualidadeLida = true; } // leve: menos ondas, sem marolas
  u.uTempo.value = t;
  u.uNoite.value = ceu.noite; u.uCrep.value = ceu.crep; u.uFechado.value = ceu.nublado; u.uChuva.value = clima.chuva;
  u.uCeuBaixo.value.copy(UNIFORMES_CEU.uCeuBaixo.value); u.uCeuAlto.value.copy(UNIFORMES_CEU.uCeuAlto.value);
  (u.uSolCor.value as THREE.Color).copy(solDia).lerp(solTarde, ceu.crep);
  u.uSol.value = (1 - ceu.noite) * (1 - ceu.nublado * 0.85) * (1 - clima.neblina * 0.7) + ceu.crep * 0.6;
  u.uLuz.value = THREE.MathUtils.lerp(1, 0.16, ceu.noite) * (1 - ceu.nublado * 0.28);
}

export function Mar() {
  const geo = useMemo(() => { const g = new THREE.PlaneGeometry(TAM, TAM, 1, 1); g.rotateX(-Math.PI / 2); return g; }, []);
  useFrame(({ clock }) => animarMar(clock.elapsedTime));
  return <mesh geometry={geo} material={MAT_MAR} position={[0, BORDAS.nivelMar, 0]} frustumCulled={false} />;
}
