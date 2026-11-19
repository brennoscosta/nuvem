"use client";
// Acabamento da imagem (12/11/2026; refeito em 18/11/2026, pedido do dono: "melhore toda a renderização").
//
// Ajustes globais (valem nos dois modos e não custam nada a mais por quadro; entram antes de qualquer sombreador compilar):
//  - curva de tom própria ("filme"): cores fiéis no meio, altas luzes que não estouram e um pouco mais de profundidade.
//    A ACES de antes puxava o verde para o amarelo e deixava tudo com cara de jogo;
//  - borda da sombra macia: a área com sombra acompanha a câmera e, em vez de cortar seco na borda, a sombra some aos poucos;
//  - oclusão de contato pela altura: paredes, meio-fio, troncos e rodas escurecem um pouco onde encostam no chão;
//  - filtragem anisotrópica de fábrica para toda textura nova (chão, fachadas e placas nítidos de longe e em ângulo).
//
// Só no modo completo (componente Acabamento):
//  - reflexos e luz de ambiente tirados do PRÓPRIO céu da hora (cúpula do CicloDia): azul de dia, laranja no fim da tarde,
//    azul-marinho com o brilho da cidade à noite. O vidro, os carros e o mar refletem o céu que aparece na tela.
//    O mapa de ambiente é refeito só quando a cor do céu muda (troca de hora, chuva), nunca a cada quadro;
//  - a força desses reflexos acompanha o dia, a noite e a chuva (scene.environmentIntensity é só um número: não recompila).
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ceu, luzInterna, UNIFORMES_CEU, DIR_SOL } from "./CicloDia";
import { clima } from "../clima";
import { leve } from "./qualidade";

// ---------- curva de tom ----------
// Contraste leve em torno do cinza médio (0,18) em escala logarítmica, ombro do "PBR Neutral" da Khronos (as cores
// abaixo de ~0,76 ficam como foram pintadas; acima, comprimem sem mudar o tom) e um pouco menos de saturação (cores de arquitetura, não de jogo).
const CURVA_TOM = /* glsl */ `vec3 CustomToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = 0.18 * exp2( log2( max( color, vec3( 1e-5 ) ) / 0.18 ) * 1.06 );
	float x = min( color.r, min( color.g, color.b ) );
	float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= off;
	float pico = max( color.r, max( color.g, color.b ) );
	if ( pico > 0.76 ) {
		float d = 0.24;
		float novo = 1.0 - d * d / ( pico + d - 0.76 );
		color *= novo / pico;
		float g = 1.0 - 1.0 / ( 0.15 * ( pico - novo ) + 1.0 );
		color = mix( color, vec3( novo ), g );
	}
	float l = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	return clamp( mix( vec3( l ), color, 0.94 ), 0.0, 1.0 );
}`;
function trocarTrecho(chunk: keyof typeof THREE.ShaderChunk, antes: string, depois: string, desde = 0) {
  const s = THREE.ShaderChunk[chunk] as string;
  const i = s.indexOf(antes, desde);
  if (i < 0) return false;
  // indexOf/slice (e não String.replace): o texto novo pode ter "$" e o replace interpretaria
  (THREE.ShaderChunk as Record<string, string>)[chunk] = s.slice(0, i) + depois + s.slice(i + antes.length);
  return true;
}
const MARCA = "/* workend-acabamento */";
function ajustesGlobais() {
  if ((THREE.ShaderChunk.tonemapping_pars_fragment as string).includes(MARCA)) return { tom: true };
  const tom = trocarTrecho("tonemapping_pars_fragment", "vec3 CustomToneMapping( vec3 color ) { return color; }", MARCA + "\n" + CURVA_TOM);
  // sombra que some aos poucos nos últimos 7% da área (só o filtro PCF, o que a cena usa)
  const pcf = (THREE.ShaderChunk.shadowmap_pars_fragment as string).indexOf("5 samples using Vogel disk");
  if (pcf >= 0) trocarTrecho("shadowmap_pars_fragment", "return mix( 1.0, shadow, shadowIntensity );", `vec2 bordaSombra = min( shadowCoord.xy, 1.0 - shadowCoord.xy );
			return mix( 1.0, shadow, shadowIntensity * smoothstep( 0.0, 0.07, min( bordaSombra.x, bordaSombra.y ) ) );`, pcf);
  // oclusão de contato pela altura: superfícies em pé (paredes, meio-fio, troncos, rodas, pernas) recebem menos luz de
  // ambiente perto do chão (y = 0), como acontece de verdade onde a parede encontra o piso. Conta feita no próprio
  // sombreador dos materiais com luz (posição de vista + matriz da câmera): sem passe extra, sem textura, sem varying novo
  if (!(THREE.ShaderChunk.aomap_fragment as string).includes("aoContatoWE")) {
    (THREE.ShaderChunk as Record<string, string>).aomap_fragment = `
#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
	{
		vec3 cimaWE = viewMatrix[ 1 ].xyz;
		float alturaWE = cameraPosition.y - dot( cimaWE, vViewPosition );
		float paredeWE = 1.0 - abs( dot( normal, cimaWE ) );
		float aoContatoWE = mix( 1.0, mix( 0.5, 1.0, smoothstep( 0.0, 1.3, alturaWE ) ), paredeWE );
		reflectedLight.indirectDiffuse *= aoContatoWE;
		reflectedLight.directDiffuse *= mix( 1.0, aoContatoWE, 0.25 );
	}
#endif
` + THREE.ShaderChunk.aomap_fragment;
  }
  // anisotrópica: o three limita ao máximo da placa de vídeo. Leve: 4 (quase de graça até em celular)
  THREE.Texture.DEFAULT_ANISOTROPY = leve() ? 4 : 8;
  return { tom };
}
// roda ao carregar o módulo (o Cena3D importa este arquivo antes de criar o Canvas)
const GLOBAIS = typeof window !== "undefined" ? ajustesGlobais() : { tom: false };
// a exposição da curva é ajustada pela hora no CicloDia
export const TOM_PROPRIO = GLOBAIS.tom;

