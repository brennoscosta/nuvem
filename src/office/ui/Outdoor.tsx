"use client";
// Cartão do outdoor (12/11/2026): ver quem anuncia (e ir até a loja), ou alugar a vaga com a sua marca por 30 dias no Pix.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalOutdoor } from "../modalOutdoor";
import { useMundo, LOTE_POR_CHAVE } from "../mundoStore";
import { OUTDOOR_POR_ID, MAX_FRASE_OUTDOOR, DIAS_OUTDOOR } from "../data/outdoors";
import { nomeNicho } from "../data/mundo";
import { PixAberto } from "./Lote";
import { BotaoCobrar } from "./Cobrar";
import { FLUTUANTE, ESTREITO } from "./estilo";
import { Icone } from "./Icone";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function Previa({ nome, cor, frase, nicho, logo }: { nome: string; cor: string; frase: string; nicho: string; logo: string | null }) {
  return (
    // v63: a prévia tem a moldura, a passarela e as colunas do outdoor de verdade (face 2:1, 14,4 × 7,2 m)
    <div className="mt-3">
      <div className="rounded-lg bg-[#1D2128] p-[5px] shadow-md">
      <div className="flex aspect-[2/1] items-center gap-3 overflow-hidden rounded-xl p-3 text-white shadow-inner" style={{ background: `linear-gradient(135deg, ${cor}, #161C25 160%)` }}>
        <span className="grid aspect-square h-[62%] shrink-0 place-items-center overflow-hidden rounded-xl bg-white">{logo ? <img src={logo} alt="" className="h-[86%] w-[86%] object-contain" /> : <b className="text-xl" style={{ color: cor }}>{nome.slice(0, 2).toUpperCase()}</b>}</span>
        <span className="min-w-0"><b className="block truncate text-lg leading-tight">{nome}</b><span className="line-clamp-2 text-[12px] opacity-90">{frase || "Sua frase aparece aqui"}</span><span className="mt-1 block text-[10px] font-semibold opacity-75">{nicho}</span></span>
      </div>
      </div>
      <div className="mx-auto -mt-px h-1.5 w-[104%] -translate-x-[2%] rounded-sm bg-[#4B5563]" aria-hidden />
      <div className="flex justify-center gap-[34%]" aria-hidden><i className="block h-5 w-2 rounded-b bg-[#3A3F47]" /><i className="block h-5 w-2 rounded-b bg-[#3A3F47]" /></div>
      <div className="text-center text-[10px] text-[#5B6472]">Prévia do outdoor · 14,4 × 7,2 m</div>
    </div>
  );
}

