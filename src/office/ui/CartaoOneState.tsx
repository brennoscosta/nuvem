"use client";
// Cartão da sede da Social RP, antes OneState RP (16/11/2026): abre ao tocar no prédio, no balão ou no nome do mapa da cidade.
// Mostra a EMPRESA, não o site (pedido do dono: "esses botões não seria para mostrar os setores da empresa para termos as
// opções sobre agentes?"): os departamentos gravados no lote da sede (scripts/sede-socialrp.mjs), cada um abrindo com a
// equipe (chefe primeiro, nível e cargo). O dono conversa com qualquer pessoa ou dá uma tarefa ao chefe do departamento
// (painel ChatEquipe no mapa); qualquer um pode ir até a sala do departamento na planta. As áreas do site seguem na fachada
// e no botão do onestatebr.com.br.
import { useState } from "react";
import { useMundo } from "../mundoStore";
import { FLUTUANTE, LARGO } from "./estilo";
import { Icone, type NomeIcone } from "./Icone";
import { SITE_ONESTATE, SEDE, CHAVE_SEDE } from "../data/onestate";
import { centroDaSala } from "../data/plantaSede";
import type { Membro, Setor } from "../data/escritorio";
import { useSede } from "../sedeStore";
import { useEscritorio } from "../store";
import { abrirChatEquipe } from "./ChatEquipe";
import { BotaoEntrar } from "./Recepcao";
import { NIVEL_COR, NIVEL_ROTULO } from "./equipeComum";

export const useCartaoOneState = useSede;
export function abrirOneState() {
  useMundo.setState({ loteSelecionado: null, alvoCamera: [SEDE.x, 0.5, SEDE.z + 6] });
  useCartaoOneState.setState({ aberto: true });
}
const fechar = () => useCartaoOneState.setState({ aberto: false });
// abriu um lote: o cartão da sede fecha (e não volta sozinho quando o lote fechar)
useMundo.subscribe((s, p) => { if (s.loteSelecionado && !p.loteSelecionado && useCartaoOneState.getState().aberto) fechar(); });

const ICONE_DEPTO: Record<string, NomeIcone> = {
  diretoria: "coroa", financeiro: "cupom", comercial: "negociar", marketing: "placa", produto: "cubo", "rh-juridico": "candidato",
  comunidade: "amizade", lives: "chamada", suporte: "fone", eventos: "agenda", recepcao: "casa",
};
const ehChefe = (m: Membro) => m.nivel === "ceo" || m.nivel === "diretor" || m.nivel === "gerente";
const ORDEM_NIVEL = { ceo: 0, diretor: 1, gerente: 2, analista: 3, assistente: 4 } as const;
const conversar = (id?: string) => void abrirChatEquipe(CHAVE_SEDE, id);

