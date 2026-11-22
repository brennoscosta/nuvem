// Qualidade gráfica da cena: "alta" (computador) ou "leve" (celular, tablet e máquinas fracas).
// Leve = resolução 1x, sem sombras, materiais mais simples, no máximo 30 quadros por segundo e menos gente/carros na rua.
// Ordem de decisão: ?qualidade=leve|alta na URL > escolha salva no aparelho (botão "Gráficos") > o aparelho já travou
// antes (12/11/2026: a cena mede os quadros por segundo e, se travar, deixa marcado "leve" para a próxima visita) > detecção.
import { numeroDaLoja, temNumero } from "../data/numeroLoja";
import { SEDE_POR_CHAVE, sedeDoParametro } from "../data/sedes";
import { QUIOSQUE_POR_NUMERO } from "../data/quiosques";

export type Qualidade = "alta" | "leve";

const CHAVE = "nuvem:qualidade";
const CHAVE_AUTO = "nuvem:qualidade-auto"; // marcado pela própria cena quando o aparelho não deu conta
let atual: Qualidade | null = null;

export function qualidade(): Qualidade {
  if (atual) return atual;
  if (typeof window === "undefined") return "alta";
  const q = new URLSearchParams(window.location.search).get("qualidade");
  if (q === "leve" || q === "alta") return (atual = q);
  if (q === "teste-alta") return (atual = "alta"); // teste: começa nos completos sem contar como escolha manual
  try { const s = window.localStorage.getItem(CHAVE); if (s === "leve" || s === "alta") return (atual = s); } catch { /* sem armazenamento: segue a detecção */ }
  try { if (window.localStorage.getItem(CHAVE_AUTO) === "leve") return (atual = "leve"); } catch { /* idem */ }
  return (atual = detectar());
}

export const leve = () => qualidade() === "leve";

// Celular ou tablet (20/11/2026): tela de toque ou estreita. Só para cortes que valem no celular; o computador, mesmo nos
// gráficos leves, não muda.
let ehCelular: boolean | null = null;
export function celular(): boolean {
  if (ehCelular != null) return ehCelular;
  if (typeof window === "undefined") return false;
  return (ehCelular = !!window.matchMedia?.("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 600);
}

// Guarda a escolha no aparelho e recarrega (sombras e antisserrilhado só mudam ao criar a cena)
export function escolherQualidade(q: Qualidade) {
  try { window.localStorage.setItem(CHAVE, q); window.localStorage.removeItem(CHAVE_AUTO); } catch { /* ignora */ }
  const u = new URL(window.location.href); u.searchParams.delete("qualidade");
  window.location.replace(u.toString());
}

function detectar(): Qualidade {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (window.matchMedia?.("(pointer: coarse)").matches) return "leve"; // celular e tablet
  if ((nav.hardwareConcurrency ?? 8) <= 4) return "leve";
  if ((nav.deviceMemory ?? 8) <= 4) return "leve";
  const gpu = placaDeVideo();
  if (gpu && /swiftshader|llvmpipe|software|basic render|mali-[t4]|adreno[^0-9]*[1-5]\d\d\b|powervr|intel.*(gma|hd graphics( [2-5]\d{3})?$)/i.test(gpu)) return "leve";
  return "alta";
}

function placaDeVideo(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const nome = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return nome;
  } catch { return null; }
}

// A pessoa escolheu no botão? (a queda automática respeita a escolha de "completos")
export function qualidadeManual(): Qualidade | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("qualidade"); if (q === "leve" || q === "alta") return q;
  try { const s = window.localStorage.getItem(CHAVE); return s === "leve" || s === "alta" ? s : null; } catch { return null; }
}
// a cena travou mesmo com tudo reduzido: a próxima visita já começa nos gráficos leves
export function lembrarLeveAuto() { try { window.localStorage.setItem(CHAVE_AUTO, "leve"); } catch { /* ignora */ } }

