// Clima da cidade (12/11/2026): o tempo de verdade de Lagarto (SE) pela Open-Meteo (gratuita, sem chave), guardado por
// 15 minutos. Todos os visitantes veem o mesmo céu. Se a Open-Meteo não responder, vale um plano B pela data e pela hora
// (o mesmo para todo mundo, sem sorteio). A neblina da manhã cedo é desenhada pela hora no navegador; aqui só entra a
// neblina de verdade (código 45/48 ou visibilidade baixa).
export type EstadoClima = "limpo" | "nublado" | "chuva" | "neblina";
export interface Clima { estado: EstadoClima; chuva: number; nuvens: number; neblina: number; fonte: "open-meteo" | "padrao"; em: string }

declare global {
  var __workendClima: { em: number; c: Clima } | undefined;
}
const LAT = -10.9136, LON = -37.6689; // Lagarto (SE)
const URL_CLIMA = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=precipitation,rain,showers,weather_code,cloud_cover,visibility&timezone=America%2FSao_Paulo`;
const lim = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const estadoDe = (chuva: number, neblina: number, nuvens: number): EstadoClima => (chuva > 0 ? "chuva" : neblina >= 0.4 ? "neblina" : nuvens > 0.75 ? "nublado" : "limpo");

// plano B: chuva em ~1 de cada 8 blocos de 3 horas, sempre igual para a mesma data e hora
function padrao(): Clima {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "0";
  let h = 2166136261; for (const ch of `${v("year")}${v("month")}${v("day")}-${Math.floor(Number(v("hour")) / 3)}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const r = (h % 1000) / 1000, nuvens = ((h >>> 10) % 100) / 100;
  const chuva = r < 0.12 ? 0.35 + r * 4 : 0;
  return { estado: estadoDe(chuva, 0, nuvens), chuva: lim(chuva), nuvens: chuva ? Math.max(0.8, nuvens) : nuvens * 0.7, neblina: 0, fonte: "padrao", em: new Date().toISOString() };
}

export async function climaAtual(): Promise<Clima> {
  const c = globalThis.__workendClima;
  if (c && Date.now() - c.em < 15 * 60_000) return c.c;
  let clima: Clima;
  try {
    const r = await fetch(URL_CLIMA, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const j = (await r.json()) as { current?: { precipitation?: number; rain?: number; showers?: number; weather_code?: number; cloud_cover?: number; visibility?: number } };
    const a = j.current; if (!a) throw new Error("sem dados");
    const cod = a.weather_code ?? 0, mm = Math.max(a.precipitation ?? 0, (a.rain ?? 0) + (a.showers ?? 0));
    const chuvaCod = (cod >= 51 && cod <= 67) || (cod >= 80 && cod <= 82) || cod >= 95;
    const forte = (cod >= 63 && cod <= 67) || cod === 81 || cod === 82 || cod >= 95;
    const chuva = chuvaCod || mm > 0.05 ? lim(0.3 + mm / 4 + (forte ? 0.3 : 0), 0.25, 1) : 0;
    const vis = a.visibility ?? 20000;
    const neblina = cod === 45 || cod === 48 ? 0.85 : vis < 1000 ? 0.8 : vis < 4000 ? 0.4 : 0;
    const nuvens = lim((a.cloud_cover ?? 0) / 100);
    clima = { estado: estadoDe(chuva, neblina, nuvens), chuva, nuvens: chuva ? Math.max(0.8, nuvens) : nuvens, neblina, fonte: "open-meteo", em: new Date().toISOString() };
  } catch (e) {
    console.error("[clima]", (e as Error).message);
    // sem resposta: guarda o plano B só por 3 minutos para tentar de novo logo
    clima = padrao();
    globalThis.__workendClima = { em: Date.now() - 12 * 60_000, c: clima };
    return clima;
  }
  globalThis.__workendClima = { em: Date.now(), c: clima };
  return clima;
}
