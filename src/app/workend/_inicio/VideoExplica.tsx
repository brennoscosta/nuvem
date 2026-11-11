"use client";
// Vídeo de 1 minuto (como funciona o WorkEnd). Não toca sozinho: só baixa e toca quando a pessoa clica.
import { useState } from "react";

export function VideoExplica({ src, poster }: { src: string; poster: string }) {
  const [tocando, setTocando] = useState(false);
  return (
    <div className="viewport" data-asset="video">
      {tocando ? (
        <video src={src} poster={poster} controls autoPlay playsInline aria-label="Como funciona o WorkEnd, em 1 minuto" />
      ) : (
        <button type="button" className="video-btn" onClick={() => setTocando(true)} aria-label="Assistir: como funciona o WorkEnd, em 1 minuto, com som">
          <img src={poster} alt="" width={1280} height={720} loading="lazy" decoding="async" />
          <span><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>Como funciona, em 1 minuto</span>
        </button>
      )}
    </div>
  );
}
