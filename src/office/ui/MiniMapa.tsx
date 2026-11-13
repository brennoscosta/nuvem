"use client";
// Mini-mapa 3D (v63, 12/11/2026, pedido do dono: "mapa 3d bonito e organizado"). A imagem é a própria cidade desenhada
// de cima, um pouco inclinada, com norte para cima (scene/MiniMapaRender). Por cima, com a mesma projeção
// (src/office/miniMapa.ts): nomes dos bairros e dos lugares, as lojas abertas com cor e logo (promoção e
// "contratando"), a obra dos lotes reservados, a praça, a câmera (para onde ela olha) e o meu personagem.
// Clicar numa loja ou num lote abre o cartão; clicar em qualquer outro ponto leva a câmera até lá. Filtro por área,
// bairro ou promoção. No celular abre por um botão e fica maior.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMundo, modoMundo, LOTES, LOTE_POR_CHAVE, useAgora, promocaoAtiva, type Terreno } from "../mundoStore";
import { NICHOS, nomeNicho, centroQuarteirao, QUARTEIRAO, CALCADA, BAIRROS, bairroDoLote, NORTE, RUAS, LIMITE_CAMERA, MUNDO } from "../data/mundo";
import { alturaPredio } from "../data/escritorio";
import { useRuas } from "../scene/RuasPlacas";
import { PRACA_CHAVE } from "../data/praca";
import { cameraInfo } from "../scene/CameraMundo";
import { eventosDoMomento } from "../scene/Praca";
import { minhaPos, usePersonagem } from "../personagemStore";
import { leve } from "../scene/qualidade";
import { projetar, noChao, PROPORCAO, miniMapa, useVersaoMiniMapa } from "../miniMapa";

const semAssinatura = () => () => {};
const assinarLargura = (f: () => void) => { const m = window.matchMedia("(min-width: 640px)"); m.addEventListener("change", f); return () => m.removeEventListener("change", f); };
const largoAgora = () => window.matchMedia("(min-width: 640px)").matches;
const VB = 1000, VBA = Math.round(VB / PROPORCAO); // caixa do desenho por cima da imagem
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const Q = QUARTEIRAO + 2 * CALCADA;
const LUGARES: { nome: string; x: number; y: number; z: number; estilo: "marco" | "agua" | "verde" | "areia"; alvo?: [number, number, number] }[] = [
  { nome: "Nuvem", x: 0, y: 22, z: 0, estilo: "marco", alvo: [0, 0.5, 0] },
  { nome: "Lanchonete", x: 52, y: 12, z: 0, estilo: "marco", alvo: [52, 0.5, 0] },
  { nome: "Parque da Cidade", x: 0, y: 2, z: -128, estilo: "verde", alvo: [0, 0.5, -122] },
  { nome: "Rio", x: -74, y: 0, z: -96, estilo: "agua" },
  { nome: "Praia", x: -30, y: 0, z: 95, estilo: "areia" },
];
const ESTILO_LUGAR = { marco: "bg-[#1D4ED8] text-white", agua: "bg-transparent text-[#BFE3FF] italic", verde: "bg-[#14532D]/85 text-[#D9F99D]", areia: "bg-transparent text-[#FDE7B0] italic" } as const;

