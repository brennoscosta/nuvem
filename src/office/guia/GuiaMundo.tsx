"use client";
// Guia no mapa da cidade (21/11/2026, frente "tutorial"). Substitui a visita guiada de 12/11 (ui/VisitaGuiada.tsx só
// reexporta este componente, para o Painel não mudar). Abre sozinho:
//  - ao entrar no mapa: "A cidade" e, numa próxima entrada, "Ter uma empresa" (uma vez por visita, enquanto sobrar passo);
//  - ao abrir o painel Montar escritório e o editor do personagem, cada um com o seu roteiro.
// Não abre sozinho em links diretos (?lote=, ?sede=, ?medir=…), com ?guia=0 nem em navegador automático (só com ?guia=1).
// O botão "Ver o guia", no canto, abre o guia do painel aberto ou um menu com os guias do mapa.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMundo, modoMundo } from "../mundoStore";
import { usePersonagem } from "../personagemStore";
import { Icone, type NomeIcone } from "../ui/Icone";
import { useCartaoAberto } from "../ui/cartaoAberto";
import type { IdRoteiro } from "../data/guias";
import { Holofote } from "./Holofote";
import { ROTEIROS_MUNDO } from "./roteirosMundo";
import { useGuia, ctxAgora, escolherAuto, marcarSessao, jaAbriuNaSessao, pedidoDaUrl, navegadorAutomatico, passosDoRoteiro, passoFeito } from "./guiaStore";

// quem chega por um link direto (lote, sede, conversa com a equipe…) não recebe o guia por cima do que veio ver
const PARAMS_DIRETOS = ["lote", "sede", "entrar", "equipe", "membro", "cam", "vista", "feira", "hora", "medir", "natal", "qualidade", "praca", "nicho", "pagamento", "outdoor", "personagem"];
const semAssinatura = () => () => {};
const useNoMundo = () => useSyncExternalStore(semAssinatura, modoMundo, () => false);

export function GuiaMundo() {
  const mundo = useNoMundo();
  const carregado = useGuia((s) => s.carregado);
  const mapaPronto = useMundo((s) => s.carregado);
  const painelEsc = useMundo((s) => s.painelEscritorio);
  const editor = usePersonagem((s) => s.painel === "montar");
  const ativo = useGuia((s) => s.ativo);

  useEffect(() => { if (mundo) void useGuia.getState().carregar(); }, [mundo]);
  // entrada no mapa
  useEffect(() => {
    if (!mundo || !carregado || !mapaPronto) return;
    useGuia.getState().visitar("mundo");
    const u = pedidoDaUrl(), q = new URLSearchParams(window.location.search);
    if (u.roteiro) { const id = u.roteiro; const t = setTimeout(() => useGuia.getState().abrir(id, true), 2200); return () => clearTimeout(t); }
    if (u.desligado || (!u.forcar && (navegadorAutomatico() || PARAMS_DIRETOS.some((p) => q.has(p)) || jaAbriuNaSessao("tela:mundo")))) return;
    const t = setTimeout(() => {
      const s = useMundo.getState();
      if (useGuia.getState().ativo || s.loteSelecionado || s.painelEmpresa || s.painelEscritorio || s.outdoorSelecionado || usePersonagem.getState().painel) return; // já está mexendo
      const r = escolherAuto(ROTEIROS_MUNDO, "entrada", ctxAgora("mundo"), u.forcar);
      if (!r) return;
      marcarSessao("tela:mundo");
      useGuia.getState().abrir(r.id, false);
    }, 2200);
    return () => clearTimeout(t);
  }, [mundo, carregado, mapaPronto]);
  // painel aberto: o guia dele (primeiro uso); painel fechado: o guia dele fecha junto
  useEffect(() => {
    if (!mundo || !carregado) return;
    if (ativo) {
      if ((ativo.roteiro === "escritorio" && !painelEsc) || (ativo.roteiro === "personagem" && !editor)) { const t = setTimeout(() => useGuia.getState().fechar(), 0); return () => clearTimeout(t); }
      return;
    }
    const gatilho = painelEsc ? "escritorio" : editor ? "personagem" : null;
    const u = pedidoDaUrl();
    if (!gatilho || u.desligado || (!u.forcar && navegadorAutomatico())) return;
    const t = setTimeout(() => {
      if (useGuia.getState().ativo) return;
      const r = escolherAuto(ROTEIROS_MUNDO, gatilho, ctxAgora("mundo"));
      if (r) useGuia.getState().abrir(r.id, false);
    }, 700);
    return () => clearTimeout(t);
  }, [mundo, carregado, ativo, painelEsc, editor]);

  if (!mundo) return null;
  return <><BotaoGuiaMundo /><Holofote roteiros={ROTEIROS_MUNDO} /></>;
}

