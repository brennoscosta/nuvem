"use client";
// Sua página grátis (Plano Vitrine, WE-13, 21/11/2026): no Meu escritório, a conta sem lote publica a página própria da loja
// (workend.online/<slug>) sem pagar nada: nome, cor, nicho, WhatsApp, o que a empresa faz e a logomarca. Publicada, mostra o
// link, os 3 produtos da vitrine e o atalho para editar. O convite para levar a mesma loja para a cidade vem logo abaixo
// (page.tsx › SemLote). Regras em src/server/planoVitrine.ts; quem salva é /api/workend/pagina.
import Link from "next/link";
import { useState } from "react";
import { CopiarLink } from "./_painel";
import { Icone } from "@/office/ui/Icone";
import { NICHOS } from "@/office/data/mundo";

// as mesmas cores do formulário do lote no mapa (mundoStore.ts › CORES_EMPRESA)
const CORES = ["#1D4ED8", "#0EA5A4", "#16A34A", "#D97706", "#DC2626", "#DB2777", "#7C3AED", "#1F2937"];
const MAX_LOGO = 400 * 1024;
const precoBR = (c: number | null) => (c == null ? "Sob consulta" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export interface DadosPaginaGratis {
  pagina: { numero: number; empresaNome: string; cor: string; nicho: string; logo: string | null } | null;
  endereco: string | null; sobre: string; whatsapp: string; instagram: string; nomeConta: string;
  produtos: { id: string; nome: string; preco: number | null; foto: string | null }[]; ativos: number; maxGratis: number; respostas: number;
}

export function PaginaGratis({ d }: { d: DadosPaginaGratis }) {
  const p = d.pagina;
  // sem página, o formulário; publicada, o resumo (o formulário volta em "Editar a página")
  const [editando, setEditando] = useState(false);
  if (!p || editando) return <FormPagina d={d} aoCancelar={p ? () => setEditando(false) : null} aoSalvar={() => setEditando(false)} />;
  const link = d.endereco ? `workend.online/${d.endereco}` : null;
  return (
    <section className="faixa" id="pagina-gratis">
      <div className="pn-loja" style={{ ["--marca" as string]: p.cor }}>
        <div className="pn-loja-texto">
          <div className="flex items-center gap-3">
            {p.logo ? <img src={p.logo} alt="" className="pn-logo" /> : <span className="pn-logo pn-logo-letra" aria-hidden="true">{p.empresaNome.slice(0, 1)}</span>}
            <span className="pn-aberta"><i aria-hidden="true" />Sua página grátis está no ar</span>
          </div>
          <h2>{p.empresaNome}</h2>
          {link && <p className="pn-endereco pn-gr-link">{link}</p>}
          <p className="pn-gr-inclui">Grátis para sempre: a página própria, {d.maxGratis} produtos na vitrine, o botão de WhatsApp e a atendente de IA com {d.respostas} respostas por mês.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {d.endereco && <a href={`/${d.endereco}`} target="_blank" rel="noreferrer" className="btn btn-azul">Abrir minha página</a>}
            {link && <CopiarLink texto={link} />}
            <button type="button" className="btn pn-btn-vidro" onClick={() => setEditando(true)}>Editar a página</button>
          </div>
        </div>
        <div className="pn-gr-vitrine">
          <div className="pn-gr-vitrine-topo"><b>Vitrine</b><span>{d.ativos} de {d.maxGratis} produtos</span></div>
          <ul>
            {Array.from({ length: d.maxGratis }, (_, i) => d.produtos[i] ?? null).map((x, i) => x ? (
              <li key={x.id} className="pn-gr-produto">
                {x.foto ? <img src={x.foto} alt="" width={64} height={64} /> : <span className="pn-gr-sem-foto" aria-hidden="true"><Icone nome="sacola" tamanho={20} /></span>}
                <span className="min-w-0"><b className="block truncate">{x.nome}</b><small>{precoBR(x.preco)}</small></span>
              </li>
            ) : (
              <li key={`vazio-${i}`} className="pn-gr-produto pn-gr-vazio"><span className="pn-gr-sem-foto" aria-hidden="true"><Icone nome="mais" tamanho={18} /></span><span>Espaço para um produto</span></li>
            ))}
          </ul>
          <Link href="/app/vitrine" className="btn btn-claro mt-3 w-full justify-center">{d.ativos ? "Editar a vitrine" : "Pôr os produtos na vitrine"}</Link>
        </div>
      </div>
    </section>
  );
}

function FormPagina({ d, aoCancelar, aoSalvar }: { d: DadosPaginaGratis; aoCancelar: (() => void) | null; aoSalvar: () => void }) {
  const p = d.pagina;
  const [f, setF] = useState({ empresaNome: p?.empresaNome ?? d.nomeConta, cor: p?.cor ?? CORES[0], nicho: p?.nicho ?? "negocios", whatsapp: d.whatsapp, instagram: d.instagram, sobre: d.sobre });
  const [logo, setLogo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const escolherLogo = (arq: File | undefined) => {
    setErro(null);
    if (!arq) return;
    if (!/^image\/(png|jpeg|webp)$/.test(arq.type)) return setErro("A logo precisa ser PNG, JPG ou WebP.");
    if (arq.size > MAX_LOGO) return setErro("Logo muito grande (máximo 400 KB).");
    const r = new FileReader(); r.onload = () => setLogo(String(r.result)); r.readAsDataURL(arq);
  };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setOcupado(true);
    try {
      const r = await fetch("/api/workend/pagina", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, ...(logo ? { logoBase64: logo } : {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
      aoSalvar(); window.location.reload(); // como o cadastro e a entrada: a página volta já com a loja no ar
    } catch (x) { setErro((x as Error).message); }
    setOcupado(false);
  };
  return (
    <section className="faixa" id="pagina-gratis">
      <div className="pn-chegar">
        <div className="pn-chegar-texto">
          <span className="pn-gr-selo">Grátis, sem lote</span>
          <h2>{p ? "Editar a sua página" : "Sua página grátis"}</h2>
          <p>{p ? "O endereço da página não muda." : "Publique agora a página da sua empresa, com endereço próprio para mandar no WhatsApp e no Instagram."} Grátis para sempre: {d.maxGratis} produtos na vitrine, o botão de WhatsApp e a atendente de IA com {d.respostas} respostas por mês.</p>
          <form onSubmit={enviar} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="campo sm:col-span-2">Nome da empresa<input name="empresa" value={f.empresaNome} onChange={set("empresaNome")} autoComplete="organization" required minLength={2} maxLength={60} placeholder="Ex.: Padaria do Zé" /></label>
            <label className="campo">WhatsApp da loja<input name="whatsapp" type="tel" inputMode="tel" value={f.whatsapp} onChange={set("whatsapp")} autoComplete="tel" placeholder="(79) 99999-9999" /></label>
            <label className="campo">Instagram (opcional)<input name="instagram" value={f.instagram} onChange={set("instagram")} placeholder="@sualoja" /></label>
            <label className="campo sm:col-span-2">O que a empresa faz<textarea name="sobre" value={f.sobre} onChange={set("sobre")} rows={3} maxLength={600} placeholder="Ex.: Pães, bolos e salgados feitos na hora. Encomendas para festas." /></label>
            <label className="campo">Ramo<select name="nicho" value={f.nicho} onChange={set("nicho")}>{NICHOS.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}</select></label>
            <div className="campo"><span>Cor da marca</span>
              <div className="flex flex-wrap gap-2 pt-1">{CORES.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, cor: c })} className={`pn-gr-cor ${f.cor === c ? "pn-gr-cor-sim" : ""}`} style={{ background: c }} aria-label={`Cor ${c}`} aria-pressed={f.cor === c} />)}</div>
            </div>
            <label className="campo sm:col-span-2">Logomarca (opcional, até 400 KB)<input name="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => escolherLogo(e.target.files?.[0])} /></label>
            {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A] sm:col-span-2">{erro}</div>}
            <div className="flex flex-wrap gap-2.5 sm:col-span-2">
              <button type="submit" disabled={ocupado || f.empresaNome.trim().length < 2} className="btn btn-azul">{ocupado ? "Publicando…" : p ? "Salvar a página" : "Publicar minha página grátis"}</button>
              {aoCancelar && <button type="button" onClick={aoCancelar} className="btn btn-linha">Cancelar</button>}
            </div>
          </form>
        </div>
        <div className="pn-gr-previa" aria-hidden="true" style={{ ["--marca" as string]: f.cor }}>
          <div className="pn-gr-previa-cartao">
            {logo || p?.logo ? <img src={logo ?? p?.logo ?? ""} alt="" className="pn-logo" /> : <span className="pn-logo pn-logo-letra">{(f.empresaNome || "?").slice(0, 1).toUpperCase()}</span>}
            <b>{f.empresaNome || "Sua empresa"}</b>
            <small>{NICHOS.find((n) => n.id === f.nicho)?.nome ?? "Negócios"}</small>
            <span className="pn-gr-previa-btn"><Icone nome="telefone" tamanho={15} />Chamar no WhatsApp</span>
          </div>
        </div>
      </div>
    </section>
  );
}
