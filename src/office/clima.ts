"use client";
// Clima no navegador. 24/11/2026 (pedido do dono: "retirar o clima, tipo nublado... sempre lá deve ser normal ensolarado,
// tarde ou noite... isso pesa, e temos que deixar o mapa mais leve possível"): o céu é sempre limpo. Não busca mais o
// clima da cidade (/api/workend/clima), não tem chuva, poças, chão molhado, céu fechado nem neblina da manhã; a cena da
// chuva (scene/Clima.tsx) não é montada. O ciclo do dia (manhã, tarde, noite) continua em scene/CicloDia.
// Os campos ficam aqui, sempre no céu limpo, porque o céu, o mar, as nuvens e o som ainda os leem.
export type EstadoClima = "limpo" | "nublado" | "chuva" | "neblina";
export const clima = {
  estado: "limpo" as EstadoClima,
  chuva: 0, neblina: 0, nuvens: 0, molhado: 0, // valores atuais (0 a 1), suavizados
  alvo: { chuva: 0, neblina: 0, nuvens: 0 },
};

// céu limpo, sempre (o mesmo PRONTO.limpo de antes)
let iniciado = false;
export function iniciarClima() {
  if (iniciado) return;
  iniciado = true;
  clima.estado = "limpo"; clima.alvo.chuva = 0; clima.alvo.neblina = 0; clima.alvo.nuvens = 0.15;
  clima.chuva = 0; clima.neblina = 0; clima.nuvens = 0.15; clima.molhado = 0;
}

// neblina da manhã: desligada desde 24/11/2026 (céu sempre limpo)
export function neblinaDaManha(_h: number | null) { void _h; return 0; }

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