// Modal do outdoor livre (20/11/2026, pedido do dono): o vídeo de propaganda completo (mudo até o visitante tocar em
// "Ouvir com som"), onde o outdoor fica, o preço e "Anunciar aqui", que fecha o modal e deixa a compra à vista.
function ModalOutdoor({ slot, preco, aoAnunciar, aoFechar }: { slot: string; preco: number; aoAnunciar: () => void; aoFechar: () => void }) {
  const vaga = OUTDOOR_POR_ID[slot]; const video = useRef<HTMLVideoElement>(null); const [som, setSom] = useState(false);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [aoFechar]);
  const ouvir = () => { const v = video.current; if (!v) return; v.muted = false; v.currentTime = 0; void v.play().catch(() => {}); setSom(true); };
  return createPortal(
    <div data-modal-outdoor className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0B1220]/70 sm:items-center sm:p-4" onClick={aoFechar} role="dialog" aria-modal="true" aria-label="Anunciar neste outdoor">
      <div className="painel-entra max-h-[100dvh] w-full max-w-[44rem] overflow-y-auto rounded-t-3xl bg-white text-[#1D2128] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-black">
          <video ref={video} className="block aspect-video w-full" autoPlay muted playsInline loop={!som} controls={som} preload="auto" poster="/workend/outdoor/anuncie-outdoor.jpg">
            <source src="/workend/outdoor/anuncie-outdoor.mp4" type='video/mp4; codecs="avc1.4D401F, mp4a.40.2"' />
            <source src="/workend/outdoor/anuncie-outdoor.webm" type="video/webm" />
          </video>
          {!som && <button onClick={ouvir} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white hover:bg-black/80"><Icone nome="som" tamanho={15} />Ouvir com som</button>}
          <button onClick={aoFechar} className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/75"><Icone nome="fechar" tamanho={16} /><span className="sr-only">Fechar</span></button>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1 basis-64">
            <div className="text-[12px] font-bold text-[#1D4ED8]">Outdoor livre · {vaga?.nome ?? slot}</div>
            <div className="mt-0.5 text-2xl font-extrabold leading-tight">{brl(preco)} <span className="text-sm font-semibold text-[#5B6472]">a cada {DIAS_OUTDOOR} dias, no Pix</span></div>
            <p className="mt-1 text-xs text-[#5B6472]">A logo, o nome e uma frase da sua loja num outdoor de 14,4 × 7,2 m, aceso à noite. Quem clica nele vai direto até a sua loja no mapa.</p>
          </div>
          <button data-anunciar-aqui onClick={aoAnunciar} className="w-full rounded-xl bg-[#16A34A] px-5 py-3 text-sm font-bold text-white hover:bg-[#15803d] sm:w-auto">Anunciar aqui</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CartaoOutdoor() {
  const slot = useMundo((s) => s.outdoorSelecionado);
  const o = useMundo((s) => s.outdoors.find((x) => x.slot === s.outdoorSelecionado));
  const abrir = useMundo((s) => s.abrirOutdoor), selecionarLote = useMundo((s) => s.selecionarLote), pagar = useMundo((s) => s.pagarOutdoor), carregar = useMundo((s) => s.carregarOutdoors);
  const usuario = useMundo((s) => s.usuario), meu = useMundo((s) => s.meu), terrenos = useMundo((s) => s.terrenos), preco = useMundo((s) => s.precoOutdoor);
  const pagamentoLigado = useMundo((s) => s.pagamentoLigado), pagando = useMundo((s) => s.pagando);
  const pixAberto = useMundo((s) => !!s.pix && s.pix.lote === `outdoor:${s.outdoorSelecionado}` && (s.pix.status === "pendente" || s.pix.status === "aprovado"));
  const [frase, setFrase] = useState<{ de: string; texto: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const modal = useModalOutdoor((s) => s.slot), abrirModal = useModalOutdoor((s) => s.abrir);
  if (!slot) return null;
  const vaga = OUTDOOR_POR_ID[slot]; if (!vaga) return null;
  const meuLote = meu ? terrenos[meu] : undefined; const loteAtivo = meuLote?.status === "ativo";
  const texto = frase?.de === slot ? frase.texto : o?.meu ? o.frase : "";
  const setTexto = (t: string) => setFrase({ de: slot, texto: t.slice(0, MAX_FRASE_OUTDOOR) });
  const alugar = async (creditos = false) => { setErro(null); const e = await pagar(slot, texto, creditos); if (e) setErro(e); };
  const salvarFrase = async () => { setErro(null); const r = await fetch(`/api/outdoors/${slot}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ frase: texto }) }); if (!r.ok) setErro(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não deu."); else { setSalvo(true); setTimeout(() => setSalvo(false), 1600); void carregar(); } };
  const ativoOutro = o?.status === "ativo" && !o.meu;
  return (
    <>
    {modal === slot && !ativoOutro && <ModalOutdoor slot={slot} preco={preco} aoAnunciar={() => abrirModal(null)} aoFechar={() => { abrirModal(null); abrir(null); }} />}
    <div data-cartao-outdoor className={`${FLUTUANTE} ${ESTREITO} painel-entra !z-10 overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div><div className="text-[12px] font-bold text-[#1D4ED8]">WorkEnd · Outdoor</div><div className="text-lg font-bold">{vaga.nome}</div><div className="text-xs text-[#5B6472]">14,4 × 7,2 m, com refletores à noite · {brl(preco)} por {DIAS_OUTDOOR} dias</div></div>
        <button onClick={() => abrir(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5"><Icone nome="fechar" tamanho={16} /><span className="sr-only">Fechar</span></button>
      </div>

      {ativoOutro && o?.empresa && (
        <>
          <Previa nome={o.empresa.nome} cor={o.empresa.cor} frase={o.frase} nicho={o.empresa.nicho} logo={o.empresa.logo} />
          <div className="mt-3 flex gap-2">
            {o.empresa.chave && <button onClick={() => selecionarLote(o.empresa!.chave)} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white">Ir até a loja</button>}
            {o.empresa.numero && <a href={`/loja/${o.empresa.numero}`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#F1F3F6] px-3 py-2.5 text-sm font-semibold text-[#1D4ED8]">Página</a>}
          </div>
          {o.pagoAte && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Este outdoor fica livre a partir de {dataBR(o.pagoAte)}.</div>}
        </>
      )}

      {o?.status === "reservado" && !o.meu && <div className="mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Outra empresa está pagando este outdoor agora. Se ela não pagar em até 1 hora, a vaga volta a ficar livre.</div>}

      {!ativoOutro && !(o?.status === "reservado" && !o.meu) && (
        <>
          {o?.meu && o.status === "ativo" && <div className="mt-3 rounded-xl bg-[#E3F6EA] px-3 py-2 text-xs text-[#166534]">Seu anúncio está no ar até <b>{o.pagoAte ? dataBR(o.pagoAte) : "—"}</b>.</div>}
          {!usuario ? (
            <a href={`/entrar?destino=${encodeURIComponent("/mundo")}`} className="mt-3 block rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-center text-sm font-bold text-white">Entrar para anunciar</a>
          ) : !loteAtivo || !meuLote ? (
            <div className="mt-3 rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs text-[#5B6472]">O outdoor mostra a sua loja e leva quem clica até ela. Para anunciar, tenha um lote ativo no mapa.</div>
          ) : (
            <>
              <Previa nome={meuLote.empresaNome} cor={meuLote.cor} frase={texto} nicho={nomeNicho(meuLote.nicho)} logo={meuLote.temLogo ? `/api/terrenos/${encodeURIComponent(meuLote.chave)}/logo` : null} />
              <label className="mt-3 block text-xs font-semibold text-[#5B6472]">Frase do anúncio ({texto.length}/{MAX_FRASE_OUTDOOR})
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Pão quentinho todo dia às 6h" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#1D4ED8]" />
              </label>
              <div className="mt-1 text-[11px] text-[#5B6472]">Só texto: o anúncio usa o nome, a cor e a logo da {meuLote.empresaNome} (Lote {LOTE_POR_CHAVE[meuLote.chave]?.numero}).</div>
              {o?.meu && o.status === "ativo" && <button onClick={salvarFrase} className="mt-2 w-full rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold text-[#1D4ED8]">{salvo ? "Frase salva ✓" : "Salvar a frase"}</button>}
              {pixAberto ? <PixAberto chave={`outdoor:${slot}`} /> : (
                <BotaoCobrar valor={preco} rotuloPix={`${o?.meu && o.status === "ativo" ? "Renovar +30 dias" : "Alugar"} · ${brl(preco)} no Pix`} rotuloCreditos={o?.meu && o.status === "ativo" ? "Renovar +30 dias" : "Alugar com créditos"} pagando={pagando} pixLigado={pagamentoLigado} onPagar={(c) => void alugar(c)} />
              )}
            </>
          )}
        </>
      )}
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
    </div>
    </>
  );
}
