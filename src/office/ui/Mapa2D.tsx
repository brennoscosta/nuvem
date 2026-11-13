"use client";
// Mapa simples em 2D (12/11/2026): a mesma cidade vista de cima, desenhada (ruas com faixa, calçadas, árvores, praia ao
// sul e a leste como no 3D, as lojas na cor e com a logo de cada empresa, a praça com o palco). Para aparelho sem WebGL
// ou fraco demais, ou para quem escolhe "Mapa simples". Tocar num lote abre o mesmo cartão do mapa 3D (o Painel e os
// cartões usam o mundoStore, que não depende da cena). Arrastar move, a roda ou o pinçar aproximam.
import { useEffect, useRef, useState } from "react";
import { useMundo, LOTES, useAgora, promocaoAtiva, type Terreno } from "../mundoStore";
import { QUARTEIROES, centroQuarteirao, EIXOS_RUA, RUA, MEIO_Q, BORDA_CALCADA, PASSO, N, EIXO_RUA, LOTE, nomeNicho, type LoteInfo } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";
import { escolherMapa } from "../scene/qualidade";

const L = N * PASSO + EIXO_RUA + 12; // metade do lado desenhado (m)
const ASFALTO = "#545962", FAIXA = "#F3EEDF", CALCADA = "#E4DFD4", GRAMA = "#9ACB78", GRAMA_Q = "#B2DA93";
const ESC_MIN = 0.9, ESC_MAX = 4.5;

// árvores de rua: uma a cada 8 m nas calçadas, com uma variação fixa (o mesmo desenho sempre)
const ARVORES: [number, number, number][] = [];
for (const q of QUARTEIROES) {
  const [cx, cz] = centroQuarteirao(q.i, q.j), B = MEIO_Q + 1.2;
  for (let d = -16; d <= 16; d += 8) for (const [x, z] of [[cx + d, cz - B], [cx + d, cz + B], [cx - B, cz + d], [cx + B, cz + d]]) ARVORES.push([x, z, 1.5 + ((Math.abs(x * 7 + z * 13) % 10) / 10) * 0.6]);
}

function Arvore({ x, z, r }: { x: number; z: number; r: number }) {
  return <g><circle cx={x + 0.5} cy={z + 0.6} r={r} fill="#000" opacity={0.12} /><circle cx={x} cy={z} r={r} fill="#4E9A4A" /><circle cx={x - r * 0.3} cy={z - r * 0.3} r={r * 0.45} fill="#6DBA5E" /></g>;
}
// casa à venda (as do 3D): telhado em duas águas visto de cima
function Casa({ x, z, cor = "#C0623A" }: { x: number; z: number; cor?: string }) {
  return (
    <g>
      <rect x={x - 5.6} y={z - 4.4} width={11.2} height={8.8} rx={0.8} fill="#000" opacity={0.14} transform="translate(0.8 0.9)" />
      <rect x={x - 5.6} y={z - 4.4} width={11.2} height={4.4} rx={0.6} fill={cor} />
      <rect x={x - 5.6} y={z} width={11.2} height={4.4} rx={0.6} fill={cor} opacity={0.78} />
      <line x1={x - 5.6} y1={z} x2={x + 5.6} y2={z} stroke="#7A3B22" strokeWidth={0.35} />
    </g>
  );
}

