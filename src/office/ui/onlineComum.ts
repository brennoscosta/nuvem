"use client";
// Pessoas na cidade agora: a parte comum ao mapa (ui/PessoasOnline.tsx) e à página inicial (app/workend/_online.tsx), sem
// nada do mapa 3D. Uma consulta a cada 15 s enquanto a aba está à vista, por mais contadores que estejam na tela.
// No mapa, quem não tem personagem manda a batida leve de visitante a cada 30 s (só um identificador aleatório deste
// navegador, para não contar a mesma pessoa duas vezes; não diz quem é) e, ao fechar a aba, avisa que saiu.
import { useEffect } from "react";
import { create } from "zustand";

export interface PessoaOnline { usuarioId: string; nome: string; boneco: string; roupa: string; x: number; z: number }
export interface ResumoOnline { total: number; personagens: number; semConta: number; semPersonagem: number; lista: PessoaOnline[] }
export const useOnline = create<{ resumo: ResumoOnline | null }>(() => ({ resumo: null }));

const URL_ONLINE = "/api/cidade/online", CHAVE_ID = "workend-visitante";
const aleatorio = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24); };
let idSessao: string | null = null;
function idDoNavegador(): string {
  try {
    let v = window.localStorage.getItem(CHAVE_ID);
    if (!v || !/^[a-z0-9]{16,40}$/.test(v)) { v = aleatorio(); window.localStorage.setItem(CHAVE_ID, v); }
    return v;
  } catch { return (idSessao ??= aleatorio()); } // sem armazenamento: vale só nesta aba
}

// o mapa diz se já sabe quem é a pessoa (pronto), se ela está com o personagem andando (aí quem conta é a batida de
// posição) e se tem conta. Antes de saber, não manda a batida de visitante (quem tem personagem contaria duas vezes)
export interface FonteMapa { pronto: () => boolean; comPersonagem: () => boolean; logado: () => boolean }
let fonte: FonteMapa | null = null, usuarios = 0, timer: ReturnType<typeof setInterval> | null = null, ultimaBatida = 0, batendo = false;

let espera: ReturnType<typeof setTimeout> | null = null;
async function tick() {
  if (document.visibilityState !== "visible") return;
  // o mapa ainda não sabe se a pessoa tem personagem: tenta de novo em 2 s (sem esperar os 15 s)
  if (fonte && !fonte.pronto() && !espera) espera = setTimeout(() => { espera = null; void tick(); }, 2000);
  try {
    let r: Response;
    const personagem = !!fonte?.comPersonagem();
    if (fonte && fonte.pronto() && !personagem && Date.now() - ultimaBatida > 29_000) {
      ultimaBatida = Date.now(); batendo = true;
      r = await fetch(URL_ONLINE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: idDoNavegador(), conta: fonte.logado(), t: Date.now() }) });
    } else {
      // passou a andar com o personagem: o visitante anônimo sai na hora (senão contaria duas vezes por 90 s)
      if (fonte && personagem && batendo) { batendo = false; void fetch(URL_ONLINE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: idDoNavegador(), sair: true, t: Date.now() }) }).catch(() => {}); }
      r = await fetch(URL_ONLINE, { cache: "no-store" });
    }
    const j = (await r.json()) as ResumoOnline;
    if (typeof j?.total === "number") useOnline.setState({ resumo: j });
  } catch { /* sem rede: tenta de novo na próxima */ }
}
const aoVer = () => { if (document.visibilityState === "visible") void tick(); };
// fechou a aba ou saiu do mapa: o número cai logo, sem esperar a batida vencer
function aoSair() {
  if (!fonte) return;
  const corpo = JSON.stringify({ id: idDoNavegador(), sair: true, personagem: fonte.comPersonagem(), t: Date.now() });
  try { navigator.sendBeacon(URL_ONLINE, new Blob([corpo], { type: "application/json" })); } catch { /* navegador sem sendBeacon */ }
  ultimaBatida = 0;
}

export function useResumoOnline(mapa?: FonteMapa) {
  const resumo = useOnline((s) => s.resumo);
  useEffect(() => {
    if (mapa) fonte = mapa;
    usuarios++;
    if (!timer) {
      timer = setInterval(() => void tick(), 15_000); void tick();
      document.addEventListener("visibilitychange", aoVer); window.addEventListener("pagehide", aoSair);
    } else if (mapa) void tick();
    return () => {
      usuarios--; if (mapa && fonte === mapa) fonte = null;
      if (!usuarios && timer) { clearInterval(timer); timer = null; document.removeEventListener("visibilitychange", aoVer); window.removeEventListener("pagehide", aoSair); }
    };
  }, [mapa]);
  return resumo;
}
export const pessoas = (n: number) => (n === 1 ? "pessoa" : "pessoas");
