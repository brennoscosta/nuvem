// Retrato do personagem em SVG (16/11/2026, no lugar do avatar de bolinhas em CSS): rosto com olhos, sobrancelhas,
// nariz e boca, cada penteado, barba, óculos e o tipo de roupa (camiseta, blazer, jaqueta, moletom, regata, vestido,
// praia). Sem gradiente nem id, então pode repetir à vontade numa lista. Mesmo visual do boneco 3D (scene/Boneco.tsx).
// 20/11/2026 (editor completo): biotipo (ombros), olhos, cor dos olhos, sobrancelhas, boca, sardas/pinta/bochecha,
// óculos quadrado e gatinho, cavanhaque, cabelos novos (raspado, crespo, black power, tranças), roupas novas (social,
// polo, blusa, terno, terno de grife, jaqueta de couro), a logo da empresa no uniforme e os brincos. `zoom` aproxima o rosto.
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
const BLACK_FORA: [number, number, number][] = Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (1.05 + (i * 0.9) / 10); return [50 + Math.cos(a) * 31, 34 + Math.sin(a) * 27, 8.5] as [number, number, number]; }).concat([[17, 44, 8], [83, 44, 8], [19, 54, 6.5], [81, 54, 6.5]]);
const BLACK_FRENTE: [number, number, number][] = [[30, 33, 5.6], [35.5, 26.5, 6], [43, 22.5, 6.2], [51, 21.6, 6.2], [59, 23, 6.2], [65.5, 27.5, 5.8], [70, 34, 5.2]];
const CRESPO: [number, number, number][] = [[31, 33, 4.2], [36, 25.5, 4.5], [43, 21, 4.6], [50, 19.5, 4.6], [57, 21, 4.6], [64, 25.5, 4.5], [69, 33, 4.2]];
const SARDAS: [number, number][] = [[35.5, 51.5], [38.4, 52.8], [35.8, 54.6], [39.6, 50.6], [37.4, 49.8]];
const OMBROS = { magro: 0.92, medio: 1, forte: 1.1 } as const;

