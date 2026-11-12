"use client";
// Mini-mapa (12/11/2026, ideia do dono): a cidade vista de cima no canto da tela. Cada lote na cor da empresa (à venda em
// cinza, em obras em amarelo), a praça, a Nuvem e a lanchonete; filtro por área; o triângulo mostra para onde a câmera
// olha e o ponto azul é o meu personagem. Clicar num lote voa até ele e abre o cartão.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMundo, modoMundo, LOTES, useAgora, promocaoAtiva } from "../mundoStore";
import { NICHOS, nomeNicho, centroQuarteirao, QUARTEIRAO, CALCADA, LOTE } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";
import { cameraInfo } from "../scene/CameraMundo";
import { eventosDoMomento } from "../scene/Praca";
import { minhaPos, usePersonagem } from "../personagemStore";

const semAssinatura = () => () => {};
const LIM = 80; // metade do lado visível do mapa (m)
const Q = QUARTEIRAO + 2 * CALCADA;
const BLOCOS: { i: number; j: number; nome?: string; cor?: string }[] = [
  { i: 0, j: 0, nome: "Nuvem", cor: "#1D4ED8" }, { i: 1, j: 0, nome: "Lanchonete", cor: "#D97706" },
  ...[[-1, 0], [-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]].map(([i, j]) => ({ i, j })),
];

