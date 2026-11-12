"use client";
// Som ambiente do mapa (12/11/2026, "vida e clima"): quatro camadas em loop (trânsito, pássaros, chuva e a música da
// praça), cada uma com o seu volume, que a cena (scene/SomCena) ajusta pela posição da câmera, pela hora e pelo clima.
// DESLIGADO por padrão: só toca depois que a pessoa liga no botão (ui/Som). A escolha fica salva no aparelho; se ficou
// ligada da visita anterior, o som começa no primeiro toque na tela (o navegador não deixa tocar antes).
// Os arquivos foram gerados para o WorkEnd na ElevenLabs (efeitos sonoros, em loop) e ficam em public/workend/sons.
export type Camada = "transito" | "passaros" | "chuva" | "praca";
const ARQUIVO: Record<Camada, string> = { transito: "/workend/sons/transito.mp3", passaros: "/workend/sons/passaros.mp3", chuva: "/workend/sons/chuva.mp3", praca: "/workend/sons/praca.mp3" };
const MAXIMO: Record<Camada, number> = { transito: 0.5, passaros: 0.42, chuva: 0.7, praca: 0.5 };
const CHAVE = "workend-som";

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
const ganhos: Partial<Record<Camada, GainNode>> = {};
let ligado = (() => { try { return typeof window !== "undefined" && window.localStorage.getItem(CHAVE) === "1"; } catch { return false; } })();
let tocando = false; // o contexto de áudio está rodando (ligado e já houve um toque)
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export const somLigado = () => ligado;
export function assinarSom(cb: () => void) { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; }
export function alternarSom() {
  ligado = !ligado;
  try { window.localStorage.setItem(CHAVE, ligado ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta visita */ }
  avisar();
  if (ligado) void tocar(); else calar();
}

async function carregar(c: AudioContext, camada: Camada) {
  try {
    const r = await fetch(ARQUIVO[camada]); const buf = await c.decodeAudioData(await r.arrayBuffer());
    const fonte = c.createBufferSource(); fonte.buffer = buf; fonte.loop = true;
    // o MP3 tem um pedacinho de silêncio no começo e no fim: o loop pula os dois para não "piscar"
    fonte.loopStart = Math.min(0.03, buf.duration / 4); fonte.loopEnd = Math.max(fonte.loopStart + 0.5, buf.duration - 0.03);
    const g = c.createGain(); g.gain.value = 0; fonte.connect(g); g.connect(mestre!);
    fonte.start(0, fonte.loopStart + Math.random() * (fonte.loopEnd - fonte.loopStart)); // cada camada começa num ponto diferente
    ganhos[camada] = g;
  } catch (e) { console.warn("[som]", camada, (e as Error).message); }
}
async function tocar() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC(); mestre = ctx.createGain(); mestre.gain.value = 0; mestre.connect(ctx.destination);
    for (const c of Object.keys(ARQUIVO) as Camada[]) void carregar(ctx, c);
  }
  try { await ctx.resume(); } catch { return; }
  tocando = ctx.state === "running";
  mestre?.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
}
function calar() {
  tocando = false;
  if (!ctx || !mestre) return;
  mestre.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  const c = ctx; setTimeout(() => { if (!ligado) void c.suspend(); }, 700);
}

// a cena chama ~5 vezes por segundo com o volume de cada camada (0 a 1)
export function definirVolumes(v: Record<Camada, number>) {
  if (!ctx || !tocando) return;
  for (const c of Object.keys(v) as Camada[]) ganhos[c]?.gain.setTargetAtTime(Math.max(0, Math.min(1, v[c])) * MAXIMO[c], ctx.currentTime, 0.6);
}

if (typeof window !== "undefined") {
  // aba escondida: para tudo; voltou: continua (se estava ligado)
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "hidden") void ctx.suspend();
    else if (ligado) void ctx.resume().then(() => { tocando = ctx?.state === "running"; });
  });
  // ligado da visita anterior: começa no primeiro toque (regra dos navegadores para som)
  const primeiroToque = () => { if (ligado && !tocando) void tocar(); };
  window.addEventListener("pointerdown", primeiroToque, { passive: true });
  window.addEventListener("keydown", primeiroToque);
}
