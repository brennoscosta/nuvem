"use client";
// Os seis prédios: escolher um troca o detalhe embaixo (transição suave só no detalhe).
import { useState } from "react";

export interface PredioLp { id: string; nome: string; descricao: string }

export function Predios({ predios }: { predios: PredioLp[] }) {
  const [i, setI] = useState(0);
  const p = predios[i];
  return (
    <>
      <div className="grid-predios">
        {predios.map((x, k) => (
          <button key={x.id} type="button" className="predio" aria-pressed={k === i} onClick={() => setI(k)}>
            <span className="predio-art" data-asset={`predio-${k}`}>
              <img src={`/workend/render/predio-${x.id}.webp`} alt="" width={780} height={540} loading="lazy" decoding="async" />
            </span>
            <span className="predio-nome">{x.nome}</span>
          </button>
        ))}
      </div>
      <div className="detalhe" aria-live="polite">
        <div key={p.id} className="detalhe-troca">
          <h3>{p.nome}</h3>
          <p>{p.descricao}</p>
        </div>
      </div>
    </>
  );
}
