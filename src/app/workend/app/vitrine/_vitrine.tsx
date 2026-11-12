"use client";
// Vitrine do dono (12/11/2026): adicionar, editar, reordenar, esconder e apagar produtos, com a prévia de como aparecem
// no cartão do mapa e na página da loja. A foto é reduzida aqui no navegador (até 800 px, WebP ou JPEG, menos de 200 KB)
// antes de subir.
import Link from "next/link";
import { useEffect, useState } from "react";
import { VitrineVisual, precoBR, type DadosVitrine, type ProdutoVitrine } from "@/office/ui/VitrineLoja";

type Produto = ProdutoVitrine & { ativo: boolean; ordem: number };
type Dados = { lote: { chave: string; numero: number | null; ativo: boolean; empresa: string; cor: string } | null; whatsapp: string | null; max: number; produtos: Produto[] };
type Rascunho = { id?: string; nome: string; preco: string; descricao: string; ativo: boolean; fotoNova: string | null; fotoAtual: string | null; removerFoto: boolean };
const VAZIO: Rascunho = { nome: "", preco: "", descricao: "", ativo: true, fotoNova: null, fotoAtual: null, removerFoto: false };
const LIMITE_FOTO = 195 * 1024; // um pouco abaixo dos 200 KB do servidor

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as T;
}

