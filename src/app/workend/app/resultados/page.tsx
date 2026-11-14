// Resultados da loja (12/11/2026, ideia do dono): o que o lote de R$ 99/mês trouxe — visitas por dia, conversas com a
// atendente de IA, candidaturas às vagas, cliques nos contatos e na vitrine e agendamentos. Mais os próximos passos
// e o "Indique um vizinho" (link, quem chegou e o desconto acumulado).
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { resultadosDoDono } from "@/server/resultados";
import { meuCodigo, minhasIndicacoes, CREDITO_INDICACAO } from "@/server/ofertas";
import { seguidoresDe } from "@/server/seguir";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { meta } from "../../seo";
import { GraficoResultados, CompartilharIndicacao, type Metrica } from "./_grafico";
import { resumoCupons } from "@/server/cupons";

export const metadata = meta({ titulo: "Resultados da loja — WorkEnd", caminho: "/app/resultados", indexar: false });
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ dias?: string }> };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const NOME_CLIQUE: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", site: "Site", email: "E-mail", produto: "Produtos da vitrine" };

export default async function Resultados({ searchParams }: Props) {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/resultados");
  const dias = Number((await searchParams).dias) || 30;
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  const ativo = chao?.status === "ativo" ? chao : null;
  const [r, codigo, ind, seguidores] = await Promise.all([resultadosDoDono(u, ativo, dias), meuCodigo(u).catch(() => null), minhasIndicacoes(u).catch(() => ({ lista: [], credito: 0 })), seguidoresDe(u.id, dias).catch(() => ({ total: 0, novos: 0 }))]);
  const cupons = ativo ? await resumoCupons(u.id, r.desde).catch(() => ({ pegos: 0, usados: 0 })) : null; // cupons da loja (13/11/2026)
  const metricas: Metrica[] = [
    { id: "visitas", nome: "Visitas", total: r.visitas.total, anterior: r.visitas.anterior, cor: "#1D4ED8", serie: r.visitas.serie, explica: "Pessoas que abriram o cartão da loja no mapa ou a página da loja (cada pessoa conta uma vez por dia)." },
    { id: "conversas", nome: "Conversas", total: r.conversas.total, anterior: r.conversas.anterior, cor: "#16A34A", serie: r.conversas.serie, explica: "Visitantes que escreveram para a sua atendente de IA (cada pessoa, uma vez por dia)." },
    { id: "cliques", nome: "Cliques", total: r.cliques.total, anterior: r.cliques.anterior, cor: "#DB2777", serie: r.cliques.serie, explica: "Toques no WhatsApp, Instagram, site, e-mail e nos produtos da vitrine." },
    { id: "candidaturas", nome: "Candidaturas", total: r.candidaturas.total, anterior: r.candidaturas.anterior, cor: "#B45309", serie: r.candidaturas.serie, explica: "Pessoas que se candidataram às suas vagas." },
    ...(r.agendamentos ? [{ id: "agendamentos", nome: "Agendamentos", total: r.agendamentos.total, anterior: r.agendamentos.anterior, cor: "#0F766E", serie: r.agendamentos.serie, explica: "Horários marcados pelos clientes (no cartão, na página ou pela atendente)." }] : []),
  ];
  const promo = ativo?.promocao ?? null;
  const passos = [
    !promo && { t: "Ligue uma promoção na fachada", d: "Uma frase curta (“20% hoje”) aparece numa faixa no prédio, no balão e no mini-mapa.", href: ativo ? `/mundo?lote=${encodeURIComponent(ativo.chave)}` : "/mundo", acao: "Ligar no mapa" },
    !r.produtosNaVitrine && { t: "Monte a vitrine de produtos", d: "Fotos e preços na sua loja, com botão para o seu WhatsApp.", href: "/app/vitrine", acao: "Montar vitrine" },
    !r.agendaLigada && { t: "Abra a agenda", d: "Barbearia, clínica, aulas: o cliente escolhe o horário e a atendente também marca.", href: "/app/agenda", acao: "Abrir agenda" },
    !r.candidaturas.vagasAbertas && { t: "Está contratando? Abra uma vaga", d: "A placa “Estamos contratando” aparece no seu prédio e a vaga entra na busca.", href: "/app/equipe?aba=vagas", acao: "Abrir vaga" },
    r.visitas.total > 0 && !r.conversas.total && { t: "Treine a atendente", d: "Gente está abrindo a loja e ninguém conversou: dê uma saudação e o que ela deve oferecer.", href: ativo ? `/mundo?lote=${encodeURIComponent(ativo.chave)}` : "/mundo", acao: "Treinar no mapa" },
    { t: "Divulgue o endereço da loja", d: "Mande o link da sua página no WhatsApp e no Instagram: cada visita entra aqui.", href: r.lote?.numero ? `/loja/${r.lote.numero}` : "/mundo", acao: "Abrir minha página" },
  ].filter(Boolean).slice(0, 4) as { t: string; d: string; href: string; acao: string }[];
  const cliquesTipos = Object.entries(r.cliques.porTipo).sort((a, b) => b[1] - a[1]);
  const maxClique = Math.max(1, ...cliquesTipos.map(([, n]) => n));
  const origemTotal = r.visitas.mapa + r.visitas.pagina;
  return (
    <>
      <CabecalhoApp atual="resultados" email={u.email} admin={ehAdmin(u)} />
      <section className="faixa pt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--azul)]">Resultados da loja{r.lote?.numero ? ` · Lote ${r.lote.numero}` : ""}</span>
            <h1 className="mt-1 text-[2rem] lg:text-[2.4rem]">{ativo ? `O que a ${ativo.empresaNome} trouxe` : "Resultados da sua loja"}</h1>
          </div>
          <nav className="flex gap-1.5" aria-label="Período">
            {[7, 30, 90].map((d) => <Link key={d} href={`/app/resultados?dias=${d}`} className={`btn !px-4 !py-2 text-sm ${r.dias === d ? "btn-tinta" : "btn-claro"}`}>{d} dias</Link>)}
          </nav>
        </div>
        {ativo && <p className="mt-3 text-[15px] text-[var(--tinta-2)]"><b className="text-[var(--tinta)]">⭐ {seguidores.total} {seguidores.total === 1 ? "pessoa segue" : "pessoas seguem"} a sua loja</b>{seguidores.novos > 0 ? ` · ${seguidores.novos} ${seguidores.novos === 1 ? "nova" : "novas"} em ${r.dias} dias` : ""}. Quem segue recebe um aviso quando você liga uma promoção, marca um evento ou põe um produto novo.</p>}
        {!ativo && <p className="mt-4 max-w-[60ch] rounded-2xl bg-[#FFF4DB] px-4 py-3 text-[#7A5200]">Você ainda não tem uma loja aberta no mapa. Os números começam a contar quando o 1º mês do lote for pago. <Link href="/mundo" className="font-semibold underline">Escolher meu lote</Link></p>}
      </section>

      <section className="faixa mt-6">
        <GraficoResultados metricas={metricas} dias={r.dias} />
      </section>

      <section className="faixa mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--linha)] p-5">
          <h2 className="!text-[1.2rem] !leading-tight">De onde vieram as visitas</h2>
          {origemTotal ? (
            <>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--cinza)]" role="img" aria-label={`${r.visitas.mapa} pelo mapa e ${r.visitas.pagina} pela página da loja`}>
                <span style={{ width: `${(r.visitas.mapa / origemTotal) * 100}%`, background: "#1D4ED8" }} />
                <span className="border-l-2 border-white" style={{ width: `${(r.visitas.pagina / origemTotal) * 100}%`, background: "#93B4F5" }} />
              </div>
              <ul className="mt-3 space-y-1 text-[15px]">
                <li className="flex justify-between"><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#1D4ED8]" />Pelo mapa da cidade</span><b className="tabular-nums">{r.visitas.mapa}</b></li>
                <li className="flex justify-between"><span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#93B4F5]" />Pela página da loja (link)</span><b className="tabular-nums">{r.visitas.pagina}</b></li>
                <li className="flex justify-between text-[var(--tinta-2)]"><span>Com conta no WorkEnd</span><span className="tabular-nums">{r.visitas.logados} de {origemTotal}</span></li>
              </ul>
              {r.topDias && r.topDias.n > 0 && <p className="mt-3 text-[13px] text-[var(--tinta-2)]">Dia com mais visitas: <b className="text-[var(--tinta)]">{r.topDias.dia.split("-").reverse().slice(0, 2).join("/")}</b>, com {r.topDias.n}.</p>}
            </>
          ) : <p className="mt-2 text-[var(--tinta-2)]">Ainda sem visitas neste período. Divulgue o link da sua página e ligue uma promoção na fachada.</p>}
        </div>
        <div className="rounded-2xl border border-[var(--linha)] p-5">
          <h2 className="!text-[1.2rem] !leading-tight">O que mais tocaram</h2>
          {cliquesTipos.length ? (
            <ul className="mt-3 space-y-2">
              {cliquesTipos.map(([t, n]) => (
                <li key={t}>
                  <div className="flex justify-between text-[15px]"><span>{NOME_CLIQUE[t] ?? t}</span><b className="tabular-nums">{n}</b></div>
                  <div className="mt-1 h-2 rounded-full bg-[var(--cinza)]"><div className="h-2 rounded-full bg-[#DB2777]" style={{ width: `${(n / maxClique) * 100}%` }} /></div>
                </li>
              ))}
              {r.cliques.produtos.length > 0 && <li className="pt-1 text-[13px] text-[var(--tinta-2)]">Produtos mais pedidos: {r.cliques.produtos.map((p) => `${p.nome} (${p.n})`).join(", ")}.</li>}
            </ul>
          ) : <p className="mt-2 text-[var(--tinta-2)]">Ninguém tocou nos contatos ainda. Preencha o WhatsApp em <Link href="/app/equipe" className="font-semibold text-[var(--azul)]">Minha equipe › Sobre</Link> e monte a vitrine.</p>}
          {r.conversas.mensagens > 0 && <p className="mt-3 text-[13px] text-[var(--tinta-2)]">{r.conversas.mensagens} mensagens para a atendente. <Link href="/app/equipe" className="font-semibold text-[var(--azul)]">Ler as conversas</Link></p>}
        </div>
      </section>

      {ativo && passos.length > 0 && (
        <section className="faixa mt-6">
          <h2 className="!text-[1.5rem]">Próximos passos para trazer mais gente</h2>
          <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {passos.map((p, i) => (
              <li key={p.t} className="flex gap-4 rounded-2xl bg-[var(--cinza)] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--tinta)] text-[15px] font-bold text-white">{i + 1}</span>
                <div className="min-w-0"><b>{p.t}</b><p className="mt-0.5 text-[14px] text-[var(--tinta-2)]">{p.d}</p><Link href={p.href} className="mt-2 inline-block text-[14px] font-semibold text-[var(--azul)] hover:underline">{p.acao} →</Link></div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* cupons e divulgação (13/11/2026) */}
      {ativo && cupons && (
        <section className="faixa mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/app/cupons" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#E11D48]/50 bg-[#FFF5F7] p-5 hover:bg-[#ffe9ee]">
            <span><b className="text-[17px] text-[#9F1239]">🎟️ Cupons</b><span className="mt-0.5 block text-[14px] text-[var(--tinta-2)]"><b className="text-[var(--tinta)] tabular-nums">{cupons.pegos}</b> pegos · <b className="text-[var(--tinta)] tabular-nums">{cupons.usados}</b> usados no período</span></span>
            <span className="text-[14px] font-semibold text-[#9F1239]">Criar e validar →</span>
          </Link>
          <Link href="/app/divulgar" className="flex items-center justify-between gap-3 rounded-2xl bg-[#1D2128] p-5 text-white hover:bg-black">
            <span><b className="text-[17px]">📣 Divulgar a loja</b><span className="mt-0.5 block text-[14px] text-white/70">Imagem para Stories e adesivo com QR Code</span></span>
            <span className="text-[14px] font-semibold">Abrir →</span>
          </Link>
        </section>
      )}

      <section id="indicacao" className="faixa mt-8 scroll-mt-6">
        <div className="rounded-2xl bg-[#EAF2FF] p-6 sm:p-7">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--azul)]">Indique um vizinho</span>
          <h2 className="mt-1 !text-[1.7rem]">Traga outra empresa para a cidade e pague menos</h2>
          <p className="mt-2 max-w-[62ch] text-[var(--tinta-2)]">Quem chega pelo seu link tem 10% no 1º mês. Quando a empresa pagar, você ganha <b className="text-[var(--tinta)]">{brl(CREDITO_INDICACAO)} de desconto</b> na sua mensalidade (até metade de cada pagamento; o que sobrar fica para a próxima).{!ativo && " O link vale quando a sua loja estiver aberta no mapa."}</p>
          {codigo && ativo && <CompartilharIndicacao link={`https://workend.online/?ind=${codigo}`} codigo={codigo} />}
          <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="rounded-2xl bg-white px-5 py-4">
              <div className="text-[13px] text-[var(--tinta-2)]">Desconto acumulado</div>
              <div className="text-[1.8rem] font-bold tabular-nums">{brl(ind.credito)}</div>
              <div className="text-[12px] text-[var(--tinta-2)]">entra no próximo Pix do lote</div>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4">
              <div className="text-[13px] font-semibold">Quem chegou pelo seu link</div>
              {ind.lista.length ? (
                <ul className="mt-1 divide-y divide-[var(--linha)] text-[15px]">
                  {ind.lista.map((x, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span className="truncate">{x.nome}</span><span className={x.status === "liberada" ? "font-semibold text-[#166534]" : "text-[var(--tinta-2)]"}>{x.status === "liberada" ? `+ ${brl(x.credito)}` : x.status === "estornada" ? "pagamento devolvido" : "ainda não pagou"}</span></li>)}
                </ul>
              ) : <p className="mt-1 text-[14px] text-[var(--tinta-2)]">Ninguém ainda. Mande o link para um fornecedor, um cliente ou um amigo que tenha negócio.</p>}
            </div>
          </div>
        </div>
      </section>
      <div className="h-16" />
      <Rodape />
    </>
  );
}