// Ícone do tipo de prédio no canto do prédio (13/11/2026): desenho de traço numa caixa de 10 × 10
const ICONE_PREDIO: Record<string, string> = {
  vidro: "M2 1h6v8H2z M4 1v8 M6 1v8", moderno: "M1 4h8v5H1z M3 1.5h4v2.5", sobrado: "M1 5L5 1.5L9 5V9H1z M4 9V6.5h2V9",
  loja: "M1 2.5h8l-1 2.2H2z M2 4.7V9h6V4.7", galpao: "M1 9V5a4 4 0 0 1 8 0v4z", container: "M1 3h8v5H1z M3.6 3v5 M6.4 3v5",
  comercial: "M2 1h6v8H2z M2 3.7h6 M2 6.3h6 M5 6.3V9", torre: "M3 0.5h4v9H3z M5 0.5v9 M3 3.5h4 M3 6.5h4", esquina: "M1 9V2h5l3 3v4z M6 2v7",
  logistico: "M1 2.5h5v4.5H1z M6 4h2l1 1.5V7H6z M2.5 8.2a0.8 0.8 0 1 0 0.01 0 M7.3 8.2a0.8 0.8 0 1 0 0.01 0",
  industrial: "M1 9V5.5l2-1.5v1.5l2-1.5v1.5l2-1.5V9z M7.6 9V1h1.2v8", coworking: "M1 2h8v7H1z M1 4.3h8 M1 6.6h8 M4 2v2.3 M6.5 4.3v2.3 M4 6.6V9",
  cafeteria: "M2 3h5v3.6a2.2 2.2 0 0 1-2.2 2.2H4.2A2.2 2.2 0 0 1 2 6.6z M7 3.8h0.8a1.4 1.4 0 0 1 0 2.8H7 M3.5 1v1 M5.5 1v1",
  consultorio: "M4 1.5h2v3h3v2H6v3H4v-3H1v-2h3z",
};
function IconePredio({ id, x, z }: { id: string; x: number; z: number }) {
  const d = ICONE_PREDIO[id]; if (!d) return null;
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={x + 0.25} cy={z + 0.3} r={2.1} fill="#000" opacity={0.18} />
      <circle cx={x} cy={z} r={2.1} fill="#FFFFFF" />
      <path d={d} transform={`translate(${x - 1.4} ${z - 1.4}) scale(0.28)`} fill={id === "consultorio" ? "#1F8A64" : "none"} stroke="#1D2128" strokeWidth={id === "consultorio" ? 0 : 0.95} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

// lote da cidade: loja aberta (prédio na cor da empresa), em obras, à venda (casa ou terreno) ou a praça
function Lote2D({ l, t, principal, anexoMeio, sel, vagas, promo, vivo }: { l: LoteInfo; t?: Terreno; principal?: Terreno; anexoMeio: number | null; sel: boolean; vagas: number; promo: string | null; vivo: boolean }) {
  const [x, z] = l.centro, s = LOTE - 1.6;
  const ehPraca = l.chave === PRACA_CHAVE;
  const abrir = () => useMundo.getState().selecionarLote(l.chave);
  const borda = sel ? <rect x={x - s / 2 - 0.4} y={z - s / 2 - 0.4} width={s + 0.8} height={s + 0.8} rx={2.2} fill="none" stroke="#FFFFFF" strokeWidth={1.1} className="mapa2d-sel" /> : null;
  if (ehPraca) return (
    <g className="cursor-pointer" onClick={abrir} role="button" aria-label="Praça de Eventos">
      <rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill="#E9E1CF" />
      {Array.from({ length: 5 }, (_, i) => <line key={i} x1={x - s / 2 + 1} y1={z - s / 2 + 2 + i * 3.6} x2={x + s / 2 - 1} y2={z - s / 2 + 2 + i * 3.6} stroke="#D6CBB2" strokeWidth={0.25} />)}
      <rect x={x - 6} y={z - s / 2 + 1} width={12} height={4} rx={0.6} fill="#2B2F36" />
      <rect x={x - 4.5} y={z - s / 2 + 1.4} width={9} height={1.6} rx={0.3} fill={vivo ? "#E11D48" : "#5B9DFF"} className={vivo ? "mapa2d-pisca" : ""} />
      {[-4, 0, 4].map((dx) => <rect key={dx} x={x + dx - 1.4} y={z + 1.5} width={2.8} height={0.8} rx={0.3} fill="#8A5A33" />)}
      {[-4, 0, 4].map((dx) => <rect key={"b" + dx} x={x + dx - 1.4} y={z + 4.5} width={2.8} height={0.8} rx={0.3} fill="#8A5A33" />)}
      <Arvore x={x - s / 2 + 2.4} z={z + s / 2 - 2.4} r={1.6} />
      <Arvore x={x + s / 2 - 2.4} z={z + s / 2 - 2.4} r={1.6} />
      <Rotulo x={x} z={z - s / 2 - 1.6} texto={vivo ? "Praça · ao vivo" : "Praça de Eventos"} cor={vivo ? "#E11D48" : "#0F766E"} />
      {borda}
    </g>
  );
  // ampliação de um lote duplo: o prédio do principal já cobre os dois terrenos
  if (t?.anexoDe && principal?.status === "ativo") return <g className="cursor-pointer" onClick={abrir}><rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill="transparent" />{borda}</g>;
  if (t && t.status === "ativo") {
    // prédio: no lote duplo ele ocupa o meio dos dois terrenos
    const cx = anexoMeio ?? x, larg = anexoMeio != null ? 2 * LOTE - 8 : 12, prof = 12;
    const logo = t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null;
    return (
      <g className="cursor-pointer" onClick={abrir} role="button" aria-label={`${t.empresaNome}, lote ${l.numero}`}>
        <rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill="#D8E6CF" />
        <rect x={cx - larg / 2 + 1.1} y={z - prof / 2 + 1.3} width={larg} height={prof} rx={1.4} fill="#000" opacity={0.18} />
        <rect x={cx - larg / 2} y={z - prof / 2} width={larg} height={prof} rx={1.4} fill={t.cor} />
        <rect x={cx - larg / 2 + 1} y={z - prof / 2 + 1} width={larg - 2} height={prof - 2} rx={1} fill="#FFFFFF" opacity={0.12} />
        {logo ? <image href={logo} x={cx - 3.6} y={z - 3.6} width={7.2} height={7.2} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }} /> : <text x={cx} y={z + 1.6} textAnchor="middle" fontSize={4.4} fontWeight={900} fill="#fff" style={{ pointerEvents: "none" }}>{t.empresaNome.slice(0, 2).toUpperCase()}</text>}
        {t.escritorio && <IconePredio id={t.escritorio.layout} x={cx - larg / 2 + 2.4} z={z - prof / 2 + 2.4} />}
        <Rotulo x={cx} z={z - prof / 2 - 1.6} texto={t.empresaNome} sub={nomeNicho(t.nicho)} cor={t.cor} />
        {vagas > 0 && <g style={{ pointerEvents: "none" }}><circle cx={cx + larg / 2 - 1} cy={z + prof / 2 - 1} r={1.6} fill="#FACC15" stroke="#1D2128" strokeWidth={0.3} /></g>}
        {promo && <g style={{ pointerEvents: "none" }}><rect x={cx - larg / 2 - 0.6} y={z + prof / 2 - 2.6} width={Math.min(14, promo.length * 1.25 + 4)} height={3.4} rx={1.7} fill="#E11D48" /><text x={cx - larg / 2 + 1.1} y={z + prof / 2 - 0.25} fontSize={2.2} fontWeight={900} fill="#fff">% {promo.slice(0, 12)}</text></g>}
        {borda}
      </g>
    );
  }
  if (t) return (
    <g className="cursor-pointer" onClick={abrir} role="button" aria-label={`${t.empresaNome}, em obras`}>
      <rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill="#E8E2D2" />
      <rect x={x - s / 2 + 1} y={z - s / 2 + 1} width={s - 2} height={s - 2} rx={1.4} fill="none" stroke={t.cor} strokeWidth={0.8} strokeDasharray="2 1.2" />
      <text x={x} y={z + 1} textAnchor="middle" fontSize={2.6} fontWeight={800} fill="#7A6A4A" style={{ pointerEvents: "none" }}>EM OBRAS</text>
      <Rotulo x={x} z={z - s / 2 - 1.6} texto={t.empresaNome} sub="reservado" cor={t.cor} />
      {borda}
    </g>
  );
  // à venda: a casa antiga ou o terreno vazio, com a placa
  return (
    <g className="cursor-pointer" onClick={abrir} role="button" aria-label={`Lote ${l.numero} à venda`}>
      <rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill={GRAMA_Q} />
      {l.lote.tipo === "casa" ? <Casa x={x} z={z - 1} cor={({ casaVelha: "#9C6B4E", casaTerrea: "#C0623A", casaSobrado: "#8A8F98", casaColonial: "#B5552F", casaModerna: "#6B7280" } as Record<string, string>)[l.lote.modelo] ?? "#C0623A"} /> : l.lote.tipo === "vazio" && l.lote.arvore ? <Arvore x={x + 3} z={z - 2} r={2.6} /> : null}
      <g style={{ pointerEvents: "none" }}>
        <rect x={x - (10 + String(l.numero).length * 1.3) / 2} y={z + 4.4} width={10 + String(l.numero).length * 1.3} height={3.4} rx={0.6} fill="#FFFFFF" stroke="#1D4ED8" strokeWidth={0.3} />
        <text x={x} y={z + 6.75} textAnchor="middle" fontSize={1.9} fontWeight={800} fill="#1D4ED8">À VENDA · {l.numero}</text>
      </g>
      {borda}
    </g>
  );
}
// balão do nome (como no 3D, mais simples)
function Rotulo({ x, z, texto, sub, cor }: { x: number; z: number; texto: string; sub?: string; cor: string }) {
  // cabe na largura do lote (18 m): nome comprido fica com a letra menor, sem encostar no vizinho
  const t = texto.trim().slice(0, 20) || "Sua empresa", natural = t.length * 1.55 + 3, w = Math.min(18.4, Math.max(10, natural)), k = Math.min(1, 18.4 / natural), h = sub ? 5.4 : 3.8;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={x - w / 2} y={z - h} width={w} height={h} rx={1.4} fill={cor} stroke="#fff" strokeWidth={0.35} />
      <path d={`M${x - 1} ${z} L${x} ${z + 1.2} L${x + 1} ${z} Z`} fill={cor} />
      <text x={x} y={z - h + 2.7} textAnchor="middle" fontSize={2.3 * k} fontWeight={900} fill="#fff">{t}</text>
      {sub && <text x={x} y={z - h + 4.6} textAnchor="middle" fontSize={1.5} fontWeight={700} fill="#fff" opacity={0.85}>{sub.toUpperCase()}</text>}
    </g>
  );
}

