"use client";
// Vídeo de 1 minuto que explica o WorkEnd. Começa mudo (a legenda está gravada na imagem) quando a seção aparece;
// o play grande no centro (o vídeo inteiro é clicável) volta ao começo, liga o áudio e os controles. Só baixa o arquivo quando chega perto da tela.
import { useEffect, useRef, useState } from "react";

export function VideoExplica({ src, poster }: { src: string; poster: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const [comSom, setComSom] = useState(false);
  const [carregar, setCarregar] = useState(false);
  useEffect(() => {
    const el = v.current; if (!el) return;
    const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setCarregar(true); if (!parado && el.muted) el.play().catch(() => {}); }
      else if (el.muted) el.pause();
    }, { rootMargin: "200px 0px", threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const ouvir = () => { const el = v.current; if (!el) return; setCarregar(true); el.muted = false; el.loop = false; el.currentTime = 0; el.controls = true; el.play().catch(() => {}); setComSom(true); };
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
