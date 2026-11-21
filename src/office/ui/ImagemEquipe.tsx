"use client";
// Cartão da imagem pedida à equipe (21/11/2026, servidor em src/server/imagemEquipe.ts), na conversa da Minha equipe e no
// painel do mapa: o custo em unidades de IA antes de gerar (formato, referências, saldo do mês e os pacotes quando falta),
// o andamento, a entrega (miniatura que abre grande, baixar e usar como foto de produto da vitrine) e, quando a empresa
// não tem ninguém de imagem, o caminho para a vitrine de agentes. Cores fixas: o cartão aparece nas duas telas.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icone } from "./Icone";

export type FormatoImagem = "quadrado" | "vertical" | "horizontal";
export type CartaoImagem = {
  id: string; tipo: "proposta" | "entrega"; status: "proposta" | "gerando" | "pronta" | "falhou" | "cancelada" | "sem_designer"; atualizadoEm: string;
  quem: { membroId: string; nome: string; cargo: string } | null; passou: boolean;
  pedido: string; formato: FormatoImagem; formatos: { id: FormatoImagem; nome: string; unidades: number }[]; unidades: number; saldo: number | null;
  logo: string | null; usarLogo: boolean; produtos: { id: string; nome: string; foto: string }[]; produto: string | null;
  pacotes: { id: string; unidades: number; creditos: number }[] | null;
  imagem: { url: string; baixar: string; largura: number | null; altura: number | null; tamanho: number | null } | null;
  vitrine: { produtos: { id: string; nome: string }[]; usadaEm: string | null } | null;
  contratar: { url: string; rotulo: string } | null; aviso: string | null;
};

const num = (v: number) => v.toLocaleString("pt-BR");
const kb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const partes = (nome: string) => { const m = nome.match(/^(.*?)\s*\((.*)\)$/); return m ? { nome: m[1], uso: m[2] } : { nome, uso: "" }; }; // "Quadrado (feed)"
async function acao(lote: string, corpo: Record<string, unknown>) {
  const r = await fetch("/api/workend/equipe/imagem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lote, ...corpo }), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as { imagem: CartaoImagem | null; aviso: string | null };
}
const Pontos = () => <span className="inline-flex gap-[3px]" aria-hidden><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:.2s]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:.4s]" /></span>;

// atualizar: recarrega a conversa (o "gerando" faz a conversa se atualizar sozinha até a entrega chegar)
export function CartaoImagemEquipe({ c: doServidor, lote, atualizar }: { c: CartaoImagem; lote: string; atualizar: () => void }) {
  const [local, setLocal] = useState<CartaoImagem | null>(null);
  // a resposta da ação vale até a conversa recarregar com uma versão igual ou mais nova
  const c = local && local.id === doServidor.id && local.tipo === doServidor.tipo && local.atualizadoEm >= doServidor.atualizadoEm ? local : doServidor;
  if (c.tipo === "entrega") return <Entrega c={c} lote={lote} mudou={setLocal} />;
  if (c.status === "sem_designer") return <SemDesigner c={c} />;
  return <Proposta c={c} lote={lote} mudou={(x) => { if (x) setLocal(x); atualizar(); }} />;
}

function Cabeca({ c }: { c: CartaoImagem }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF3FF] text-[#1D4ED8]"><Icone nome="foto" tamanho={17} /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block text-[13.5px]">Imagem{c.quem ? ` com ${c.quem.nome}` : ""}</b>
        {c.quem && <span className="block truncate text-[12px] text-[#5B6472]">{c.quem.cargo}</span>}
      </span>
    </div>
  );
}

