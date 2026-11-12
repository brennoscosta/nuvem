"use client";
// Primeira visita guiada (12/11/2026): um passeio de ~30 s na primeira vez que alguém abre o mapa. Escurece a tela com
// um holofote em volta de cada peça (marcadas com data-tour="…"): a câmera, o mini-mapa, a praça, o cartão de uma loja,
// o personagem e o sino. Avança sozinho a cada 4,5 s (pausa com o mouse sobre o balão); "Pular" (ou Esc) fecha. Aparece uma vez por navegador
// (localStorage "workend-visita-guiada"; sem storage, uma vez por carregamento). ?tour=1 força; ?tour=0 desliga.
// Não aparece em links diretos e testes (?lote=, ?cam=, ?vista=, ?feira=, ?hora=… ver PARAMS_DIRETOS) nem para quem já
// tem lote, a não ser com ?tour=1.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useMundo, modoMundo, LOTES } from "../mundoStore";
import { PRACA_CHAVE } from "../data/praca";
import { PASSO } from "../data/mundo";

const CHAVE = "workend-visita-guiada";
const PARAMS_DIRETOS = ["lote", "cam", "vista", "feira", "hora", "medir", "natal", "qualidade", "praca", "nicho", "pagamento", "outdoor"];
const DURACAO = 4500; // ms por passo
const ESPERA_ALVO = 1600; // se a peça não aparecer nesse tempo, o passo é pulado
const PAD = 8; // folga do holofote em volta da peça
const carga = { rodou: false }; // sem localStorage: uma vez por carregamento

type Passo = { id: string; alvo?: string; titulo: string; texto: string; final?: boolean; entrar?: () => void | (() => void) };
type Caixa = { x: number; y: number; w: number; h: number };

const lerVisto = () => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return carga.rodou; } };
const marcarVisto = () => { carga.rodou = true; try { localStorage.setItem(CHAVE, "1"); } catch { /* sem storage: fica só nesta carga */ } };
const sel = (chave: string | null) => useMundo.getState().selecionarLote(chave);
const olhar = (x: number, z: number) => useMundo.setState({ alvoCamera: [x, 0.5, z] });

