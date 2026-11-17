// Retrato do personagem em SVG (16/11/2026, no lugar do avatar de bolinhas em CSS): rosto com olhos, sobrancelhas,
// nariz e boca, cada penteado, barba, óculos e o tipo de roupa (camiseta, blazer, jaqueta, moletom, regata, vestido,
// praia). Sem gradiente nem id, então pode repetir à vontade numa lista. Mesmo visual do boneco 3D (scene/Boneco.tsx).
import type { Boneco } from "../data/bonecos";

const mix = (a: string, b: string, k: number) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
};
const hex = (c: string | undefined, padrao: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : padrao);

// cachos em volta da cabeça (cacheado / black power)
const CACHOS_FORA: [number, number, number][] = [[23, 31, 7.5], [28, 18, 7.5], [39, 10, 7.5], [52, 8, 7.5], [65, 11.5, 7.5], [75, 21, 7.5], [79, 34, 7], [77, 46, 6], [22, 45, 6]];
const CACHOS_FRENTE: [number, number, number][] = [[31, 37, 5.8], [36.5, 30.5, 6.2], [43.5, 27, 6.4], [51, 26.2, 6.4], [58.5, 27.5, 6.4], [65, 31.5, 6], [69.5, 38, 5.4]];

export function RetratoBoneco({ def, roupa, tamanho, fundo, className }: { def: Boneco; roupa: string; tamanho: number; fundo?: string; className?: string }) {
  const pele = hex(def.pele, "#F1C9A5"), cab = hex(def.cabelo, "#2A1E19"), cor = hex(roupa, "#1D4ED8");
  const est = def.estiloCabelo, traje = def.traje ?? "camisa", barba = def.barba ?? "nenhuma";
  const sombra = mix(pele, "#000000", 0.12);
  const corEsc = mix(cor, "#000000", 0.24);
  const ombroPele = traje === "semCamisa" || traje === "biquini" || traje === "regata" || traje === "vestido";
  const sobrancelha = est === "careca" ? mix(pele, "#000000", 0.45) : mix(cab, "#000000", 0.1);
  const comBarba = barba === "cheia" || barba === "rala";
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className={className} aria-hidden focusable="false" style={{ display: "block" }}>
      <rect width="100" height="100" fill={fundo ?? mix(cor, "#FFFFFF", 0.8)} />
      {/* cabelo atrás da cabeça */}
      {est === "longo" && <path d="M27.5 42 C25 62 26 80 30 94 L70 94 C74 80 75 62 72.5 42 Z" fill={cab} />}
      {est === "cacheado" && <g fill={cab}><circle cx="50" cy="35" r="28" />{CACHOS_FORA.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {est === "coque" && <circle cx="50" cy="15" r="9.5" fill={cab} />}
      {est === "rabo" && <path d="M64 29 C80 32 83 52 77 66 C75 55 71 45 63 38 Z" fill={cab} />}
      {/* corpo e roupa */}
      <path d="M11 101 C11 83 26 72.5 50 72.5 C74 72.5 89 83 89 101 Z" fill={ombroPele ? pele : cor} />
      {traje === "regata" && <path d="M33 101 L35 81 Q36 76.5 39.5 75.5 Q50 85 60.5 75.5 Q64 76.5 65 81 L67 101 Z" fill={cor} />}
      {traje === "vestido" && <path d="M34 101 L36 80 L39 74.5 L41.2 74.5 L42.4 81 Q50 87 57.6 81 L58.8 74.5 L61 74.5 L64 80 L66 101 Z" fill={cor} />}
      {traje === "biquini" && <g fill={cor}><path d="M36.5 94 Q43 86 49 94 Z" /><path d="M51 94 Q57 86 63.5 94 Z" /></g>}
      {traje === "moletom" && <><path d="M33.5 78 C37 65.5 63 65.5 66.5 78 C59 73.5 41 73.5 33.5 78 Z" fill={corEsc} /><path d="M46 77 L45 89 M54 77 L55 89" stroke="#F4F4F0" strokeWidth="1.5" strokeLinecap="round" /></>}
      {traje === "blazer" && <><path d="M40.5 72 Q50 74.5 59.5 72 L50 95 Z" fill="#F4F4F0" /><path d="M40.5 72 L35 75.5 L45 89 L50 95 Z" fill={corEsc} /><path d="M59.5 72 L65 75.5 L55 89 L50 95 Z" fill={corEsc} /></>}
      {traje === "jaqueta" && <><path d="M50 76 L50 101" stroke="#C9CDD3" strokeWidth="1.6" /><path d="M37 73.5 Q50 66 63 73.5 L61 78.5 Q50 73 39 78.5 Z" fill={corEsc} /></>}
      {/* pescoço (e a gola da camiseta) */}
      <path d="M42.5 57 L42.5 72 Q50 77.5 57.5 72 L57.5 57 Z" fill={sombra} />
      {(traje === "camisa" || traje === "saida") && <path d="M40.5 71.2 Q50 81 59.5 71.2" fill="none" stroke={corEsc} strokeWidth="2.8" strokeLinecap="round" />}
      {/* orelhas e cabeça */}
      <ellipse cx="28.8" cy="46" rx="4" ry="6" fill={sombra} />
      <ellipse cx="71.2" cy="46" rx="4" ry="6" fill={sombra} />
      <ellipse cx="50" cy="44" rx="21.5" ry="23" fill={pele} />
      <ellipse cx="42" cy="33" rx="9" ry="5.5" fill="#FFFFFF" opacity="0.12" />
      {/* barba e bigode */}
      {comBarba && <path d="M29.5 46.5 C30 62 39 68.6 50 68.6 C61 68.6 70 62 70.5 46.5 C67 54.5 61.5 57.2 56.5 56.6 C53.5 55.6 46.5 55.6 43.5 56.6 C38.5 57.2 33 54.5 29.5 46.5 Z" fill={barba === "rala" ? mix(pele, cab, 0.55) : cab} />}
      {(barba === "cheia" || barba === "bigode") && <path d="M43.2 57.6 C45.8 54.6 48.8 55.4 50 56.4 C51.2 55.4 54.2 54.6 56.8 57.6 C53.8 58.6 51.6 58.1 50 57.6 C48.4 58.1 46.2 58.6 43.2 57.6 Z" fill={cab} />}
      {/* cabelo da frente */}
      {est === "curto" && <path d="M28 47 C26 30 36 19.5 50 19.5 C64 19.5 74 30 72 47 C71 41 69.5 37 67 34.5 C61 36.5 52 37 45 34 C40 33.5 35 35.5 31 39.5 C29.5 41.5 28.6 44 28 47 Z" fill={cab} />}
      {est === "topete" && <><path d="M28 46 C26 30 36 20 50 20 C64 20 74 30 72 46 C71 40 69 36 66 33 C60 31 40 31 34 33 C31 36 29 40 28 46 Z" fill={cab} /><path d="M33 30.5 C33 17 46 11 58 13 C66 14.5 70.5 20.5 68 28.5 C62 24.5 50 23.5 40.5 26 C37 27 35 28.5 33 30.5 Z" fill={cab} /></>}
      {est === "moicano" && <><path d="M28.5 44 C27 29 37 21 50 21 C63 21 73 29 71.5 44 C69 36 64 31 50 31 C36 31 31 36 28.5 44 Z" fill={mix(pele, cab, 0.45)} /><path d="M44.5 32 C44 20 46 11 50 7.5 C54 11 56 20 55.5 32 Q50 30.5 44.5 32 Z" fill={cab} /></>}
      {est === "cacheado" && <g fill={cab}>{CACHOS_FRENTE.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {(est === "coque" || est === "rabo" || est === "longo") && <path d="M28 47 C26 29 37 20 50 20 C63 20 74 29 72 47 C70 37 62 30 51 29.5 L50 33 L49 29.5 C38 30 30 37 28 47 Z" fill={cab} />}
      {est === "longo" && <><path d="M28 44 C26 56 27 70 31 82 L36 82 C33 69 32 57 32.6 46 Z" fill={cab} /><path d="M72 44 C74 56 73 70 69 82 L64 82 C67 69 68 57 67.4 46 Z" fill={cab} /></>}
      {/* rosto */}
      <path d="M37.5 39.6 Q42 37.2 46.5 39" fill="none" stroke={sobrancelha} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M53.5 39 Q58 37.2 62.5 39.6" fill="none" stroke={sobrancelha} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="42" cy="46.5" rx="4.3" ry="4.8" fill="#FAFAF7" />
      <ellipse cx="58" cy="46.5" rx="4.3" ry="4.8" fill="#FAFAF7" />
      <circle cx="42.3" cy="46.9" r="2.7" fill="#2B1D16" />
      <circle cx="58.3" cy="46.9" r="2.7" fill="#2B1D16" />
      <circle cx="41.3" cy="45.6" r="0.95" fill="#FFFFFF" />
      <circle cx="57.3" cy="45.6" r="0.95" fill="#FFFFFF" />
      <ellipse cx="50" cy="53" rx="2.6" ry="2.1" fill={sombra} />
      <path d={comBarba ? "M45.6 60.2 Q50 63.8 54.4 60.2" : "M45 58.6 Q50 63 55 58.6"} fill="none" stroke="#9E3B30" strokeWidth="2" strokeLinecap="round" />
      {def.oculos && <><g fill="#1F2227" fillOpacity="0.16" stroke="#1F2227" strokeWidth="1.8"><circle cx="42" cy="46.6" r="6.3" /><circle cx="58" cy="46.6" r="6.3" /></g><path d="M48.3 46 Q50 44.6 51.7 46" fill="none" stroke="#1F2227" strokeWidth="1.8" /></>}
      {def.chapeu && <><ellipse cx="50" cy="25" rx="31" ry="6" fill={def.chapeu} /><path d="M36 25 C36 11.5 64 11.5 64 25 Z" fill={def.chapeu} /><path d="M36.6 22 L63.4 22" stroke={mix(def.chapeu, "#000000", 0.25)} strokeWidth="2.6" /></>}
    </svg>
  );
}
