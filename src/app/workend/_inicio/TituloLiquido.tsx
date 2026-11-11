"use client";
// Tipografia líquida: cada letra engorda quando o ponteiro chega perto (fonte variável com mola) e o toque solta uma
// onda de choque que passa pelas letras. Sem mouse (celular, ou mouse parado), um ponteiro imaginário passeia pela frase
// e de tempos em tempos solta uma onda sozinho.
import { useEffect, useRef, type ReactNode } from "react";

const W_MIN = 220, W_MAX = 900;

export function TituloLiquido({ texto, depois, como = "h1", className = "", oculto = false }: { texto: string; depois?: ReactNode; como?: "h1" | "h2" | "p"; className?: string; oculto?: boolean }) {
  const raiz = useRef<HTMLHeadingElement>(null);
  const anel = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = raiz.current; if (!el) return;
    const letras = [...el.querySelectorAll<HTMLSpanElement>(".wl-l")];
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { letras.forEach((l) => (l.style.fontVariationSettings = `"wght" 700`)); return; }
    const peso = letras.map(() => W_MIN + 140), vel = letras.map(() => 0), sobe = letras.map(() => 0), vsobe = letras.map(() => 0);
    let centros: { x: number; y: number }[] = [], tam = 80, caixa = el.getBoundingClientRect();
    const medir = () => {
      caixa = el.getBoundingClientRect();
      tam = parseFloat(getComputedStyle(letras[0] ?? el).fontSize) || 80;
      centros = letras.map((l) => { const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    };
    const ponteiro = { x: -9999, y: -9999, mouse: false, visto: -1e9 };
    const ondas: { x: number; y: number; t0: number }[] = [];
    let ultimaAuto = performance.now();
    const onda = (x: number, y: number) => {
      ondas.push({ x, y, t0: performance.now() }); if (ondas.length > 3) ondas.shift();
      const o = document.createElement("span"); o.className = "wl-onda"; o.style.left = `${x - caixa.left}px`; o.style.top = `${y - caixa.top}px`;
      o.addEventListener("animationend", () => o.remove()); el.appendChild(o);
    };
    const mexe = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; ponteiro.x = e.clientX; ponteiro.y = e.clientY; ponteiro.mouse = true; ponteiro.visto = performance.now(); };
    const toca = (e: PointerEvent) => { medir(); onda(e.clientX, e.clientY); ultimaAuto = performance.now(); };
    window.addEventListener("pointermove", mexe, { passive: true });
    el.addEventListener("pointerdown", toca);
    let raf = 0, quadro = 0, visivel = true;
    const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) medir(); }, { threshold: 0 }); io.observe(el);
    const passo = (t: number) => {
      raf = requestAnimationFrame(passo);
      if (!visivel) return;
      if (quadro++ % 20 === 0) medir();
      const R = tam * 1.9;
      let px = ponteiro.x, py = ponteiro.y;
      const solto = !ponteiro.mouse || t - ponteiro.visto > 2400;
      if (solto) {
        const s = t / 1000;
        px = caixa.left + caixa.width * (0.5 + 0.48 * Math.sin(s * 0.5));
        py = caixa.top + caixa.height * (0.45 + 0.35 * Math.sin(s * 0.93 + 1));
        if (t - ultimaAuto > 5200 && centros.length) { const c = centros[Math.floor(Math.random() * centros.length)]; onda(c.x, c.y); ultimaAuto = t; }
      }
      const a = anel.current;
      if (a) { const ax = +(a.dataset.x || caixa.width / 2), ay = +(a.dataset.y || caixa.height / 2); const nx = ax + (px - caixa.left - ax) * 0.1, ny = ay + (py - caixa.top - ay) * 0.1; a.dataset.x = String(nx); a.dataset.y = String(ny); a.style.transform = `translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`; }
      for (let i = 0; i < letras.length; i++) {
        const c = centros[i]; if (!c) continue;
        const d = Math.hypot(px - c.x, py - c.y);
        let alvo = W_MIN + (W_MAX - W_MIN) * Math.exp(-((d / R) ** 2));
        let empurra = 0;
        for (const o of ondas) {
          const idade = t - o.t0, raio = idade * 1.5;
          const banda = Math.exp(-(((Math.hypot(o.x - c.x, o.y - c.y) - raio) / (tam * 0.8)) ** 2)) * Math.max(0, 1 - idade / 1500);
          alvo += banda * 560; empurra += banda * tam * 0.14;
        }
        alvo = Math.min(W_MAX, alvo);
        vel[i] = (vel[i] + (alvo - peso[i]) * 0.085) * 0.8; peso[i] += vel[i];
        vsobe[i] = (vsobe[i] + (empurra - sobe[i]) * 0.16) * 0.76; sobe[i] += vsobe[i];
        letras[i].style.fontVariationSettings = `"wght" ${Math.max(100, Math.min(900, peso[i])).toFixed(0)}`;
        letras[i].style.transform = Math.abs(sobe[i]) > 0.15 ? `translateY(${(-sobe[i]).toFixed(1)}px)` : "";
      }
      while (ondas.length && t - ondas[0].t0 > 1600) ondas.shift();
    };
    medir(); raf = requestAnimationFrame(passo);
    const r = () => medir();
    window.addEventListener("resize", r); window.addEventListener("scroll", r, { passive: true });
    document.fonts?.ready.then(r).catch(() => {});
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("pointermove", mexe); el.removeEventListener("pointerdown", toca); window.removeEventListener("resize", r); window.removeEventListener("scroll", r); };
  }, [texto]);
  const Tag = como;
  const palavras = texto.split(" ");
  return (
    <Tag ref={raiz as never} className={`wl ${className}`} aria-hidden={oculto || undefined} aria-label={oculto ? undefined : texto + (typeof depois === "string" ? " " + depois : "")}>
      <span className="wl-anel" ref={anel} aria-hidden />
      <span className="wl-linha" aria-hidden>
        {palavras.map((p, k) => <span key={k} className="wl-p">{[...p].map((ch, j) => <span key={j} className="wl-l">{ch}</span>)}</span>)}
      </span>
      {depois && <span className="wl-depois" aria-hidden>{depois}</span>}
    </Tag>
  );
}
