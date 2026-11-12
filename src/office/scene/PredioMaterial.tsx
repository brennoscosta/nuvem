"use client";
// Material dos prédios (12/11/2026, lote visual): troca o revestimento das paredes do modelo (vidro, tijolinho, madeira,
// concreto ou pintura na cor da marca) e acende o interior à noite.
// Os modelos do Higgsfield têm uma textura só e as janelas são vãos com mesas e cadeiras de verdade lá dentro. Por isso a
// separação é pela posição (no espaço do próprio modelo, que é normalizado: altura 1): parede é a casca externa, com a
// face voltada para fora e cor não escura (caixilho preto fica preto); interior é o que fica dentro, e é ele que acende à
// noite, um andar aceso ou apagado por prédio. Nas casas (sem interior), a janela é o que está pintado escuro na casca.
// O padrão do revestimento é desenhado no shader em metros do mundo (não estica com o modelo). Um programa só para todos.
import * as THREE from "three";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODELO, type NomeModelo, type ItemInstancia } from "./Modelos";
import { ceu } from "./CicloDia";
import type { MaterialFachada } from "../data/escritorio";

// uniformes compartilhados: um só lugar atualiza a noite para todos os prédios
export const UNI_PREDIO = { uNoite: { value: 0 } };
export function RelogioPredios() {
  useFrame(() => { UNI_PREDIO.uNoite.value = ceu.noite; });
  return null;
}

export const NUM_MATERIAL: Record<MaterialFachada | "container", number> = { original: 0, vidro: 1, tijolinho: 2, madeira: 3, concreto: 4, pintura: 5, container: 6 };
// medidas do modelo normalizado (meia largura em x e z), altura do começo do telhado e andares (medido nos GLB, 12/11/2026)
// planos: onde ficam as paredes externas (frente +x, fundos −x, lados +z e −z), achados nos GLB pela maior área de faces
// voltadas para fora (a medida total inclui floreiras, degraus e toldo, que ficam na frente da parede)
type Forma = { ext: [number, number]; teto: number; andares: number; planos?: [number, number, number, number] };
export const FORMA: Partial<Record<NomeModelo, Forma>> = {
  escritorioVidro: { ext: [0.431, 0.443], teto: 0.92, andares: 2, planos: [0.4, 0.41, 0.43, 0.43] },
  escritorioModerno: { ext: [0.849, 0.896], teto: 0.88, andares: 1, planos: [0.65, 0.82, 0.845, 0.845] },
  escritorioSobrado: { ext: [0.54, 0.508], teto: 0.88, andares: 2, planos: [0.47, 0.51, 0.47, 0.47] },
  escritorioLoja: { ext: [0.467, 0.509], teto: 0.6, andares: 1, planos: [0.3, 0.37, 0.455, 0.455] },
  escritorioGalpao: { ext: [0.652, 0.613], teto: 0.62, andares: 1, planos: [0.49, 0.59, 0.58, 0.58] },
  escritorioContainer: { ext: [0.553, 0.678], teto: 0.9, andares: 2, planos: [0.22, 0.53, 0.63, 0.55] },
  casaVelha: { ext: [0.667, 0.736], teto: 0.6, andares: 1 }, casaTerrea: { ext: [0.886, 0.684], teto: 0.6, andares: 1 }, casaSobrado: { ext: [0.739, 0.53], teto: 0.65, andares: 2 },
  casaColonial: { ext: [0.532, 0.488], teto: 0.7, andares: 2 }, casaModerna: { ext: [1.113, 0.961], teto: 0.8, andares: 1 },
};

