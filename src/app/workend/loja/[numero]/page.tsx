// Página pública da loja (11/11/2026): o endereço da empresa no WorkEnd para divulgar (workend.online/loja/N). Mostra o
// que a empresa faz, contatos, equipe, avaliações de quem já negociou e a conversa com a atendente de IA.
// Desde 12/11/2026 mostra também as vagas abertas ("Estamos contratando", com candidatura).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { lojaPublica } from "@/server/equipeCliente";
import { avaliacoesRecebidas } from "@/server/rede";
import { vagasAbertas } from "@/server/cidade";
import { ListaVagas, type VagaLista } from "../../_vagas";
import { Topo, Rodape } from "../../_partes";
import { meta } from "../../seo";
import { ConversaDaLoja } from "./_conversa";
import { headers } from "next/headers";
import { registrarVisitaDia } from "@/server/resultados";
import { obterTerreno } from "@/server/terrenos";
import { LinkRastreado, type TipoClique } from "@/office/ui/LinkRastreado";
import { AgendarLoja } from "@/office/ui/AgendarLoja";
import { BotaoSeguir } from "@/office/ui/BotaoSeguir";
import { PegarCupom } from "@/office/ui/PegarCupom";
import { VitrineLoja } from "@/office/ui/VitrineLoja";

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
  // painel de resultados do dono: uma visita por pessoa por dia (o próprio dono não conta)
  void registrarVisitaDia(await headers(), { chave: l.chave, donoId: l.donoId }, u?.id ?? null, "pagina");
  const [avals, vagasBrutas] = await Promise.all([avaliacoesRecebidas(l.donoId, 6).catch(() => []), vagasAbertas({ donoId: l.donoId }).catch(() => [])]);
  const vagas: VagaLista[] = vagasBrutas.map((v) => ({ ...v, criadoEm: new Date(v.criadoEm).toISOString() }));
  const ehDono = u?.id === l.donoId;
  const promo = (await obterTerreno(l.chave).catch(() => null))?.promocao ?? null; // promoção na fachada (12/11/2026)
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
          {promo && <p className="relative mt-5 inline-flex flex-wrap items-center gap-2 rounded-full bg-[#E11D48] px-4 py-1.5 text-[15px] font-bold shadow-lg">🏷️ {promo.texto}<span className="font-semibold text-white/80">· até {new Date(promo.ate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></p>}
          <div className="relative mt-6 flex flex-wrap gap-2">
            <BotaoSeguir numero={l.numero} claro />
            <Link href={`/mundo?lote=${encodeURIComponent(l.chave)}`} className="btn" style={{ background: "#fff", color: "var(--ink)" }}>Ver no mapa 3D</Link>
            {vagas.length > 0 && <a href="#vagas" className="btn border-white/40 bg-white/10" style={{ color: "#fff" }}><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[#FFD24A]" aria-hidden="true" />Estamos contratando · {vagas.length} {vagas.length === 1 ? "vaga" : "vagas"}</a>}
            {ehDono && <Link href="/app/equipe" className="btn border-white/40 bg-white/10" style={{ color: "#fff" }}>Esta é a sua loja · Minha equipe</Link>}
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            <section>
              <h2 className="text-[1.5rem]">O que a {l.nome} faz</h2>
              {l.sobre ? <p className="mt-3 max-w-[62ch] whitespace-pre-line text-[17px] leading-relaxed">{l.sobre}</p> : <p className="mt-3 text-[var(--tinta-2)]">A empresa ainda não escreveu a apresentação. Pergunte à atendente ao lado.</p>}
            </section>
            <VitrineLoja numero={l.numero} />
            {vagas.length > 0 && (
              <section id="vagas" className="scroll-mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[1.5rem]">Estamos contratando</h2>
                  <span className="text-sm text-[var(--tinta-2)]">{vagas.length} {vagas.length === 1 ? "vaga aberta" : "vagas abertas"} · <a href="/encontrar?tipo=vagas" className="font-semibold text-[var(--azul)] hover:underline">ver vagas de outras empresas</a></span>
                </div>
                <ListaVagas vagas={vagas} logado={!!u} destino={`/loja/${l.numero}#vagas`} mostrarEmpresa={false} ehDono={ehDono} />
              </section>
            )}
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
            <PegarCupom numero={l.numero} />
            <AgendarLoja numero={l.numero} cor={l.cor} />
            <ConversaDaLoja loja={l} logado={!!u} />
            <ContatosBloco c={l.contatos} numero={l.numero} />
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
function ContatosBloco({ c, numero }: { c: { whatsapp?: string; instagram?: string; site?: string; email?: string }; numero: number }) {
  const itens = [c.whatsapp && ["WhatsApp", `https://wa.me/${c.whatsapp.length <= 11 ? `55${c.whatsapp}` : c.whatsapp}`, c.whatsapp, "whatsapp"], c.instagram && ["Instagram", `https://instagram.com/${c.instagram}`, `@${c.instagram}`, "instagram"], c.site && ["Site", c.site, c.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), "site"], c.email && ["E-mail", `mailto:${c.email}`, c.email, "email"]].filter(Boolean) as string[][];
  if (!itens.length) return null;
  return (
    <div className="rounded-2xl border border-[var(--linha)] p-5">
      <b>Contatos</b>
      <ul className="mt-2 space-y-1.5">{itens.map(([t, href, rot, tipo]) => <li key={t} className="flex justify-between gap-3 text-[15px]"><span className="text-[var(--tinta-2)]">{t}</span><LinkRastreado numero={numero} tipo={tipo as TipoClique} href={href} target="_blank" rel="noreferrer nofollow" className="truncate font-semibold text-[var(--azul)] hover:underline">{rot}</LinkRastreado></li>)}</ul>
    </div>
  );
}
