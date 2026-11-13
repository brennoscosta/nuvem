"use client";
// Galeria arrastável dos prédios (os 6 modelos e os 8 do kit modular) (renders claros sobre cartões em tons pastel), com inércia e encaixe no centro.
// O nome digitado aparece aceso numa placa (HTML) sobre o prédio do meio. Teclado (setas) e botões também giram.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PredioGaleria { id: string; nome: string; descricao: string; andares: number; cores: [string, string] }

const larguraDoCartao = (palco: number) => (palco < 640 ? Math.min(300, palco * 0.66) : Math.min(350, palco * 0.28));

export function GaleriaPredios({ predios, lote, logado }: { predios: PredioGaleria[]; lote: { chave: string; numero: number } | null; logado: boolean }) {
  const N = predios.length;
  const [pos, setPos] = useState(0);
  const [w, setW] = useState(320);
  const [nome, setNome] = useState("");
  const s = useRef({ pos: 0, alvo: 0, arrastando: false, x0: 0, p0: 0, ultX: 0, ultT: 0, v: 0, moveu: false, w: 320 });
  const palco = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  useEffect(() => {
    const el = palco.current; if (!el) return;
    const mede = () => { const x = larguraDoCartao(el.clientWidth); s.current.w = x; setW(x); };
    mede(); const ro = new ResizeObserver(mede); ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); };
  }, []);
  const anima = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { s.current.pos = s.current.alvo; setPos(s.current.pos); return; }
    let v = 0;
    const passo = () => {
      const e = s.current; if (e.arrastando) return;
      v = (v + (e.alvo - e.pos) * 0.1) * 0.74; e.pos += v; setPos(e.pos);
      if (Math.abs(e.alvo - e.pos) > 0.0008 || Math.abs(v) > 0.0008) raf.current = requestAnimationFrame(passo); else { e.pos = e.alvo; setPos(e.pos); }
    };
    raf.current = requestAnimationFrame(passo);
  }, []);
  const ir = useCallback((alvo: number) => { s.current.alvo = alvo; anima(); }, [anima]);
  const baixa = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input, a, button")) return;
    const x = s.current; x.arrastando = true; x.moveu = false; x.x0 = e.clientX; x.p0 = x.pos; x.ultX = e.clientX; x.ultT = performance.now(); x.v = 0;
    cancelAnimationFrame(raf.current); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const x = s.current; if (!x.arrastando) return;
    const dx = e.clientX - x.x0; if (Math.abs(dx) > 5) x.moveu = true;
    x.pos = x.p0 - dx / (x.w * 0.85); setPos(x.pos);
    const t = performance.now(); x.v = (e.clientX - x.ultX) / Math.max(1, t - x.ultT); x.ultX = e.clientX; x.ultT = t;
  };
  const solta = () => { const x = s.current; if (!x.arrastando) return; x.arrastando = false; ir(Math.round(x.pos - Math.max(-2, Math.min(2, x.v * 3)))); };
  const ativo = ((Math.round(pos) % N) + N) % N;
  const p = predios[ativo];
  const v = nome.trim();
  const q = new URLSearchParams(); if (lote) q.set("lote", lote.chave); if (v) q.set("empresa", v);
  const destino = logado ? (lote ? `/mundo?lote=${encodeURIComponent(lote.chave)}` : "/mundo") : `/cadastro${q.size ? `?${q}` : ""}`;
  return (
    <div className="wg">
      <div className="wg-form">
        <label className="wg-campo"><span>Escreva o nome da sua empresa</span>
          <input type="text" value={nome} maxLength={26} onChange={(e) => setNome(e.target.value)} placeholder="Padaria do Bairro" autoComplete="organization" />
        </label>
        <Link href={destino} className="wi-btn wi-btn-tinta">Reservar este nome<span aria-hidden>→</span></Link>
      </div>
      <div ref={palco} className="wg-palco" onPointerDown={baixa} onPointerMove={move} onPointerUp={solta} onPointerCancel={solta}
        role="listbox" tabIndex={0} aria-label="Tipos de prédio. Arraste para o lado ou use as setas do teclado." aria-activedescendant={`wg-${p.id}`}
        onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); ir(Math.round(pos) + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); ir(Math.round(pos) - 1); } }}
        style={{ ["--w" as string]: `${w}px` }}>
        {predios.map((x, i) => {
          let o = i - pos; o = ((((o + N / 2) % N) + N) % N) - N / 2;
          const a = Math.abs(o), sinal = Math.sign(o);
          const tx = sinal * (Math.min(a, 1) * w * 0.74 + Math.max(0, a - 1) * w * 0.42);
          const estilo = {
            transform: `translate3d(${tx.toFixed(1)}px, 0, ${(-a * 150).toFixed(1)}px) rotateY(${Math.max(-48, Math.min(48, -o * 34)).toFixed(2)}deg)`,
            zIndex: 30 - Math.round(a * 6), opacity: a > 2.6 ? 0 : 1, filter: a > 0.5 ? `brightness(${(1 - Math.min(a, 2) * 0.07).toFixed(3)})` : undefined,
            ["--c1" as string]: x.cores[0], ["--c2" as string]: x.cores[1],
          } as React.CSSProperties;
          return (
            <div key={x.id} id={`wg-${x.id}`} role="option" aria-selected={i === ativo} aria-label={x.nome}
              className={`wg-cartao ${a < 0.5 ? "centro" : ""}`} style={estilo}
              onClick={() => { if (!s.current.moveu && a >= 0.5) ir(Math.round(pos + o)); }}>
              <img src={`/workend/predios/${x.id}.webp`} alt="" draggable={false} loading={i < 2 || i > N - 2 ? "eager" : "lazy"} decoding="async" />
              <i className="wg-chao" aria-hidden />
              {a < 0.5 && (
                <div className={`wg-placa ${v ? "acesa" : ""}`} aria-hidden>
                  <div className="wg-placa-nome">{v || "Sua empresa"}</div><i />
                </div>
              )}
              <span className="wg-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            </div>
          );
        })}
      </div>
      <div className="wg-info">
        <div className="wg-pontos" aria-hidden>{predios.map((x, i) => <i key={x.id} className={i === ativo ? "on" : ""} />)}</div>
        <div className="wg-texto" key={p.id} aria-live="polite">
          <h3>{p.nome}</h3>
          <p>{p.descricao}</p>
          <small>{p.andares === 1 ? "1 andar" : `${p.andares} andares`} · dá para trocar de prédio 3 vezes sem pagar nada</small>
        </div>
        <div className="wg-acoes">
          <button type="button" className="wi-redondo" aria-label="Prédio anterior" onClick={() => ir(Math.round(pos) - 1)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <button type="button" className="wi-redondo" aria-label="Próximo prédio" onClick={() => ir(Math.round(pos) + 1)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        </div>
      </div>
    </div>
  );
}
