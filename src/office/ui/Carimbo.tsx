"use client";
// Carimbo do passaporte (20/11/2026, frente "visitante"): desenho de carimbo de borracha de verdade, com a cor e a logo
// da empresa. Cada lugar tem sempre o mesmo formato, giro e força de tinta (data/passaporte.ts › estiloDoCarimbo):
// redondo, oval, retangular, hexagonal, escudo ou serrilhado. A tinta falha um pouco (ruído do SVG), como no papel.
import { useId } from "react";
import { estiloDoCarimbo, hashTexto } from "../data/passaporte";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export function dataCarimbo(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000); // Brasília
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function siglaDe(nome: string) {
  const p = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^A-Za-z0-9]+/).filter((w) => w.length > 2 || /^[0-9A-Z]/.test(w));
  return (p.length >= 2 ? p[0][0] + p[1][0] : (p[0] ?? nome).slice(0, 2)).toUpperCase();
}
// contorno serrilhado (selo de correio): um círculo com bicos
function serrilha(r: number, bicos: number, fundo: number) {
  let d = "";
  for (let i = 0; i <= bicos * 2; i++) { const a = (i / (bicos * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r - fundo : r; d += `${i ? "L" : "M"}${(60 + Math.cos(a) * rr).toFixed(2)} ${(60 + Math.sin(a) * rr).toFixed(2)}`; }
  return d + "Z";
}
const HEX = "M60 8 L105 34 L105 86 L60 112 L15 86 L15 34 Z";
const HEX2 = "M60 15 L99 37.5 L99 82.5 L60 105 L21 82.5 L21 37.5 Z";
const ESCUDO = "M60 8 C78 14 92 14 106 12 C108 52 98 92 60 112 C22 92 12 52 14 12 C28 14 42 14 60 8 Z";
const ESCUDO2 = "M60 15 C76 20 88 20 99 19 C100 53 92 86 60 104 C28 86 20 53 21 19 C32 20 44 20 60 15 Z";

export function Carimbo({ chave, nome, cor, em, logo, tamanho = 120, bater = false, className = "" }: { chave: string; nome: string; cor: string; em: string; logo?: string | null; tamanho?: number; bater?: boolean; className?: string }) {
  const e = estiloDoCarimbo(chave);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const data = dataCarimbo(em);
  const nomeC = nome.toUpperCase().replace(/\s+/g, " ").trim();
  const curto = nomeC.length > 20 ? `${nomeC.slice(0, 19).trimEnd()}.` : nomeC;
  const sigla = siglaDe(nome);
  const semente = hashTexto(chave) % 97;
  const circular = e.forma === "redondo" || e.forma === "serrilhado";
  const centroLogo = (cx: number, cy: number, r: number) => logo
    ? <g><circle cx={cx} cy={cy} r={r + 1.6} fill="none" stroke="currentColor" strokeWidth="1.2" /><image href={logo} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#c${uid})`} preserveAspectRatio="xMidYMid slice" style={{ mixBlendMode: "multiply" }} opacity="0.9" /></g>
    : <text x={cx} y={cy + r * 0.38} textAnchor="middle" fontSize={r * 1.15} fontWeight="900" fill="currentColor" stroke="none" style={{ letterSpacing: "-0.04em" }}>{sigla}</text>;
  return (
    <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} role="img" aria-label={`Carimbo de ${nome}, ${data}`} data-carimbo={chave} data-forma={e.forma}
      className={`we-carimbo ${bater ? "we-carimbo-bate" : ""} ${className}`} style={{ color: cor, opacity: e.tinta, ["--giro" as string]: `${e.giro}deg`, transform: `rotate(${e.giro}deg)` }}>
      <defs>
        {/* borracha: o ruído apaga um pouco da tinta aqui e ali */}
        <filter id={`t${uid}`} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={semente} result="r" />
          <feColorMatrix in="r" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.55" result="f" />
          <feComposite in="SourceGraphic" in2="f" operator="in" />
        </filter>
        <path id={`a${uid}`} d={circular ? "M 15 60 A 45 45 0 0 1 105 60" : "M 20 60 A 40 40 0 0 1 100 60"} />
        <path id={`b${uid}`} d="M 19 62 A 41 41 0 0 0 101 62" />
        <clipPath id={`c${uid}`}><circle cx={circular ? 60 : e.forma === "retangulo" ? 92 : 60} cy={circular ? 56 : e.forma === "retangulo" ? 42 : e.forma === "oval" ? 44 : 40} r="13" /></clipPath>
      </defs>
      <g filter={`url(#t${uid})`} fill="none" stroke="currentColor" fontFamily="ui-sans-serif, system-ui, sans-serif">
        {e.forma === "redondo" && <><circle cx="60" cy="60" r="54" strokeWidth="3.2" /><circle cx="60" cy="60" r={e.dupla ? 47 : 49} strokeWidth="1.3" />{e.dupla && <circle cx="60" cy="60" r="35" strokeWidth="1" strokeDasharray="2 2.4" />}</>}
        {e.forma === "serrilhado" && <><path d={serrilha(55, 30, 3.2)} strokeWidth="2.2" /><circle cx="60" cy="60" r="46" strokeWidth="1.4" /></>}
        {e.forma === "oval" && <><ellipse cx="60" cy="60" rx="55" ry="40" strokeWidth="3" /><ellipse cx="60" cy="60" rx="49" ry="34" strokeWidth="1.2" /></>}
        {e.forma === "retangulo" && <><rect x="6" y="22" width="108" height="76" rx="7" strokeWidth="3.2" /><rect x="12" y="28" width="96" height="64" rx="4" strokeWidth="1.2" />{e.dupla && <path d="M12 58h96" strokeWidth="1" />}</>}
        {e.forma === "hexagono" && <><path d={HEX} strokeWidth="3" /><path d={HEX2} strokeWidth="1.2" /></>}
        {e.forma === "escudo" && <><path d={ESCUDO} strokeWidth="3" /><path d={ESCUDO2} strokeWidth="1.2" /></>}
        <g fill="currentColor" stroke="none">
          {circular ? (
            <>
              <text fontSize={curto.length > 14 ? 7.6 : 9} fontWeight="800" letterSpacing="0.9"><textPath href={`#a${uid}`} startOffset="50%" textAnchor="middle">{curto}</textPath></text>
              <text fontSize="6.2" fontWeight="700" letterSpacing="1.6"><textPath href={`#b${uid}`} startOffset="50%" textAnchor="middle">CIDADE WORKEND</textPath></text>
              <rect x="27" y="73" width="66" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <text x="60" y="82.6" textAnchor="middle" fontSize="8.4" fontWeight="800" letterSpacing="0.6">{data}</text>
              {[-1, 1].map((s) => <path key={s} d={`M${60 + s * 40} 79.5l1.6 -3.4 1.6 3.4 -3.4 -2.1h3.6z`} transform={`translate(${s > 0 ? -1.6 : -1.6} 0)`} />)}
            </>
          ) : e.forma === "retangulo" ? (
            <>
              <text x="18" y="41" fontSize="8" fontWeight="900" letterSpacing="1.8">ENTRADA</text>
              <path d="M18 46h26l-4 -3M44 46l-4 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <text x="60" y={e.dupla ? 70 : 69} textAnchor="middle" fontSize={curto.length > 14 ? 8 : 9.6} fontWeight="800" letterSpacing="0.5">{curto}</text>
              <text x="60" y="84" textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing="0.8">{data}</text>
            </>
          ) : (
            <>
              <text x="60" y={e.forma === "oval" ? 69 : 66} textAnchor="middle" fontSize={curto.length > 14 ? 7.6 : 9.2} fontWeight="800" letterSpacing="0.5">{curto}</text>
              <path d={e.forma === "oval" ? "M30 74h60" : "M28 72h64"} stroke="currentColor" strokeWidth="1" />
              <text x="60" y={e.forma === "oval" ? 84 : 83} textAnchor="middle" fontSize="8.4" fontWeight="800" letterSpacing="0.8">{data}</text>
              <text x="60" y={e.forma === "oval" ? 92.5 : 93} textAnchor="middle" fontSize="5.4" fontWeight="700" letterSpacing="1.4">CIDADE WORKEND</text>
            </>
          )}
        </g>
        {circular ? centroLogo(60, 56, 13) : e.forma === "retangulo" ? centroLogo(92, 42, 13) : centroLogo(60, e.forma === "oval" ? 44 : 40, 13)}
      </g>
    </svg>
  );
}

// a animação de bater o carimbo (o aviso depois do atendimento); fica aqui para o passaporte e o aviso usarem
export const ESTILO_CARIMBO = `
@keyframes we-carimbo-bate { 0% { transform: scale(1.9) rotate(calc(var(--giro) - 18deg)); opacity: 0; } 55% { transform: scale(0.94) rotate(var(--giro)); opacity: 1; } 72% { transform: scale(1.03) rotate(var(--giro)); } 100% { transform: scale(1) rotate(var(--giro)); } }
.we-carimbo-bate { animation: we-carimbo-bate .62s cubic-bezier(.2,.8,.25,1) both; transform-origin: 50% 50%; }
@media (prefers-reduced-motion: reduce) { .we-carimbo-bate { animation: none; } }
`;