// polígono (na caixa do desenho) de um retângulo do chão: os quatro cantos projetados
function poligono(x0: number, z0: number, x1: number, z1: number) {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => { const p = projetar(x, 0, z); return `${(p.u * VB).toFixed(1)},${(p.v * VBA).toFixed(1)}`; }).join(" ");
}
// centro e altura do prédio de uma loja (lote duplo: no meio dos dois terrenos)
function ondeFica(t: Terreno, terrenos: Record<string, Terreno>) {
  const l = LOTE_POR_CHAVE[t.chave]; if (!l) return null;
  const anexo = Object.values(terrenos).find((x) => x.anexoDe === t.chave && x.status === "ativo");
  const la = anexo ? LOTE_POR_CHAVE[anexo.chave] : null;
  const x = la ? (l.centro[0] + la.centro[0]) / 2 : l.centro[0], z = l.centro[1];
  const h = t.status === "ativo" && t.escritorio ? alturaPredio(t.escritorio, !!la) : 6;
  return { x, z, h };
}
// o que está embaixo do mouse/dedo (nome para a dica)
function descrever(x: number, z: number, terrenos: Record<string, Terreno>, nomesRuas: Record<string, string>) {
  const l = LOTES.find((q) => Math.abs(x - q.centro[0]) < 9.5 && Math.abs(z - q.centro[1]) < 9.5);
  if (l) {
    if (l.chave === PRACA_CHAVE) return "Praça de Eventos";
    const t = terrenos[l.chave], p = t?.anexoDe ? terrenos[t.anexoDe] : t;
    return !t ? `Lote ${l.numero} · à venda` : `${p?.empresaNome ?? t.empresaNome} · Lote ${l.numero}${t.status === "ativo" ? "" : " · em obras"}`;
  }
  const r = RUAS.find((q) => Math.abs((q.eixo === "z" ? z : x) - q.valor) < 4 && Math.abs(q.eixo === "z" ? x : z) < MUNDO.x - 8);
  if (r) return nomesRuas[r.id] ?? r.padrao;
  if (z < NORTE.rio.z1) return "Parque da Cidade";
  if (z < NORTE.rio.z0) return "Rio";
  if (z < NORTE.calcadao.z0 + 0.5) return "Calçadão do rio";
  const b = BAIRROS.find((q) => { const [cx, cz] = centroQuarteirao(q.i, q.j); return Math.abs(x - cx) < Q / 2 && Math.abs(z - cz) < Q / 2; });
  return b ? b.nome : "";
}

