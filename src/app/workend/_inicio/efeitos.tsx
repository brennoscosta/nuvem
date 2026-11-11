"use client";
// Efeitos da página inicial: revelar ao rolar (liga as animações CSS só quando a seção aparece) e contador.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function Revelar({ children, className = "", como = "div", id, style }: { children: ReactNode; className?: string; como?: "div" | "section"; id?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!("IntersectionObserver" in window)) { const t = setTimeout(() => setVisto(true), 0); return () => clearTimeout(t); }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = como;
  return <Tag ref={ref as never} id={id} style={style} className={`wi-revela ${visto ? "visto" : ""} ${className}`}>{children}</Tag>;
}

export function Contador({ valor, duracao = 1200 }: { valor: number; duracao?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(valor);
  useEffect(() => {
    const el = ref.current; if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const passo = (t: number) => { const p = Math.min(1, (t - t0) / duracao); setN(Math.round(valor * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(passo); };
      setN(0); raf = requestAnimationFrame(passo);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [valor, duracao]);
  return <span ref={ref} className="wi-num">{n}</span>;
}

// Texto que se escreve e apaga, trocando de palavra (placa da cena "Coloque sua marca")
export function Maquina({ textos }: { textos: string[] }) {
  const [txt, setTxt] = useState(textos[0]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0, j = textos[0].length, apagando = true, vivo = true;
    const tick = () => {
      if (!vivo) return;
      const alvo = textos[i];
      if (apagando) { j--; if (j <= 0) { apagando = false; i = (i + 1) % textos.length; j = 0; } }
      else { j++; if (j >= textos[i].length) { apagando = true; setTxt(textos[i]); setTimeout(tick, 1600); return; } }
      setTxt((apagando ? alvo : textos[i]).slice(0, Math.max(0, j)));
      setTimeout(tick, apagando ? 45 : 85);
    };
    const t = setTimeout(tick, 1600);
    return () => { vivo = false; clearTimeout(t); };
  }, [textos]);
  return <span className="wi-maquina">{txt}<i aria-hidden /></span>;
}

// Progresso da rolagem em variáveis CSS: --e vai de 0 a 1 enquanto o bloco entra na tela; --p vai de 0 a 1 enquanto
// ele passa (usado na pilha de cartões e no vídeo que cresce). Sem movimento reduzido: fica tudo no estado final.
export function Rolagem({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { el.style.setProperty("--e", "1"); el.style.setProperty("--p", "0"); return; }
    let raf = 0, perto = false;
    const conta = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight || 800;
      const e = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.85)));
      const p = Math.max(0, Math.min(1, (vh * 0.15 - r.top) / Math.max(1, r.height - vh * 0.75)));
      el.style.setProperty("--e", e.toFixed(4)); el.style.setProperty("--p", p.toFixed(4));
    };
    const pede = () => { if (perto && !raf) raf = requestAnimationFrame(conta); };
    const io = new IntersectionObserver(([x]) => { perto = x.isIntersecting; if (perto) pede(); }, { rootMargin: "200px 0px" }); io.observe(el);
    window.addEventListener("scroll", pede, { passive: true }); window.addEventListener("resize", pede);
    conta();
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("scroll", pede); window.removeEventListener("resize", pede); };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
