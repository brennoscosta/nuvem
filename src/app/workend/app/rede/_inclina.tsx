"use client";
// Efeito 3D (16/11/2026): o bloco inclina seguindo o mouse, com um reflexo de luz onde o ponteiro está; o que tiver
// profundidade (translateZ no CSS) parece flutuar na frente. Só com mouse e sem "movimento reduzido"; no toque fica parado.
// Mexe direto no estilo do elemento (sem estado do React), então não renderiza de novo a cada movimento.
import { useRef, type CSSProperties, type ReactNode } from "react";

export function Inclina({ className, style, children, suave }: { className?: string; style?: CSSProperties; children: ReactNode; suave?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    const g = suave ? 6 : 10;
    el.style.setProperty("--rx", `${(-y * g).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * g).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
    el.dataset.ativo = "";
  };
  const sair = () => {
    const el = ref.current; if (!el) return;
    el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
    delete el.dataset.ativo;
  };
  return (
    <div ref={ref} className={`inclina ${className ?? ""}`} style={style} onPointerMove={mover} onPointerLeave={sair}>
      {children}
      <span className="inclina-luz" aria-hidden="true" />
    </div>
  );
}
