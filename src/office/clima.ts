"use client";
// Clima no navegador (12/11/2026): busca o clima da cidade (/api/workend/clima, o mesmo para todos) a cada 10 minutos e
// guarda num objeto lido a cada quadro pela cena (chuva, poças, neblina, céu, faróis, som). As trocas são suaves: a chuva
// começa e para aos poucos, o chão molha rápido e seca devagar. ?clima=chuva|neblina|limpo|nublado força (prévias e testes).
// Neblina da manhã cedo: vem da hora (5h–8h, mais forte por volta das 6h), somada à neblina de verdade do clima.

export type EstadoClima = "limpo" | "nublado" | "chuva" | "neblina";
export const clima = {
  estado: "limpo" as EstadoClima,
  chuva: 0, neblina: 0, nuvens: 0, molhado: 0, // valores atuais (0 a 1), suavizados
  alvo: { chuva: 0, neblina: 0, nuvens: 0 },
};

const FORCADO = (() => {
  if (typeof window === "undefined") return null;
  const c = new URLSearchParams(window.location.search).get("clima");
  return c === "chuva" || c === "neblina" || c === "limpo" || c === "nublado" ? (c as EstadoClima) : null;
})();
const PRONTO: Record<EstadoClima, { chuva: number; neblina: number; nuvens: number }> = {
  limpo: { chuva: 0, neblina: 0, nuvens: 0.15 }, nublado: { chuva: 0, neblina: 0, nuvens: 0.9 },
  chuva: { chuva: 0.85, neblina: 0.15, nuvens: 1 }, neblina: { chuva: 0, neblina: 0.9, nuvens: 0.6 },
};

let iniciado = false;
export function iniciarClima() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  if (FORCADO) {
    clima.estado = FORCADO; Object.assign(clima.alvo, PRONTO[FORCADO]);
    // forçado: já começa no clima pedido (as fotos dos testes não esperam a chuva chegar)
    clima.chuva = clima.alvo.chuva; clima.neblina = clima.alvo.neblina; clima.nuvens = clima.alvo.nuvens; clima.molhado = clima.alvo.chuva > 0 ? 1 : 0;
    return;
  }
  const buscar = () => {
    fetch("/api/workend/clima").then((r) => (r.ok ? r.json() : null)).then((c: { estado?: EstadoClima; chuva?: number; neblina?: number; nuvens?: number } | null) => {
      if (!c?.estado) return;
      clima.estado = c.estado; clima.alvo.chuva = c.chuva ?? 0; clima.alvo.neblina = c.neblina ?? 0; clima.alvo.nuvens = c.nuvens ?? 0;
    }).catch(() => { /* sem clima: segue o céu limpo */ });
  };
  buscar();
  setInterval(buscar, 10 * 60_000);
}

// neblina pela hora: 0 fora das 5h–8h30; pico de 0,5 às 6h
export function neblinaDaManha(h: number | null) {
  if (h == null || h < 5 || h > 8.5) return 0;
  return h < 6 ? 0.5 * (h - 5) : 0.5 * (1 - (h - 6) / 2.5);
}

// chamado uma vez por quadro (scene/CicloDia): aproxima os valores atuais dos alvos
let primeiroPasso = true;
export function passoClima(dt: number, hora: number | null) {
  const a = clima.alvo, k = Math.min(1, dt * 0.35);
  // ao abrir o mapa a neblina da manhã já está lá (não "chega" na frente de quem acabou de entrar)
  if (primeiroPasso) { primeiroPasso = false; clima.neblina = Math.max(clima.neblina, neblinaDaManha(hora)); }
  clima.chuva += (a.chuva - clima.chuva) * k;
  clima.nuvens += (a.nuvens - clima.nuvens) * k;
  clima.neblina += (Math.max(a.neblina, neblinaDaManha(hora)) - clima.neblina) * Math.min(1, dt * 0.2);
  // o chão molha em ~10 s de chuva e seca em ~2 min
  clima.molhado = clima.chuva > 0.15 ? Math.min(1, clima.molhado + dt * 0.1) : Math.max(0, clima.molhado - dt * 0.008);
}
