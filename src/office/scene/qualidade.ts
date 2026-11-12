// Qualidade gráfica da cena: "alta" (computador) ou "leve" (celular, tablet e máquinas fracas).
// Leve = resolução 1x, sem sombras, materiais mais simples, no máximo 30 quadros por segundo e menos gente/carros na rua.
// Ordem de decisão: ?qualidade=leve|alta na URL > escolha salva no aparelho (botão "Gráficos") > o aparelho já travou
// antes (12/11/2026: a cena mede os quadros por segundo e, se travar, deixa marcado "leve" para a próxima visita) > detecção.
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
const CHAVE_MAPA = "workend-mapa";
let mapa2d: boolean | null = null;
export function temWebGL() {
  try { const c = document.createElement("canvas"); const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null; if (!gl) return false; gl.getExtension("WEBGL_lose_context")?.loseContext(); return true; } catch { return false; }
}
export function usarMapa2D(): boolean {
  if (mapa2d != null) return mapa2d;
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("mapa");
  if (q === "2d") return (mapa2d = true);
  if (q === "3d") return (mapa2d = false);
  try { if (window.localStorage.getItem(CHAVE_MAPA) === "2d") return (mapa2d = true); } catch { /* sem armazenamento */ }
  return (mapa2d = !temWebGL());
}
export function escolherMapa(m: "2d" | "3d") {
  try { if (m === "2d") window.localStorage.setItem(CHAVE_MAPA, "2d"); else window.localStorage.removeItem(CHAVE_MAPA); } catch { /* ignora */ }
  const u = new URL(window.location.href); u.searchParams.delete("mapa");
  if (m === "3d" && !temWebGL()) u.searchParams.set("mapa", "3d");
  window.location.replace(u.toString());
}