// reduz a foto para no máximo 800 px e tenta WebP e depois JPEG até ficar abaixo do limite; foto muito "cheia" (que não
// comprime) desce para 640 e 480 px
async function reduzirFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não consegui abrir essa imagem. Use JPG, PNG ou WebP.")); i.src = url; });
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d"); if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
    for (const lado of [800, 640, 480]) {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * escala)); c.height = Math.max(1, Math.round(img.naturalHeight * escala));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      for (const [tipo, q] of [["image/webp", 0.85], ["image/webp", 0.7], ["image/jpeg", 0.8], ["image/jpeg", 0.6], ["image/jpeg", 0.45]] as const) {
        const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
        if (blob && blob.type === tipo && blob.size <= LIMITE_FOTO) return await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(new Error("Não consegui ler a foto.")); r.readAsDataURL(blob); });
      }
    }
    throw new Error("Não consegui deixar a foto com menos de 200 KB. Tente outra.");
  } finally { URL.revokeObjectURL(url); }
}
const precoTexto = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
// prévia do preço digitado (mesma leitura do servidor, só para mostrar)
function precoDoTexto(s: string): number | null {
  let t = s.replace(/[^\d,.]/g, ""); if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function VitrinePainel() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [r, setR] = useState<Rascunho | null>(null); // null = formulário fechado
  const [salvando, setSalvando] = useState(false);
  const [reduzindo, setReduzindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [apagar, setApagar] = useState<string | null>(null); // produto esperando a confirmação
  const [previa, setPrevia] = useState<"mapa" | "pagina">("mapa");
  useEffect(() => {
    let vivo = true;
    api<Dados>("/api/workend/vitrine").then((d) => { if (vivo) { setDados(d); setErroLista(null); } }).catch((e) => vivo && setErroLista((e as Error).message));
    return () => { vivo = false; };
  }, [versao]);

  if (!dados) return <section className="faixa mt-6"><p className="text-[var(--tinta-2)]">{erroLista ?? "Carregando a vitrine…"}</p></section>;
  const { lote, produtos, max } = dados;
  const numero = lote?.numero ?? null;
  const cheia = produtos.length >= max;

  const abrirNovo = () => { setR({ ...VAZIO }); setErro(null); setAviso(null); };
  const editar = (p: Produto) => { setR({ id: p.id, nome: p.nome, preco: precoTexto(p.preco), descricao: p.descricao, ativo: p.ativo, fotoNova: null, fotoAtual: p.foto, removerFoto: false }); setErro(null); setAviso(null); };
  const escolherFoto = async (f: File | undefined) => {
    if (!f || !r) return;
    setReduzindo(true); setErro(null);
    try { const foto = await reduzirFoto(f); setR((x) => (x ? { ...x, fotoNova: foto, removerFoto: false } : x)); }
    catch (e) { setErro((e as Error).message); }
    setReduzindo(false);
  };
  const salvar = async () => {
    if (!r) return;
    setSalvando(true); setErro(null); setAviso(null);
    try {
      await api("/api/workend/vitrine", { method: "POST", body: JSON.stringify({ id: r.id, nome: r.nome, preco: r.preco, descricao: r.descricao, ativo: r.ativo, foto: r.fotoNova ?? undefined, removerFoto: r.removerFoto }) });
      setAviso(r.id ? "Produto atualizado." : "Produto na vitrine! Ele já aparece na sua loja.");
      setR(null); setVersao((x) => x + 1);
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  const mostrar = async (p: Produto) => {
    setErro(null); setAviso(null);
    try { await api(`/api/workend/vitrine/${p.id}`, { method: "PATCH", body: JSON.stringify({ ativo: !p.ativo }) }); setAviso(p.ativo ? `“${p.nome}” saiu da vitrine (continua guardado aqui).` : `“${p.nome}” voltou para a vitrine.`); setVersao((x) => x + 1); }
    catch (e) { setErro((e as Error).message); }
  };
  const confirmarApagar = async (p: Produto) => {
    setErro(null); setAviso(null); setApagar(null);
    try { await api(`/api/workend/vitrine/${p.id}`, { method: "DELETE" }); setAviso(`“${p.nome}” foi apagado.`); if (r?.id === p.id) setR(null); setVersao((x) => x + 1); }
    catch (e) { setErro((e as Error).message); }
  };
  const mover = async (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= produtos.length) return;
    const nova = [...produtos]; [nova[i], nova[j]] = [nova[j], nova[i]];
    setDados({ ...dados, produtos: nova }); // na tela já muda; o servidor confirma em seguida
    try { await api("/api/workend/vitrine", { method: "PUT", body: JSON.stringify({ ordem: nova.map((p) => p.id) }) }); }
    catch (e) { setErro((e as Error).message); setVersao((x) => x + 1); }
  };

  // prévia: os produtos à mostra, com o rascunho aberto no lugar (ou no fim, se for novo)
  const doRascunho: ProdutoVitrine | null = r && r.nome.trim().length >= 2 ? { id: r.id ?? "novo", nome: r.nome.trim(), preco: precoDoTexto(r.preco), descricao: r.descricao.trim(), foto: r.fotoNova ?? (r.removerFoto ? null : r.fotoAtual) } : null;
  let lista: ProdutoVitrine[] = produtos.filter((p) => p.ativo && p.id !== r?.id);
  if (doRascunho && r?.ativo) { const pos = r.id ? produtos.filter((p) => p.ativo || p.id === r.id).findIndex((p) => p.id === r.id) : -1; lista = pos >= 0 ? [...lista.slice(0, pos), doRascunho, ...lista.slice(pos)] : [...lista, doRascunho]; }
  const dPrevia: DadosVitrine = { numero: numero ?? 0, empresa: lote?.empresa ?? "", cor: lote?.cor ?? "#1D4ED8", whatsapp: dados.whatsapp, atendente: "atendente", produtos: lista };
  const fotoForm = r ? r.fotoNova ?? (r.removerFoto ? null : r.fotoAtual) : null;

  return (
    <>
      <section className="faixa pt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--azul)]">{numero != null ? `Lote ${numero} · ` : ""}{lote?.empresa}</span>
            <h1 className="mt-1 text-[2rem] lg:text-[2.5rem]">Vitrine da loja</h1>
            <p className="mt-2 max-w-[62ch] text-[var(--tinta-2)]">Até {max} produtos com foto e preço. Eles aparecem no cartão da sua loja no mapa e na página da loja, com o botão <b>Pedir no WhatsApp</b>. O pagamento você combina direto com o cliente: o WorkEnd não passa dinheiro adiante.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {numero != null && <a href={`/loja/${numero}#vitrine`} target="_blank" rel="noreferrer" className="btn btn-linha">Ver a página da loja ↗</a>}
            {lote && <Link href={`/mundo?lote=${encodeURIComponent(lote.chave)}`} className="btn btn-claro">Ver no mapa</Link>}
          </div>
        </div>
        {!dados.whatsapp && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FFF4DB] px-5 py-4 text-[#6B4A00]">
            <p className="max-w-[60ch] text-[15px]"><b>Sua loja ainda não tem WhatsApp nos contatos.</b> Sem ele, o botão “Pedir no WhatsApp” não aparece e o cliente só pode perguntar à atendente de IA.</p>
            <Link href="/app/equipe?aba=sobre" className="btn btn-tinta whitespace-nowrap">Cadastrar o WhatsApp</Link>
          </div>
        )}
      </section>

      <section className="faixa mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.4rem]">Produtos <span className="text-base font-normal text-[var(--tinta-2)]">· {produtos.length} de {max}</span></h2>
            {!r && <button type="button" onClick={abrirNovo} disabled={cheia} className="btn btn-azul" title={cheia ? `A vitrine cabe ${max} produtos` : undefined}>+ Adicionar produto</button>}
          </div>
          {cheia && !r && <p className="mt-2 text-sm text-[var(--tinta-2)]">A vitrine está cheia. Apague um produto para pôr outro.</p>}
          {aviso && <p className="mt-3 rounded-lg bg-[#E3F6EA] px-3 py-2 text-sm text-[#166534]" role="status">{aviso}</p>}
          {erro && !r && <p className="mt-3 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]" role="alert">{erro}</p>}

          {r && (
            <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="equipe-entra mt-4 rounded-2xl bg-[var(--cinza)] p-5 sm:p-6">
              <h3 className="text-[1.2rem]">{r.id ? "Editar o produto" : "Novo produto"}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-[9rem_1fr]">
                <div>
                  <span className="mb-1 block text-sm font-semibold">Foto</span>
                  <label className="relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-[var(--linha)] bg-white text-center text-xs text-[var(--tinta-2)] hover:border-[var(--azul)]">
                    {fotoForm ? <img src={fotoForm} alt="Foto do produto" className="absolute inset-0 h-full w-full object-cover" /> : <span className="px-2">{reduzindo ? "Preparando…" : "Toque para escolher"}</span>}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" onChange={(e) => { void escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {fotoForm && <button type="button" onClick={() => setR({ ...r, fotoNova: null, removerFoto: true })} className="mt-1.5 w-full text-xs font-semibold text-[#9B1C1C] hover:underline">Tirar a foto</button>}
                  {reduzindo && <p className="mt-1 text-xs text-[var(--tinta-2)]">Reduzindo a foto…</p>}
                </div>
                <div className="space-y-3">
                  <label className="campo">Nome
                    <input value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value.slice(0, 60) })} placeholder="Ex.: Bolo de pote de chocolate" required />
                  </label>
                  <label className="campo">Preço (deixe vazio para “sob consulta”)
                    <input value={r.preco} onChange={(e) => setR({ ...r, preco: e.target.value.slice(0, 14) })} inputMode="decimal" placeholder="Ex.: 12,90" />
                  </label>
                  <label className="campo">Descrição (opcional)
                    <textarea rows={3} value={r.descricao} onChange={(e) => setR({ ...r, descricao: e.target.value.slice(0, 300) })} placeholder="Ex.: 250 ml, entrega no bairro." />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={r.ativo} onChange={(e) => setR({ ...r, ativo: e.target.checked })} className="h-4 w-4" /> Mostrar na vitrine</label>
                </div>
              </div>
              {erro && <p className="mt-3 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]" role="alert">{erro}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={salvando || reduzindo || r.nome.trim().length < 2} className="btn btn-azul flex-1">{salvando ? "Salvando…" : r.id ? "Salvar o produto" : "Pôr na vitrine"}</button>
                <button type="button" onClick={() => { setR(null); setErro(null); }} className="btn btn-linha">Cancelar</button>
              </div>
            </form>
          )}

          {produtos.length === 0 && !r && (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-[var(--linha)] p-7 text-center">
              <b>Sua vitrine está vazia.</b>
              <p className="mt-1 text-sm text-[var(--tinta-2)]">Ponha os produtos que mais vendem, com uma foto bonita e o preço. Quem visita a sua loja no mapa pede com um toque.</p>
              <button type="button" onClick={abrirNovo} className="btn btn-azul mt-4">Adicionar o primeiro produto</button>
            </div>
          )}
          <ul className="mt-4 space-y-2.5">
            {produtos.map((p, i) => (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${r?.id === p.id ? "border-[var(--azul)] shadow-md" : "border-[var(--linha)]"} ${p.ativo ? "bg-[var(--surface)]" : "bg-[var(--cinza)] opacity-80"}`}>
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => void mover(i, -1)} disabled={i === 0} aria-label={`Subir ${p.nome}`} className="rounded-md px-1.5 text-sm leading-none text-[var(--tinta-2)] hover:bg-black/5 disabled:opacity-30">▲</button>
                  <button type="button" onClick={() => void mover(i, 1)} disabled={i === produtos.length - 1} aria-label={`Descer ${p.nome}`} className="rounded-md px-1.5 text-sm leading-none text-[var(--tinta-2)] hover:bg-black/5 disabled:opacity-30">▼</button>
                </div>
                {p.foto ? <img src={p.foto} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-black text-white" style={{ background: lote?.cor ?? "#1D4ED8" }}>{p.nome.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{p.nome}</b>
                  <span className="text-[13px] text-[var(--tinta-2)]">{precoBR(p.preco)}{!p.ativo && " · escondido"}{!p.foto && " · sem foto"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  <button type="button" onClick={() => editar(p)} className="rounded-lg bg-[#EEF3FF] px-3 py-2 text-[#1D4ED8]">Editar</button>
                  <button type="button" onClick={() => void mostrar(p)} className="rounded-lg bg-[var(--cinza)] px-3 py-2">{p.ativo ? "Esconder" : "Mostrar"}</button>
                  {apagar === p.id
                    ? <><button type="button" onClick={() => void confirmarApagar(p)} className="rounded-lg bg-[#E2575B] px-3 py-2 text-white">Apagar mesmo</button><button type="button" onClick={() => setApagar(null)} className="rounded-lg bg-[var(--cinza)] px-3 py-2">Não</button></>
                    : <button type="button" onClick={() => setApagar(p.id)} className="rounded-lg bg-[var(--cinza)] px-3 py-2 text-[#9B1C1C]">Apagar</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[1.2rem]">Prévia</h2>
            <div className="flex rounded-full bg-[var(--cinza)] p-1 text-sm font-semibold" role="tablist" aria-label="Onde ver a prévia">
              {(["mapa", "pagina"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={previa === v} onClick={() => setPrevia(v)} className={`rounded-full px-3 py-1 ${previa === v ? "bg-[var(--azul)] text-white" : "text-[var(--tinta-2)]"}`}>{v === "mapa" ? "No mapa" : "Na página da loja"}</button>)}
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-[#E9EDF2] p-3 sm:p-4">
            {lista.length === 0 ? <p className="py-8 text-center text-sm text-[var(--tinta-2)]">Os produtos à mostra aparecem aqui como o visitante vê.</p>
              : previa === "mapa"
                ? <div className="mx-auto max-w-[20rem] rounded-2xl bg-white p-3 text-[#1D2128] shadow-xl"><div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">WorkEnd · {numero != null ? `Lote ${numero}` : "sua loja"}</div><div className="mb-2 text-lg font-bold">{lote?.empresa}</div><VitrineVisual d={dPrevia} compacto previa /></div>
                : <div className="rounded-2xl bg-white p-3"><VitrineVisual d={dPrevia} previa /></div>}
          </div>
          {produtos.some((p) => !p.ativo) && <p className="mt-2 text-xs text-[var(--tinta-2)]">Produtos escondidos não aparecem para os visitantes.</p>}
        </aside>
      </section>
    </>
  );
}