export function MiniMapa() {
  const mundo = useSyncExternalStore(semAssinatura, modoMundo, () => false);
  const terrenos = useMundo((s) => s.terrenos);
  const meu = useMundo((s) => s.meu);
  const vagas = useMundo((s) => s.vagas);
  const sel = useMundo((s) => s.loteSelecionado);
  const praca = useMundo((s) => s.praca);
  const temPersonagem = usePersonagem((s) => !!s.meu);
  const agora = useAgora();
  const [nicho, setNicho] = useState("");
  const [abertoCel, setAbertoCel] = useState(false);
  const [minimizado, setMin] = useState(false);
  const cam = useRef<SVGGElement>(null), eu = useRef<SVGCircleElement>(null);
  // a câmera e o personagem mexem a cada quadro: atualiza direto no SVG, sem redesenhar o componente
  useEffect(() => {
    let id = 0;
    const passo = () => {
      if (cam.current && cameraInfo.pronto) cam.current.setAttribute("transform", `translate(${cameraInfo.x.toFixed(1)} ${cameraInfo.z.toFixed(1)}) rotate(${(-cameraInfo.ang * 180) / Math.PI + 180})`);
      if (eu.current) { eu.current.setAttribute("cx", minhaPos.x.toFixed(1)); eu.current.setAttribute("cy", minhaPos.z.toFixed(1)); }
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, []);
  const nichosPresentes = useMemo(() => { const s = new Set(Object.values(terrenos).filter((t) => t.status === "ativo" && !t.anexoDe).map((t) => t.nicho ?? "negocios")); return NICHOS.filter((n) => s.has(n.id)); }, [terrenos]);
  if (!mundo) return null;
  const vivo = !!eventosDoMomento(praca?.agenda ?? []).vivo;
  const ir = (chave: string) => { useMundo.getState().selecionarLote(chave); setAbertoCel(false); };
  const lotes = LOTES.map((l) => {
    const t = terrenos[l.chave]; const principal = t?.anexoDe ? terrenos[t.anexoDe] : t;
    const ehPraca = l.chave === PRACA_CHAVE;
    const cor = ehPraca ? (vivo ? "#E11D48" : "#0F766E") : !t ? "#3A4452" : t.status === "ativo" ? t.cor : "#E0A91B";
    const area = principal?.nicho ?? "negocios";
    const promo = t && !t.anexoDe && t.status === "ativo" ? promocaoAtiva(t, agora) : null; // promoção na fachada (12/11/2026)
    const apagado = nicho === "__promo" ? !promo : !!nicho && (ehPraca || !t || t.status !== "ativo" || area !== nicho);
    const nome = ehPraca ? `Praça de Eventos${vivo ? " · ao vivo agora" : ""}` : !t ? `Lote ${l.numero} · à venda` : `${principal?.empresaNome ?? t.empresaNome} · Lote ${l.numero}${t.status === "ativo" ? ` · ${nomeNicho(area)}` : " · em obras"}${promo ? ` · 🏷️ ${promo.texto}` : ""}`;
    return { l, t, cor, apagado, nome, ehPraca, promo: !!promo, contratando: !!t && !t.anexoDe && (vagas[l.chave] ?? 0) > 0 };
  });
  const algumaPromo = lotes.some((x) => x.promo);
  return (
    <>
      <button data-tour="mapa" onClick={() => { setAbertoCel(true); setMin(false); }} className={`pointer-events-auto absolute right-2 top-[4.4rem] z-10 items-center gap-1.5 rounded-full bg-[#111418]/85 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur sm:left-3 sm:right-auto sm:top-20 ${abertoCel ? "hidden" : "flex"} ${minimizado ? "sm:flex" : "sm:hidden"}`}>🗺️ Mapa da cidade</button>
      <div data-tour="mapa" className={`pointer-events-auto absolute right-2 top-[4.4rem] z-10 w-[11.5rem] rounded-2xl bg-[#111418]/88 p-2 text-white shadow-2xl backdrop-blur sm:left-3 sm:right-auto sm:top-20 sm:w-[13.5rem] ${abertoCel ? "block" : "hidden"} ${minimizado ? "sm:hidden" : "sm:block"}`}>
        <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">Mapa da cidade</span>
          <button onClick={() => { setAbertoCel(false); setMin(true); }} aria-label="Fechar o mapa" className="rounded-full px-1.5 text-white/60 hover:bg-white/10">✕</button>
        </div>
        <svg viewBox={`${-LIM} ${-LIM} ${LIM * 2} ${LIM * 2}`} className="block w-full rounded-xl bg-[#1B222B]" role="img" aria-label="Mapa da cidade visto de cima">
          {/* ruas e calçadas dos quarteirões */}
          {BLOCOS.map((b) => { const [cx, cz] = centroQuarteirao(b.i, b.j); return (
            <g key={`${b.i},${b.j}`}>
              <rect x={cx - Q / 2} y={cz - Q / 2} width={Q} height={Q} rx={3} fill="#2B333E" />
              {b.nome && <g className="cursor-pointer" onClick={() => { useMundo.setState({ alvoCamera: [cx, 0.5, cz], loteSelecionado: null }); setAbertoCel(false); }}>
                <title>{b.nome}</title>
                <rect x={cx - QUARTEIRAO / 2 + 1} y={cz - QUARTEIRAO / 2 + 1} width={QUARTEIRAO - 2} height={QUARTEIRAO - 2} rx={2.5} fill={b.cor} opacity={nicho ? 0.25 : 0.85} />
                <text x={cx} y={cz + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#fff" style={{ pointerEvents: "none" }}>{b.nome}</text>
              </g>}
            </g>
          ); })}
          {lotes.map(({ l, t, cor, apagado, nome, ehPraca, contratando, promo }) => {
            const [x, z] = l.centro; const s = LOTE - 1.6; const eMeu = !!meu && (l.chave === meu || t?.anexoDe === meu);
            return (
              <g key={l.chave} className="cursor-pointer" onClick={() => ir(l.chave)} opacity={apagado ? 0.22 : 1}>
                <title>{nome}</title>
                <rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill={cor} stroke={sel === l.chave ? "#FFFFFF" : eMeu ? "#93C5FD" : "none"} strokeWidth={sel === l.chave ? 2.2 : 1.6} strokeDasharray={!t && !ehPraca ? "3 2" : undefined} fillOpacity={!t && !ehPraca ? 0.55 : 1} />
                {ehPraca && <text x={x} y={z + 3.2} textAnchor="middle" fontSize={9} style={{ pointerEvents: "none" }}>🎤</text>}
                {!t && !ehPraca && <text x={x} y={z + 2.6} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="#9AA6B4" style={{ pointerEvents: "none" }}>{l.numero}</text>}
                {contratando && <circle cx={x + s / 2 - 2.6} cy={z - s / 2 + 2.6} r={2.4} fill="#FACC15" stroke="#111418" strokeWidth={0.8} />}
                {promo && <g style={{ pointerEvents: "none" }}><circle cx={x - s / 2 + 3} cy={z + s / 2 - 3} r={3.4} fill="#E11D48" stroke="#fff" strokeWidth={0.9} /><text x={x - s / 2 + 3} y={z + s / 2 - 1.2} textAnchor="middle" fontSize={5} fontWeight={900} fill="#fff">%</text></g>}
              </g>
            );
          })}
          {/* meu personagem e a câmera */}
          {temPersonagem && <circle ref={eu} r={2.6} fill="#38BDF8" stroke="#fff" strokeWidth={1} />}
          <g ref={cam} style={{ pointerEvents: "none" }}><path d="M0 0 L-7 -14 L7 -14 Z" fill="rgba(255,255,255,.22)" /><circle r={2} fill="#fff" /></g>
        </svg>
        <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Filtrar por área" className="mt-1.5 w-full rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white outline-none [&>option]:text-[#1D2128]">
          <option value="">Todas as áreas</option>
          {algumaPromo && <option value="__promo">🏷️ Com promoção agora</option>}
          {nichosPresentes.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
        </select>
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 px-0.5 text-[9.5px] text-white/60">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm border border-dashed border-white/50 align-middle" />à venda</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#E0A91B] align-middle" />em obras</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#FACC15] align-middle" />contratando</span>
          {algumaPromo && <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#E11D48] align-middle" />promoção</span>}
        </div>
      </div>
    </>
  );
}
