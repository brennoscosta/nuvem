"use client";
// Pessoas na cidade agora (20/11/2026, pedido do dono: "quero que mostre quantas pessoas estão online na cidade e que
// possam ver"). Para todos, com ou sem conta: no topo do mapa, "N pessoas na cidade agora" com o ponto verde pulsando.
// Tocar abre a lista curta de quem está online: a aparência e o nome do personagem (o que já é público no mapa), onde ele
// está e o botão "Ir até" para quem anda com o próprio personagem (sem personagem, "Ver" leva a câmera até lá). Quem está
// sem conta entra só no número. Os dados vêm de /api/cidade/online (server/online.ts), pelo ui/onlineComum.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePersonagem } from "../personagemStore";
import { useMundo, type Terreno } from "../mundoStore";
import { useCamera } from "../cameraStore";
import { MiniAvatar } from "./MiniAvatar";
import { Icone } from "./Icone";
import { sedeNoPonto } from "../data/sedes";
import { LOTES, LOTE_POR_CHAVE, NORTE, PASSO, N, EIXO_RUA, BORDA_CALCADA } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";
import { useResumoOnline, pessoas, type FonteMapa, type PessoaOnline, type ResumoOnline } from "./onlineComum";

const FONTE: FonteMapa = { pronto: () => usePersonagem.getState().carregado && useMundo.getState().carregado, comPersonagem: () => usePersonagem.getState().ativo, logado: () => !!useMundo.getState().usuario };

// onde a pessoa está, pelo ponto do mapa: sede, praça, loja, lote, beira-rio, parque, orla ou rua
export function ondeNaCidade(x: number, z: number, terrenos: Record<string, Terreno>): string {
  const sd = sedeNoPonto(x, z); if (sd) return `na ${sd.nome}`;
  const pr = LOTE_POR_CHAVE[PRACA_CHAVE]?.centro;
  if (pr && Math.abs(x - pr[0]) <= 10 && Math.abs(z - pr[1]) <= 10) return "na Praça de Eventos";
  if (Math.abs(x) <= BORDA_CALCADA && Math.abs(z) <= BORDA_CALCADA) return "na praça da Nuvem";
  if (Math.abs(x - PASSO) <= BORDA_CALCADA && Math.abs(z) <= BORDA_CALCADA) return "na lanchonete";
  const l = LOTES.find((lt) => Math.abs(x - lt.centro[0]) <= 10 && Math.abs(z - lt.centro[1]) <= 10);
  if (l) {
    const t = terrenos[l.chave], dono = t?.anexoDe ? terrenos[t.anexoDe] : t;
    return dono?.status === "ativo" && dono.empresaNome ? `na ${dono.empresaNome}` : `no lote ${l.numero}`;
  }
  if (z < NORTE.calcadao.z0) return z >= NORTE.calcadao.z1 ? "no calçadão do rio" : z > NORTE.rio.z1 ? "numa ponte do rio" : "no Parque da Cidade";
  const B = N * PASSO + EIXO_RUA + 3;
  if (Math.abs(x) > B || z > B) return "na orla";
  return "andando pela rua";
}

function useFecharFora(aberto: boolean, caixa: React.RefObject<HTMLElement | null>, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) fechar(); };
    window.addEventListener("keydown", tecla); document.addEventListener("pointerdown", fora);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", fora); };
  }, [aberto, caixa, fechar]);
}

export function ContadorCidade() {
  const resumo = useResumoOnline(FONTE);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(false), []);
  useFecharFora(aberto, caixa, fechar);
  const n = resumo?.total;
  return (
    <div ref={caixa} className="pointer-events-auto relative" data-teste="contador-cidade">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-label={n == null ? "Pessoas na cidade agora" : `${n} ${pessoas(n)} na cidade agora. Ver quem está online`} className="hud-ilha hud-online">
        <i className="hud-online-ponto" aria-hidden="true" />
        <b data-teste="total-online">{n ?? "–"}</b>
        <span className="hud-online-longo">{pessoas(n ?? 2)} na cidade agora</span>
        <span className="hud-online-curto">na cidade</span>
      </button>
      {aberto && <ListaOnline resumo={resumo} fechar={fechar} />}
    </div>
  );
}

function ListaOnline({ resumo, fechar }: { resumo: ResumoOnline | null; fechar: () => void }) {
  const terrenos = useMundo((s) => s.terrenos);
  const meuId = usePersonagem((s) => s.meu?.usuarioId ?? null);
  const ativo = usePersonagem((s) => s.ativo);
  const lista = resumo?.lista ?? [];
  const irAte = (p: PessoaOnline) => {
    usePersonagem.getState().irPara(p.x, p.z);
    if (!useCamera.getState().seguir) useCamera.getState().pedir("seguir"); // a câmera vai junto
    fechar();
  };
  const ver = (p: PessoaOnline) => { useMundo.setState({ alvoCamera: [p.x, 0.5, p.z] }); fechar(); };
  const resto = resumo ? resumo.personagens - lista.length : 0;
  return (
    <div className="hud-pop hud-pop-baixo hud-online-pop" role="dialog" aria-label="Quem está na cidade agora" data-teste="lista-online">
      <b className="hud-pop-titulo"><Icone nome="pessoa" tamanho={18} />Na cidade agora</b>
      {!resumo ? <p className="hud-nota">Contando quem está por aqui…</p> : (
        <>
          {lista.length > 0 ? (
            <ul className="hud-online-lista">
              {lista.map((p) => {
                const eu = p.usuarioId === meuId;
                return (
                  <li key={p.usuarioId} data-teste="pessoa-online">
                    <MiniAvatar boneco={p.boneco} roupa={p.roupa} tamanho={30} />
                    <span className="hud-online-quem"><b>{p.nome}{eu && <em> · você</em>}</b><small>{ondeNaCidade(p.x, p.z, terrenos)}</small></span>
                    {!eu && (ativo
                      ? <button type="button" onClick={() => irAte(p)} className="hud-btn hud-online-ir"><Icone nome="andar" tamanho={15} />Ir até</button>
                      : <button type="button" onClick={() => ver(p)} className="hud-btn hud-online-ir"><Icone nome="pino" tamanho={15} />Ver</button>)}
                  </li>
                );
              })}
            </ul>
          ) : <p className="hud-nota">Nenhum personagem andando pela cidade agora.</p>}
          {resto > 0 && <p className="hud-online-mais">e mais {resto} {resto === 1 ? "personagem" : "personagens"}</p>}
          {resumo.semConta > 0 && <p className="hud-online-mais" data-teste="sem-conta">+ {resumo.semConta} {resumo.semConta === 1 ? "visitante" : "visitantes"} sem conta</p>}
          {resumo.semPersonagem > 0 && <p className="hud-online-mais">+ {resumo.semPersonagem} {resumo.semPersonagem === 1 ? "pessoa" : "pessoas"} com conta, sem personagem</p>}
          {!ativo && lista.length > 0 && <p className="hud-nota">Com o seu personagem, você anda até quem está online.</p>}
        </>
      )}
    </div>
  );
}