export function RetratoBoneco({ def, roupa, tamanho, fundo, className, acessorios, zoom = false }: { def: Boneco; roupa: string; tamanho: number; fundo?: string; className?: string; acessorios?: string[]; zoom?: boolean }) {
  const pele = hex(def.pele, "#F1C9A5"), cab = hex(def.cabelo, "#2A1E19"), cor = hex(roupa, "#1D4ED8");
  const est = def.estiloCabelo, traje = def.traje ?? "camisa", barba = def.barba ?? "nenhuma";
  const sombra = mix(pele, "#000000", 0.12);
  const corEsc = mix(cor, "#000000", 0.24);
  const ombroPele = traje === "semCamisa" || traje === "biquini" || traje === "regata" || traje === "vestido";
  const sobrancelha = est === "careca" ? mix(pele, "#000000", 0.45) : mix(cab, "#000000", 0.1);
  const comBarba = barba === "cheia" || barba === "rala";
  const iris = hex(def.corOlhos, "#2B1D16"), olhos = def.olhos ?? "redondos", sob = def.sobrancelha ?? "normal", boca = def.boca ?? "sorriso", marcas = def.marcas ?? "nenhuma";
  const largura = OMBROS[def.biotipo ?? "medio"] ?? 1;
  const terno = traje === "terno" || traje === "ternoGrife", grife = traje === "ternoGrife";
  const brinco = (acessorios ?? []).find((a) => a === "brinco-argola" || a === "brinco-ponto");
  const dy = comBarba ? 1.6 : 0; // a boca desce um pouco por cima da barba
  const olho = (cx: number, s: number) => {
    if (olhos === "felizes") return <path d={`M${cx - 4.2} 47.6 Q${cx} 43.2 ${cx + 4.2} 47.6`} fill="none" stroke="#2B1D16" strokeWidth="2.1" strokeLinecap="round" />;
    if (olhos === "amendoados") return <g transform={`rotate(${s * 8} ${cx} 46.5)`}><ellipse cx={cx} cy="46.5" rx="5" ry="3.5" fill="#FAFAF7" /><circle cx={cx + 0.3} cy="46.6" r="2.4" fill={iris} /><circle cx={cx - 0.6} cy="45.6" r="0.85" fill="#FFFFFF" /></g>;
    if (olhos === "grandes") return <><ellipse cx={cx} cy="46.2" rx="5" ry="5.6" fill="#FAFAF7" /><circle cx={cx + 0.3} cy="46.8" r="3.3" fill={iris} /><circle cx={cx - 1.1} cy="45.2" r="1.15" fill="#FFFFFF" /><circle cx={cx + 1.4} cy="48.2" r="0.6" fill="#FFFFFF" /></>;
    return <>
      <ellipse cx={cx} cy="46.5" rx="4.3" ry="4.8" fill="#FAFAF7" /><circle cx={cx + 0.3} cy="46.9" r="2.7" fill={iris} /><circle cx={cx - 0.7} cy="45.6" r="0.95" fill="#FFFFFF" />
      {olhos === "sonolentos" && <path d={`M${cx - 4.6} 46.8 A4.6 5 0 0 1 ${cx + 4.6} 46.8 Z`} fill={mix(pele, "#000000", 0.05)} />}
    </>;
  };
  const so = sob === "finas" ? 1.4 : sob === "grossas" ? 3.2 : 2.2, alto = sob === "arqueadas" ? 34.8 : 37.2;
  return (
    <svg viewBox={zoom ? "21 14 58 58" : "0 0 100 100"} width={tamanho} height={tamanho} className={className} aria-hidden focusable="false" style={{ display: "block" }}>
      <rect x="0" y="0" width="100" height="100" fill={fundo ?? mix(cor, "#FFFFFF", 0.8)} />
      {/* cabelo atrás da cabeça */}
      {est === "longo" && <path d="M27.5 42 C25 62 26 80 30 94 L70 94 C74 80 75 62 72.5 42 Z" fill={cab} />}
      {est === "cacheado" && <g fill={cab}><circle cx="50" cy="35" r="28" />{CACHOS_FORA.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {est === "blackpower" && <g fill={cab}><ellipse cx="50" cy="36" rx="33" ry="30" />{BLACK_FORA.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {est === "coque" && <circle cx="50" cy="15" r="9.5" fill={cab} />}
      {est === "rabo" && <path d="M64 29 C80 32 83 52 77 66 C75 55 71 45 63 38 Z" fill={cab} />}
      {/* corpo e roupa (o biotipo alarga ou afina os ombros) */}
      <g transform={largura !== 1 ? `translate(50 0) scale(${largura} 1) translate(-50 0)` : undefined}>
        <path d="M11 101 C11 83 26 72.5 50 72.5 C74 72.5 89 83 89 101 Z" fill={ombroPele ? pele : cor} />
        {traje === "regata" && <path d="M33 101 L35 81 Q36 76.5 39.5 75.5 Q50 85 60.5 75.5 Q64 76.5 65 81 L67 101 Z" fill={cor} />}
        {traje === "vestido" && <path d="M34 101 L36 80 L39 74.5 L41.2 74.5 L42.4 81 Q50 87 57.6 81 L58.8 74.5 L61 74.5 L64 80 L66 101 Z" fill={cor} />}
        {traje === "biquini" && <g fill={cor}><path d="M36.5 94 Q43 86 49 94 Z" /><path d="M51 94 Q57 86 63.5 94 Z" /></g>}
        {traje === "moletom" && <><path d="M33.5 78 C37 65.5 63 65.5 66.5 78 C59 73.5 41 73.5 33.5 78 Z" fill={corEsc} /><path d="M46 77 L45 89 M54 77 L55 89" stroke="#F4F4F0" strokeWidth="1.5" strokeLinecap="round" /></>}
        {traje === "blazer" && <><path d="M40.5 72 Q50 74.5 59.5 72 L50 95 Z" fill="#F4F4F0" /><path d="M40.5 72 L35 75.5 L45 89 L50 95 Z" fill={corEsc} /><path d="M59.5 72 L65 75.5 L55 89 L50 95 Z" fill={corEsc} /></>}
        {traje === "jaqueta" && <><path d="M50 76 L50 101" stroke="#C9CDD3" strokeWidth="1.6" /><path d="M37 73.5 Q50 66 63 73.5 L61 78.5 Q50 73 39 78.5 Z" fill={corEsc} /></>}
        {traje === "blusa" && <><path d="M38.2 73.4 Q50 87 61.8 73.4 Z" fill={pele} /><path d="M38.2 73.4 Q50 87 61.8 73.4" fill="none" stroke={corEsc} strokeWidth="1.4" /></>}
        {traje === "social" && <><path d="M50 77 L50 101" stroke={corEsc} strokeWidth="1.3" /><g fill={mix(cor, "#FFFFFF", 0.6)}><circle cx="50" cy="83" r="0.9" /><circle cx="50" cy="89" r="0.9" /><circle cx="50" cy="95" r="0.9" /></g><path d="M40.6 71 L50 77.4 L45.4 80.4 Z M59.4 71 L50 77.4 L54.6 80.4 Z" fill={corEsc} /></>}
        {traje === "polo" && <><path d="M40.5 71.5 L50 76 L59.5 71.5 L58 75.6 L50 79.2 L42 75.6 Z" fill={corEsc} /><rect x="48.6" y="76.5" width="2.8" height="9" rx="0.8" fill={corEsc} /><g fill="#F4F4F0"><circle cx="50" cy="80" r="0.75" /><circle cx="50" cy="83.6" r="0.75" /></g></>}
        {terno && <>
          <path d="M41.5 72.5 Q50 74.5 58.5 72.5 L50 93 Z" fill="#F4F4F0" />
          <path d="M48.6 76 L51.4 76 L52.6 89.5 L50 92.6 L47.4 89.5 Z" fill={grife ? "#14161A" : "#8B1E2D"} /><rect x="47.9" y="74" width="4.2" height="3.2" rx="1" fill={grife ? "#14161A" : "#8B1E2D"} />
          <path d="M41.5 72.5 L36 76 L45.5 88.5 L50 93 Z" fill={grife ? "#14161A" : corEsc} /><path d="M58.5 72.5 L64 76 L54.5 88.5 L50 93 Z" fill={grife ? "#14161A" : corEsc} />
          {grife && <><path d="M62 84 L67.5 84 L66 81.2 Z" fill="#F4F4F0" /><circle cx="38.6" cy="80.2" r="1.2" fill="#D4A63A" /><rect x="47.6" y="84.4" width="4.8" height="1" fill="#D4A63A" /></>}
        </>}
        {traje === "jaquetaCouro" && <><path d="M40 72 Q50 75 60 72 L56.5 101 L43.5 101 Z" fill="#F4F4F0" /><path d="M40 72 L33 76.5 L42 93 L45.2 86 Z" fill={corEsc} /><path d="M60 72 L67 76.5 L58 93 L54.8 86 Z" fill={corEsc} /><path d="M57.6 87 L59 101" stroke="#C9CDD3" strokeWidth="1.4" /></>}
        {def.uniforme && <><rect x="60" y="80" width="13.5" height="13.5" rx="3" fill="#FFFFFF" /><image href={`/api/terrenos/${encodeURIComponent(def.uniforme)}/logo`} x="61.2" y="81.2" width="11.1" height="11.1" preserveAspectRatio="xMidYMid meet" /></>}
      </g>
      {/* pescoço (e a gola da camiseta) */}
      <path d="M42.5 57 L42.5 72 Q50 77.5 57.5 72 L57.5 57 Z" fill={sombra} />
      {(traje === "camisa" || traje === "saida") && <path d="M40.5 71.2 Q50 81 59.5 71.2" fill="none" stroke={corEsc} strokeWidth="2.8" strokeLinecap="round" />}
      {/* orelhas e cabeça */}
      <ellipse cx="28.8" cy="46" rx="4" ry="6" fill={sombra} />
      <ellipse cx="71.2" cy="46" rx="4" ry="6" fill={sombra} />
      {brinco === "brinco-argola" && <g fill="none" stroke="#D4A63A" strokeWidth="1.2"><circle cx="28.4" cy="54.4" r="2.4" /><circle cx="71.6" cy="54.4" r="2.4" /></g>}
      {brinco === "brinco-ponto" && <g fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.4"><circle cx="28.2" cy="51.6" r="1.3" /><circle cx="71.8" cy="51.6" r="1.3" /></g>}
      <ellipse cx="50" cy="44" rx="21.5" ry="23" fill={pele} />
      <ellipse cx="42" cy="33" rx="9" ry="5.5" fill="#FFFFFF" opacity="0.12" />
      {/* sardas, pinta e bochecha rosada */}
      {marcas === "rosadas" && <g fill="#F06A7A" opacity="0.32"><ellipse cx="35.5" cy="53.6" rx="3.8" ry="2.3" /><ellipse cx="64.5" cy="53.6" rx="3.8" ry="2.3" /></g>}
      {marcas === "sardas" && <g fill={mix(pele, "#7A3E1E", 0.45)}>{SARDAS.flatMap(([x, y]) => [<circle key={`a${x}`} cx={x} cy={y} r="0.75" />, <circle key={`b${x}`} cx={100 - x} cy={y} r="0.75" />])}</g>}
      {marcas === "pinta" && <circle cx="56.8" cy="57.4" r="0.95" fill="#3B2418" />}
      {/* barba e bigode */}
      {comBarba && <path d="M29.5 46.5 C30 62 39 68.6 50 68.6 C61 68.6 70 62 70.5 46.5 C67 54.5 61.5 57.2 56.5 56.6 C53.5 55.6 46.5 55.6 43.5 56.6 C38.5 57.2 33 54.5 29.5 46.5 Z" fill={barba === "rala" ? mix(pele, cab, 0.55) : cab} />}
      {barba === "cavanhaque" && <path d="M44.6 62.4 Q50 71 55.4 62.4 Q50 65.2 44.6 62.4 Z" fill={cab} />}
      {(barba === "cheia" || barba === "bigode" || barba === "cavanhaque") && <path d="M43.2 57.6 C45.8 54.6 48.8 55.4 50 56.4 C51.2 55.4 54.2 54.6 56.8 57.6 C53.8 58.6 51.6 58.1 50 57.6 C48.4 58.1 46.2 58.6 43.2 57.6 Z" fill={cab} />}
      {/* cabelo da frente */}
      {est === "curto" && <path d="M28 47 C26 30 36 19.5 50 19.5 C64 19.5 74 30 72 47 C71 41 69.5 37 67 34.5 C61 36.5 52 37 45 34 C40 33.5 35 35.5 31 39.5 C29.5 41.5 28.6 44 28 47 Z" fill={cab} />}
      {est === "topete" && <><path d="M28 46 C26 30 36 20 50 20 C64 20 74 30 72 46 C71 40 69 36 66 33 C60 31 40 31 34 33 C31 36 29 40 28 46 Z" fill={cab} /><path d="M33 30.5 C33 17 46 11 58 13 C66 14.5 70.5 20.5 68 28.5 C62 24.5 50 23.5 40.5 26 C37 27 35 28.5 33 30.5 Z" fill={cab} /></>}
      {est === "moicano" && <><path d="M28.5 44 C27 29 37 21 50 21 C63 21 73 29 71.5 44 C69 36 64 31 50 31 C36 31 31 36 28.5 44 Z" fill={mix(pele, cab, 0.45)} /><path d="M44.5 32 C44 20 46 11 50 7.5 C54 11 56 20 55.5 32 Q50 30.5 44.5 32 Z" fill={cab} /></>}
      {est === "raspado" && <path d="M28.5 44 C27 29 37 21 50 21 C63 21 73 29 71.5 44 C69 36 64 31 50 31 C36 31 31 36 28.5 44 Z" fill={mix(pele, cab, 0.62)} />}
      {est === "crespo" && <g fill={cab}><path d="M28 44 C26 28 37 18 50 18 C63 18 74 28 72 44 C70 36 63 31 50 31 C37 31 30 36 28 44 Z" />{CRESPO.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {est === "cacheado" && <g fill={cab}>{CACHOS_FRENTE.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {est === "blackpower" && <g fill={cab}>{BLACK_FRENTE.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}</g>}
      {(est === "coque" || est === "rabo" || est === "longo" || est === "trancas") && <path d="M28 47 C26 29 37 20 50 20 C63 20 74 29 72 47 C70 37 62 30 51 29.5 L50 33 L49 29.5 C38 30 30 37 28 47 Z" fill={cab} />}
      {est === "longo" && <><path d="M28 44 C26 56 27 70 31 82 L36 82 C33 69 32 57 32.6 46 Z" fill={cab} /><path d="M72 44 C74 56 73 70 69 82 L64 82 C67 69 68 57 67.4 46 Z" fill={cab} /></>}
      {est === "trancas" && <g fill={cab}>{[0, 1, 2, 3, 4, 5, 6].flatMap((i) => [<ellipse key={`e${i}`} cx={29.6 - i * 0.25} cy={51 + i * 5.4} rx="3.1" ry="3.4" />, <ellipse key={`d${i}`} cx={70.4 + i * 0.25} cy={51 + i * 5.4} rx="3.1" ry="3.4" />])}<circle cx="27.8" cy="89.5" r="2.2" fill={mix(cab, "#D4A63A", 0.55)} /><circle cx="72.2" cy="89.5" r="2.2" fill={mix(cab, "#D4A63A", 0.55)} /></g>}
      {/* rosto */}
      <path d={`M37.5 ${sob === "arqueadas" ? 40.2 : 39.6} Q42 ${alto} 46.5 39`} fill="none" stroke={sobrancelha} strokeWidth={so} strokeLinecap="round" />
      <path d={`M53.5 39 Q58 ${alto} 62.5 ${sob === "arqueadas" ? 40.2 : 39.6}`} fill="none" stroke={sobrancelha} strokeWidth={so} strokeLinecap="round" />
      {olho(42, 1)}{olho(58, -1)}
      <ellipse cx="50" cy="53" rx="2.6" ry="2.1" fill={sombra} />
      {boca === "risada" ? <><path d={`M44.6 ${58.4 + dy} Q50 ${66 + dy} 55.4 ${58.4 + dy} Z`} fill="#5A1F1A" /><path d={`M45.8 ${58.6 + dy} L54.2 ${58.6 + dy} L53.6 ${60.2 + dy} L46.4 ${60.2 + dy} Z`} fill="#FFFFFF" /></>
        : boca === "neutra" ? <path d={`M45.4 ${60 + dy} L54.6 ${60 + dy}`} fill="none" stroke="#9E3B30" strokeWidth="2" strokeLinecap="round" />
        : boca === "deLado" ? <path d={`M45.8 ${60.6 + dy} Q51 ${62.6 + dy} 55.6 ${57.6 + dy}`} fill="none" stroke="#9E3B30" strokeWidth="2" strokeLinecap="round" />
        : <path d={comBarba ? "M45.6 60.2 Q50 63.8 54.4 60.2" : "M45 58.6 Q50 63 55 58.6"} fill="none" stroke="#9E3B30" strokeWidth="2" strokeLinecap="round" />}
      {def.oculos && (def.oculosModelo ?? "redondo") === "redondo" && <><g fill="#1F2227" fillOpacity="0.16" stroke="#1F2227" strokeWidth="1.8"><circle cx="42" cy="46.6" r="6.3" /><circle cx="58" cy="46.6" r="6.3" /></g><path d="M48.3 46 Q50 44.6 51.7 46" fill="none" stroke="#1F2227" strokeWidth="1.8" /></>}
      {def.oculos && def.oculosModelo === "quadrado" && <g fill="#1F2227" fillOpacity="0.1" stroke="#1F2227" strokeWidth="1.7"><rect x="35.6" y="41.6" width="12.6" height="9.8" rx="1.6" /><rect x="51.8" y="41.6" width="12.6" height="9.8" rx="1.6" /><path d="M48.2 45.2 L51.8 45.2" fill="none" /></g>}
      {def.oculos && def.oculosModelo === "gatinho" && <g fill="#5A2E1E" fillOpacity="0.1" stroke="#5A2E1E" strokeWidth="1.7" strokeLinejoin="round"><path d="M35 42.2 L47.8 43 Q48.6 48 46 50.6 L38.6 50.6 Q35.4 48.6 35 42.2 Z" /><path d="M65 42.2 L52.2 43 Q51.4 48 54 50.6 L61.4 50.6 Q64.6 48.6 65 42.2 Z" /><path d="M47.8 45 L52.2 45" fill="none" /></g>}
      {def.chapeu && <><ellipse cx="50" cy="25" rx="31" ry="6" fill={def.chapeu} /><path d="M36 25 C36 11.5 64 11.5 64 25 Z" fill={def.chapeu} /><path d="M36.6 22 L63.4 22" stroke={mix(def.chapeu, "#000000", 0.25)} strokeWidth="2.6" /></>}
    </svg>
  );
}
