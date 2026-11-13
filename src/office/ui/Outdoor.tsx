"use client";
// Cartão do outdoor (12/11/2026): ver quem anuncia (e ir até a loja), ou alugar a vaga com a sua marca por 30 dias no Pix.
import { useState } from "react";
import { useMundo, LOTE_POR_CHAVE } from "../mundoStore";
import { OUTDOOR_POR_ID, MAX_FRASE_OUTDOOR, DIAS_OUTDOOR } from "../data/outdoors";
import { nomeNicho } from "../data/mundo";
import { PixAberto } from "./Lote";
import { FLUTUANTE, ESTREITO } from "./estilo";

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

export function CartaoOutdoor() {
  const slot = useMundo((s) => s.outdoorSelecionado);
  const o = useMundo((s) => s.outdoors.find((x) => x.slot === s.outdoorSelecionado));
  const abrir = useMundo((s) => s.abrirOutdoor), selecionarLote = useMundo((s) => s.selecionarLote), pagar = useMundo((s) => s.pagarOutdoor), carregar = useMundo((s) => s.carregarOutdoors);
  const usuario = useMundo((s) => s.usuario), meu = useMundo((s) => s.meu), terrenos = useMundo((s) => s.terrenos), preco = useMundo((s) => s.precoOutdoor);
  const pagamentoLigado = useMundo((s) => s.pagamentoLigado), pagando = useMundo((s) => s.pagando);
  const pixAberto = useMundo((s) => !!s.pix && s.pix.lote === `outdoor:${s.outdoorSelecionado}` && s.pix.status === "pendente");
  const [frase, setFrase] = useState<{ de: string; texto: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  if (!slot) return null;
  const vaga = OUTDOOR_POR_ID[slot]; if (!vaga) return null;
  const meuLote = meu ? terrenos[meu] : undefined; const loteAtivo = meuLote?.status === "ativo";
  const texto = frase?.de === slot ? frase.texto : o?.meu ? o.frase : "";
  const setTexto = (t: string) => setFrase({ de: slot, texto: t.slice(0, MAX_FRASE_OUTDOOR) });
  const alugar = async () => { setErro(null); const e = await pagar(slot, texto); if (e) setErro(e); };
  const salvarFrase = async () => { setErro(null); const r = await fetch(`/api/outdoors/${slot}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ frase: texto }) }); if (!r.ok) setErro(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não deu."); else { setSalvo(true); setTimeout(() => setSalvo(false), 1600); void carregar(); } };
  const ativoOutro = o?.status === "ativo" && !o.meu;
  return (
    <div className={`${FLUTUANTE} ${ESTREITO} painel-entra !z-10 overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div><div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">WorkEnd · Outdoor</div><div className="text-lg font-bold">{vaga.nome}</div><div className="text-xs text-[#5B6472]">14,4 × 7,2 m, com refletores à noite · {brl(preco)} por {DIAS_OUTDOOR} dias</div></div>
        <button onClick={() => abrir(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>

      {ativoOutro && o?.empresa && (
        <>
          <Previa nome={o.empresa.nome} cor={o.empresa.cor} frase={o.frase} nicho={o.empresa.nicho} logo={o.empresa.logo} />
          <div className="mt-3 flex gap-2">
            {o.empresa.chave && <button onClick={() => selecionarLote(o.empresa!.chave)} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white">Ir até a loja</button>}
            {o.empresa.numero && <a href={`/loja/${o.empresa.numero}`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#F1F3F6] px-3 py-2.5 text-sm font-semibold text-[#1D4ED8]">Página ↗</a>}
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
              {pixAberto ? <PixAberto chave={`outdoor:${slot}`} /> : pagamentoLigado ? (
                <button onClick={alugar} disabled={pagando} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#15803d] disabled:opacity-50">{pagando ? "Gerando o Pix…" : `${o?.meu && o.status === "ativo" ? "Renovar +30 dias" : "Alugar"} · ${brl(preco)} no Pix`}</button>
              ) : <div className="mt-2 rounded-xl bg-[#F1F3F6] px-3 py-2 text-center text-xs text-[#5B6472]">Pagamento em instantes.</div>}
            </>
          )}
        </>
      )}
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
    </div>
  );
}
