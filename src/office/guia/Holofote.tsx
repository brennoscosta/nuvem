"use client";
// Guia passo a passo com holofote (21/11/2026, frente "tutorial", no padrão do guia do bday.fm): a tela escurece e só o
// alvo da vez fica aceso, com um balão dizendo o que é e para que serve.
//  - O escuro é um SVG fixo com um <path fill-rule="evenodd">: a tela inteira mais o retângulo arredondado do alvo. O furo
//    não tem preenchimento, então o clique atravessa até o elemento de verdade; clicar no escuro só sacode o balão.
//  - A posição é medida a cada quadro (requestAnimationFrame, com um relógio de reserva quando o navegador desenha devagar)
//    e só redesenha quando a assinatura do retângulo muda: pega rolagem, troca de aba e o teclado do celular.
//  - Cada passo pode preparar a tela (antes), espera o alvo até 6 s e é pulado se ele não existir para esta conta.
//  - Até 640 px o balão vira uma faixa de largura total, em cima ou embaixo, do lado oposto ao alvo; no computador ele
//    fica ao lado do alvo e vai para a lateral se fosse tapar o alvo seguinte. Recado sem alvo: centralizado pelo CSS.
// Não acrescenta nada à cena 3D: é só uma camada HTML por cima (portal no <body>).
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icone } from "../ui/Icone";
import { useGuia, passoFeito, passosDoRoteiro, pendentes, ctxAgora } from "./guiaStore";
import { resolverAlvo } from "./alvos";
import type { AcaoFim, CtxGuia, Passo, Roteiro, Texto } from "./tipos";
import "./guia.css";

const PAD = 8; // folga do furo em volta do alvo
const RAIO = 14;
const ESPERA = 6000; // quanto o passo espera o alvo aparecer antes de ser pulado
const OLHADAS = 12; // e quantas vezes, no mínimo, olhou a tela nesse tempo
const SUMIU = 1400; // o alvo sumiu (a pessoa abriu outra coisa nele): segue para o próximo passo
const AUTO = 700; // passo "auto": avança depois do toque no alvo
const M = 12; // margem da tela
const LARGURA = 348; // balão no computador
const CELULAR = 640;

type Caixa = { x: number; y: number; w: number; h: number };
interface Vista { passo: number; caixa: Caixa | null; w: number; h: number; bh: number; prox: Caixa | null }
declare global {
  interface Window { __guia?: { roteiro: string; passo: string; i: number; total: number; furo: Caixa | null; alvo: Caixa | null; balao: Caixa | null; modo: string } }
}

