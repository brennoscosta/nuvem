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
import { Icone } from "./Icone";
import { brl } from "./equipeComum";
import { abrirSede } from "./CartaoOneState";
import { SEDES, centroTorre, alturaSede, frenteDaSede, sedeNoPonto } from "../data/sedes";
import { QUIOSQUES, QUIOSQUE_POR_CHAVE, PRECO_QUIOSQUE } from "../data/quiosques";
import { numeroDaLoja, rotuloLoja } from "../data/numeroLoja";

const semAssinatura = () => () => {};
const assinarLargura = (f: () => void) => { const m = window.matchMedia("(min-width: 640px)"); m.addEventListener("change", f); return () => m.removeEventListener("change", f); };
const largoAgora = () => window.matchMedia("(min-width: 640px)").matches;
const VB = 1000, VBA = Math.round(VB / PROPORCAO); // caixa do desenho por cima da imagem
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const Q = QUARTEIRAO + 2 * CALCADA;
const LUGARES: { nome: string; x: number; y: number; z: number; estilo: "marco" | "agua" | "verde" | "areia" | "ouro"; alvo?: [number, number, number]; abrir?: () => void }[] = [
  // sedes (19/11/2026: cada uma num lote de esquina virado para o centro): o nome sobre a torre; o alvo é a frente dela
  ...SEDES.map((sd) => { const [x, z] = centroTorre(sd), [fx, fz] = frenteDaSede(sd, 0); return { nome: sd.nome, x, y: alturaSede(sd), z, estilo: "ouro" as const, alvo: [fx, 0.5, fz] as [number, number, number], abrir: () => abrirSede(sd.id) }; }),
  { nome: "Nuvem", x: 0, y: 22, z: 0, estilo: "marco", alvo: [0, 0.5, 0] },
  { nome: "Lanchonete", x: 52, y: 12, z: 0, estilo: "marco", alvo: [52, 0.5, 0] },
  { nome: "Parque da Cidade", x: 0, y: 2, z: -128, estilo: "verde", alvo: [0, 0.5, -122] },
  { nome: "Rio", x: -74, y: 0, z: -96, estilo: "agua" },
  { nome: "Praia", x: -30, y: 0, z: 95, estilo: "areia" },
];
// Mover e ampliar (16/11/2026, pedido do dono: "expandir o mapa, movimentar o minimapa para qualquer lugar da tela"):
// no computador o painel é arrastado pelo cabeçalho, muda de tamanho pela alça do canto e tem o botão Expandir.
// Posição e largura ficam neste navegador; duplo clique no cabeçalho volta ao canto de sempre.
const CHAVE_LUGAR = "workend-minimapa";
const LARG_PADRAO = 288, LARG_MIN = 240, TOPO = 72; // TOPO: abaixo da barra de cima (o cabeçalho do mapa nunca fica escondido)
type LugarPainel = { x: number | null; y: number | null; w: number };
const PADRAO: LugarPainel = { x: null, y: null, w: LARG_PADRAO };
function lerLugar(): LugarPainel {
  try { const j = JSON.parse(window.localStorage.getItem(CHAVE_LUGAR) ?? "null"); if (j && typeof j.w === "number") return { x: typeof j.x === "number" ? j.x : null, y: typeof j.y === "number" ? j.y : null, w: j.w }; } catch { /* nada guardado */ }
  return PADRAO;
}
const guardarLugar = (l: LugarPainel) => { try { window.localStorage.setItem(CHAVE_LUGAR, JSON.stringify(l)); } catch { /* sem armazenamento */ } };
// cabe na área do mapa: largura entre o mínimo e o que cabe (a altura acompanha a largura), sem sair da tela e sem
// passar por baixo da barra de cima
function limitar(l: LugarPainel, W: number, H: number, alt: number): LugarPainel {
  const w = Math.round(Math.max(LARG_MIN, Math.min(l.w, W - 24, 1100, (H - TOPO - 8 - 175) * PROPORCAO)));
  if (l.x == null || l.y == null) return { x: null, y: null, w };
  return { w, x: Math.round(Math.max(8, Math.min(l.x, W - w - 8))), y: Math.round(Math.max(TOPO, Math.min(l.y, H - Math.min(alt, H - TOPO - 8) - 8))) };
}
const ESTILO_LUGAR = { ouro: "bg-[#14110A] text-[#F2C14E] ring-1 ring-[#D4A63A]", marco: "bg-[#1D4ED8] text-white", agua: "bg-transparent text-[#BFE3FF] italic", verde: "bg-[#14532D]/85 text-[#D9F99D]", areia: "bg-transparent text-[#FDE7B0] italic" } as const;