// a primeira peça visível com aquele data-tour (o mini-mapa tem botão no celular e painel no computador)
function acharAlvo(nome: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${nome}"]`))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}
const dentroDaTela = (r: DOMRect) => r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;

function montarPassos(): Passo[] {
  const s = useMundo.getState();
  const pc = innerWidth >= 640;
  const ativas = Object.values(s.terrenos).filter((t) => t.status === "ativo" && !t.anexoDe && t.chave !== PRACA_CHAVE);
  const loja = ativas.find((t) => t.chave !== s.meu) ?? ativas[0] ?? null;
  const livre = LOTES.find((l) => l.lote.tipo !== "praca" && l.chave !== PRACA_CHAVE && !s.terrenos[l.chave]) ?? null;
  const passos: Passo[] = [
    {
      id: "ola", alvo: pc ? "camera" : undefined, titulo: "Bem-vindo à cidade do WorkEnd",
      texto: pc ? "Cada prédio é uma empresa. Arraste para passear; esta barra gira e aproxima a câmera." : "Cada prédio é uma empresa. Arraste com o dedo para passear e use dois dedos para aproximar.",
      entrar: () => { sel(null); const t1 = setTimeout(() => olhar(PASSO * 0.55, PASSO * 0.3), 250), t2 = setTimeout(() => olhar(-PASSO * 0.2, PASSO * 0.45), 2400); return () => { clearTimeout(t1); clearTimeout(t2); }; },
    },
    { id: "mapa", alvo: "mapa", titulo: "Mapa da cidade", texto: "Veja as lojas por área e toque num lote para voar até ele." },
    { id: "praca", alvo: "praca", titulo: "Praça de eventos", texto: "Aqui as empresas fazem lives e lançamentos. Aos sábados tem feira com barracas.", entrar: () => sel(PRACA_CHAVE) },
    {
      id: "loja", alvo: "cartao-loja", titulo: loja ? "Entre numa loja" : "Este lote está à venda",
      texto: loja ? `Toque num prédio para entrar. Na ${loja.empresaNome} você conversa com a atendente de IA, vê a vitrine e as vagas.` : "Toque num prédio para entrar na loja. Este lote ainda está livre e pode ser o endereço da sua empresa.",
      entrar: () => sel(loja?.chave ?? livre?.chave ?? null),
    },
    { id: "personagem", alvo: "personagem", titulo: "Seu personagem", texto: "Crie um personagem para andar pela cidade, fazer amigos e negociar com as empresas.", entrar: () => sel(null) },
    { id: "avisos", alvo: "avisos", titulo: "Avisos", texto: "O sino junta num lugar só as mensagens, candidaturas, eventos e pagamentos." },
    { id: "fim", final: true, titulo: s.meu ? "Boa visita!" : "Pronto para começar?", texto: s.meu ? "Sua empresa já tem endereço. Explore a cidade e visite as vizinhas." : "Escolha um lote para a sua empresa ou explore a cidade por conta própria.", entrar: () => sel(null) },
  ];
  // peças que não existem nesta tela (sino sem login, por exemplo) já ficam de fora
  return passos.filter((p) => !p.alvo || p.alvo === "praca" || p.alvo === "cartao-loja" || acharAlvo(p.alvo));
}

export function VisitaGuiada() {
  const [passos, setPassos] = useState<Passo[] | null>(null);
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [tela, setTela] = useState({ w: 1280, h: 800, balao: 200 });
  const balao = useRef<HTMLDivElement>(null);
  const [pausado, setPausado] = useState(false); // mouse sobre o balão: a pessoa está lendo
  const restante = useRef(DURACAO), desde = useRef(0);
  const meu = useMundo((s) => s.meu);
  const terrenos = useMundo((s) => s.terrenos);

  // começa sozinho depois que o mapa carregou
  useEffect(() => {
    if (!modoMundo()) return;
    const q = new URLSearchParams(location.search);
    const forcar = q.get("tour") === "1";
    if (!forcar && (q.get("tour") === "0" || PARAMS_DIRETOS.some((p) => q.has(p)) || lerVisto())) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const tentar = () => {
      const s = useMundo.getState();
      if (!s.carregado) { t = setTimeout(tentar, 400); return; }
      t = setTimeout(() => {
        const st = useMundo.getState();
        if (!forcar && (st.meu || st.loteSelecionado || st.painelEmpresa || st.painelEscritorio || st.outdoorSelecionado)) return; // já sabe usar ou já está mexendo
        marcarVisto();
        setTela({ w: innerWidth, h: innerHeight, balao: 200 });
        setI(0); setPassos(montarPassos());
      }, 2200);
    };
    tentar();
    return () => clearTimeout(t);
  }, []);

  const passo = passos?.[i] ?? null;
  const fechar = (depois?: string | null) => { setPassos(null); setCaixa(null); sel(depois ?? null); };

  // cada passo: a ação dele (selecionar a praça, a loja…), o holofote acompanhando a peça e o avanço automático
  useEffect(() => {
    if (!passos) return;
    if (i >= passos.length) { const t = setTimeout(() => { setPassos(null); setCaixa(null); sel(null); }, 0); return () => clearTimeout(t); }
    const p = passos[i];
    const limpar = p.entrar?.();
    restante.current = DURACAO;
    const t0 = performance.now();
    let raf = 0, rolou = false, ultimo = "";
    const seguir = () => {
      const el = p.alvo ? acharAlvo(p.alvo) : null;
      if (p.alvo && !el) { if (performance.now() - t0 > ESPERA_ALVO) { setI((x) => x + 1); return; } }
      let c: Caixa | null = null;
      if (el) {
        let r = el.getBoundingClientRect();
        if (!dentroDaTela(r) && !rolou) { rolou = true; el.scrollIntoView({ block: "nearest", inline: "nearest" }); r = el.getBoundingClientRect(); }
        // o holofote não passa da tela (cartões altos no celular)
        const x = Math.max(4, r.left - PAD), y = Math.max(4, r.top - PAD);
        c = { x, y, w: Math.min(innerWidth - 4, r.right + PAD) - x, h: Math.min(innerHeight - 4, r.bottom + PAD) - y };
      }
      const bh = balao.current?.offsetHeight ?? 200;
      const chave = c ? `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}` : "-";
      const k = `${chave}|${innerWidth}x${innerHeight}|${bh}`;
      if (k !== ultimo) { ultimo = k; setCaixa(c); setTela({ w: innerWidth, h: innerHeight, balao: bh }); }
      raf = requestAnimationFrame(seguir);
    };
    raf = requestAnimationFrame(seguir);
    return () => { cancelAnimationFrame(raf); if (typeof limpar === "function") limpar(); };
  }, [passos, i]);

  // avanço automático; pausado, guarda quanto faltava (a barra de progresso pausa junto)
  useEffect(() => {
    if (!passos || pausado || !passos[i] || passos[i].final) return;
    desde.current = performance.now();
    const t = setTimeout(() => setI((x) => x + 1), Math.max(0, restante.current));
    return () => { clearTimeout(t); restante.current -= performance.now() - desde.current; };
  }, [passos, i, pausado]);

  // teclado: Esc pula, → ou Enter avança
  useEffect(() => {
    if (!passos) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setPassos(null); setCaixa(null); sel(null); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); setI((x) => (passos[x]?.final ? x : x + 1)); }
    };
    addEventListener("keydown", tecla);
    return () => removeEventListener("keydown", tecla);
  }, [passos]);

  if (!passos || !passo) return null;
  const livre = LOTES.find((l) => l.lote.tipo !== "praca" && l.chave !== PRACA_CHAVE && !terrenos[l.chave]) ?? null;

  // onde fica o balão: no celular embaixo (ou em cima, se a peça estiver embaixo); no computador ao lado da peça
  const cel = tela.w < 640;
  const W = 320, M = 12;
  let pos: CSSProperties;
  if (cel) pos = caixa && caixa.y + caixa.h / 2 > tela.h * 0.5 ? { left: M, right: M, top: 72 } : { left: M, right: M, bottom: M };
  else if (!caixa) pos = { left: Math.max(M, (tela.w - W) / 2), bottom: 96, width: W };
  else {
    const top = Math.min(Math.max(M, caixa.y), tela.h - tela.balao - M);
    if (caixa.x - 16 - W >= M) pos = { left: caixa.x - 16 - W, top, width: W };
    else if (caixa.x + caixa.w + 16 + W <= tela.w - M) pos = { left: caixa.x + caixa.w + 16, top, width: W };
    else { const left = Math.min(Math.max(M, caixa.x), tela.w - W - M); pos = caixa.y + caixa.h + 12 + tela.balao <= tela.h - M ? { left, top: caixa.y + caixa.h + 12, width: W } : { left, top: Math.max(M, caixa.y - 12 - tela.balao), width: W }; }
  }
  const total = passos.length;
  return (
    <div className="fixed inset-0 z-[60] select-none" role="dialog" aria-modal="true" aria-label="Visita guiada pela cidade">
      <style>{"@keyframes visita-barra{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>
      {caixa
        // chaves diferentes: o véu e o holofote são elementos distintos (reaproveitar o mesmo animava a sombra gigante, que pesa)
        ? <div key="holofote" className="pointer-events-none absolute rounded-2xl transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none" style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h, boxShadow: "0 0 0 2px rgba(255,255,255,.85), 0 0 0 200vmax rgba(8,11,16,.62)" }} />
        : <div key="veu" className="pointer-events-none absolute inset-0 bg-[#080B10]/30" />}
      <div ref={balao} className="absolute rounded-2xl bg-white p-4 text-[#1D2128] shadow-2xl" style={pos} aria-live="polite" onPointerEnter={(e) => { if (e.pointerType === "mouse") setPausado(true); }} onPointerLeave={() => setPausado(false)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#1D4ED8]">Visita guiada · {Math.min(i + 1, total)} de {total}</span>
          {!passo.final && <button type="button" onClick={() => fechar(null)} className="rounded-full px-2 py-0.5 text-xs font-semibold text-[#5B6472] hover:bg-black/5">Pular</button>}
        </div>
        <h2 className="mt-1 text-[17px] font-bold leading-snug">{passo.titulo}</h2>
        <p className="mt-1 text-[14px] leading-snug text-[#3B4350]">{passo.texto}</p>
        {!passo.final && <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#E6EAF0] motion-reduce:hidden"><div key={i} className="h-full origin-left bg-[#1D4ED8]" style={{ animation: `visita-barra ${DURACAO}ms linear forwards`, animationPlayState: pausado ? "paused" : "running" }} /></div>}
        <div className="mt-3 flex gap-2">
          {passo.final ? (
            meu
              ? <><button type="button" onClick={() => fechar(meu)} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white hover:bg-[#1e40af]">Ver o meu lote</button><button type="button" onClick={() => fechar(null)} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold">Explorar</button></>
              : <><button type="button" onClick={() => fechar(livre?.chave ?? null)} className="flex-1 rounded-xl bg-[#16A34A] px-3 py-2 text-sm font-bold text-white hover:bg-[#15803d]">Escolher meu lote</button><button type="button" onClick={() => fechar(null)} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold">Explorar sozinho</button></>
          ) : (
            <>
              {i > 0 && <button type="button" onClick={() => setI((x) => Math.max(0, x - 1))} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold">Voltar</button>}
              <button type="button" onClick={() => setI((x) => x + 1)} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white hover:bg-[#1e40af]">Próximo</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
