"use client";
// Fita da cidade: fotos reais do mapa do WorkEnd ondulando pela tela numa curva que desce na diagonal.
// A fita é mais comprida que a tela (as fotos esperam fora dela) e acelera um pouco quando a pessoa rola a página.
import { useEffect, useRef } from "react";

const PROPORCAO = 604 / 480;

export function FitaCidade({ fotos }: { fotos: string[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const tiles = [...el.querySelectorAll<HTMLElement>(".wf-foto")];
    const parado = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let u = 0.18, extra = 0, ultY = window.scrollY, raf = 0, visivel = true, tAnt = performance.now();
    const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }, { threshold: 0 }); io.observe(el);
    const rola = () => { const y = window.scrollY; extra = Math.min(0.05, extra + Math.abs(y - ultY) * 0.00003); ultY = y; };
    window.addEventListener("scroll", rola, { passive: true });
    const desenha = (t: number) => {
      const W = el.clientWidth, H = el.clientHeight, n = tiles.length;
      const lado = Math.max(66, Math.min(132, W / 10.5)), alto = lado * PROPORCAO;
      const L = Math.max(W + lado * 2, n * lado * 1.14);
      for (let i = 0; i < n; i++) {
        const k = (i / n + u) % 1;
        const x = -lado + k * L;
        const xr = Math.max(0, Math.min(1, x / Math.max(1, W)));
        const q = Math.min(1, xr / 0.72), desce = q * q * (3 - 2 * q);
        const e = 0.78 + 0.32 * Math.sin(Math.PI * xr);
        const y = (H - alto * 1.12) * (0.02 + 0.92 * desce) + Math.sin(xr * 9 + t / 1500) * Math.min(18, H * 0.04);
        const giro = Math.cos(xr * 9 + t / 1500) * 4;
        const st = tiles[i].style;
        st.width = `${lado.toFixed(1)}px`;
        st.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${giro.toFixed(2)}deg) scale(${e.toFixed(3)})`;
        st.visibility = x > W + 10 ? "hidden" : "visible";
      }
    };
    const passo = (t: number) => {
      raf = requestAnimationFrame(passo);
      const dt = Math.min(0.05, (t - tAnt) / 1000); tAnt = t;
      if (!visivel) return;
      if (!parado) { u = (u + dt * (0.012 + extra)) % 1; extra *= 0.95; }
      desenha(parado ? 0 : t);
    };
    desenha(0); el.classList.add("pronta");
    raf = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("scroll", rola); };
  }, []);
  return (
    <div className="wf" ref={caixa} aria-hidden>
      {fotos.map((f) => <span key={f} className="wf-foto"><img src={f} alt="" loading="lazy" decoding="async" draggable={false} /></span>)}
    </div>
  );
}