// ---------- reflexos do céu da hora ----------
const CAMPOS_TEXTURA = ["map", "roughnessMap", "metalnessMap", "normalMap", "emissiveMap", "aoMap"] as const;
// céu do ambiente: os mesmos uniformes da cúpula, mais o chão (embaixo), o sol e o brilho da cidade no horizonte à noite
const U_AMB = {
  uBaixo: { value: new THREE.Color() }, uAlto: { value: new THREE.Color() }, uChao: { value: new THREE.Color() },
  uSolDir: { value: new THREE.Vector3(0, 1, 0) }, uSolCor: { value: new THREE.Color() }, uSol: { value: 1 }, uCidade: { value: new THREE.Color() },
};
const MAT_AMBIENTE = new THREE.ShaderMaterial({
  uniforms: U_AMB, side: THREE.BackSide, depthWrite: false, depthTest: false,
  vertexShader: "varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  // saída linear (vai para o mapa de ambiente, não para a tela): sem curva de tom nem conversão de cor
  fragmentShader: /* glsl */ `uniform vec3 uBaixo, uAlto, uChao, uSolDir, uSolCor, uCidade; uniform float uSol; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 ceuCor = mix(uBaixo, uAlto, pow(smoothstep(0.0, 0.85, d.y), 0.7));
  vec3 chao = mix(uBaixo * 0.5, uChao, 1.0 - smoothstep(-0.22, 0.0, d.y));
  vec3 c = mix(chao, ceuCor, smoothstep(-0.025, 0.02, d.y));
  c += uCidade * exp(-abs(d.y) * 12.0);
  float s = max(dot(d, uSolDir), 0.0);
  c += uSolCor * (pow(s, 1400.0) * 40.0 + pow(s, 28.0) * 0.5) * uSol;
  gl_FragColor = vec4(c, 1.0);
}`,
});
const CHAO_DIA = new THREE.Color("#7F8C72"), CHAO_NOITE = new THREE.Color("#1A1D24"), CIDADE = new THREE.Color("#FFB36B");
const SOL_DIA = new THREE.Color("#FFF1DC"), SOL_NOITE = new THREE.Color("#9FB4FF");
// lê o céu da hora (CicloDia) e diz se mudou o bastante para refazer o mapa de ambiente
const ultimo = new Float32Array(16), atual = new Float32Array(16);
function guardar(c: THREE.Color, k: number) { atual[k] = c.r; atual[k + 1] = c.g; atual[k + 2] = c.b; }
function lerCeu() {
  const n = ceu.noite, fechado = ceu.nublado;
  U_AMB.uBaixo.value.copy(UNIFORMES_CEU.uCeuBaixo.value);
  U_AMB.uAlto.value.copy(UNIFORMES_CEU.uCeuAlto.value);
  U_AMB.uChao.value.copy(CHAO_DIA).lerp(CHAO_NOITE, n).multiplyScalar(THREE.MathUtils.lerp(0.42, 0.1, n) * (1 - fechado * 0.35));
  U_AMB.uSolDir.value.copy(DIR_SOL);
  U_AMB.uSolCor.value.copy(UNIFORMES_CEU.uSolCor.value).lerp(SOL_DIA, 1 - ceu.crep).lerp(SOL_NOITE, n);
  U_AMB.uSol.value = (1 - fechado * 0.9) * THREE.MathUtils.lerp(1, 0.08, n);
  U_AMB.uCidade.value.copy(CIDADE).multiplyScalar(0.16 * n);
  // compara com o céu do último mapa FEITO (não com o quadro anterior: a troca lenta do modo automático também conta)
  guardar(U_AMB.uBaixo.value, 0); guardar(U_AMB.uAlto.value, 3); guardar(U_AMB.uChao.value, 6); guardar(U_AMB.uSolCor.value, 9);
  const d = U_AMB.uSolDir.value; atual[12] = d.x; atual[13] = d.y; atual[14] = d.z; atual[15] = U_AMB.uSol.value;
  let mudou = false;
  for (let k = 0; k < 16; k++) if (Math.abs(atual[k] - ultimo[k]) > 0.01) { mudou = true; break; }
  if (mudou) ultimo.set(atual);
  return mudou;
}