export function Mapa2D() {
  const terrenos = useMundo((s) => s.terrenos);
  const sel = useMundo((s) => s.loteSelecionado);
  const vagas = useMundo((s) => s.vagas);
  const praca = useMundo((s) => s.praca);
  const alvo = useMundo((s) => s.alvoCamera);
  const agora = useAgora();
  // vista: centro (m) e escala (1 = a cidade inteira na tela)
  const [vista, setVista] = useState({ x: 0, z: 6, esc: 1.15 });
  const caixa = useRef<SVGSVGElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const arrasto = useRef({ moveu: 0, dist: 0 });
  // lote escolhido no mini-mapa ou na busca: a vista vai até ele (o mesmo "alvo da câmera" do 3D)
  useEffect(() => {
    if (!alvo) return;
    const t = setTimeout(() => { setVista((v) => ({ x: alvo[0], z: alvo[2], esc: Math.max(v.esc, 2.2) })); useMundo.getState().limparAlvo(); }, 0);
    return () => clearTimeout(t);
  }, [alvo]);
  // a praça (agenda) também carrega aqui, para o "ao vivo" do palco
  useEffect(() => { void useMundo.getState().carregarPraca?.(); }, []);
  const vivo = !!praca?.agenda.some((e) => new Date(e.inicio).getTime() <= agora && new Date(e.fim).getTime() > agora);
  const metros = (dxPx: number) => { const r = caixa.current?.getBoundingClientRect(); return r ? (dxPx / Math.min(r.width, r.height)) * ((2 * L) / vista.esc) : 0; };
  const limitar = (v: { x: number; z: number; esc: number }) => ({ esc: Math.min(ESC_MAX, Math.max(ESC_MIN, v.esc)), x: Math.max(-L, Math.min(L, v.x)), z: Math.max(-L, Math.min(L, v.z)) });
  const zoom = (f: number) => setVista((v) => limitar({ ...v, esc: v.esc * f }));
  const lado = (2 * L) / vista.esc;
  const anexos: Record<string, number> = {};
  for (const t of Object.values(terrenos)) if (t.anexoDe && t.status === "ativo") { const a = LOTES.find((l) => l.chave === t.chave), p = LOTES.find((l) => l.chave === t.anexoDe); if (a && p) anexos[p.chave] = (a.centro[0] + p.centro[0]) / 2; }
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#7FB6D9]">
      <svg ref={caixa} viewBox={`${vista.x - lado / 2} ${vista.z - lado / 2} ${lado} ${lado}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full touch-none select-none"
        role="img" aria-label="Mapa simples da cidade do WorkEnd"
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onPointerDown={(e) => { toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); arrasto.current.moveu = 0; if (toques.current.size === 2) { const [a, b] = [...toques.current.values()]; arrasto.current.dist = Math.hypot(a.x - b.x, a.y - b.y); } }}
        onPointerMove={(e) => {
          const ant = toques.current.get(e.pointerId); if (!ant) return;
          const dx = e.clientX - ant.x, dy = e.clientY - ant.y; toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          arrasto.current.moveu += Math.abs(dx) + Math.abs(dy);
          if (toques.current.size === 2) { const [a, b] = [...toques.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (arrasto.current.dist) zoom(d / arrasto.current.dist); arrasto.current.dist = d; return; }
          if (arrasto.current.moveu > 4) setVista((v) => limitar({ ...v, x: v.x - metros(dx), z: v.z - metros(dy) }));
        }}
        onPointerUp={(e) => toques.current.delete(e.pointerId)} onPointerCancel={(e) => toques.current.delete(e.pointerId)}
        onClickCapture={(e) => { if (arrasto.current.moveu > 6) { e.stopPropagation(); e.preventDefault(); } }}>
        <defs>
          <pattern id="m2-grama" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={GRAMA} /><circle cx="1.5" cy="1.5" r="0.35" fill="#8BBE69" /><circle cx="4.5" cy="4.2" r="0.3" fill="#A6D484" /></pattern>
          <linearGradient id="m2-mar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8FD0EA" /><stop offset="1" stopColor="#4E9CCB" /></linearGradient>
        </defs>
        {/* mar e praia ao sul e a leste (como o horizonte do 3D) */}
        <rect x={-L - 60} y={-L - 60} width={2 * L + 120} height={2 * L + 120} fill="url(#m2-mar)" />
        <rect x={-L} y={-L} width={2 * L + 6} height={2 * L + 6} rx={8} fill="#EBD9A8" />
        <rect x={-L} y={-L} width={2 * L - 4} height={2 * L - 4} rx={6} fill="url(#m2-grama)" />
        {/* ruas */}
        {EIXOS_RUA.map((e) => <g key={"r" + e}>
          <rect x={-L} y={e - RUA / 2} width={2 * L - 4} height={RUA} fill={ASFALTO} />
          <rect x={e - RUA / 2} y={-L} width={RUA} height={2 * L - 4} fill={ASFALTO} />
        </g>)}
        {EIXOS_RUA.map((e) => <g key={"f" + e}>
          <line x1={-L} y1={e} x2={L - 4} y2={e} stroke={FAIXA} strokeWidth={0.3} strokeDasharray="2.4 2.4" />
          <line x1={e} y1={-L} x2={e} y2={L - 4} stroke={FAIXA} strokeWidth={0.3} strokeDasharray="2.4 2.4" />
        </g>)}
        {/* faixas de pedestre nos cruzamentos */}
        {EIXOS_RUA.flatMap((a) => EIXOS_RUA.map((b) => (
          <g key={`z${a},${b}`} fill={FAIXA} opacity={0.9}>
            {[-2.4, -1.2, 0, 1.2, 2.4].map((d) => <rect key={"n" + d} x={a + d - 0.35} y={b - RUA / 2 - 2.2} width={0.7} height={1.8} />)}
            {[-2.4, -1.2, 0, 1.2, 2.4].map((d) => <rect key={"o" + d} x={a - RUA / 2 - 2.2} y={b + d - 0.35} width={1.8} height={0.7} />)}
          </g>
        )))}
        {/* quarteirões: calçada e miolo */}
        {QUARTEIROES.map((q) => { const [cx, cz] = centroQuarteirao(q.i, q.j); return (
          <g key={`q${q.i},${q.j}`}>
            <rect x={cx - BORDA_CALCADA} y={cz - BORDA_CALCADA} width={2 * BORDA_CALCADA} height={2 * BORDA_CALCADA} rx={3} fill={CALCADA} />
            <rect x={cx - MEIO_Q} y={cz - MEIO_Q} width={2 * MEIO_Q} height={2 * MEIO_Q} rx={2} fill={GRAMA_Q} />
            {q.ocupante === "nuvem" && <g>
              <rect x={cx - 15} y={cz - 13} width={30} height={26} rx={2} fill="#000" opacity={0.18} transform="translate(1.2 1.4)" />
              <rect x={cx - 15} y={cz - 13} width={30} height={26} rx={2} fill="#1D4ED8" />
              {Array.from({ length: 4 }, (_, i) => Array.from({ length: 3 }, (_, k) => <rect key={`${i}${k}`} x={cx - 12 + i * 6.4} y={cz - 10 + k * 7} width={4.6} height={4.6} rx={0.6} fill="#5B9DFF" opacity={0.6} />))}
              <Rotulo x={cx} z={cz - 14} texto="Nuvem" sub="tecnologia" cor="#1D4ED8" />
            </g>}
            {q.ocupante === "restaurante" && <g>
              <rect x={cx - 12} y={cz - 9} width={24} height={18} rx={2} fill="#000" opacity={0.18} transform="translate(1.2 1.4)" />
              <rect x={cx - 12} y={cz - 9} width={24} height={18} rx={2} fill="#D97706" />
              {[-8, -2, 4].map((d) => <circle key={d} cx={cx + d + 2} cy={cz + 13} r={1.4} fill="#FFFFFF" stroke="#D97706" strokeWidth={0.4} />)}
              <Rotulo x={cx} z={cz - 10} texto="Lanchonete" cor="#D97706" />
            </g>}
          </g>
        ); })}
        {ARVORES.map(([x, z, r], i) => <Arvore key={i} x={x} z={z} r={r} />)}
        {/* lotes */}
        {LOTES.map((l) => {
          const t = terrenos[l.chave], principal = t?.anexoDe ? terrenos[t.anexoDe] : undefined;
          return <Lote2D key={l.chave} l={l} t={t} principal={principal} anexoMeio={anexos[l.chave] ?? null} sel={sel === l.chave} vagas={t && !t.anexoDe ? vagas[l.chave] ?? 0 : 0} promo={t && !t.anexoDe && t.status === "ativo" ? promocaoAtiva(t, agora)?.texto ?? null : null} vivo={vivo} />;
        })}
      </svg>
      {/* aproximar, afastar e voltar ao 3D */}
      <div className="pointer-events-auto absolute bottom-14 left-3 z-10 flex items-center gap-1 rounded-2xl bg-[#111418]/75 p-1 text-white shadow-xl backdrop-blur">
        <button type="button" onClick={() => zoom(1.35)} aria-label="Aproximar" className="grid h-9 w-9 place-items-center rounded-xl text-lg font-bold hover:bg-white/15">+</button>
        <button type="button" onClick={() => zoom(1 / 1.35)} aria-label="Afastar" className="grid h-9 w-9 place-items-center rounded-xl text-lg font-bold hover:bg-white/15">−</button>
        <button type="button" onClick={() => setVista({ x: 0, z: 6, esc: 1.15 })} aria-label="Ver a cidade inteira" className="h-9 rounded-xl px-2.5 text-[12px] font-semibold hover:bg-white/15">Cidade inteira</button>
        <button type="button" onClick={() => escolherMapa("3d")} className="h-9 rounded-xl bg-white/15 px-2.5 text-[12px] font-bold hover:bg-white/25">Ver em 3D</button>
      </div>
      <style>{`.mapa2d-sel{animation:m2sel 1.4s ease-in-out infinite}@keyframes m2sel{50%{opacity:.35}}.mapa2d-pisca{animation:m2sel 1s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.mapa2d-sel,.mapa2d-pisca{animation:none}}`}</style>
    </div>
  );
}