export function MiniMapa() {
  const mundo = useSyncExternalStore(semAssinatura, modoMundo, () => false);
  const largo = useSyncExternalStore(assinarLargura, largoAgora, () => true);
  const terrenos = useMundo((s) => s.terrenos);
  const meu = useMundo((s) => s.meu);
  const vagas = useMundo((s) => s.vagas);
  const sel = useMundo((s) => s.loteSelecionado);
  const praca = useMundo((s) => s.praca);
  const temPersonagem = usePersonagem((s) => !!s.meu);
  const agora = useAgora();
  const { nomes } = useRuas();
  const versao = useVersaoMiniMapa();
  const [nicho, setNicho] = useState("");
  const [abertoCel, setAbertoCel] = useState(false);
  const [minimizado, setMin] = useState(false);
  const [dica, setDica] = useState<{ u: number; v: number; texto: string } | null>(null);
  const cam = useRef<SVGGElement>(null), eu = useRef<SVGCircleElement>(null);
  const visivel = mundo && (largo ? !minimizado : abertoCel);
  // a cena só desenha a imagem com o painel à vista; abrir o painel ou a cidade mudar pede um desenho novo
  useEffect(() => { miniMapa.setVisivel(visivel); return () => miniMapa.setVisivel(false); }, [visivel]);
  useEffect(() => { miniMapa.pedir(); }, [terrenos, vagas]);
  // a câmera e o personagem mexem a cada quadro: atualiza direto no desenho, sem redesenhar o componente
  useEffect(() => {
    let id = 0;
    const passo = () => {
      if (cam.current && cameraInfo.pronto) {
        const p = projetar(cameraInfo.x, 0, cameraInfo.z), f = projetar(cameraInfo.x + Math.sin(cameraInfo.ang) * 20, 0, cameraInfo.z + Math.cos(cameraInfo.ang) * 20);
        const ang = (Math.atan2((f.v - p.v) * VBA, (f.u - p.u) * VB) * 180) / Math.PI;
        cam.current.setAttribute("transform", `translate(${(p.u * VB).toFixed(1)} ${(p.v * VBA).toFixed(1)}) rotate(${ang.toFixed(1)})`);
      }
      if (eu.current) { const p = projetar(minhaPos.x, 0, minhaPos.z); eu.current.setAttribute("cx", (p.u * VB).toFixed(1)); eu.current.setAttribute("cy", (p.v * VBA).toFixed(1)); }
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, []);
  const nichosPresentes = useMemo(() => { const s = new Set(Object.values(terrenos).filter((t) => t.status === "ativo" && !t.anexoDe).map((t) => t.nicho ?? "negocios")); return NICHOS.filter((n) => s.has(n.id)); }, [terrenos]);
  // resolução da imagem: o mapa desenha em 2× o tamanho do painel (nítido em tela retina); no modo leve, menor
  const largura = useMemo(() => (mundo && leve() ? 384 : 544), [mundo]);
  if (!mundo) return null;
  const altura = Math.round(largura / PROPORCAO);
  const vivo = !!eventosDoMomento(praca?.agenda ?? []).vivo;
  const fechar = () => { if (largo) setMin(true); else setAbertoCel(false); };
  const ir = (chave: string) => { useMundo.getState().selecionarLote(chave); if (!largo) setAbertoCel(false); };
  const voar = (x: number, z: number) => {
    const cx = Math.max(LIMITE_CAMERA.xMin, Math.min(LIMITE_CAMERA.xMax, x)), cz = Math.max(LIMITE_CAMERA.zMin, Math.min(LIMITE_CAMERA.zMax, z));
    useMundo.setState({ alvoCamera: [cx, 0.5, cz], loteSelecionado: null }); if (!largo) setAbertoCel(false);
  };
  // lojas abertas (lote principal), obras (reservados) e a praça
  const lojas = Object.values(terrenos).filter((t) => !t.anexoDe).map((t) => {
    const o = ondeFica(t, terrenos); if (!o) return null;
    const ativo = t.status === "ativo";
    const promo = ativo ? promocaoAtiva(t, agora) : null;
    const area = t.nicho ?? "negocios";
    const apagado = nicho === "__promo" ? !promo : nicho.startsWith("bairro:") ? bairroDoLote(t.chave)?.id !== nicho.slice(7) : !!nicho && (!ativo || area !== nicho);
    const destaque = !!nicho && !apagado;
    return { t, ...o, ativo, promo, apagado, destaque, contratando: ativo && (vagas[t.chave] ?? 0) > 0, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? 0 };
  }).filter(Boolean) as { t: Terreno; x: number; z: number; h: number; ativo: boolean; promo: { texto: string } | null; apagado: boolean; destaque: boolean; contratando: boolean; numero: number }[];
  const algumaPromo = lojas.some((x) => x.promo);
  const praca2 = LOTE_POR_CHAVE[PRACA_CHAVE];
  const bairroFiltro = nicho.startsWith("bairro:") ? BAIRROS.find((b) => b.id === nicho.slice(7)) ?? null : null;
  const aoClicar = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    const { x, z } = noChao(u, v, 4);
    const l = LOTES.find((q) => Math.abs(x - q.centro[0]) < 9.5 && Math.abs(z - q.centro[1]) < 9.5);
    if (l) ir(l.chave); else voar(x, z);
  };
  const aoMover = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    const { x, z } = noChao(u, v, 4); const texto = descrever(x, z, terrenos, nomes);
    setDica(texto ? { u, v, texto } : null);
  };
  return (
    <>
      <button data-tour="mapa" onClick={() => { setAbertoCel(true); setMin(false); }} className={`pointer-events-auto absolute right-2 top-[4.4rem] z-10 items-center gap-1.5 rounded-full bg-[#111418]/85 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur sm:left-3 sm:right-auto sm:top-20 ${abertoCel ? "hidden" : "flex"} ${minimizado ? "sm:flex" : "sm:hidden"}`}>🗺️ Mapa da cidade</button>
      <div data-tour="mapa" className={`pointer-events-auto fixed inset-x-2 top-[4.2rem] z-20 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl bg-[#111418]/92 p-2 text-white shadow-2xl backdrop-blur sm:absolute sm:inset-x-auto sm:left-3 sm:top-20 sm:z-10 sm:w-[17rem] sm:max-h-none sm:overflow-visible ${abertoCel ? "block" : "hidden"} ${minimizado ? "sm:hidden" : "sm:block"}`}>
        <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">Mapa da cidade</span>
          <button onClick={fechar} aria-label="Fechar o mapa" className="rounded-full px-1.5 text-white/60 hover:bg-white/10">✕</button>
        </div>
        <div className="relative w-full cursor-pointer select-none overflow-hidden rounded-xl bg-[#1B222B]" style={{ aspectRatio: String(PROPORCAO) }}
          role="img" aria-label="Mapa da cidade em 3D visto de cima, com o norte para cima" onClick={aoClicar} onMouseMove={aoMover} onMouseLeave={() => setDica(null)}>
          {/* base desenhada enquanto a imagem da cidade não chega (e por baixo dela) */}
          <svg viewBox={`0 0 ${VB} ${VBA}`} className="absolute inset-0 h-full w-full" aria-hidden>
            <polygon points={poligono(-MUNDO.x, NORTE.parque.z1, MUNDO.x, NORTE.rio.z1)} fill="#2F6B45" />
            <polygon points={poligono(-MUNDO.x - 8, NORTE.rio.z1, MUNDO.x + 8, NORTE.rio.z0)} fill="#2F6FA3" />
            <polygon points={poligono(-MUNDO.x, NORTE.rio.z0, MUNDO.x, MUNDO.z)} fill="#3B4350" />
            {centroQuarteiroes().map(([cx, cz]) => <polygon key={`${cx},${cz}`} points={poligono(cx - Q / 2, cz - Q / 2, cx + Q / 2, cz + Q / 2)} fill="#4B5563" />)}
          </svg>
          <canvas ref={(c) => miniMapa.registrar(c)} width={largura} height={altura} className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${versao > 0 ? "opacity-100" : "opacity-0"}`} />
          {/* destaque do bairro filtrado, câmera e eu */}
          <svg viewBox={`0 0 ${VB} ${VBA}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {bairroFiltro && (() => { const [cx, cz] = centroQuarteirao(bairroFiltro.i, bairroFiltro.j); return <polygon points={poligono(cx - Q / 2, cz - Q / 2, cx + Q / 2, cz + Q / 2)} fill={bairroFiltro.cor} fillOpacity={0.25} stroke={bairroFiltro.cor} strokeWidth={6} strokeLinejoin="round" />; })()}
            <g ref={cam}><path d="M0 0 L80 -34 Q92 0 80 34 Z" fill="rgba(255,255,255,.28)" stroke="rgba(255,255,255,.7)" strokeWidth={2.5} /><circle r={9} fill="#fff" stroke="#111418" strokeWidth={3} /></g>
            {temPersonagem && <circle ref={eu} r={11} fill="#38BDF8" stroke="#fff" strokeWidth={4} />}
          </svg>
          {/* nomes dos bairros e dos lugares */}
          {BAIRROS.map((b) => { const [cx, cz] = centroQuarteirao(b.i, b.j); const p = projetar(cx, 1, cz); const fraco = !!nicho && nicho !== `bairro:${b.id}`; return (
            <span key={b.id} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#111418]/72 px-1.5 py-px text-[8.5px] font-bold leading-tight text-white shadow transition-opacity sm:text-[8px] ${fraco ? "opacity-30" : "opacity-95"}`} style={{ left: pct(p.u), top: pct(p.v) }}>
              <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: b.cor }} />{b.curto}
            </span>
          ); })}
          {LUGARES.map((l) => { const p = projetar(l.x, l.y, l.z); return (
            <button key={l.nome} onClick={(e) => { e.stopPropagation(); if (l.alvo) voar(l.alvo[0], l.alvo[2]); }} className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-extrabold leading-tight shadow-sm ${ESTILO_LUGAR[l.estilo]} ${l.alvo ? "" : "pointer-events-none"}`} style={{ left: pct(p.u), top: pct(p.v) }}>{l.nome}</button>
          ); })}
          {/* praça de eventos */}
          {praca2 && (() => { const p = projetar(praca2.centro[0], 3, praca2.centro[1]); return (
            <button onClick={(e) => { e.stopPropagation(); ir(PRACA_CHAVE); }} title={`Praça de Eventos${vivo ? " · ao vivo agora" : ""}`} className={`absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] shadow ring-2 ring-white ${vivo ? "animate-pulse bg-[#E11D48]" : "bg-[#0F766E]"} ${nicho && nicho !== "bairro:praca" ? "opacity-40" : ""}`} style={{ left: pct(p.u), top: pct(p.v) }}>🎤</button>
          ); })()}
          {/* lojas abertas (alfinete com a logo) e obras */}
          {/* o alfinete fica perto do chão: com a inclinação, o alto do prédio já cai no quarteirão vizinho */}
          {lojas.map((x) => { const p = projetar(x.x, Math.min(x.h, 4), x.z); const eMeu = meu === x.t.chave; const selecionada = sel === x.t.chave; const cor = x.t.cor;
            if (!x.ativo) return (
              <button key={x.t.chave} onClick={(e) => { e.stopPropagation(); ir(x.t.chave); }} title={`${x.t.empresaNome} · em obras`} className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#E0A91B] ring-2 ring-[#111418] ${x.apagado ? "opacity-25" : ""}`} style={{ left: pct(p.u), top: pct(p.v) }} />
            );
            return (
              <button key={x.t.chave} onClick={(e) => { e.stopPropagation(); ir(x.t.chave); }} title={`${x.t.empresaNome} · Lote ${x.numero} · ${nomeNicho(x.t.nicho ?? "negocios")}${x.promo ? ` · 🏷️ ${x.promo.texto}` : ""}${x.contratando ? " · contratando" : ""}`}
                className={`absolute flex -translate-x-1/2 -translate-y-full flex-col items-center transition-opacity ${x.apagado ? "opacity-25" : ""} ${x.destaque ? "z-[2] scale-110" : ""}`} style={{ left: pct(p.u), top: pct(p.v) }}>
                <span className={`relative block rounded-full p-[2px] shadow-md ${selecionada ? "ring-2 ring-white" : eMeu ? "ring-2 ring-[#93C5FD]" : ""}`} style={{ background: cor }}>
                  <span className="grid h-[18px] w-[18px] place-items-center overflow-hidden rounded-full bg-white text-[7px] font-black" style={{ color: cor }}>
                    {x.t.temLogo ? <img src={`/api/terrenos/${encodeURIComponent(x.t.chave)}/logo`} alt="" className="h-full w-full object-contain" /> : x.t.empresaNome.trim().slice(0, 2).toUpperCase()}
                  </span>
                  {x.promo && <span className="absolute -right-2 -top-1.5 rounded-full bg-[#E11D48] px-1 text-[7px] font-black leading-[11px] text-white ring-1 ring-white">%</span>}
                  {x.contratando && <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[#FACC15] ring-1 ring-[#111418]" />}
                </span>
                <span className="block h-1.5 w-[2px]" style={{ background: cor }} />
              </button>
            );
          })}
          {dica && largo && <span className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#1D2128] shadow" style={{ left: pct(dica.u), top: pct(dica.v) }}>{dica.texto}</span>}
        </div>
        <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Filtrar por área" className="mt-1.5 w-full rounded-lg bg-white/10 px-2 py-1 text-base font-semibold text-white outline-none sm:text-[11px] [&>option]:text-[#1D2128]">
          <option value="">Todas as áreas</option>
          {algumaPromo && <option value="__promo">🏷️ Com promoção agora</option>}
          {nichosPresentes.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
          <optgroup label="Bairros">{BAIRROS.map((b) => <option key={b.id} value={`bairro:${b.id}`}>{b.nome}</option>)}</optgroup>
        </select>
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 px-0.5 text-[9.5px] text-white/60">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-white align-middle ring-2 ring-[#5B9DFF]" />loja aberta</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#E0A91B] align-middle" />em obras</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#FACC15] align-middle" />contratando</span>
          {algumaPromo && <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#E11D48] align-middle" />promoção</span>}
          <span className="w-full text-white/45">Toque numa loja para abrir ou em qualquer ponto para ir até lá.</span>
        </div>
      </div>
    </>
  );
}
// centros de todos os quarteirões (base desenhada)
function centroQuarteiroes(): [number, number][] {
  const out: [number, number][] = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(centroQuarteirao(i, j)); return out;
}
