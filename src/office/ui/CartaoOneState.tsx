"use client";
// Cartão da sede da Social RP, antes OneState RP (16/11/2026): abre ao tocar no prédio, no balão ou no nome do mapa da cidade.
// Mostra a EMPRESA, não o site (pedido do dono: "esses botões não seria para mostrar os setores da empresa para termos as
// opções sobre agentes?"): os departamentos gravados no lote da sede (scripts/sede-socialrp.mjs), cada um abrindo com a
// equipe (chefe primeiro, nível e cargo). O dono conversa com qualquer pessoa ou dá uma tarefa ao chefe do departamento
// (painel ChatEquipe no mapa); qualquer um pode ir até a sala do departamento na planta. As áreas do site seguem na fachada
// e no botão do onestatebr.com.br.
// 17/11/2026: o mesmo cartão serve a todas as sedes do cadastro (data/sedes.ts: Social RP, AppZone, bday.fm, NUVCAM), na
// cor de cada uma; dono e sócios (terreno.socios) têm as mesmas opções.
import { useState } from "react";
import { useMundo } from "../mundoStore";
import { FLUTUANTE, LARGO } from "./estilo";
import { Icone, type NomeIcone } from "./Icone";
import { SEDE_POR_ID, SEDE_SOCIALRP, frenteDaSede, paraMundoSede, type Sede } from "../data/sedes";
import { centroDaSala, Z0 as ZI0, Z1 as ZI1 } from "../data/plantaSede";
import type { Membro, Setor } from "../data/escritorio";
import { useSede } from "../sedeStore";
import { useEscritorio } from "../store";
import { abrirChatEquipe } from "./ChatEquipe";
import { BotaoEntrar } from "./Recepcao";
import { NIVEL_COR, NIVEL_ROTULO } from "./equipeComum";

export const useCartaoOneState = useSede;
export function abrirSede(id: string) {
  // a câmera vai até a frente da sede e, se estiver olhando pelas costas, dá a volta (19/11/2026: cada sede num lote, de
  // frente para a rua dela; scene/Cena3D.tsx)
  const sede = SEDE_POR_ID[id] ?? SEDE_SOCIALRP, [x, z] = frenteDaSede(sede, 0);
  useMundo.setState({ loteSelecionado: null, alvoCamera: [x, 0.5, z], giroCamera: sede.rot });
  useSede.setState({ aberto: true, id: sede.id });
}
export function abrirOneState() { abrirSede("socialrp"); }
// texto escuro ou claro sobre a cor da sede (botões)
const tinta = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150 ? "#1A1306" : "#FFFFFF"; };
const fechar = () => useCartaoOneState.setState({ aberto: false });
// abriu um lote: o cartão da sede fecha (e não volta sozinho quando o lote fechar)
useMundo.subscribe((s, p) => { if (s.loteSelecionado && !p.loteSelecionado && useCartaoOneState.getState().aberto) fechar(); });

const ICONE_DEPTO: Record<string, NomeIcone> = {
  diretoria: "coroa", financeiro: "cupom", comercial: "negociar", marketing: "placa", produto: "cubo", "rh-juridico": "candidato",
  comunidade: "amizade", lives: "chamada", suporte: "fone", eventos: "agenda", recepcao: "casa",
  engenharia: "codigo", backend: "banco", design: "brilho", qualidade: "check", presentes: "cupom", criadores: "estrela",
  parceiros: "negociar", moderacao: "admin", seguranca: "admin", infraestrutura: "predios", compliance: "selo", operacoes: "ajustes",
};
const ehChefe = (m: Membro) => m.nivel === "ceo" || m.nivel === "diretor" || m.nivel === "gerente";
const ORDEM_NIVEL = { ceo: 0, diretor: 1, gerente: 2, analista: 3, assistente: 4 } as const;