// ---------- mapa simples (2D) ----------
// Para aparelho sem WebGL ou fraco demais: ?mapa=2d força, ?mapa=3d volta; a escolha do botão fica salva no aparelho.
// Plano B (WE-20, 22/11/2026): a cena 3D também cai sozinha para cá quando perde o contexto do WebGL (faltou memória de
// vídeo e a tela fica preta) ou quando passa 5 s abaixo de 20 quadros por segundo já nos gráficos leves, depois de a cidade
// carregar (Cena3D). O aparelho fica marcado (CHAVE_MAPA_AUTO) e as próximas visitas já abrem no 2D, com o aviso e o botão
// "Tentar o 3D de novo" (ui/Mapa2D). Quem chegou por link de loja aberta (?lote=, ?sede=, ?quiosque=) vai para a página da
// loja (/loja/N?sem3d=1, feita no servidor e sem WebGL), com o botão "Ver a loja na cidade em 3D".
const CHAVE_MAPA = "workend-mapa";
const CHAVE_MAPA_AUTO = "workend-mapa-auto"; // por que o aparelho caiu sozinho para o 2D
export type MotivoQueda = "contexto" | "lento";
let mapa2d: boolean | null = null;
let motivo: MotivoQueda | "sem-webgl" | null = null; // null: o 2D foi escolha da pessoa (ou é o 3D)
export function temWebGL() {
  try { const c = document.createElement("canvas"); const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null; if (!gl) return false; gl.getExtension("WEBGL_lose_context")?.loseContext(); return true; } catch { return false; }
}
function quedaSalva(): MotivoQueda | null {
  try { const v = window.localStorage.getItem(CHAVE_MAPA_AUTO); return v === "contexto" || v === "lento" ? v : null; } catch { return null; }
}
export function usarMapa2D(): boolean {
  if (mapa2d != null) return mapa2d;
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("mapa");
  if (q === "2d") return (mapa2d = true);
  if (q === "3d") return (mapa2d = false);
  try { if (window.localStorage.getItem(CHAVE_MAPA) === "2d") return (mapa2d = true); } catch { /* sem armazenamento */ }
  motivo = quedaSalva() ?? (temWebGL() ? null : "sem-webgl");
  return (mapa2d = motivo != null);
}
// o mapa simples desta visita veio sozinho (aparelho sem WebGL ou que já caiu do 3D), não de uma escolha da pessoa
export function motivo2D() { return usarMapa2D() ? motivo : null; }
export function escolherMapa(m: "2d" | "3d") {
  const caiu = quedaSalva() != null;
  try { if (m === "2d") window.localStorage.setItem(CHAVE_MAPA, "2d"); else window.localStorage.removeItem(CHAVE_MAPA); window.localStorage.removeItem(CHAVE_MAPA_AUTO); } catch { /* ignora */ }
  const u = new URL(window.location.href); u.searchParams.delete("mapa");
  // "Tentar o 3D de novo" (WE-20): com ?mapa=3d a lentidão só avisa nesta visita, não derruba de novo para o 2D
  if (m === "3d" && (caiu || !temWebGL())) u.searchParams.set("mapa", "3d");
  window.location.replace(u.toString());
}

// página da loja do link (?lote=, ?sede=, ?quiosque=), só se a loja estiver aberta (as sedes sempre estão). Lote livre ou
// fechado fica no mapa simples: a página dele manda de volta ao mapa para reservar (sem isso, ida e volta sem fim).
// ?sem3d=webgl: o navegador não tem WebGL nenhum (a página oferece o mapa 2D, não o 3D); ?sem3d=1: o aparelho caiu do 3D.
type TerrenoMin = { status: string; anexoDe?: string | null };
export function paginaDaLojaDoLink(terrenos: Record<string, TerrenoMin>, semWebGL = false): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const marca = `?sem3d=${semWebGL ? "webgl" : "1"}`;
  const sede = sedeDoParametro(q.get("sede"));
  if (sede) return `/loja/${sede.numeroLoja}${marca}`;
  const qk = q.get("quiosque");
  const chave = q.get("lote") ?? (qk && /^\d+$/.test(qk) ? QUIOSQUE_POR_NUMERO[Number(qk)]?.chave ?? null : qk);
  if (!chave) return null;
  const t = terrenos[chave], principal = t?.anexoDe ? terrenos[t.anexoDe] : t;
  if (!SEDE_POR_CHAVE[chave] && principal?.status !== "ativo") return null;
  const n = numeroDaLoja({ chave, anexoDe: t?.anexoDe ?? null });
  return temNumero(n) ? `/loja/${n}${marca}` : null;
}
export const veioPorLinkDeLoja = () => { if (typeof window === "undefined") return false; const q = new URLSearchParams(window.location.search); return q.has("lote") || q.has("sede") || q.has("quiosque"); };

// a cena 3D não deu conta: marca o aparelho e recarrega no mapa simples (ou abre a página da loja do link)
let caindo = false;
export function cairPara2D(m: MotivoQueda, terrenos: Record<string, TerrenoMin>) {
  if (caindo || typeof window === "undefined") return;
  caindo = true;
  let guardou = false;
  try { window.localStorage.setItem(CHAVE_MAPA_AUTO, m); guardou = true; } catch { /* sem armazenamento: vai pela URL */ }
  const loja = paginaDaLojaDoLink(terrenos);
  if (loja) { window.location.replace(loja); return; }
  const u = new URL(window.location.href); u.searchParams.delete("mapa");
  if (!guardou) u.searchParams.set("mapa", "2d"); // sem a marca, a recarga voltaria ao 3D que acabou de cair
  window.location.replace(u.toString());
}