// fora do componente: as luzes são objetos do three.js, não estado do React
function compensarLuzes(h: THREE.HemisphereLight | null, p: THREE.DirectionalLight | null) {
  // o céu do ambiente já ilumina por todo lado (azulado de dia, quente no fim da tarde): a luz de hemisfério e a de
  // preenchimento (que o CicloDia ajusta a cada quadro, antes deste componente) caem para as formas ganharem volume
  // à noite o céu quase não ilumina: a luz de hemisfério volta a ser o ambiente (senão a cidade escurece demais)
  if (h) h.intensity *= THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.5, 0.85, ceu.noite), 0.85, luzInterna.k);
  if (p) p.intensity *= 0.7;
}
// o gerador do mapa de ambiente, a cena do céu e o mapa atual (fora do React: objetos do three.js)
interface Ambiente { pmrem: THREE.PMREMGenerator; cena: THREE.Scene; geo: THREE.BufferGeometry; alvo: THREE.WebGLRenderTarget | null; ate: number }
function criarAmbiente(gl: THREE.WebGLRenderer): Ambiente {
  const cena = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 48, 24);
  cena.add(new THREE.Mesh(geo, MAT_AMBIENTE));
  ultimo.fill(-1);
  return { pmrem: new THREE.PMREMGenerator(gl), cena, geo, alvo: null, ate: 0 };
}
function liberarAmbiente(a: Ambiente, cena: THREE.Scene) {
  if (a.alvo) { if (cena.environment === a.alvo.texture) cena.environment = null; a.alvo.dispose(); }
  a.pmrem.dispose(); a.geo.dispose();
}
// refaz o mapa de ambiente quando o céu muda (no máximo 4 vezes por segundo, durante a troca de dia e noite)
function passoAmbiente(a: Ambiente, cena: THREE.Scene, t: number) {
  if (t < a.ate || (!lerCeu() && a.alvo)) return;
  a.ate = t + 0.25;
  const novo = a.pmrem.fromScene(a.cena, 0, 0.1, 50, { size: 128 });
  cena.environment = novo.texture;
  a.alvo?.dispose(); a.alvo = novo;
}
function forcaReflexos(cena: THREE.Scene) {
  const chuva = Math.min(1, Math.max(0, clima.chuva));
  cena.environmentIntensity = 0.95 * (1 - 0.55 * ceu.noite * (1 - luzInterna.k)) * (1 - 0.3 * chuva);
}
export function Acabamento({ hemi, preench }: { hemi: React.RefObject<THREE.HemisphereLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }) {
  const scene = useThree((s) => s.scene), gl = useThree((s) => s.gl);
  const amb = useRef<Ambiente | null>(null);
  useEffect(() => {
    const a = criarAmbiente(gl); amb.current = a;
    return () => { amb.current = null; liberarAmbiente(a, scene); };
  }, [gl, scene]);
  useFrame((estado) => {
    if (amb.current) passoAmbiente(amb.current, estado.scene, estado.clock.elapsedTime);
    forcaReflexos(estado.scene);
    compensarLuzes(hemi.current, preench.current);
  });
  useEffect(() => {
    const max = Math.min(8, gl.capabilities.getMaxAnisotropy());
    // texturas criadas antes deste módulo (ou com anisotrópica baixa de propósito): passa de novo algumas vezes
    const aplicar = () => scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; if (!m) return;
      for (const x of Array.isArray(m) ? m : [m]) for (const k of CAMPOS_TEXTURA) {
        const t = (x as unknown as Record<string, THREE.Texture | null | undefined>)[k];
        if (t && t.anisotropy < max) { t.anisotropy = max; t.needsUpdate = true; }
      }
    });
    const ts = [4000, 15000, 40000].map((ms) => setTimeout(aplicar, ms));
    return () => ts.forEach(clearTimeout);
  }, [scene, gl]);
  return null;
}