function Departamento({ s, pessoas, dono, aberto, alternar, verSala, chave }: { s: Setor; pessoas: Membro[]; dono: boolean; aberto: boolean; alternar: () => void; verSala: () => void; chave: string }) {
  const conversar = (id?: string) => void abrirChatEquipe(chave, id);
  // quem recebe as tarefas do departamento: o CEO na diretoria, o gerente nos outros
  const chefe = pessoas.find((m) => m.nivel === "ceo") ?? pessoas.find((m) => m.nivel === "gerente") ?? pessoas.find(ehChefe) ?? null;
  const equipe = pessoas.length - (chefe ? 1 : 0);
  return (
    <section className={`overflow-hidden rounded-xl ring-1 transition ${aberto ? "bg-white/[.08] ring-[var(--sede)]" : "bg-white/[.05] ring-white/[.07] hover:bg-white/[.08]"}`}>
      <button type="button" onClick={alternar} aria-expanded={aberto} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${s.cor}26`, color: s.cor }}><Icone nome={ICONE_DEPTO[s.id] ?? "equipe"} tamanho={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-white">{s.nome}</span>
          <span className="block truncate text-[11.5px] text-white/55">{chefe ? `${chefe.nome}, ${chefe.nivel === "ceo" ? "CEO" : NIVEL_ROTULO[chefe.nivel ?? "gerente"].toLowerCase()}` : "Equipe"}{equipe > 0 ? ` · equipe de ${equipe}` : ""}</span>
        </span>
        <Icone nome="baixo" tamanho={15} className={`shrink-0 text-white/40 transition ${aberto ? "rotate-180 text-[var(--sede)]" : ""}`} />
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
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.08] text-[var(--sede)] ring-1 ring-white/10 transition hover:bg-[var(--sede)] hover:text-[var(--sede-tinta)]">
                    <Icone nome="conversar" tamanho={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {dono && chefe && (
              <button type="button" onClick={() => conversar(chefe.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sede)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--sede-tinta)] hover:brightness-105">
                <Icone nome="maleta" tamanho={14} />Dar uma tarefa para {chefe.nome}
              </button>
            )}
            <button type="button" onClick={verSala} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15">
              <Icone nome="pino" tamanho={14} className="text-[var(--sede)]" />Ver a sala
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
  const id = useSede((s) => s.id);
  const sd: Sede = SEDE_POR_ID[id] ?? SEDE_SOCIALRP;
  const loteAberto = useMundo((s) => !!s.loteSelecionado);
  const sede = useMundo((s) => s.terrenos[sd.chave]);
  const souDono = useMundo((s) => s.meus.includes(sd.chave));
  const dentro = useEscritorio((s) => s.vista === "dentro");
  const luz = useEscritorio((s) => s.luz);
  const [depto, setDepto] = useState<string | null>("diretoria");
  if (!aberto || loteAberto) return null;
  // por dentro a câmera olha o meio da planta; por fora, a frente da torre (coordenadas do lote: data/plantaSede.ts)
  const [ix, iz] = paraMundoSede(sd, 0, (ZI0 + ZI1) / 2), [fx, fz] = frenteDaSede(sd, 0);
  const alternarVista = () => { useEscritorio.getState().setVista(dentro ? "fora" : "dentro"); useMundo.setState({ alvoCamera: dentro ? [fx, 0.5, fz] : [ix, 0.5, iz], giroCamera: sd.rot }); };
  const e = sede?.escritorio ?? null;
  // departamentos na ordem da empresa (diretoria primeiro), a recepção no fim
  const setores = e ? [...e.setores.filter((s) => s.id !== "recepcao"), ...e.setores.filter((s) => s.id === "recepcao")] : [];
  const pessoasDe = (id: string) => (e?.equipe ?? []).filter((m) => (m.setorId ?? (m.papel === "ceo" ? "diretoria" : "recepcao")) === id)
    .sort((a, b) => ORDEM_NIVEL[a.nivel ?? "analista"] - ORDEM_NIVEL[b.nivel ?? "analista"]);
  const verSala = (id: string) => {
    if (!e) return;
    const c = centroDaSala(e.setores, id), [sx, sz] = c ? paraMundoSede(sd, c[0], c[1]) : [ix, iz];
    useEscritorio.getState().setVista("dentro");
    useMundo.setState({ alvoCamera: [sx, 0.5, sz], giroCamera: sd.rot });
  };
  const departamentos = setores.filter((s) => s.id !== "recepcao").length;
  return (
    <div className={`${FLUTUANTE} ${LARGO} painel-entra flex flex-col overflow-hidden !bg-[#0E1013] !text-white`} role="dialog" aria-label={`Sede da ${sd.nome}`} style={{ "--sede": sd.cor, "--sede-tinta": tinta(sd.cor) } as React.CSSProperties}>
      <div className="relative shrink-0 overflow-hidden px-4 pb-3 pt-4" style={{ background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${sd.cor} 24%, #0E1013) 0%, #0E1013 60%)` }}>
        <button onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"><Icone nome="fechar" tamanho={17} /></button>
        <img src={sd.logo} alt={sd.nome} className="h-11 w-auto max-w-[78%] object-contain object-left" />
        <p className="mt-2 text-[13px] leading-snug text-white/75">{sd.resumo}</p>
        {e && <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-semibold"><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Icone nome="equipe" tamanho={13} className="text-[var(--sede)]" />{e.equipe.length} agentes de IA</span><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Icone nome="camadas" tamanho={13} className="text-[var(--sede)]" />{departamentos} departamentos</span></div>}
        <BotaoEntrar chave={sd.chave} escuro className="mt-3" />
        <div className="mt-3 flex flex-wrap gap-2">
          {souDono && <button type="button" onClick={() => void abrirChatEquipe(sd.chave)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sede)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--sede-tinta)] hover:brightness-105"><Icone nome="conversar" tamanho={15} />Falar com a equipe</button>}
          {souDono && <a href={`/app/equipe?lote=${encodeURIComponent(sd.chave)}&aba=internas`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/15"><Icone nome="equipe" tamanho={15} />Conversas internas</a>}
          <button type="button" onClick={alternarVista} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-[var(--sede)] hover:bg-white/15"><Icone nome={dentro ? "predios" : "escritorio"} tamanho={15} className="text-[var(--sede)]" />{dentro ? "Ver por fora" : "Ver por dentro"}</button>
          {dentro && <button type="button" onClick={() => useEscritorio.getState().setLuz(!luz)} aria-pressed={luz} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/15"><Icone nome={luz ? "sol" : "lua"} tamanho={15} className="text-[var(--sede)]" />{luz ? "Apagar a luz" : "Acender a luz"}</button>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-1.5 mt-3 flex items-center gap-2 px-1 text-[12px] font-semibold text-[var(--sede)]"><Icone nome="camadas" tamanho={14} />Departamentos</div>
        {souDono && <p className="mb-2 px-1 text-[11.5px] leading-snug text-white/50">Abra um departamento para ver a equipe, conversar com cada pessoa ou dar uma tarefa ao chefe. Por dentro, tocar numa pessoa também abre a conversa.</p>}
        {!e && <p className="px-1 text-[12.5px] text-white/60">A equipe da sede ainda está sendo montada.</p>}
        <div className="flex flex-col gap-1.5">
          {setores.map((s) => (
            <Departamento key={s.id} s={s} pessoas={pessoasDe(s.id)} dono={souDono} aberto={depto === s.id} chave={sd.chave}
              alternar={() => setDepto(depto === s.id ? null : s.id)} verSala={() => verSala(s.id)} />
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-white/10 p-3">
        <a href={sd.site} target="_blank" rel="noopener" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sede)] px-3 py-2.5 text-sm font-bold text-[var(--sede-tinta)] shadow-lg hover:brightness-105">
          Abrir o {sd.dominio}<Icone nome="seta" tamanho={16} />
        </a>
      </div>
    </div>
  );
}