function Proposta({ c, lote, mudou }: { c: CartaoImagem; lote: string; mudou: (c: CartaoImagem | null) => void }) {
  const [formato, setFormato] = useState<FormatoImagem>(c.formato);
  const [logo, setLogo] = useState(c.usarLogo);
  const [produto, setProduto] = useState(c.produto ?? "");
  const [ocupado, setOcupado] = useState<"gerar" | "cancelar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const custo = c.formatos.find((f) => f.id === formato)?.unidades ?? c.unidades;
  const falta = c.saldo !== null && c.saldo < custo;
  const aberto = c.status === "proposta" || c.status === "falhou";
  const fotoProduto = c.produtos.find((p) => p.id === produto)?.foto ?? null;
  const fazer = async (qual: "gerar" | "cancelar") => {
    setOcupado(qual); setErro(null);
    try { const r = await acao(lote, { id: c.id, acao: qual, formato, logo, produto: produto || null }); mudou(r.imagem); }
    catch (e) { setErro((e as Error).message); mudou(null); }
    setOcupado(null);
  };
  return (
    <div className="@container mt-2 w-full max-w-[440px] rounded-2xl border border-[#D9DEE7] bg-white p-3 text-[13.5px] text-[#1D2128] shadow-sm" data-imagem={c.id} data-status={c.status}>
      <Cabeca c={c} />
      <p className="mt-2 line-clamp-3 rounded-xl bg-[#F4F6F9] px-3 py-2 text-[13px] text-[#3A414C]">“{c.pedido}”</p>
      {c.status === "gerando" && <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#FFF8E6] px-3 py-2 text-[13px] text-[#8A6A12]"><Pontos />{c.quem?.nome ?? "A equipe"} está criando a imagem. Costuma levar até um minuto.</p>}
      {c.status === "pronta" && <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#166534]"><Icone nome="check" tamanho={15} />Feito: {num(c.unidades)} unidades. A imagem está logo abaixo.</p>}
      {c.status === "cancelada" && <p className="mt-2.5 text-[13px] text-[#5B6472]">Você preferiu não gerar agora. Nada foi descontado.</p>}
      {aberto && (
        <>
          {c.aviso && <p className="mt-2.5 rounded-xl bg-[#FDECEC] px-3 py-2 text-[13px] text-[#9B1C1C]">{c.aviso}</p>}
          <fieldset className="mt-2.5">
            <legend className="text-[12px] font-semibold text-[#5B6472]">Formato</legend>
            <div className="mt-1 grid grid-cols-1 gap-1.5 @xs:grid-cols-3">
              {c.formatos.map((f) => { const p = partes(f.nome); const sel = formato === f.id; return (
                <button key={f.id} type="button" aria-pressed={sel} onClick={() => setFormato(f.id)} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left leading-tight transition @xs:block @xs:px-2 ${sel ? "border-[#1D4ED8] bg-[#EEF3FF] text-[#1D4ED8]" : "border-[#D9DEE7] hover:border-[#9AA1AC]"}`}>
                  <span className="min-w-0">
                    <span className="text-[12.5px] font-semibold @xs:block">{p.nome}</span>
                    {p.uso && <span className="ml-1.5 text-[11px] opacity-75 @xs:ml-0 @xs:block">{p.uso}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums @xs:block">{num(f.unidades)} unidades</span>
                </button>
              ); })}
            </div>
          </fieldset>
          {(c.logo || c.produtos.length > 0) && (
            <div className="mt-2.5 space-y-1.5">
              <span className="block text-[12px] font-semibold text-[#5B6472]">Referências</span>
              {c.logo && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={logo} onChange={(e) => setLogo(e.target.checked)} className="h-4 w-4 shrink-0 accent-[#1D4ED8]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.logo} alt="" className="h-7 w-7 shrink-0 rounded-md border border-black/10 bg-white object-contain" />
                  Usar a logomarca
                </label>
              )}
              {c.produtos.length > 0 && (
                <label className="flex items-center gap-2 text-[13px]">
                  {fotoProduto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoProduto} alt="" className="h-7 w-7 shrink-0 rounded-md border border-black/10 object-cover" />
                  ) : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#F4F6F9] text-[#7A828E]"><Icone nome="sacola" tamanho={15} /></span>}
                  <span className="sr-only">Foto de produto da vitrine</span>
                  <select value={produto} onChange={(e) => setProduto(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-2 py-1 text-[16px] text-[#1D2128] outline-none focus:border-[#1D4ED8] sm:text-[13px]">
                    <option value="">Sem foto de produto</option>
                    {c.produtos.map((p) => <option key={p.id} value={p.id}>Foto de {p.nome}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          <p className="mt-3 text-[13px]" data-custo={custo}>
            <b>Custa {num(custo)} unidades de IA.</b>{" "}
            {c.saldo === null ? "Esta empresa não paga unidades." : <>Restam <b data-saldo={c.saldo}>{num(c.saldo)}</b> no mês{c.saldo >= custo ? ` (dá para ${num(Math.floor(c.saldo / custo))} ${Math.floor(c.saldo / custo) === 1 ? "imagem" : "imagens"} assim)` : ""}.</>}
          </p>
          {falta && c.saldo !== null && (
            <div className="mt-2 rounded-xl border border-[#F2D58A] bg-[#FFF8E6] p-2.5 text-[#4A3A10]" data-falta>
              <b className="block text-[13px]">Faltam {num(custo - c.saldo)} unidades para esta imagem.</b>
              <span className="text-[12.5px]">Com um pacote ela sai agora (as unidades compradas não vencem):</span>
              {c.pacotes && <ul className="mt-1.5 grid grid-cols-1 gap-1.5 @xs:grid-cols-3">
                {c.pacotes.map((p) => <li key={p.id}><Link prefetch={false} href="/app/creditos#unidades" className="flex items-baseline justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] leading-tight ring-1 ring-black/5 hover:ring-[#1D4ED8] @xs:block @xs:px-2"><span><b className="tabular-nums">{num(p.unidades)}</b> unidades</span><span className="text-[11.5px] text-[#5B6472] @xs:block">{num(p.creditos)} créditos</span></Link></li>)}
              </ul>}
              <Link prefetch={false} href="/app/creditos#unidades" className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#1D2128] px-3 py-2 text-[13px] font-bold text-white"><Icone nome="unidades" tamanho={15} />Comprar unidades</Link>
            </div>
          )}
          {erro && <p className="mt-2 rounded-lg bg-[#FDECEC] px-3 py-1.5 text-[12.5px] text-[#9B1C1C]" role="alert">{erro}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!ocupado || falta} onClick={() => fazer("gerar")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#1A43BE] disabled:opacity-50">
              <Icone nome="foto" tamanho={16} />{ocupado === "gerar" ? "Enviando…" : `${c.status === "falhou" ? "Tentar de novo" : "Gerar imagem"} · ${num(custo)} unidades`}
            </button>
            <button type="button" disabled={!!ocupado} onClick={() => fazer("cancelar")} className="rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-[#5B6472] hover:bg-black/5">{ocupado === "cancelar" ? "Cancelando…" : "Agora não"}</button>
          </div>
          <p className="mt-1 text-[11.5px] text-[#7A828E]">As unidades só saem quando a imagem fica pronta.</p>
        </>
      )}
    </div>
  );
}

function SemDesigner({ c }: { c: CartaoImagem }) {
  if (!c.contratar) return null;
  return (
    <div className="mt-2 w-full max-w-[440px] rounded-2xl border border-[#D9DEE7] bg-white p-3 text-[#1D2128] shadow-sm" data-imagem={c.id} data-status={c.status}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF3FF] text-[#1D4ED8]"><Icone nome="foto" tamanho={18} /></span>
        <span className="min-w-0 flex-1 text-[13px] leading-snug">
          <b className="block text-[13.5px]">Designer gráfico ou social media</b>
          <span className="text-[#5B6472]">Cria fotos de produto, artes para o Instagram, cartazes e banners da sua marca, aqui mesmo na conversa.</span>
        </span>
      </div>
      <Link href={c.contratar.url} prefetch={false} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#1A43BE] sm:inline-flex sm:w-auto">{c.contratar.rotulo}<Icone nome="seta" tamanho={15} /></Link>
    </div>
  );
}

function Entrega({ c, lote, mudou }: { c: CartaoImagem; lote: string; mudou: (c: CartaoImagem) => void }) {
  const [grande, setGrande] = useState(false);
  const [naVitrine, setNaVitrine] = useState(false);
  const im = c.imagem;
  if (!im) return null;
  const fmt = partes(c.formatos.find((f) => f.id === c.formato)?.nome ?? "").nome;
  return (
    <div className="mt-2 w-full max-w-[340px]" data-imagem={c.id} data-status="entrega">
      <button type="button" onClick={() => setGrande(true)} className="group relative block w-full overflow-hidden rounded-2xl border border-[#D9DEE7] bg-[#F4F6F9]" style={{ aspectRatio: im.largura && im.altura ? `${im.largura} / ${im.altura}` : "1 / 1" }} aria-label="Ver a imagem em tamanho grande">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={im.url} alt={`Imagem criada pela equipe: ${c.pedido.slice(0, 120)}`} loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white transition group-hover:bg-black/70"><Icone nome="expandir" tamanho={16} /></span>
      </button>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <a href={im.baixar} download className="inline-flex items-center gap-1 rounded-full bg-[#1D4ED8] px-3 py-1.5 font-bold text-white hover:bg-[#1A43BE]"><Icone nome="baixar" tamanho={14} />Baixar</a>
        {c.vitrine && <button type="button" onClick={() => setNaVitrine((v) => !v)} aria-expanded={naVitrine} className="inline-flex items-center gap-1 rounded-full border border-[#D9DEE7] bg-white px-3 py-1.5 font-semibold text-[#1D2128] hover:border-[#1D4ED8] hover:text-[#1D4ED8]"><Icone nome="sacola" tamanho={14} />Usar na vitrine</button>}
      </div>
      <p className="mt-1 text-[11.5px] text-[#7A828E]">{fmt}{im.largura && im.altura ? ` · ${im.largura} × ${im.altura}` : ""}{im.tamanho ? ` · ${kb(im.tamanho)}` : ""} · custou {num(c.unidades)} unidades{c.saldo !== null ? ` · restam ${num(c.saldo)} no mês` : ""}</p>
      {c.vitrine?.usadaEm && !naVitrine && <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#166534]"><Icone nome="check" tamanho={13} />É a foto de “{c.vitrine.usadaEm}” na vitrine.</p>}
      {naVitrine && c.vitrine && <UsarNaVitrine c={c} lote={lote} mudou={mudou} />}
      {grande && <VerGrande c={c} fechar={() => setGrande(false)} />}
    </div>
  );
}

function UsarNaVitrine({ c, lote, mudou }: { c: CartaoImagem; lote: string; mudou: (c: CartaoImagem) => void }) {
  const lista = c.vitrine?.produtos ?? [];
  const [alvo, setAlvo] = useState(lista[0]?.id ?? "novo");
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const salvar = async () => {
    setOcupado(true); setMsg(null);
    try { const r = await acao(lote, { id: c.id, acao: "vitrine", vitrine: alvo === "novo" ? { nome } : { produto: alvo } }); if (r.imagem) mudou(r.imagem); setMsg({ ok: true, t: r.aviso ?? "Pronto." }); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setOcupado(false);
  };
  const campo = "mt-1 block w-full rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-[16px] text-[#1D2128] outline-none focus:border-[#1D4ED8] sm:text-[13.5px]";
  return (
    <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="mt-2 rounded-xl border border-[#D9DEE7] bg-white p-2.5 text-[13px]">
      <label className="block text-[12px] font-semibold text-[#5B6472]">Usar como foto de
        <select value={alvo} onChange={(e) => setAlvo(e.target.value)} className={campo}>
          {lista.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          <option value="novo">Um produto novo</option>
        </select>
      </label>
      {alvo === "novo" && <label className="mt-2 block text-[12px] font-semibold text-[#5B6472]">Nome do produto<input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Ex.: Pão de queijo" className={campo} /></label>}
      <button type="submit" disabled={ocupado || (alvo === "novo" && nome.trim().length < 2)} className="mt-2 rounded-xl bg-[#1D2128] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50">{ocupado ? "Salvando…" : "Salvar na vitrine"}</button>
      {msg && <p className={`mt-1.5 text-[12.5px] ${msg.ok ? "text-[#166534]" : "text-[#9B1C1C]"}`} role="status">{msg.t}{msg.ok && <> <Link prefetch={false} href="/app/vitrine" className="font-semibold underline">Abrir a Vitrine</Link></>}</p>}
    </form>
  );
}

// a imagem grande, por cima de tudo (portal: a bolha da conversa tem animação com transform)
function VerGrande({ c, fechar }: { c: CartaoImagem; fechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  const im = c.imagem;
  if (!im || typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Imagem em tamanho grande" className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-3 bg-black/85 p-4" onClick={fechar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={im.url} alt={`Imagem criada pela equipe: ${c.pedido.slice(0, 120)}`} className="max-h-[calc(100dvh-110px)] max-w-full rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={im.baixar} download className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[14px] font-bold text-[#1D2128]"><Icone nome="baixar" tamanho={16} />Baixar</a>
        <button type="button" onClick={fechar} autoFocus className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-[14px] font-bold text-white ring-1 ring-white/30 hover:bg-white/25"><Icone nome="fechar" tamanho={16} />Fechar</button>
      </div>
    </div>,
    document.body,
  );
}