function Departamento({ s, pessoas, dono, aberto, alternar, verSala }: { s: Setor; pessoas: Membro[]; dono: boolean; aberto: boolean; alternar: () => void; verSala: () => void }) {
  // quem recebe as tarefas do departamento: o CEO na diretoria, o gerente nos outros
  const chefe = pessoas.find((m) => m.nivel === "ceo") ?? pessoas.find((m) => m.nivel === "gerente") ?? pessoas.find(ehChefe) ?? null;
  const equipe = pessoas.length - (chefe ? 1 : 0);
  return (
    <section className={`overflow-hidden rounded-xl ring-1 transition ${aberto ? "bg-white/[.08] ring-[#D4A63A]/40" : "bg-white/[.05] ring-white/[.07] hover:bg-white/[.08]"}`}>
      <button type="button" onClick={alternar} aria-expanded={aberto} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${s.cor}26`, color: s.cor }}><Icone nome={ICONE_DEPTO[s.id] ?? "equipe"} tamanho={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-white">{s.nome}</span>
          <span className="block truncate text-[11.5px] text-white/55">{chefe ? `${chefe.nome}, ${chefe.nivel === "ceo" ? "CEO" : NIVEL_ROTULO[chefe.nivel ?? "gerente"].toLowerCase()}` : "Equipe"}{equipe > 0 ? ` · equipe de ${equipe}` : ""}</span>
        </span>
        <Icone nome="baixo" tamanho={15} className={`shrink-0 text-white/40 transition ${aberto ? "rotate-180 text-[#E9C46A]" : ""}`} />
      </button>
      {aberto && (
        <div className="border-t border-white/[.07] px-2.5 pb-2.5 pt-1">
          <ul>
            {pessoas.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 py-1.5">
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: ehChefe(m) ? "#2B2F36" : m.camisa, boxShadow: `0 0 0 2px ${s.cor}` }}>
                  {m.nome.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                    <span className="truncate">{m.nome}</span>
                    {m.nivel && <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-semibold text-white" style={{ background: NIVEL_COR[m.nivel] }}>{NIVEL_ROTULO[m.nivel]}</span>}
                  </span>
                  <span className="block truncate text-[11.5px] text-white/55">{m.cargo}</span>
                </span>
                {dono && (
                  <button type="button" onClick={() => conversar(m.id)} aria-label={`Conversar com ${m.nome}`} title="Conversar"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.08] text-[#E9C46A] ring-1 ring-white/10 transition hover:bg-[#E9C46A] hover:text-[#1A1306]">
                    <Icone nome="conversar" tamanho={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {dono && chefe && (
              <button type="button" onClick={() => conversar(chefe.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#E9C46A] px-2.5 py-1.5 text-[12px] font-bold text-[#1A1306] hover:brightness-105">
                <Icone nome="maleta" tamanho={14} />Dar uma tarefa para {chefe.nome}
              </button>
            )}
            <button type="button" onClick={verSala} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15">
              <Icone nome="pino" tamanho={14} className="text-[#E9C46A]" />Ver a sala
            </button>
          </div>
          {dono && chefe && equipe > 0 && <p className="mt-1.5 text-[11px] leading-snug text-white/45">{chefe.nome} divide o trabalho com a equipe e te entrega o resultado na conversa.</p>}
        </div>
      )}
    </section>
  );
}

export function CartaoOneState() {
  const aberto = useCartaoOneState((s) => s.aberto);
  const loteAberto = useMundo((s) => !!s.loteSelecionado);
  const sede = useMundo((s) => s.terrenos[CHAVE_SEDE]);
  const souDono = useMundo((s) => s.meu === CHAVE_SEDE);
  const dentro = useEscritorio((s) => s.vista === "dentro");
  const luz = useEscritorio((s) => s.luz);
  const [depto, setDepto] = useState<string | null>("diretoria");
  if (!aberto || loteAberto) return null;
  const alternarVista = () => { useEscritorio.getState().setVista(dentro ? "fora" : "dentro"); useMundo.setState({ alvoCamera: [SEDE.x, 0.5, SEDE.z + 3] }); };
  const e = sede?.escritorio ?? null;
  // departamentos na ordem da empresa (diretoria primeiro), a recepção no fim
  const setores = e ? [...e.setores.filter((s) => s.id !== "recepcao"), ...e.setores.filter((s) => s.id === "recepcao")] : [];
  const pessoasDe = (id: string) => (e?.equipe ?? []).filter((m) => (m.setorId ?? (m.papel === "ceo" ? "diretoria" : "recepcao")) === id)
    .sort((a, b) => ORDEM_NIVEL[a.nivel ?? "analista"] - ORDEM_NIVEL[b.nivel ?? "analista"]);
  const verSala = (id: string) => {
    if (!e) return;
    const c = centroDaSala(e.setores, id);
    useEscritorio.getState().setVista("dentro");
    useMundo.setState({ alvoCamera: c ? [c[0], 0.5, c[1]] : [SEDE.x, 0.5, SEDE.z + 3] });
  };
  const departamentos = setores.filter((s) => s.id !== "recepcao").length;
  return (
    <div className={`${FLUTUANTE} ${LARGO} painel-entra flex flex-col overflow-hidden !bg-[#0E1013] !text-white`} role="dialog" aria-label="Sede da Social RP">
      <div className="relative shrink-0 overflow-hidden px-4 pb-3 pt-4" style={{ background: "radial-gradient(120% 140% at 0% 0%, #2A2210 0%, #0E1013 60%)" }}>
        <button onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"><Icone nome="fechar" tamanho={17} /></button>
        <img src="/socialrp/logo.png" alt="Social RP" className="h-11 w-auto" />
        <p className="mt-2 text-[13px] leading-snug text-white/75">A sede da Social RP na cidade. Lá dentro, cada departamento trabalha com a sua equipe de agentes de IA.</p>
        {e && <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-semibold"><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Icone nome="equipe" tamanho={13} className="text-[#E9C46A]" />{e.equipe.length} agentes de IA</span><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Icone nome="camadas" tamanho={13} className="text-[#E9C46A]" />{departamentos} departamentos</span></div>}
        <BotaoEntrar chave={CHAVE_SEDE} escuro className="mt-3" />
        <div className="mt-3 flex flex-wrap gap-2">
          {souDono && <button type="button" onClick={() => conversar()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#E9C46A] px-3 py-1.5 text-[12.5px] font-bold text-[#1A1306] hover:brightness-105"><Icone nome="conversar" tamanho={15} />Falar com a equipe</button>}
          {souDono && <a href="/app/equipe?aba=internas" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/15"><Icone nome="equipe" tamanho={15} />Conversas internas</a>}
          <button type="button" onClick={alternarVista} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-[#D4A63A]/50 hover:bg-white/15"><Icone nome={dentro ? "predios" : "escritorio"} tamanho={15} className="text-[#E9C46A]" />{dentro ? "Ver por fora" : "Ver por dentro"}</button>
          {dentro && <button type="button" onClick={() => useEscritorio.getState().setLuz(!luz)} aria-pressed={luz} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/15"><Icone nome={luz ? "sol" : "lua"} tamanho={15} className="text-[#E9C46A]" />{luz ? "Apagar a luz" : "Acender a luz"}</button>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-1.5 mt-3 flex items-center gap-2 px-1 text-[12px] font-semibold text-[#E9C46A]"><Icone nome="camadas" tamanho={14} />Departamentos</div>
        {souDono && <p className="mb-2 px-1 text-[11.5px] leading-snug text-white/50">Abra um departamento para ver a equipe, conversar com cada pessoa ou dar uma tarefa ao chefe. Por dentro, tocar numa pessoa também abre a conversa.</p>}
        {!e && <p className="px-1 text-[12.5px] text-white/60">A equipe da sede ainda está sendo montada.</p>}
        <div className="flex flex-col gap-1.5">
          {setores.map((s) => (
            <Departamento key={s.id} s={s} pessoas={pessoasDe(s.id)} dono={souDono} aberto={depto === s.id}
              alternar={() => setDepto(depto === s.id ? null : s.id)} verSala={() => verSala(s.id)} />
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-white/10 p-3">
        <a href={SITE_ONESTATE} target="_blank" rel="noopener" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E9C46A] to-[#B8862B] px-3 py-2.5 text-sm font-bold text-[#1A1306] shadow-lg hover:brightness-105">
          Abrir o onestatebr.com.br<Icone nome="seta" tamanho={16} />
        </a>
      </div>
    </div>
  );
}
