"use client";
// Guia nas páginas logadas e em /encontrar (21/11/2026, frente "tutorial"), montado pela barra de cima
// (src/app/workend/_barra.tsx). Abre sozinho no primeiro uso de cada tela e volta a cada entrada enquanto sobrar passo
// (uma vez por visita); o botão "Ver o guia" abre o roteiro da tela a qualquer momento. Em /app/perfil/comecar (o
// cadastro em etapas) não há barra, então o guia só começa depois dele.
import { useEffect, useSyncExternalStore } from "react";
import { Icone } from "../ui/Icone";
import { telaDoCaminho } from "../data/guias";
import { Holofote } from "./Holofote";
import { ROTEIROS_APP } from "./roteirosApp";
import { useGuia, ctxAgora, escolherAuto, marcarSessao, jaAbriuNaSessao, pedidoDaUrl, navegadorAutomatico } from "./guiaStore";

const semAssinatura = () => () => {};
const useTela = () => useSyncExternalStore(semAssinatura, () => telaDoCaminho(window.location.pathname), () => null);

export function GuiaApp() {
  const tela = useTela();
  const carregado = useGuia((s) => s.carregado);
  useEffect(() => {
    if (!tela) return;
    // trocou de tela com um guia aberto (navegação sem recarregar): o guia da outra tela fecha
    const a = useGuia.getState().ativo;
    if (a && ROTEIROS_APP.find((r) => r.id === a.roteiro)?.tela !== tela) useGuia.getState().fechar();
    void useGuia.getState().carregar();
  }, [tela]);
  useEffect(() => {
    if (!tela || !carregado) return;
    useGuia.getState().visitar(tela);
    const u = pedidoDaUrl();
    if (u.roteiro) { const id = u.roteiro; const t = setTimeout(() => useGuia.getState().abrir(id, true), 900); return () => clearTimeout(t); }
    if (u.desligado || (!u.forcar && (navegadorAutomatico() || jaAbriuNaSessao(`tela:${tela}`)))) return;
    const t = setTimeout(() => {
      if (useGuia.getState().ativo) return;
      const r = escolherAuto(ROTEIROS_APP, "entrada", ctxAgora(tela), u.forcar);
      if (!r) return;
      marcarSessao(`tela:${tela}`);
      useGuia.getState().abrir(r.id, false);
    }, 1200);
    return () => clearTimeout(t);
  }, [tela, carregado]);
  return <Holofote roteiros={ROTEIROS_APP} />;
}

// "Ver o guia" na barra: abre o roteiro desta tela (no painel, o de quem tem loja aberta ou o dos primeiros passos)
export function BotaoGuiaBarra() {
  const tela = useTela();
  const roteiros = tela ? ROTEIROS_APP.filter((r) => r.tela === tela) : [];
  if (!tela || !roteiros.length) return null;
  const abrir = async () => {
    if (!useGuia.getState().carregado) await useGuia.getState().carregar();
    const c = ctxAgora(tela);
    const r = roteiros.find((x) => !x.quando || x.quando(c)) ?? roteiros[0];
    useGuia.getState().abrir(r.id, true);
  };
  return (
    <button type="button" className="cab-guia" data-guia-botao="" onClick={() => void abrir()} aria-label="Ver o guia desta tela" title="Ver o guia desta tela">
      <Icone nome="guia" tamanho={18} /><span className="cab-guia-rotulo">Ver o guia</span>
    </button>
  );
}
