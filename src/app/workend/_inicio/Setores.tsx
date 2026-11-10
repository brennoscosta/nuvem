"use client";
// Os setores viram salas do prédio: a sala acende na cor do setor e mostra quem trabalha lá (os especialistas que estão chegando).
import { useEffect, useRef, useState } from "react";

export interface SetorVitrine { id: string; nome: string; cor: string; entrega: string; equipe: { nome: string; cargo: string; skills: string[] }[] }

export function Setores({ setores }: { setores: SetorVitrine[] }) {
  const [i, setI] = useState(0);
  const parado = useRef(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!parado.current) setI((x) => (x + 1) % setores.length); }, 3600);
    return () => clearInterval(t);
  }, [setores.length]);
  const s = setores[i];
  return (
    <div className="wi-setores" onMouseEnter={() => { parado.current = true; }} onMouseLeave={() => { parado.current = false; }}>
      <div className="wi-setores-lista" role="tablist" aria-label="Setores">
        {setores.map((x, k) => (
          <button key={x.id} role="tab" aria-selected={k === i} className={k === i ? "on" : ""} style={{ ["--cor" as string]: x.cor }} onClick={() => { parado.current = true; setI(k); }}>
            <b aria-hidden />{x.nome}
          </button>
        ))}
      </div>
      <div className="wi-sala" key={s.id} style={{ ["--cor" as string]: s.cor }} role="tabpanel">
        <div className="wi-sala-piso" aria-hidden>
          {Array.from({ length: 6 }, (_, k) => <span key={k} className="wi-mesa" style={{ ["--k" as string]: k }} />)}
        </div>
        <div className="wi-sala-info">
          <h3>Sala de {s.nome}</h3>
          <p>{s.entrega[0].toUpperCase() + s.entrega.slice(1)}.</p>
          <ul>
            {s.equipe.map((m, k) => (
              <li key={m.nome + k} style={{ ["--k" as string]: k }}>
                <span className="wi-avatar" aria-hidden>{m.nome[0]}</span>
                <div><b>{m.nome}</b><small>{m.cargo}</small><em>{m.skills.slice(0, 2).join(" · ")}</em></div>
              </li>
            ))}
          </ul>
          <span className="wi-embreve">Agentes de IA em breve</span>
        </div>
      </div>
    </div>
  );
}