// polígono (na caixa do desenho) de um retângulo do chão: os quatro cantos projetados
function poligono(x0: number, z0: number, x1: number, z1: number) {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => { const p = projetar(x, 0, z); return `${(p.u * VB).toFixed(1)},${(p.v * VBA).toFixed(1)}`; }).join(" ");
}
// centro e altura do prédio de uma loja (lote duplo: no meio dos dois terrenos)
function ondeFica(t: Terreno, terrenos: Record<string, Terreno>) {
  const qk = QUIOSQUE_POR_CHAVE[t.chave]; if (qk) return { x: qk.pos[0], z: qk.pos[1], h: 3 }; // quiosque (20/11/2026)
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
  const sd = sedeNoPonto(x, z); if (sd) return `Sede da ${sd.nome}`;
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
  // 21/11/2026: no celular o editor do personagem sobe até 88% da tela e cobria a metade de baixo do botão do mapa
  const editorPersonagem = usePersonagem((s) => s.painel === "montar");
  // 24/11/2026: no computador o mapa da cidade também começa recolhido (só o botão); abre ao tocar nele
  const [minimizado, setMin] = useState(true);
  const [dica, setDica] = useState<{ u: number; v: number; texto: string } | null>(null);
  const [lugar, setLugar] = useState<LugarPainel>(() => (typeof window === "undefined" ? PADRAO : lerLugar()));
  const painel = useRef<HTMLDivElement>(null);
  const ultimoToque = useRef(0); // duplo clique no cabeçalho (o arrastar segura o clique; contamos à mão)
  const arrasto = useRef<null | { tipo: "mover" | "tamanho"; id: number; x0: number; y0: number; l0: LugarPainel }>(null);
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
  // ampliado, a imagem é desenhada maior para continuar nítida (no modo leve, menos)
  const largura = useMemo(() => {
    const fraco = mundo && leve(), base = fraco ? 384 : 544;
    if (!largo) return base;
    return Math.min(fraco ? 640 : 1152, Math.max(base, Math.round((lugar.w * (fraco ? 1.2 : 1.8)) / 32) * 32));
  }, [mundo, largo, lugar.w]);
  useEffect(() => { miniMapa.pedir(); }, [largura]);
  // a janela mudou de tamanho: o painel volta para dentro da tela
  useEffect(() => {
    const ajustar = () => { const p = painel.current, b = p?.offsetParent as HTMLElement | null; if (!p || !b) return; setLugar((l) => limitar(l, b.clientWidth, b.clientHeight, p.offsetHeight)); };
    window.addEventListener("resize", ajustar); return () => window.removeEventListener("resize", ajustar);
  }, []);
  if (!mundo) return null;
  const altura = Math.round(largura / PROPORCAO);
  const vivo = !!eventosDoMomento(praca?.agenda ?? []).vivo;
  const fechar = () => { if (largo) setMin(true); else setAbertoCel(false); };
  // arrastar pelo cabeçalho (mover) ou pela alça do canto (tamanho): mexe direto no painel e guarda ao soltar
  const comecar = (tipo: "mover" | "tamanho", e: React.PointerEvent<HTMLElement>) => {
    if (!largo || e.button !== 0) return;
    if (tipo === "mover" && (e.target as HTMLElement).closest("button")) return;
    if (tipo === "mover") { if (e.timeStamp - ultimoToque.current < 330) { ultimoToque.current = 0; voltarAoCanto(); return; } ultimoToque.current = e.timeStamp; }
    const p = painel.current, b = p?.offsetParent as HTMLElement | null; if (!p || !b) return;
    const r = p.getBoundingClientRect(), rb = b.getBoundingClientRect();
    arrasto.current = { tipo, id: e.pointerId, x0: e.clientX, y0: e.clientY, l0: { x: r.left - rb.left, y: r.top - rb.top, w: r.width } };
    e.currentTarget.setPointerCapture(e.pointerId); p.dataset.arrastando = ""; e.preventDefault();
  };
  const comecarMover = (e: React.PointerEvent<HTMLElement>) => comecar("mover", e);
  const comecarTamanho = (e: React.PointerEvent<HTMLElement>) => comecar("tamanho", e);
  const arrastar = (e: React.PointerEvent<HTMLElement>) => {
    const a = arrasto.current, p = painel.current, b = p?.offsetParent as HTMLElement | null; if (!a || !p || !b || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    const c = limitar(a.tipo === "mover" ? { ...a.l0, x: (a.l0.x ?? 0) + dx, y: (a.l0.y ?? 0) + dy } : { ...a.l0, w: a.l0.w + dx }, b.clientWidth, b.clientHeight, p.offsetHeight);
    p.style.left = `${c.x}px`; p.style.top = `${c.y}px`; p.style.width = `${c.w}px`;
  };
  const soltar = (e: React.PointerEvent<HTMLElement>) => {
    const a = arrasto.current, p = painel.current, b = p?.offsetParent as HTMLElement | null; if (!a || !p || !b || a.id !== e.pointerId) return;
    arrasto.current = null; delete p.dataset.arrastando;
    const r = p.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const novo = limitar({ x: r.left - rb.left, y: r.top - rb.top, w: r.width }, b.clientWidth, b.clientHeight, p.offsetHeight);
    setLugar(novo); guardarLugar(novo);
  };
  const grande = lugar.w >= 480;
  const alternarTamanho = () => {
    const p = painel.current, b = p?.offsetParent as HTMLElement | null; if (!p || !b) return;
    const w = grande ? LARG_PADRAO : Math.min(680, b.clientWidth * 0.6);
    const novo = limitar({ ...lugar, w }, b.clientWidth, b.clientHeight, w / PROPORCAO + 170);
    setLugar(novo); guardarLugar(novo);
  };
  const voltarAoCanto = () => { setLugar(PADRAO); guardarLugar(PADRAO); };
  const escala = Math.min(1.7, Math.max(1, (lugar.w / LARG_PADRAO) * 0.85));
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
    return { t, ...o, ativo, promo, apagado, destaque, contratando: ativo && (vagas[t.chave] ?? 0) > 0, numero: numeroDaLoja(t) ?? LOTE_POR_CHAVE[t.chave]?.numero ?? 0 };
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
      <button data-tour="mapa" onClick={() => { setAbertoCel(true); setMin(false); }} className={`hud-ilha hud-btn pointer-events-auto absolute right-2 top-[4.4rem] z-10 !h-11 !rounded-2xl !px-3.5 sm:left-3 sm:right-auto sm:top-[5.2rem] ${abertoCel || editorPersonagem ? "hidden" : "flex"} ${minimizado ? "sm:flex" : "sm:hidden"}`}><Icone nome="mapa" tamanho={18} />Mapa da cidade</button>
      <div ref={painel} data-tour="mapa" style={largo ? { left: lugar.x ?? undefined, top: lugar.y ?? undefined, width: lugar.w, ["--mm-escala" as string]: escala } : undefined} className={`mm-painel pointer-events-auto fixed inset-x-2 top-[4.2rem] z-20 max-h-[calc(100dvh-5rem)] overflow-y-auto hud-ilha p-2.5 sm:absolute sm:inset-x-auto sm:left-3 sm:top-[5.2rem] sm:z-10 sm:w-[18rem] sm:max-h-none sm:overflow-visible ${abertoCel ? "block" : "hidden"} ${minimizado ? "sm:hidden" : "sm:block"}`}>
        <div className={`mb-2 flex items-center justify-between gap-1 pl-1 ${largo ? "mm-cabeca" : ""}`} onPointerDown={comecarMover} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} onDoubleClick={() => largo && voltarAoCanto()} title={largo ? "Arraste para levar o mapa a qualquer lugar. Duplo clique volta ao canto." : undefined}>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-white/90">{largo && <Icone nome="arrastar" tamanho={15} className="-mr-1 text-white/40" />}<Icone nome="mapa" tamanho={17} className="text-[#93C5FD]" />Mapa da cidade</span>
          <span className="flex items-center gap-0.5">
          {largo && <button onClick={alternarTamanho} aria-label={grande ? "Diminuir o mapa" : "Expandir o mapa"} title={grande ? "Diminuir" : "Expandir"} className="hud-btn hud-btn-icone !h-8 !w-8"><Icone nome={grande ? "recolher" : "expandir"} tamanho={16} /></button>}
          <button onClick={fechar} aria-label={largo ? "Recolher o mapa" : "Fechar o mapa"} title={largo ? "Recolher" : "Fechar"} className="hud-btn hud-btn-icone !h-8 !w-8"><Icone nome={largo ? "menos" : "fechar"} tamanho={16} /></button>
          </span>
        </div>
        <div className="relative w-full cursor-pointer select-none overflow-hidden rounded-xl bg-[#1B222B] ring-1 ring-white/10" style={{ aspectRatio: String(PROPORCAO) }}
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
            <span key={b.id} className={`mm-e pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#111418]/72 px-1.5 py-px text-[8.5px] font-bold leading-tight text-white shadow transition-opacity sm:text-[8px] ${fraco ? "opacity-30" : "opacity-95"}`} style={{ left: pct(p.u), top: pct(p.v) }}>
              <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: b.cor }} />{b.curto}
            </span>
          ); })}
          {LUGARES.map((l) => { const p = projetar(l.x, l.y, l.z); return (
            <button key={l.nome} onClick={(e) => { e.stopPropagation(); if (l.abrir) { l.abrir(); if (!largo) setAbertoCel(false); } else if (l.alvo) voar(l.alvo[0], l.alvo[2]); }} className={`mm-e absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-extrabold leading-tight shadow-sm ${ESTILO_LUGAR[l.estilo]} ${l.alvo ? "" : "pointer-events-none"}`} style={{ left: pct(p.u), top: pct(p.v) }}>{l.nome}</button>
          ); })}
          {/* praça de eventos */}
          {praca2 && (() => { const p = projetar(praca2.centro[0], 3, praca2.centro[1]); return (
            <button onClick={(e) => { e.stopPropagation(); ir(PRACA_CHAVE); }} title={`Praça de Eventos${vivo ? " · ao vivo agora" : ""}`} className={`mm-e absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] shadow ring-2 ring-white ${vivo ? "animate-pulse bg-[#E11D48]" : "bg-[#0F766E]"} ${nicho && nicho !== "bairro:praca" ? "opacity-40" : ""} text-white`} style={{ left: pct(p.u), top: pct(p.v) }}><Icone nome="microfone" tamanho={11} traco={2.2} /></button>
          ); })()}
          {/* lojas abertas (alfinete com a logo) e obras */}
          {/* o alfinete fica perto do chão: com a inclinação, o alto do prédio já cai no quarteirão vizinho */}
          {lojas.map((x) => { const p = projetar(x.x, Math.min(x.h, 4), x.z); const eMeu = meu === x.t.chave; const selecionada = sel === x.t.chave; const cor = x.t.cor;
            if (!x.ativo) return (
              <button key={x.t.chave} onClick={(e) => { e.stopPropagation(); ir(x.t.chave); }} title={`${x.t.empresaNome} · em obras`} className={`mm-e absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#E0A91B] ring-2 ring-[#111418] ${x.apagado ? "opacity-25" : ""}`} style={{ left: pct(p.u), top: pct(p.v) }} />
            );
            return (
              <button key={x.t.chave} onClick={(e) => { e.stopPropagation(); ir(x.t.chave); }} title={`${x.t.empresaNome} · ${rotuloLoja(x.numero)} · ${nomeNicho(x.t.nicho ?? "negocios")}${x.promo ? ` · promoção: ${x.promo.texto}` : ""}${x.contratando ? " · contratando" : ""}`}
                className={`mm-e mm-pino absolute flex -translate-x-1/2 -translate-y-full flex-col items-center transition-opacity ${x.apagado ? "opacity-25" : ""} ${x.destaque ? "z-[2] scale-110" : ""}`} style={{ left: pct(p.u), top: pct(p.v) }}>
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
          {/* quiosques livres (20/11/2026): quadradinho verde-água; tocar abre o cartão */}
          {QUIOSQUES.filter((q) => !terrenos[q.chave]).map((q) => { const p = projetar(q.pos[0], 1, q.pos[1]); return (
            <button key={q.chave} onClick={(e) => { e.stopPropagation(); ir(q.chave); }} title={`Quiosque ${q.numero} · disponível · ${brl(PRECO_QUIOSQUE)}/mês`} aria-label={`Quiosque ${q.numero} disponível`}
              className={`mm-e absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-[#2DD4BF] ring-2 ${sel === q.chave ? "ring-white" : "ring-[#111418]"} ${nicho ? "opacity-30" : ""}`} style={{ left: pct(p.u), top: pct(p.v) }} />
          ); })}
          {dica && largo && <span className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#1D2128] shadow" style={{ left: pct(dica.u), top: pct(dica.v) }}>{dica.texto}</span>}
        </div>
        <label className="hud-filtro">
          <Icone nome="filtro" tamanho={15} />
          <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Filtrar por área">
            <option value="">Todas as áreas</option>
            {algumaPromo && <option value="__promo">Com promoção agora</option>}
            {nichosPresentes.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
            <optgroup label="Bairros">{BAIRROS.map((b) => <option key={b.id} value={`bairro:${b.id}`}>{b.nome}</option>)}</optgroup>
          </select>
          <Icone nome="baixo" tamanho={14} />
        </label>
        <div className="hud-legenda">
          <span><i className="bg-white ring-2 ring-[#5B9DFF]" />loja aberta</span>
          <span><i className="!rounded-sm bg-[#E0A91B]" />em obras</span>
          <span><i className="bg-[#FACC15]" />contratando</span>
          <span><i className="!rounded-[3px] bg-[#2DD4BF]" />quiosque livre</span>
          {algumaPromo && <span><i className="bg-[#E11D48]" />promoção</span>}
        </div>
        <p className="mt-2 px-1 text-[11px] leading-snug text-white/45">Toque numa loja para abrir ou em qualquer ponto para ir até lá.</p>
        {largo && <span className="mm-alca" role="separator" aria-label="Arraste para mudar o tamanho do mapa" title="Arraste para mudar o tamanho" onPointerDown={comecarTamanho} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} />}
      </div>
    </>
  );
}
// centros de todos os quarteirões (base desenhada)
function centroQuarteiroes(): [number, number][] {
  const out: [number, number][] = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(centroQuarteirao(i, j)); return out;
}