function BotaoGuiaMundo() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const painelEsc = useMundo((s) => s.painelEscritorio);
  const editor = usePersonagem((s) => s.painel === "montar");
  const meu = useMundo((s) => s.meu);
  const temEscritorio = useMundo((s) => !!s.meu && s.terrenos[s.meu]?.status === "ativo" && !!s.terrenos[s.meu]?.escritorio);
  const logado = useGuia((s) => s.logado), fatos = useGuia((s) => s.fatos), progresso = useGuia((s) => s.progresso), telas = useGuia((s) => s.telas);
  const ativo = useGuia((s) => s.ativo);
  // computador: painel aberto no lado direito descendo até o canto (cartão, Montar escritório, editor): o botão vai para a
  // esquerda dele, para não tapar o Salvar. Mede só enquanto há painel aberto.
  const cartao = useCartaoAberto();
  const [desvio, setDesvio] = useState(0);
  useEffect(() => {
    const medir = () => {
      let esq = window.innerWidth;
      if (window.innerWidth >= 640) for (const el of Array.from(document.querySelectorAll<HTMLElement>(".painel-entra, [data-editor-personagem]"))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth - 48 && r.bottom > window.innerHeight - 96) esq = Math.min(esq, r.left);
      }
      // sem lugar à esquerda do painel (ele ocupa quase toda a largura): o botão sai em vez de ir para fora da tela
      const larg = (caixa.current?.offsetWidth || 120) + 24;
      setDesvio(esq >= window.innerWidth ? 0 : esq < larg ? -1 : Math.round(window.innerWidth - esq + 12));
    };
    const t0 = setTimeout(medir, 0);
    const t = cartao ? setInterval(medir, 800) : undefined;
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [cartao]);
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    window.addEventListener("keydown", tecla); document.addEventListener("pointerdown", fora);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", fora); };
  }, [aberto]);
  if (ativo) return null; // o guia aberto já cobre a tela

  const abrir = (id: IdRoteiro) => { setAberto(false); useGuia.getState().abrir(id, true); };
  const clicar = () => {
    if (painelEsc) return abrir("escritorio");
    if (editor && logado) return abrir("personagem");
    setAberto(!aberto);
  };
  const abrirEscritorio = () => {
    setAberto(false);
    if (!meu) return;
    useMundo.getState().selecionarLote(meu);
    setTimeout(() => { useMundo.getState().abrirEscritorio("predio"); setTimeout(() => useGuia.getState().abrir("escritorio", true), 450); }, 250);
  };
  const abrirEditor = () => { setAberto(false); usePersonagem.getState().abrir("montar"); setTimeout(() => useGuia.getState().abrir("personagem", true), 500); };
  const itens: { id: IdRoteiro; nome: string; icone: NomeIcone; fazer: () => void }[] = [
    { id: "cidade", nome: "A cidade", icone: "mapa", fazer: () => abrir("cidade") },
    { id: "empresa", nome: "Ter uma empresa", icone: "predios", fazer: () => abrir("empresa") },
    ...(temEscritorio ? [{ id: "escritorio" as const, nome: "Montar o escritório", icone: "escritorio" as const, fazer: abrirEscritorio }] : []),
    ...(logado ? [{ id: "personagem" as const, nome: "Editar o personagem", icone: "pessoa" as const, fazer: abrirEditor }] : []),
  ];
  const c = ctxAgora("mundo");
  const andamento = (id: IdRoteiro) => {
    const r = ROTEIROS_MUNDO.find((x) => x.id === id); if (!r) return "";
    const ps = passosDoRoteiro(r, c).filter((p) => !p.ultimo);
    const n = ps.filter((p) => passoFeito(p, id, { fatos, telas, progresso })).length;
    return n === 0 ? "Ainda não visto" : n >= ps.length ? "Visto" : `${n} de ${ps.length} passos vistos`;
  };
  return (
    <div ref={caixa} className={`gd-mundo ${editor ? "gd-mundo-editor" : ""} ${desvio < 0 ? "gd-mundo-sem-espaco" : ""}`} style={desvio > 0 ? { right: desvio } : undefined} data-guia-desvio={desvio > 0 ? desvio : undefined}>
      {aberto && (
        <div className="hud-ilha gd-menu" role="menu" aria-label="Guias do mapa">
          <span className="gd-menu-titulo">Guias do mapa</span>
          {itens.map((it) => (
            <button key={it.id} type="button" role="menuitem" className="gd-menu-item" onClick={it.fazer} data-guia-item={it.id}>
              <Icone nome={it.icone} tamanho={20} /><span className="min-w-0"><b>{it.nome}</b><small>{andamento(it.id)}</small></span>
            </button>
          ))}
        </div>
      )}
      <div className="hud-ilha p-1">
        <button type="button" className="hud-btn" data-guia-botao="" onClick={clicar} aria-expanded={painelEsc || editor ? undefined : aberto} aria-haspopup={painelEsc || editor ? undefined : "menu"}
          aria-label={painelEsc ? "Ver o guia do escritório" : editor ? "Ver o guia do personagem" : "Ver o guia"} title="Ver o guia">
          <Icone nome="guia" tamanho={18} /><span className="hud-rotulo">Ver o guia</span>
        </button>
      </div>
    </div>
  );
}