const VERT_DECL = /* glsl */ `
uniform mat4 uNo;
varying vec3 vPosW;
varying vec3 vPosL;
varying vec3 vNorL;
`;
const VERT_CORPO = /* glsl */ `
#ifdef USE_INSTANCING
  vPosW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
  vPosL = (uNo * vec4(transformed, 1.0)).xyz;
  vNorL = mat3(uNo) * objectNormal;
`;
const FRAG_DECL = /* glsl */ `
uniform float uNoite;
uniform float uMat;
uniform vec3 uCorF;
uniform float uModo;
uniform vec2 uExt;
uniform vec4 uPlanos;
uniform float uTeto;
uniform float uAndares;
uniform float uSeed;
uniform float uDebug;
varying vec3 vPosW;
varying vec3 vPosL;
varying vec3 vNorL;
float hashP(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruidoP(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashP(i), hashP(i + vec2(1, 0)), f.x), mix(hashP(i + vec2(0, 1)), hashP(i + vec2(1, 1)), f.x), f.y); }
vec3 srgbP(vec3 c) { return pow(max(c, vec3(0.0)), vec3(0.4545)); }
vec3 linP(vec3 c) { return pow(c, vec3(2.2)); }
`;
// depois do map_fragment: diffuseColor já tem a cor da textura (linear)
const FRAG_COR = /* glsl */ `
vec3 corOrigP = diffuseColor.rgb;
vec3 baseP = srgbP(diffuseColor.rgb);
float lumP = dot(baseP, vec3(0.299, 0.587, 0.114));
vec3 nLP = normalize(vNorL);
float hP = abs(nLP.x) > abs(nLP.z) ? vPosW.z : vPosW.x; // eixo horizontal da face, em metros (o prédio só gira em quartos de volta)
float yP = vPosW.y;
float paredeP = 0.0, janelaP = 0.0;
if (uModo > 2.5) {
  // casa: janela pintada (escura ou azulada) na casca
  float bx = smoothstep(uExt.x * 0.84, uExt.x * 0.94, abs(vPosL.x)) * smoothstep(0.4, 0.7, nLP.x * sign(vPosL.x));
  float bz = smoothstep(uExt.y * 0.84, uExt.y * 0.94, abs(vPosL.z)) * smoothstep(0.4, 0.7, nLP.z * sign(vPosL.z));
  float azul = smoothstep(0.04, 0.14, baseP.b - max(baseP.r, baseP.g));
  janelaP = max(bx, bz) * max(1.0 - smoothstep(0.16, 0.3, lumP), azul * (1.0 - smoothstep(0.5, 0.68, lumP))) * step(vPosL.y, uTeto);
} else if (uModo > 1.5) {
  // textura própria (bloco dos andares): parede é o pixel claro, janela é o escuro
  float vert = 1.0 - smoothstep(0.45, 0.75, abs(nLP.y));
  paredeP = smoothstep(0.62, 0.72, lumP) * vert;
  janelaP = vert * (1.0 - smoothstep(0.3, 0.45, lumP));
} else {
  // prédio: casca externa não escura = parede (perto do plano de cada lado, com a face para fora); dentro = interior
  float px = smoothstep(uPlanos.x - 0.05, uPlanos.x - 0.025, vPosL.x) * (1.0 - smoothstep(uPlanos.x + 0.05, uPlanos.x + 0.08, vPosL.x)) * smoothstep(0.45, 0.75, nLP.x);
  float nx = smoothstep(uPlanos.y - 0.05, uPlanos.y - 0.025, -vPosL.x) * (1.0 - smoothstep(uPlanos.y + 0.05, uPlanos.y + 0.08, -vPosL.x)) * smoothstep(0.45, 0.75, -nLP.x);
  float pz = smoothstep(uPlanos.z - 0.05, uPlanos.z - 0.025, vPosL.z) * (1.0 - smoothstep(uPlanos.z + 0.05, uPlanos.z + 0.08, vPosL.z)) * smoothstep(0.45, 0.75, nLP.z);
  float nz = smoothstep(uPlanos.w - 0.05, uPlanos.w - 0.025, -vPosL.z) * (1.0 - smoothstep(uPlanos.w + 0.05, uPlanos.w + 0.08, -vPosL.z)) * smoothstep(0.45, 0.75, -nLP.z);
  paredeP = max(max(px, nx), max(pz, nz)) * smoothstep(0.24, 0.36, lumP) * step(0.015, vPosL.y);
  float dentro = (1.0 - smoothstep(uPlanos.x - 0.07, uPlanos.x - 0.035, vPosL.x)) * (1.0 - smoothstep(uPlanos.y - 0.07, uPlanos.y - 0.035, -vPosL.x))
    * (1.0 - smoothstep(uPlanos.z - 0.07, uPlanos.z - 0.035, vPosL.z)) * (1.0 - smoothstep(uPlanos.w - 0.07, uPlanos.w - 0.035, -vPosL.z));
  float telhado = step(0.4, nLP.y) * step(uTeto, vPosL.y);
  janelaP = dentro * (1.0 - telhado) * step(0.01, vPosL.y) * (1.0 - step(uTeto, vPosL.y));
}
float sombraP = clamp(lumP / 0.8, 0.6, 1.12);
vec3 novaP = baseP;
float rugP = -1.0, metP = -1.0;
if (uMat > 0.5 && paredeP > 0.001) {
  if (uMat < 1.5) { // vidro espelhado com caixilhos
    vec2 g = vec2(fract(hP / 1.5), fract(yP / 1.6));
    float caix = step(g.x, 0.05) + step(g.y, 0.06);
    vec3 ceuR = mix(vec3(0.46, 0.6, 0.72), vec3(0.14, 0.22, 0.31), clamp((yP - 1.0) / 14.0, 0.0, 1.0) + 0.25 * ruidoP(vec2(hP * 0.15, yP * 0.1)));
    novaP = mix(ceuR, vec3(0.8, 0.84, 0.88), clamp(caix, 0.0, 1.0));
    rugP = mix(0.1, 0.5, clamp(caix, 0.0, 1.0)); metP = 0.6;
  } else if (uMat < 2.5) { // tijolinho
    float fila = floor(yP / 0.22);
    float desl = mod(fila, 2.0) * 0.3;
    vec2 t = vec2(fract((hP + desl) / 0.6), fract(yP / 0.22));
    float junta = step(t.x, 0.06) + step(t.y, 0.12);
    float hb = hashP(vec2(floor((hP + desl) / 0.6), fila));
    vec3 tij = mix(vec3(0.6, 0.29, 0.2), vec3(0.73, 0.39, 0.26), hb) * (0.92 + 0.12 * ruidoP(vec2(hP * 3.0, yP * 3.0)));
    novaP = mix(tij, vec3(0.84, 0.8, 0.74), clamp(junta, 0.0, 1.0)) * sombraP;
    rugP = 0.92;
  } else if (uMat < 3.5) { // ripas de madeira
    float ripa = floor(hP / 0.2);
    float hr = hashP(vec2(ripa, 3.0));
    float veio = 0.9 + 0.1 * sin(yP * 7.0 + hr * 12.0 + ruidoP(vec2(ripa, yP * 2.0)) * 3.0);
    vec3 mad = mix(vec3(0.55, 0.36, 0.2), vec3(0.69, 0.47, 0.27), hr) * veio;
    novaP = mix(mad, vec3(0.22, 0.14, 0.08), step(fract(hP / 0.2), 0.07)) * sombraP;
    rugP = 0.85;
  } else if (uMat < 4.5) { // concreto aparente com juntas e furos de forma
    vec2 pl = vec2(fract(hP / 2.4), fract(yP / 1.2));
    float junta = step(pl.x, 0.012) + step(pl.y, 0.02);
    vec2 fu = vec2(fract(hP / 0.6) - 0.5, fract(yP / 0.6) - 0.5);
    float furo = 1.0 - smoothstep(0.03, 0.05, length(fu));
    vec3 conc = vec3(0.7, 0.71, 0.7) * (0.9 + 0.12 * ruidoP(vec2(hP * 1.3, yP * 1.3)) + 0.05 * ruidoP(vec2(hP * 9.0, yP * 9.0)));
    novaP = mix(conc, vec3(0.5, 0.51, 0.5), clamp(junta + furo * 0.6, 0.0, 1.0)) * sombraP;
    rugP = 0.95;
  } else if (uMat < 5.5) { // pintura na cor escolhida
    novaP = srgbP(uCorF) * (0.8 + 0.3 * clamp(lumP / 0.85, 0.0, 1.2)) * (0.97 + 0.05 * ruidoP(vec2(hP * 2.0, yP * 2.0)));
    rugP = 0.8;
  } else { // contêiner: chapa ondulada na cor escolhida
    novaP = srgbP(uCorF) * (0.86 + 0.14 * sin(hP * 21.0)) * sombraP;
    rugP = 0.6; metP = 0.35;
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, linP(novaP), paredeP);
}
if (uDebug > 0.5) diffuseColor.rgb = vec3(0.15) + vec3(0.85, 0.0, 0.0) * paredeP + vec3(0.0, 0.2, 0.9) * janelaP;
`;
const FRAG_RUG = /* glsl */ `
if (uMat > 0.5 && rugP >= 0.0) roughnessFactor = mix(roughnessFactor, rugP, paredeP);
`;
const FRAG_MET = /* glsl */ `
if (uMat > 0.5 && metP >= 0.0) metalnessFactor = mix(metalnessFactor, metP, paredeP);
`;
// à noite: o interior acende com a própria cor (mesas e cadeiras aparecem); cada andar de cada prédio aceso ou apagado
const FRAG_EMISSAO = /* glsl */ `
if (uNoite > 0.01 && janelaP > 0.001) {
  if (uModo > 2.5) {
    vec2 cel = vec2(floor(hP / 2.0), floor(yP / 2.6)) + floor(vPosW.xz / 20.0) * 13.0;
    float aceso = step(0.4, hashP(cel));
    vec3 luz = mix(vec3(1.0, 0.7, 0.36), vec3(1.0, 0.86, 0.6), hashP(cel + 2.3));
    totalEmissiveRadiance += luz * janelaP * aceso * uNoite * 1.1;
  } else if (uModo > 1.5) {
    vec2 cel = vec2(floor(hP / 2.4), floor((yP - 0.3) / 3.4));
    float aceso = step(0.42, hashP(cel + uSeed));
    vec3 luz = mix(vec3(1.0, 0.72, 0.4), vec3(1.0, 0.9, 0.72), hashP(cel + 3.1));
    totalEmissiveRadiance += luz * janelaP * aceso * uNoite * 1.25;
  } else {
    float andar = floor(clamp(vPosL.y, 0.0, 0.999) * uAndares);
    float aceso = step(0.25, hashP(vec2(andar, uSeed)));
    vec3 luz = mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.92, 0.78), hashP(vec2(uSeed, 7.0)));
    totalEmissiveRadiance += luz * (0.1 + 0.55 * srgbP(corOrigP)) * janelaP * aceso * uNoite * 0.55;
  }
}
`;

const DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fachadaDebug");
// teste: ?fachadaTeste=tijolinho força um revestimento em todos os prédios (fotos de conferência)
export const FACHADA_TESTE = (() => { if (typeof window === "undefined") return null; const v = new URLSearchParams(window.location.search).get("fachadaTeste"); return v && v in NUM_MATERIAL ? (v as MaterialFachada) : null; })();

export interface OpcoesFachada { material: MaterialFachada | "container"; cor?: string; modo?: 0 | 2 | 3; no?: THREE.Matrix4; forma?: Forma; seed?: number }
// Copia o material e liga o shader
export function materialFachada(base: THREE.Material, o: OpcoesFachada): THREE.Material {
  const m = base.clone() as THREE.MeshStandardMaterial;
  const f: Forma = o.forma ?? { ext: [10, 10], teto: 1, andares: 1 };
  const pl = f.planos ?? [f.ext[0], f.ext[0], f.ext[1], f.ext[1]];
  const u = {
    uMat: { value: NUM_MATERIAL[o.material] ?? 0 }, uCorF: { value: new THREE.Color(o.cor ?? "#FFFFFF") }, uModo: { value: o.modo ?? 0 },
    uExt: { value: new THREE.Vector2(f.ext[0], f.ext[1]) }, uPlanos: { value: new THREE.Vector4(...pl) }, uTeto: { value: f.teto }, uAndares: { value: f.andares }, uSeed: { value: o.seed ?? 1 },
    uDebug: { value: DEBUG ? 1 : 0 }, uNo: { value: o.no ?? new THREE.Matrix4() },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u); sh.uniforms.uNoite = UNI_PREDIO.uNoite;
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_CORPO);
    sh.fragmentShader = FRAG_DECL + sh.fragmentShader
      .replace("#include <map_fragment>", "#include <map_fragment>\n" + FRAG_COR)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + FRAG_RUG)
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n" + FRAG_MET)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + FRAG_EMISSAO);
  };
  m.customProgramCacheKey = () => "fachada-v2";
  return m;
}
export const semente = (s: string) => ([...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7) / 9973) * 100;

