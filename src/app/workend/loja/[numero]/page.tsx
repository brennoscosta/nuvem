// Página pública da loja (11/11/2026): o endereço da empresa no WorkEnd para divulgar (workend.online/loja/N). Mostra o
// que a empresa faz, contatos, equipe, avaliações de quem já negociou e a conversa com a atendente de IA.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { lojaPublica } from "@/server/equipeCliente";
import { avaliacoesRecebidas } from "@/server/rede";
import { Topo, Rodape } from "../../_partes";
import { meta } from "../../seo";
import { ConversaDaLoja } from "./_conversa";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ numero: string }> };

async function carregar(numero: string) { return lojaPublica(Number(numero) | 0).catch(() => null); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { numero } = await params;
  const l = await carregar(numero);
  if (!l) return meta({ titulo: "Loja fechada — WorkEnd", caminho: `/loja/${numero}`, indexar: false });
  const resumo = (l.sobre || `${l.nome} tem endereço no WorkEnd, a cidade 3D das empresas. Converse com a equipe e peça seu orçamento.`).replace(/\s+/g, " ").slice(0, 155);
  return meta({ titulo: `${l.nome} · ${l.nicho} — WorkEnd`, descricao: resumo, caminho: `/loja/${numero}` });
}

export default async function Loja({ params }: Props) {
  const { numero } = await params;
  const l = await carregar(numero);
  if (!l) notFound();
  const u = await usuarioAtual().catch(() => null);
  const avals = await avaliacoesRecebidas(l.donoId, 6).catch(() => []);
  const ehDono = u?.id === l.donoId;
  return (
    <>
      <Topo logado={!!u} nome={u?.nome} />
      <main className="faixa mt-4">
        <section className="relative overflow-hidden rounded-[22px] p-7 text-white sm:p-10" style={{ background: `linear-gradient(135deg, ${l.cor}, #161C25 115%)` }}>
          <div className="loja-brilho" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center gap-5">
            {l.logo ? <img src={l.logo} alt={`Logo da ${l.nome}`} className="h-20 w-20 rounded-2xl bg-white object-contain p-1.5 shadow-xl" /> : <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/15 text-3xl font-black">{l.nome.slice(0, 2).toUpperCase()}</span>}
            <div className="min-w-0">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-white/75">Lote {l.numero} · {l.nicho}</span>
              <h1 className="mt-1 text-[2.2rem] sm:text-[3rem]" style={{ color: "#fff" }}>{l.nome}</h1>
              <span className="mt-1 inline-block rounded-full bg-white/90 px-3 py-1"><EstrelasTexto media={l.avaliacao.media} n={l.avaliacao.n} /></span>
            </div>
          </div>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Link href={`/mundo?lote=${encodeURIComponent(l.chave)}`} className="btn" style={{ background: "#fff", color: "var(--ink)" }}>Ver no mapa 3D</Link>
            {ehDono && <Link href="/app/equipe" className="btn border-white/40 bg-white/10" style={{ color: "#fff" }}>Esta é a sua loja · Minha equipe</Link>}
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            <section>
              <h2 className="text-[1.5rem]">O que a {l.nome} faz</h2>
              {l.sobre ? <p className="mt-3 max-w-[62ch] whitespace-pre-line text-[17px] leading-relaxed">{l.sobre}</p> : <p className="mt-3 text-[var(--tinta-2)]">A empresa ainda não escreveu a apresentação. Pergunte à atendente ao lado.</p>}
            </section>
            {l.equipe.length > 0 && (
              <section>
                <h2 className="text-[1.3rem]">Quem trabalha aqui</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {l.equipe.map((m) => (
                    <li key={`${m.nome}-${m.cargo}`} className="flex items-center gap-3 rounded-2xl bg-[var(--cinza)] p-3">
                      {m.foto ? <img src={m.foto} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-dim)] font-bold">{m.nome.slice(0, 1)}</span>}
                      <span className="min-w-0"><b className="block truncate">{m.nome}</b><small className="block truncate text-[var(--tinta-2)]">{m.cargo} · IA</small></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h2 className="text-[1.3rem]">Avaliações</h2>
              {avals.length ? (
                <ul className="mt-4 space-y-3">
                  {avals.map((a) => (
                    <li key={a.id} className="rounded-2xl border border-[var(--linha)] p-4">
                      <div className="flex items-baseline justify-between gap-2"><b>{a.deNome}</b><span className="text-[#B7791F]">{"★".repeat(a.nota)}<span className="text-[var(--line)]">{"★".repeat(5 - a.nota)}</span></span></div>
                      {a.texto && <p className="mt-1 text-[15px]">{a.texto}</p>}
                      <small className="text-[var(--tinta-2)]">{a.titulo} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}</small>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-[var(--tinta-2)]">Ainda não há avaliações. Elas aparecem quando um negócio fechado pelo WorkEnd é concluído.</p>}
            </section>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <ConversaDaLoja loja={l} logado={!!u} />
            <ContatosBloco c={l.contatos} />
          </aside>
        </div>
      </main>
      <div className="h-16" />
      <Rodape />
    </>
  );
}

function EstrelasTexto({ media, n }: { media: number | null; n: number }) {
  if (!n || media == null) return <span className="text-[13px] font-semibold text-[var(--tinta-2)]">Sem avaliações ainda</span>;
  return <span className="text-[13px] font-bold text-[#7A5A00]">★ {media.toFixed(1).replace(".", ",")} <span className="font-normal text-[var(--tinta-2)]">· {n} {n === 1 ? "avaliação" : "avaliações"}</span></span>;
}
function ContatosBloco({ c }: { c: { whatsapp?: string; instagram?: string; site?: string; email?: string } }) {
  const itens = [c.whatsapp && ["WhatsApp", `https://wa.me/${c.whatsapp.length <= 11 ? `55${c.whatsapp}` : c.whatsapp}`, c.whatsapp], c.instagram && ["Instagram", `https://instagram.com/${c.instagram}`, `@${c.instagram}`], c.site && ["Site", c.site, c.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")], c.email && ["E-mail", `mailto:${c.email}`, c.email]].filter(Boolean) as string[][];
  if (!itens.length) return null;
  return (
    <div className="rounded-2xl border border-[var(--linha)] p-5">
      <b>Contatos</b>
      <ul className="mt-2 space-y-1.5">{itens.map(([t, href, rot]) => <li key={t} className="flex justify-between gap-3 text-[15px]"><span className="text-[var(--tinta-2)]">{t}</span><a href={href} target="_blank" rel="noreferrer nofollow" className="truncate font-semibold text-[var(--azul)] hover:underline">{rot}</a></li>)}</ul>
    </div>
  );
}
