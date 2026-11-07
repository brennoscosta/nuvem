// Qualidade gráfica da cena: "alta" (computador) ou "leve" (celular, tablet e máquinas fracas).
// Leve = resolução 1x, sem sombras, materiais mais simples, no máximo 30 quadros por segundo e menos gente/carros na rua.
// Ordem de decisão: ?qualidade=leve|alta na URL > escolha salva no aparelho (botão "Gráficos") > detecção automática.
export type Qualidade = "alta" | "leve";

const CHAVE = "nuvem:qualidade";
let atual: Qualidade | null = null;

export function qualidade(): Qualidade {
  if (atual) return atual;
  if (typeof window === "undefined") return "alta";
  const q = new URLSearchParams(window.location.search).get("qualidade");
  if (q === "leve" || q === "alta") return (atual = q);
  try { const s = window.localStorage.getItem(CHAVE); if (s === "leve" || s === "alta") return (atual = s); } catch { /* sem armazenamento: segue a detecção */ }
  return (atual = detectar());
}

export const leve = () => qualidade() === "leve";

// Guarda a escolha no aparelho e recarrega (sombras e antisserrilhado só mudam ao criar a cena)
export function escolherQualidade(q: Qualidade) {
  try { window.localStorage.setItem(CHAVE, q); } catch { /* ignora */ }
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
