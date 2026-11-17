"use client";
// "Enviar para…" no painel da conversa do mapa (17/11/2026, frente acabamento): a mesma ação dos conectores da página
// Minha equipe (src/app/workend/app/equipe/_conectores.tsx › EnviarPara), com estilo próprio em Tailwind: o mapa não tem o
// .we nem o equipe.css. Abre por cima de tudo (portal no body) e manda a entrega para um destino cadastrado na aba
// Conectores, assinada pelo servidor (POST /api/workend/conectores, acao "enviar"). Nada sai sem o clique do dono.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icone } from "./Icone";
import { apiEquipe, type MembroEquipe, type MsgEquipe } from "./equipeComum";

type Destino = { id: string; nome: string; tipos: string[] };
type Resposta = { ok: boolean; id?: string; url?: string; resposta?: string };
const TIPO_NOME: Record<string, string> = { noticia: "Notícia", guia: "Guia", missao: "Missão", evento: "Evento", outro: "Outro", teste: "Teste" };
// título sugerido: a primeira linha com conteúdo, sem marcações
const tituloDe = (t: string) => (t.split("\n").map((l) => l.replace(/^[#>*\-\s\d.)]+/, "").replace(/[*_`]/g, "").trim()).find((l) => l.length > 3) ?? "").slice(0, 120);

// destinos ativos do lote: uma busca por lote enquanto a página estiver aberta
const cache = new Map<string, Promise<Destino[]>>();
function useDestinos(lote: string) {
  const [lista, setLista] = useState<{ de: string; d: Destino[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    let p = cache.get(lote);
    if (!p) { p = apiEquipe<{ destinos: Destino[] }>(`/api/workend/conectores?lote=${encodeURIComponent(lote)}&so=destinos`).then((r) => r.destinos ?? []).catch(() => []); cache.set(lote, p); }
    void p.then((d) => { if (vivo) setLista({ de: lote, d }); });
    return () => { vivo = false; };
  }, [lote]);
  return lista?.de === lote ? lista.d : null;
}

export function EnviarPara({ m, membro, lote }: { m: MsgEquipe; membro: MembroEquipe; lote: string }) {
  const destinos = useDestinos(lote);
  const [aberto, setAberto] = useState(false);
  if (!destinos?.length || m.id.startsWith("tmp")) return null;
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1 font-semibold hover:text-[#1D4ED8]"><Icone nome="enviar" tamanho={12} />Enviar para…</button>
      {aberto && createPortal(<Janela m={m} membro={membro} lote={lote} destinos={destinos} fechar={() => setAberto(false)} />, document.body)}
    </>
  );
}

const CAMPO = "mt-1 w-full min-w-0 rounded-xl border border-black/15 bg-white px-3 py-2 text-[14px] font-normal text-[#1D2128] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20";

function Janela({ m, membro, lote, destinos, fechar }: { m: MsgEquipe; membro: MembroEquipe; lote: string; destinos: Destino[]; fechar: () => void }) {
  const [destino, setDestino] = useState(destinos[0].id);
  const dest = destinos.find((x) => x.id === destino) ?? destinos[0];
  const [tipoEscolhido, setTipo] = useState(dest.tipos[0]);
  const tipo = dest.tipos.includes(tipoEscolhido) ? tipoEscolhido : dest.tipos[0];
  const [titulo, setTitulo] = useState(() => tituloDe(m.conteudo));
  const [texto, setTexto] = useState(m.conteudo);
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<Resposta | null>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    addEventListener("keydown", tecla); return () => removeEventListener("keydown", tecla);
  }, [fechar]);
  const enviar = async () => {
    setEnviando(true); setRes(null);
    try { setRes(await apiEquipe<Resposta>(`/api/workend/conectores`, { method: "POST", body: JSON.stringify({ lote, acao: "enviar", destino: dest.id, tipoConteudo: tipo, titulo, texto, membro: membro.membroId, mensagem: m.id }) })); }
    catch (e) { setRes({ ok: false, resposta: (e as Error).message }); }
    setEnviando(false);
  };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0A0E14]/60 p-3 backdrop-blur-sm" onClick={fechar}>
      <div className="painel-entra relative max-h-[calc(100vh-1.5rem)] w-full max-w-[600px] overflow-y-auto rounded-3xl bg-[#F2F5F8] p-5 text-[#1D2128] shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mapa-enviar-titulo" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-[#5A6472] hover:bg-black/5"><Icone nome="fechar" tamanho={18} /></button>
        <h2 id="mapa-enviar-titulo" className="pr-10 text-[1.3rem] font-bold leading-tight">Enviar a entrega de {membro.nome}</h2>
        <p className="mt-1 text-[13.5px] text-[#5A6472]">Confira e ajuste antes. O sistema de destino recebe o conteúdo assinado pelo WorkEnd.</p>
        {res?.ok ? (
          <div className="mt-4 rounded-2xl bg-[#E3F6EA] p-4 text-[#166534]">
            <b className="flex items-center gap-2"><Icone nome="check" tamanho={18} />Enviado para {dest.nome}.</b>
            <p className="mt-1 text-[14px]">{res.id ? `O sistema registrou com o id ${res.id}.` : "O sistema confirmou o recebimento."}</p>
            {res.url && <a href={res.url} target="_blank" rel="noopener" className="mt-1 inline-block font-semibold text-[#0453CC] hover:underline">Abrir no sistema</a>}
            <div className="mt-3"><button type="button" onClick={fechar} className="rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-black/5">Fechar</button></div>
          </div>
        ) : (
          <form className="mt-3 grid gap-2.5" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[13px] font-semibold">Destino
                <select className={CAMPO} value={dest.id} onChange={(e) => setDestino(e.target.value)}>{destinos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
              </label>
              <label className="text-[13px] font-semibold">Tipo
                <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>{dest.tipos.map((t) => <option key={t} value={t}>{TIPO_NOME[t] ?? t}</option>)}</select>
              </label>
            </div>
            <label className="text-[13px] font-semibold">Título
              <input className={CAMPO} value={titulo} onChange={(e) => setTitulo(e.target.value.slice(0, 200))} />
            </label>
            <label className="text-[13px] font-semibold">Texto
              <textarea className={`${CAMPO} min-h-[170px] resize-y`} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 20000))} />
            </label>
            {res && !res.ok && <p className="rounded-lg bg-[#FDECEC] px-3 py-1.5 text-[13px] text-[#9B1C1C]">{res.resposta ?? "Não deu certo."}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={enviando || !titulo.trim() || !texto.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6CFF] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0453CC] disabled:opacity-50"><Icone nome="enviar" tamanho={16} />{enviando ? "Enviando…" : `Enviar para ${dest.nome}`}</button>
              <button type="button" onClick={fechar} className="rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-black/5">Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
