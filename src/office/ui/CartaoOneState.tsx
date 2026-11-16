"use client";
// Cartão da sede do OneState RP (16/11/2026): abre ao tocar no prédio, no balão ou no nome do mapa da cidade. Mostra
// todas as áreas do site, andar por andar (como estão na fachada), cada uma abrindo a página no onestatebr.com.br.
import { useMundo } from "../mundoStore";
import { FLUTUANTE, LARGO } from "./estilo";
import { Icone, type NomeIcone } from "./Icone";
import { AREAS_ONESTATE, SITE_ONESTATE, ANDARES_COM_AREAS, andarDaArea, SEDE, CHAVE_SEDE } from "../data/onestate";
import { useSede } from "../sedeStore";
import { useEscritorio } from "../store";

export const useCartaoOneState = useSede;
export function abrirOneState() {
  useMundo.setState({ loteSelecionado: null, alvoCamera: [SEDE.x, 0.5, SEDE.z + 6] });
  useCartaoOneState.setState({ aberto: true });
}
const fechar = () => useCartaoOneState.setState({ aberto: false });
// abriu um lote: o cartão da sede fecha (e não volta sozinho quando o lote fechar)
useMundo.subscribe((s, p) => { if (s.loteSelecionado && !p.loteSelecionado && useCartaoOneState.getState().aberto) fechar(); });

const ICONE_AREA: Record<string, NomeIcone> = {
  perfilRp: "pessoa", oneMatch: "amizade", feedRp: "camadas", cenas: "chamada", lives: "microfone", grupos: "equipe",
  mercado: "sacola", x1: "raio", noticias: "etiqueta", dinheiro: "cupom", guias: "ajuda", criadores: "brilho",
  missoes: "explorador", verificado: "selo", moedas: "cupom", eventos: "agenda", servidores: "predios", videos: "foto",
  atualizacoes: "relogio", policia: "admin", anuncie: "placa", suporte: "conversar", sobre: "perfil",
};

export function CartaoOneState() {
  const aberto = useCartaoOneState((s) => s.aberto);
  const loteAberto = useMundo((s) => !!s.loteSelecionado);
  const sede = useMundo((s) => s.terrenos[CHAVE_SEDE]);
  const souDono = useMundo((s) => s.meu === CHAVE_SEDE);
  const dentro = useEscritorio((s) => s.vista === "dentro");
  const alternarVista = () => { useEscritorio.getState().setVista(dentro ? "fora" : "dentro"); useMundo.setState({ alvoCamera: [SEDE.x, 0.5, SEDE.z + 3] }); };
  if (!aberto || loteAberto) return null;
  const andares = Array.from({ length: ANDARES_COM_AREAS }, (_, i) => i + 1);
  return (
    <div className={`${FLUTUANTE} ${LARGO} painel-entra flex flex-col overflow-hidden !bg-[#0E1013] !text-white`} role="dialog" aria-label="Sede do OneState RP">
      <div className="relative overflow-hidden px-4 pb-3 pt-4" style={{ background: "radial-gradient(120% 140% at 0% 0%, #2A2210 0%, #0E1013 60%)" }}>
        <button onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10"><Icone nome="fechar" tamanho={17} /></button>
        <img src="/onestate/logo.png" alt="OneState" className="h-11 w-auto" />
        <p className="mt-2 text-[13px] leading-snug text-white/75">A sede do OneState RP na cidade. Cada andar reúne áreas do site: toque para abrir.</p>
        <button type="button" onClick={alternarVista} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-[#D4A63A]/50 hover:bg-white/15"><Icone nome={dentro ? "predios" : "escritorio"} tamanho={15} className="text-[#E9C46A]" />{dentro ? "Ver a sede por fora" : "Ver a sede por dentro"}</button>
        {sede?.escritorio && <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-semibold"><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Icone nome="equipe" tamanho={13} className="text-[#E9C46A]" />{sede.escritorio.equipe.length} agentes de IA</span><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Icone nome="camadas" tamanho={13} className="text-[#E9C46A]" />{sede.escritorio.setores.length} setores</span></div>}
        {souDono && <div className="mt-3 flex gap-2"><a href="/app/equipe" className="inline-flex items-center gap-1.5 rounded-lg bg-[#E9C46A] px-3 py-1.5 text-[12.5px] font-bold text-[#1A1306]"><Icone nome="conversar" tamanho={15} />Falar com a equipe</a><a href="/app" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold"><Icone nome="escritorio" tamanho={15} />Meu escritório</a></div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {andares.map((a) => (
          <section key={a} className="mt-3">
            <div className="mb-1.5 flex items-center gap-2 px-1 text-[12px] font-semibold text-[#E9C46A]"><Icone nome="predios" tamanho={14} />{a}º andar{sede?.escritorio && <span className="font-medium text-white/45">· 3 agentes por sala</span>}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {AREAS_ONESTATE.map((x, i) => ({ x, i })).filter(({ i }) => andarDaArea(i) === a).map(({ x }) => (
                <a key={x.id} href={`${SITE_ONESTATE}${x.href}`} target="_blank" rel="noopener" className="group flex items-center gap-2 rounded-xl bg-white/[.06] px-2.5 py-2 text-[13px] font-semibold text-white/90 ring-1 ring-white/[.06] transition hover:bg-white/[.12] hover:ring-[#D4A63A]/50">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${x.cor}22`, color: x.cor }}><Icone nome={ICONE_AREA[x.id] ?? "seta"} tamanho={16} /></span>
                  <span className="min-w-0 flex-1 truncate">{x.nome}</span>
                  <Icone nome="seta" tamanho={14} className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-[#E9C46A]" />
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <a href={SITE_ONESTATE} target="_blank" rel="noopener" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E9C46A] to-[#B8862B] px-3 py-2.5 text-sm font-bold text-[#1A1306] shadow-lg hover:brightness-105">
          Abrir o onestatebr.com.br<Icone nome="seta" tamanho={16} />
        </a>
      </div>
    </div>
  );
}
