"use client";
// A busca de /encontrar: profissionais (personagens com perfil profissional) e empresas (lojas abertas no mapa).
import { useEffect, useMemo, useState } from "react";
import { NICHOS } from "@/office/data/mundo";
import { MiniAvatar } from "@/office/ui/Personagem";
import type { Perfil, Redes } from "@/office/personagemStore";

type Prof = { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; redes?: Redes; online: boolean; perfil: Perfil; nichoNome: string | null; reputacao: { media: number | null; n: number } };
type Emp = { numero: number; chave: string; nome: string; cor: string; nicho: string; nichoNome: string; logo: string | null; sobre: string; contatos: { whatsapp?: string; instagram?: string; site?: string; email?: string }; equipe: number; atendente: string | null; reputacao: { media: number | null; n: number } };
type Tipo = "profissionais" | "empresas";

function Nota({ r }: { r: { media: number | null; n: number } }) {
  if (!r.n || r.media == null) return <span className="text-[12px] text-[var(--tinta-2)]">sem avaliações</span>;
  return <span className="text-[12px] font-semibold text-[#7A5A00]">★ {r.media.toFixed(1).replace(".", ",")} <span className="font-normal text-[var(--tinta-2)]">({r.n})</span></span>;
}

export function Busca({ logado, euId, inicial }: { logado: boolean; euId: string | null; inicial: { tipo: Tipo; nicho: string; q: string } }) {
  const [tipo, setTipo] = useState<Tipo>(inicial.tipo);
  const [q, setQ] = useState(inicial.q);
  const [nicho, setNicho] = useState(inicial.nicho);
  const [disp, setDisp] = useState(false);
  const [online, setOnline] = useState(false);
  const [termo, setTermo] = useState(inicial.q);
  useEffect(() => { const t = setTimeout(() => setTermo(q), 300); return () => clearTimeout(t); }, [q]);
  // o resultado fica guardado com a busca que o gerou: mudar o filtro mostra "buscando" sem limpar o estado no efeito
  const busca = useMemo(() => { const p = new URLSearchParams({ tipo }); if (termo.trim()) p.set("q", termo.trim()); if (nicho) p.set("nicho", nicho); if (tipo === "profissionais" && disp) p.set("disponivel", "1"); if (tipo === "profissionais" && online) p.set("online", "1"); return p.toString(); }, [tipo, termo, nicho, disp, online]);
  const [resDe, setResDe] = useState<{ de: string; res: (Prof | Emp)[] } | null>(null);
  const res = resDe?.de === busca ? resDe.res : null;
  useEffect(() => {
    let vivo = true;
    fetch(`/api/workend/encontrar?${busca}`, { cache: "no-store" }).then((r) => r.json()).then((j) => vivo && setResDe({ de: busca, res: Array.isArray(j) ? j : [] })).catch(() => vivo && setResDe({ de: busca, res: [] }));
    const url = new URLSearchParams(); if (tipo === "empresas") url.set("tipo", "empresas"); if (nicho) url.set("nicho", nicho); if (termo.trim()) url.set("q", termo.trim());
    window.history.replaceState(null, "", `/encontrar${url.size ? `?${url}` : ""}`);
    return () => { vivo = false; };
  }, [busca, tipo, termo, nicho]);
  const entrar = (destino: string) => (logado ? destino : `/entrar?destino=${encodeURIComponent(destino)}`);
  const nomeNicho = useMemo(() => NICHOS.find((n) => n.id === nicho)?.nome, [nicho]);

  return (
    <main className="faixa mt-2">
      <section className="busca-topo relative overflow-hidden rounded-[22px] bg-[var(--night)] p-7 text-white sm:p-10">
        <div className="busca-grade" aria-hidden="true" />
        <div className="relative">
          <h1 className="text-[2.1rem] sm:text-[3rem]" style={{ color: "#fff" }}>Encontre quem resolve.</h1>
          <p className="mt-2 max-w-[56ch] text-white/75">Profissionais que atendem pelo WorkEnd e empresas com endereço no mapa 3D. Converse, peça orçamento e feche negócio com avaliação dos dois lados.</p>
          <div className="mt-6 inline-flex rounded-xl bg-white/10 p-1 text-sm font-semibold">
            {(["profissionais", "empresas"] as Tipo[]).map((t) => <button key={t} type="button" onClick={() => setTipo(t)} className={`rounded-lg px-4 py-2 transition ${tipo === t ? "bg-white text-[var(--tinta)]" : "text-white/80 hover:text-white"}`}>{t === "profissionais" ? "Profissionais" : "Empresas"}</button>)}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[var(--tinta)] shadow-xl">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--tinta-2)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="sr-only">Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 60))} placeholder={tipo === "profissionais" ? "Fotógrafo, designer, contador, Aracaju…" : "Padaria, estúdio, consultoria…"} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
          </label>
        </div>
      </section>

      <div className="sem-barra mt-5 flex gap-1.5 overflow-x-auto pb-1">
        <button type="button" onClick={() => setNicho("")} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${!nicho ? "bg-[var(--tinta)] text-white" : "bg-[var(--surface)] text-[var(--tinta-2)] hover:text-[var(--tinta)]"}`}>Todas as áreas</button>
        {NICHOS.map((n) => <button key={n.id} type="button" onClick={() => setNicho(n.id === nicho ? "" : n.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${nicho === n.id ? "bg-[var(--azul)] text-white" : "bg-[var(--surface)] text-[var(--tinta-2)] hover:text-[var(--tinta)]"}`}>{n.nome}</button>)}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--tinta-2)]">{res === null ? "Buscando…" : `${res.length} ${tipo === "profissionais" ? (res.length === 1 ? "profissional" : "profissionais") : res.length === 1 ? "empresa" : "empresas"}${nomeNicho ? ` em ${nomeNicho}` : ""}`}</span>
        {tipo === "profissionais" ? (
          <span className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={disp} onChange={(e) => setDisp(e.target.checked)} /> Disponíveis</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Online agora</label>
          </span>
        ) : res && res.length > 0 && <a href={`/mundo${nicho ? `?nicho=${nicho}` : ""}`} className="btn btn-claro !py-2 text-sm">{nicho ? `Acender ${res.length === 1 ? "esta" : `estas ${res.length}`} no mapa` : "Ver todas no mapa"}</a>}
      </div>

      {res && res.length === 0 && (
        <div className="mt-6 rounded-2xl bg-[var(--cinza)] p-8 text-center">
          <b className="text-[1.1rem]">{tipo === "profissionais" ? "Nenhum profissional com esse perfil ainda." : "Nenhuma empresa com esse perfil no mapa ainda."}</b>
          <p className="mt-1 text-[var(--tinta-2)]">{tipo === "profissionais" ? "Você é profissional? Monte o seu personagem e preencha o perfil profissional para aparecer aqui." : "Tem uma empresa? Escolha um lote no mapa e ela aparece aqui, com atendente de IA."}</p>
          <a href={tipo === "profissionais" ? "/mundo?personagem=1" : "/mundo"} className="btn btn-azul mt-4">{tipo === "profissionais" ? "Montar meu perfil" : "Escolher meu lote"}</a>
        </div>
      )}

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tipo === "profissionais" && (res as Prof[] | null)?.map((p, i) => (
          <li key={p.usuarioId} className="busca-cartao flex flex-col rounded-2xl border border-[var(--linha)] bg-[var(--surface)] p-5" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <div className="flex items-center gap-3">
              <span className="relative"><MiniAvatar boneco={p.boneco} roupa={p.roupa} tamanho={52} />{p.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#16A34A]" title="online agora" />}</span>
              <div className="min-w-0">
                <b className="block truncate text-[17px]">{p.nome}</b>
                <span className="block truncate text-sm text-[var(--tinta-2)]">{p.perfil.profissao || p.nichoNome || "Profissional"}</span>
                <Nota r={p.reputacao} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
              {p.perfil.disponivel ? <span className="rounded-full bg-[#E3F6EA] px-2 py-0.5 font-semibold text-[#166534]">disponível</span> : <span className="rounded-full bg-[var(--cinza)] px-2 py-0.5 font-semibold text-[var(--tinta-2)]">agenda cheia</span>}
              {p.perfil.local && <span className="rounded-full bg-[var(--cinza)] px-2 py-0.5">{p.perfil.local}</span>}
              {p.perfil.preco && <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 font-semibold text-[var(--azul)]">{p.perfil.preco}</span>}
            </div>
            {(p.perfil.servicos || p.bio) && <p className="mt-2 line-clamp-3 text-[14px] text-[var(--tinta-2)]">{p.perfil.servicos || p.bio}</p>}
            {p.perfil.portfolio.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{p.perfil.portfolio.slice(0, 3).map((t) => <a key={t.url} href={t.url} target="_blank" rel="noreferrer nofollow" className="text-[12px] font-semibold text-[var(--azul)] hover:underline">{t.titulo} ↗</a>)}</div>}
            {p.usuarioId !== euId && (
              <div className="mt-auto flex gap-2 pt-4">
                <a href={entrar(`/app/rede?com=${p.usuarioId}`)} className="btn btn-azul flex-1 !py-2.5 text-sm">Conversar</a>
                <a href={entrar(`/app/rede?com=${p.usuarioId}&negociar=1`)} className="btn btn-linha flex-1 !py-2.5 text-sm">Propor negócio</a>
              </div>
            )}
          </li>
        ))}
        {tipo === "empresas" && (res as Emp[] | null)?.map((e, i) => (
          <li key={e.chave} className="busca-cartao flex flex-col overflow-hidden rounded-2xl border border-[var(--linha)] bg-[var(--surface)]" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <div className="flex items-center gap-3 p-4 text-white" style={{ background: `linear-gradient(135deg, ${e.cor}, #161C25 140%)` }}>
              {e.logo ? <img src={e.logo} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" /> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 font-black">{e.nome.slice(0, 2).toUpperCase()}</span>}
              <div className="min-w-0"><b className="block truncate text-[17px]">{e.nome}</b><span className="text-[13px] text-white/80">Lote {e.numero} · {e.nichoNome}</span></div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center justify-between gap-2"><Nota r={e.reputacao} />{e.atendente && <span className="text-[12px] font-semibold text-[#16A34A]">● {e.atendente} atende agora</span>}</div>
              <p className="mt-2 line-clamp-3 text-[14px] text-[var(--tinta-2)]">{e.sobre || "A empresa ainda não escreveu a apresentação. A atendente responde suas dúvidas."}</p>
              <div className="mt-auto flex gap-2 pt-4">
                <a href={`/loja/${e.numero}`} className="btn btn-azul flex-1 !py-2.5 text-sm">Abrir a loja</a>
                <a href={`/mundo?lote=${encodeURIComponent(e.chave)}`} className="btn btn-linha flex-1 !py-2.5 text-sm">Ver no mapa</a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
