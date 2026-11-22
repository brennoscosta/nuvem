"use client";
// Vídeo de 1 minuto que explica o WorkEnd. Começa mudo (a legenda está gravada na imagem) quando a seção aparece;
// o play grande no centro (o vídeo inteiro é clicável) volta ao começo, liga o áudio e os controles. Só baixa o arquivo quando chega perto da tela.
// WE-16 (22/11/2026): e só depois do evento load da página (o arquivo tem 19 MB e disputava a rede com o pôster e o
// JavaScript). Com economia de dados ou rede 2G/3G não começa sozinho: fica o pôster até a pessoa tocar no play.
import { useEffect, useRef, useState } from "react";

export function VideoExplica({ src, poster }: { src: string; poster: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const [comSom, setComSom] = useState(false);
  const [carregar, setCarregar] = useState(false);
  useEffect(() => {
    const el = v.current; if (!el) return;
    const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rede = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const economia = !!rede?.saveData || /^(slow-2g|2g|3g)$/.test(rede?.effectiveType ?? "");
    let visivel = false, liberado = document.readyState === "complete", t = 0;
    const tentar = () => { if (visivel && liberado && !economia) { setCarregar(true); if (!parado && el.muted) el.play().catch(() => {}); } };
    const liberar = () => { if (liberado) return; liberado = true; window.clearTimeout(t); tentar(); };
    const io = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      if (visivel) tentar();
      else if (el.muted) el.pause();
    }, { rootMargin: "200px 0px", threshold: 0.25 });
    io.observe(el);
    // depois do load, mais um respiro (o navegador termina de pintar); se o load demorar, libera em 8 s
    const aoCarregar = () => { if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(liberar, { timeout: 2000 }); else window.setTimeout(liberar, 200); };
    if (!liberado) { window.addEventListener("load", aoCarregar, { once: true }); t = window.setTimeout(liberar, 8000); }
    return () => { io.disconnect(); window.removeEventListener("load", aoCarregar); window.clearTimeout(t); };
  }, []);
  // com economia de dados o src só entra no toque: o play() espera o React pôr o src (antes dele o navegador não toca)
  const tocarAoEntrar = useRef(false);
  useEffect(() => { const el = v.current; if (carregar && el && tocarAoEntrar.current) { tocarAoEntrar.current = false; el.play().catch(() => {}); } }, [carregar]);
  const ouvir = () => { const el = v.current; if (!el) return; el.muted = false; el.loop = false; el.currentTime = 0; el.controls = true; if (carregar) el.play().catch(() => {}); else { tocarAoEntrar.current = true; setCarregar(true); } setComSom(true); };
  return (
    <div className="wc-video">
      <video ref={v} src={carregar ? src : undefined} poster={poster} muted loop playsInline preload="none" aria-label="Como funciona o WorkEnd, em 1 minuto" onEnded={() => setComSom(false)} />
      {!comSom && (
        <button type="button" className="wc-play" onClick={ouvir} aria-label="Assistir com som: como funciona o WorkEnd, em 1 minuto">
          <span className="wc-play-bola"><svg viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg></span>
          <span className="wc-play-rotulo">Assistir com som<small>1 min</small></span>
        </button>
      )}
    </div>
  );
}
