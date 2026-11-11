"use client";
// Seção dos especialistas de IA, no estilo "objeto de vidro sobre azul-oceano". No computador, a esfera é 3D de
// verdade e segue o mouse; no celular (ou sem WebGL), uma esfera desenhada em CSS com o prédio dentro.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AlvoEsfera } from "./EsferaVidro";
import { leve as aparelhoLeve } from "@/office/scene/qualidade";

const EsferaVidro = dynamic(() => import("./EsferaVidro"), { ssr: false });

export function SecaoEsfera({ texto, rodape, id }: { texto: ReactNode; rodape?: ReactNode; id?: string }) {
  const secao = useRef<HTMLElement>(null), palco = useRef<HTMLDivElement>(null);
  const [modo3d, setModo3d] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [ativa, setAtiva] = useState(false);
  const [alvo, setAlvo] = useState<AlvoEsfera | null>(null);
  useEffect(() => {
    const s = secao.current, p = palco.current; if (!s || !p) return;
    const mede = () => {
      const a = s.getBoundingClientRect(), b = p.getBoundingClientRect();
      setAlvo({ fx: (b.left + b.width / 2 - (a.left + a.width / 2)) / a.width, fy: (b.top + b.height / 2 - (a.top + a.height / 2)) / a.height, fr: (Math.min(b.width, b.height) * 0.46) / a.height });
    };
    const t = setTimeout(() => {
      let gl = false; try { const c = document.createElement("canvas"); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { gl = false; }
      setModo3d(gl && window.innerWidth >= 900 && !aparelhoLeve());
      mede();
    }, 0);
    const ro = new ResizeObserver(mede); ro.observe(s);
    const io = new IntersectionObserver(([e]) => setAtiva(e.isIntersecting), { rootMargin: "120px 0px" }); io.observe(s);
    return () => { clearTimeout(t); ro.disconnect(); io.disconnect(); };
  }, []);
  return (
    <section ref={secao} id={id} className={`wa ${modo3d && pronto ? "com-3d" : ""}`}>
      <div className="wa-fundo" aria-hidden>{modo3d && alvo && <EsferaVidro alvo={alvo} ativa={ativa} fonte={secao} onPronto={() => setTimeout(() => setPronto(true), 350)} />}</div>
      <div className="faixa wa-grade">
        <div className="wa-texto">{texto}</div>
        <div className="wa-palco" ref={palco} aria-hidden>
          <div className="wa-bola"><span className="wa-grama" /><img src="/workend/predios/vidro.webp" alt="" /><i className="wa-reflexo" /></div>
        </div>
      </div>
      {rodape}
    </section>
  );
}