const txt = (t: Texto, c: CtxGuia) => (typeof t === "function" ? t(c) : t);
const arred = (c: Caixa | null) => (c ? `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}` : "-");
const cruza = (a: Caixa, b: Caixa) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const area = (a: Caixa, b: Caixa) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const entre = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// o furo: o retângulo do alvo com folga, sem passar da tela
function furo(r: DOMRect): Caixa {
  const x = Math.max(4, r.left - PAD), y = Math.max(4, r.top - PAD);
  return { x, y, w: Math.max(0, Math.min(window.innerWidth - 4, r.right + PAD) - x), h: Math.max(0, Math.min(window.innerHeight - 4, r.bottom + PAD) - y) };
}
// a tela inteira com o retângulo arredondado do alvo recortado (evenodd)
function caminho(w: number, h: number, c: Caixa | null) {
  let d = `M0 0H${w}V${h}H0Z`;
  if (c) {
    const { x, y } = c, cw = c.w, ch = c.h, r = Math.min(RAIO, cw / 2, ch / 2);
    d += `M${x + r} ${y}H${x + cw - r}A${r} ${r} 0 0 1 ${x + cw} ${y + r}V${y + ch - r}A${r} ${r} 0 0 1 ${x + cw - r} ${y + ch}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + ch - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  return d;
}

// onde fica o balão. Recado: centralizado pelo CSS. Celular: faixa do lado oposto ao alvo. Computador: ao lado do alvo
// (direita, esquerda, embaixo, em cima); se taparia o alvo seguinte, vai para a lateral da tela.
function lugar(v: Vista): { classe: string; estilo: CSSProperties } {
  if (!v.caixa) return { classe: "gd-centro", estilo: {} };
  const c = v.caixa;
  // celular: a faixa vai para o lado com mais espaço livre, que é o lado oposto ao alvo (empate: embaixo, perto do polegar)
  if (v.w <= CELULAR) return { classe: c.y > v.h - (c.y + c.h) + 1 ? "gd-faixa gd-faixa-cima" : "gd-faixa gd-faixa-baixo", estilo: {} };
  const W = Math.min(LARGURA, v.w - 2 * M), bh = v.bh || 200;
  const ret = (q: { x: number; y: number }): Caixa => ({ x: q.x, y: q.y, w: W, h: bh });
  const cabe = (q: { x: number; y: number }) => q.x >= M && q.y >= M && q.x + W <= v.w - M && q.y + bh <= v.h - M;
  const yLado = entre(c.y, M, v.h - bh - M), xMeio = entre(c.x + c.w / 2 - W / 2, M, v.w - W - M);
  const opcoes = [{ x: c.x + c.w + 16, y: yLado }, { x: c.x - 16 - W, y: yLado }, { x: xMeio, y: c.y + c.h + 14 }, { x: xMeio, y: c.y - 14 - bh }];
  let q = opcoes.find((o) => cabe(o) && !cruza(ret(o), c));
  if (!q) { // alvo enorme: o canto que menos tapa
    const cantos = [{ x: v.w - W - M, y: M }, { x: M, y: M }, { x: v.w - W - M, y: v.h - bh - M }, { x: M, y: v.h - bh - M }];
    q = cantos.reduce((a, b) => (area(ret(b), c) < area(ret(a), c) ? b : a));
  }
  if (v.prox && cruza(ret(q), v.prox)) {
    const lateral = [{ x: M, y: q.y }, { x: v.w - W - M, y: q.y }].find((o) => !cruza(ret(o), c) && !cruza(ret(o), v.prox!));
    if (lateral) q = lateral;
  }
  return { classe: "gd-solto", estilo: { left: Math.round(q.x), top: Math.round(q.y), width: W } };
}

// a lista de passos, montada na abertura: aberto pelo botão, todos; reaparecendo sozinho, só os que faltam (e o final)
function montarLista(r: Roteiro, manual: boolean): Passo[] {
  const c = ctxAgora(r.tela), s = useGuia.getState();
  const todos = passosDoRoteiro(r, c);
  if (manual || !(s.progresso[r.id]?.feitos.length)) return todos;
  const falta = new Set(pendentes(r, c, s).map((p) => p.id));
  return todos.filter((p) => p.ultimo || falta.has(p.id));
}

export function Holofote({ roteiros }: { roteiros: Roteiro[] }) {
  const ativo = useGuia((s) => s.ativo);
  const r = ativo ? roteiros.find((x) => x.id === ativo.roteiro) : undefined;
  if (!ativo || !r) return null;
  return <Sessao key={ativo.vez} roteiro={r} manual={ativo.manual} />;
}

function Sessao({ roteiro: r, manual }: { roteiro: Roteiro; manual: boolean }) {
  const fatos = useGuia((s) => s.fatos), progresso = useGuia((s) => s.progresso), telas = useGuia((s) => s.telas);
  const logado = useGuia((s) => s.logado), nome = useGuia((s) => s.nome);
  const [lista] = useState<Passo[]>(() => montarLista(r, manual));
  const [passo, setPasso] = useState<{ i: number; dir: 1 | -1 }>({ i: 0, dir: 1 });
  const [vista, setVista] = useState<Vista | null>(null);
  const [sacode, setSacode] = useState(0);
  const balao = useRef<HTMLDivElement>(null);

  // ao fechar (qualquer jeito): desfaz o que o roteiro abriu na tela
  useEffect(() => () => r.aoFechar?.(), [r]);

  // cada passo: prepara a tela, espera o alvo, mede o furo e o balão a cada quadro; pula o passo sem alvo
  useEffect(() => {
    const p = lista[passo.i];
    const g = useGuia.getState();
    if (!p) { // passou do fim (o último passo foi pulado)
      const t = setTimeout(() => { if (!pendentes(r, ctxAgora(r.tela), useGuia.getState()).length) g.concluir(r.id); g.fechar(); }, 0);
      return () => clearTimeout(t);
    }
    if (p.pularSe?.()) { // a situação mudou depois de o guia abrir (ex.: a reserva já foi paga)
      const t = setTimeout(() => setPasso((s) => (s.i + s.dir < 0 ? { i: s.i + 1, dir: 1 } : { i: s.i + s.dir, dir: s.dir })), 0);
      return () => clearTimeout(t);
    }
    const c0 = ctxAgora(r.tela);
    const semAlvo = !p.alvo || (!!p.recadoNoCelular && c0.celular);
    let pronto = !p.antes, vivo = true, raf = 0, relogio: ReturnType<typeof setTimeout> | undefined, tAuto: ReturnType<typeof setTimeout> | undefined;
    const t0 = performance.now();
    // as esperas contam tempo E olhadas: com a cena 3D travando o processador, 6 s podem passar sem o guia olhar a tela
    let tPronto = pronto ? t0 : 0, achou = false, sumiu = 0, faltas = 0, olhadas = 0, rolou = false, focou = false, ultima = "";
    const limpar = p.antes ? p.antes(() => { pronto = true; }, c0) : undefined;
    const pular = () => { vivo = false; setPasso((s) => (s.i + s.dir < 0 ? { i: s.i + 1, dir: 1 } : { i: s.i + s.dir, dir: s.dir })); };
    const avancar = () => { vivo = false; if (p.tipo === "manual") useGuia.getState().marcar(r.id, [p.id]); setPasso((s) => ({ i: s.i + 1, dir: 1 })); };
    const medir = () => {
      if (!vivo) return;
      const agora = performance.now();
      olhadas++;
      if (!pronto) { if (agora - t0 > ESPERA && olhadas >= OLHADAS) return pular(); return agendar(); }
      if (!tPronto) olhadas = 1;
      if (!tPronto) tPronto = agora;
      let caixa: Caixa | null = null, alvo: Caixa | null = null;
      if (!semAlvo && p.alvo) {
        const el = resolverAlvo(p.alvo);
        let rr = el?.getBoundingClientRect();
        if (el && rr && !rolou) {
          rolou = true;
          if (rr.top < 0 || rr.bottom > window.innerHeight || rr.left < 0 || rr.right > window.innerWidth) {
            el.scrollIntoView({ block: rr.height > window.innerHeight * 0.7 ? "start" : "center", inline: "nearest" });
            rr = el.getBoundingClientRect();
          }
        }
        const f = rr ? furo(rr) : null;
        if (!el || !rr || !f || f.w < 4 || f.h < 4) {
          if (achou) { faltas++; if (!sumiu) sumiu = agora; else if (agora - sumiu > SUMIU && faltas >= 3) return avancar(); }
          else if (agora - tPronto > ESPERA && olhadas >= OLHADAS) return pular();
          return agendar();
        }
        achou = true; sumiu = 0; faltas = 0; caixa = f; alvo = { x: rr.left, y: rr.top, w: rr.width, h: rr.height };
      }
      // o alvo do passo seguinte, se já está na tela (o balão não deve tapá-lo)
      let prox: Caixa | null = null;
      const q = lista[passo.i + 1];
      if (q?.alvo && !(q.recadoNoCelular && c0.celular)) { const e2 = resolverAlvo(q.alvo); if (e2) { const r2 = e2.getBoundingClientRect(); prox = { x: r2.left, y: r2.top, w: r2.width, h: r2.height }; } }
      const b = balao.current, bh = b?.offsetHeight ?? 0;
      const w = window.innerWidth, h = window.innerHeight;
      const k = `${passo.i}|${arred(caixa)}|${arred(prox)}|${w}x${h}|${bh}`;
      if (k !== ultima) { ultima = k; setVista({ passo: passo.i, caixa, w, h, bh, prox }); }
      if (b) {
        const rb = b.getBoundingClientRect();
        window.__guia = { roteiro: r.id, passo: p.id, i: passo.i, total: lista.length, furo: caixa, alvo, balao: { x: rb.left, y: rb.top, w: rb.width, h: rb.height }, modo: b.dataset.modo ?? "" };
        if (!focou && bh > 0 && b.style.visibility !== "hidden") { focou = true; b.querySelector<HTMLElement>("[data-guia-seguir]")?.focus({ preventScroll: true }); }
      }
      agendar();
    };
    // a cada quadro; o relógio de reserva cobre o navegador que desenha devagar (aba em segundo plano, sem placa de vídeo)
    function agendar() { raf = requestAnimationFrame(passar); relogio = setTimeout(passar, 300); }
    function passar() { cancelAnimationFrame(raf); clearTimeout(relogio); medir(); }
    // passo "auto": um toque no alvo avança sozinho
    const ouvir = (e: PointerEvent) => {
      if (!p.auto || !p.alvo) return;
      const el = resolverAlvo(p.alvo);
      if (el && e.target instanceof Node && el.contains(e.target)) { clearTimeout(tAuto); tAuto = setTimeout(() => { if (vivo) avancar(); }, AUTO); }
    };
    if (p.auto) document.addEventListener("pointerdown", ouvir, true);
    agendar();
    return () => {
      vivo = false; cancelAnimationFrame(raf); clearTimeout(relogio); clearTimeout(tAuto);
      document.removeEventListener("pointerdown", ouvir, true);
      if (typeof limpar === "function") limpar();
    };
  }, [passo, lista, r]);

  const p = lista[passo.i];
  const ctx: CtxGuia = { logado, nome, fatos, celular: (vista?.w ?? 1280) <= CELULAR, tela: r.tela };
  const fechar = () => useGuia.getState().fechar();
  const terminar = () => {
    const g = useGuia.getState();
    if (p) g.marcar(r.id, [p.id]);
    if (!pendentes(r, ctxAgora(r.tela), useGuia.getState()).length) g.concluir(r.id);
    g.fechar();
  };
  const seguir = () => {
    if (!p) return;
    if (p.ultimo || passo.i >= lista.length - 1) return terminar();
    if (p.tipo === "manual") useGuia.getState().marcar(r.id, [p.id]);
    setPasso((s) => ({ i: s.i + 1, dir: 1 }));
  };
  const voltar = () => setPasso((s) => ({ i: Math.max(0, s.i - 1), dir: -1 }));
  const agir = (a: AcaoFim) => {
    terminar();
    if (a.fazer) a.fazer();
    if (a.roteiro) { const id = a.roteiro; setTimeout(() => useGuia.getState().abrir(id, true), 350); }
  };
  // teclado: Esc fecha, setas andam (Enter já aciona o botão em foco)
  const tecla = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seguir(); }
    else if (e.key === "ArrowLeft" && passo.i > 0) { e.preventDefault(); voltar(); }
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => tecla(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  if (!p) return null;
  const pronta = !!vista && vista.passo === passo.i;
  const caixa = pronta ? vista.caixa : null;
  const { classe, estilo } = pronta ? lugar(vista) : { classe: !p.alvo ? "gd-centro" : "gd-solto", estilo: { visibility: "hidden" as const, left: 0, top: 0, width: LARGURA } };
  const w = vista?.w ?? 4000, h = vista?.h ?? 4000;
  const total = lista.length, n = passo.i + 1;
  const feito = passoFeito(p, r.id, { fatos, telas, progresso });
  const acoes = p.ultimo ? (typeof p.acoes === "function" ? p.acoes(ctx) : p.acoes) ?? [] : [];
  const temPrincipal = acoes.some((a) => a.principal);

  return createPortal(
    <div className="gd-raiz" data-guia-raiz="" data-roteiro={r.id}>
      <svg className="gd-veu" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" data-furo={caixa ? arred(caixa) : ""}>
        <path className="gd-escuro" d={caminho(w, h, caixa)} fillRule="evenodd" onPointerDown={() => setSacode((x) => x + 1)} />
        {caixa && <rect className="gd-anel" x={caixa.x} y={caixa.y} width={caixa.w} height={caixa.h} rx={Math.min(RAIO, caixa.w / 2, caixa.h / 2)} />}
      </svg>
      <div ref={balao} className={`gd-balao ${classe} ${sacode ? `gd-sacode-${(sacode % 2) + 1}` : ""}`} style={estilo} role="dialog" aria-modal="false"
        aria-labelledby="gd-titulo" data-guia-balao="" data-passo={p.id} data-tipo={p.tipo} data-modo={classe.includes("faixa") ? "faixa" : classe === "gd-centro" ? "centro" : "lado"}>
        <div className="gd-topo">
          <span className="gd-rotulo"><Icone nome="guia" tamanho={15} />{r.nome}<i aria-hidden="true">·</i><span>{n} de {total}</span></span>
          <button type="button" className="gd-x" onClick={fechar} aria-label="Fechar o guia" title="Fechar: o guia volta na próxima entrada"><Icone nome="fechar" tamanho={16} /></button>
        </div>
        <div className="gd-trilho" aria-hidden="true"><i style={{ width: `${(n / total) * 100}%` }} /></div>
        <h2 id="gd-titulo" className="gd-titulo">{txt(p.titulo, ctx)}</h2>
        <p className="gd-texto" aria-live="polite">{txt(p.texto, ctx)}</p>
        {p.tipo === "fato" && (
          <p className={`gd-fato ${feito ? "gd-fato-ok" : ""}`} data-fato={feito ? "feito" : "falta"}>
            {feito ? <><Icone nome="check" tamanho={15} />Feito</> : <><Icone nome="relogio" tamanho={15} />Marca sozinho quando você fizer</>}
          </p>
        )}
        {p.auto && !p.ultimo && <p className="gd-dica">Toque na parte acesa para continuar.</p>}
        <div className="gd-botoes">
          {passo.i > 0 && !p.ultimo && <button type="button" className="gd-btn gd-btn-linha" onClick={voltar}>Voltar</button>}
          {p.ultimo
            ? <>
                {acoes.map((a) => (a.href
                  ? <a key={a.rotulo} href={a.href} className={`gd-btn ${a.principal ? "gd-btn-azul" : "gd-btn-linha"}`} onClick={() => agir(a)}>{a.rotulo}</a>
                  : <button key={a.rotulo} type="button" className={`gd-btn ${a.principal ? "gd-btn-azul" : "gd-btn-linha"}`} onClick={() => agir(a)}>{a.rotulo}</button>))}
                <button type="button" className={`gd-btn ${temPrincipal ? "gd-btn-linha" : "gd-btn-azul"}`} data-guia-seguir="" onClick={terminar}>{temPrincipal ? "Fechar" : "Pronto"}</button>
              </>
            : <button type="button" className="gd-btn gd-btn-azul" data-guia-seguir="" onClick={seguir}>Seguir<Icone nome="seta" tamanho={16} traco={2.2} /></button>}
        </div>
        {!p.ultimo && <button type="button" className="gd-dispensar" onClick={() => useGuia.getState().dispensar(r.id)}>Não mostrar mais este guia</button>}
      </div>
    </div>,
    document.body,
  );
}