// Um modelo com o material de fachada (cada prédio tem a sua cópia; a noite é compartilhada)
export function ModeloPredio({ nome, position, rotation = 0, altura = 1, material, cor, seed = "", sombra = true }: { nome: NomeModelo; position: [number, number, number]; rotation?: number; altura?: number; material: MaterialFachada; cor?: string; seed?: string; sombra?: boolean }) {
  const gltf = useGLTF(MODELO[nome]);
  const cena = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    c.updateMatrixWorld(true); // a cópia ainda está fora da cena: matrixWorld = posição dentro do modelo
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = sombra; m.receiveShadow = false;
      m.material = materialFachada(m.material as THREE.Material, { material, cor, modo: 0, no: m.matrixWorld.clone(), forma: FORMA[nome], seed: semente(seed + nome) });
    });
    return c;
  }, [gltf.scene, material, cor, sombra, nome, seed]);
  return <primitive object={cena} position={position} rotation={[0, rotation, 0]} scale={[altura, altura, altura]} />;
}

// Igual ao ModeloInstanciado, mas com as janelas acesas à noite (casas dos lotes à venda). Material copiado uma vez por modelo.
const matNoite = new Map<string, THREE.Material>();
export function ModeloInstanciadoNoite({ nome, itens, sombra = true }: { nome: NomeModelo; itens: ItemInstancia[]; sombra?: boolean }) {
  const gltf = useGLTF(MODELO[nome]);
  const partes = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material; no: THREE.Matrix4 }[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const no = m.matrixWorld.clone(); const k = `${nome}|${m.uuid}`;
      let mat = matNoite.get(k); if (!mat) { mat = materialFachada(m.material as THREE.Material, { material: "original", modo: 3, no, forma: FORMA[nome] }); matNoite.set(k, mat); }
      out.push({ geo: m.geometry, mat, no });
    });
    return out;
  }, [gltf.scene, nome]);
  const matrizes = useMemo(() => {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    return itens.map((it) => { const h = it.altura ?? 1, xz = h * (it.escalaXZ ?? 1); e.set(0, it.rot ?? 0, 0); q.setFromEuler(e); return M.compose(new THREE.Vector3(...it.pos), q.clone(), new THREE.Vector3(xz, h, xz)).clone(); });
  }, [itens]);
  return (
    <group>
      {partes.map((p, i) => (
        <instancedMesh key={i} args={[p.geo, p.mat, itens.length]} castShadow={sombra} ref={(im) => { if (!im) return; const t = new THREE.Matrix4(); matrizes.forEach((m, k) => im.setMatrixAt(k, t.multiplyMatrices(m, p.no))); im.instanceMatrix.needsUpdate = true; }} />
      ))}
    </group>
  );
}
