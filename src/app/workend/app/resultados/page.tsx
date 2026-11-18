// Resultados da loja (12/11/2026, ideia do dono): o que o lote de R$ 99/mês trouxe — visitas por dia, conversas com a
// atendente de IA, candidaturas às vagas, cliques nos contatos e na vitrine e agendamentos. Mais os próximos passos
// e o "Indique um vizinho" (link, quem chegou e o desconto acumulado).
// 17/11/2026 (pedido do dono: vendas e resultados para as empresas): no topo, "Quanto a sua equipe trouxe" em reais —
// vendas confirmadas, pedidos esperando o Pix, ticket médio, clientes novos, horários, conversas e o custo da IA, com
// uma frase-resumo; depois o funil (visitas → conversas → pedidos → pagos) e as vendas por dia. Um seletor de período só
// (este mês, últimos 30 dias, esta semana, 90 dias) vale para a página inteira. Os pedidos vêm de /app/vendas.
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { resultadosDoDono, vendasDoDono, janelaDe, PERIODOS, type Vendas, type Resultados as Res, type Janela } from "@/server/resultados";
import { TETO_IA_MES } from "@/server/equipeCliente";
import { meuCodigo, minhasIndicacoes, CREDITO_INDICACAO } from "@/server/ofertas";
import { seguidoresDe } from "@/server/seguir";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { meta } from "../../seo";
import { GraficoResultados, CompartilharIndicacao, type Metrica } from "./_grafico";
import { GraficoVendas, COR_VENDAS } from "./_vendas";
import { resumoCupons } from "@/server/cupons";
import { temNumero, rotuloLoja } from "@/office/data/numeroLoja";
import { Icone } from "@/office/ui/Icone";
import "./resultados.css";

export const metadata = meta({ titulo: "Resultados da loja — WorkEnd", caminho: "/app/resultados", indexar: false });
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ periodo?: string; dias?: string }> };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centavos = (c: number) => brl(c / 100);
// na frase: sem centavos quando o valor é redondo ou passa de R$ 100 (R$ 2.300, R$ 8,12)
const curto = (c: number) => { const v = c / 100; return v >= 100 || Number.isInteger(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }) : brl(v); };
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
const NOME_CLIQUE: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", site: "Site", email: "E-mail", produto: "Produtos da vitrine" };

export default async function Resultados({ searchParams }: Props) {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/resultados");
  const sp = await searchParams;
  // ?periodo=mes|semana|30|90; os links antigos com ?dias=7|30|90 continuam valendo
  const janela = janelaDe(sp.periodo ?? sp.dias ?? "mes");
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  const ativo = chao?.status === "ativo" ? chao : null;
  const [r, vendas, codigo, ind, seguidores] = await Promise.all([
    resultadosDoDono(u, ativo, janela.periodo),
    ativo ? vendasDoDono(u, janela).catch((e) => { console.error("[resultados] vendas:", (e as Error).message); return null; }) : null,
    meuCodigo(u).catch(() => null), minhasIndicacoes(u).catch(() => ({ lista: [], credito: 0 })), seguidoresDe(u.id, janela.dias).catch(() => ({ total: 0, novos: 0 })),
  ]);
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
    { t: "Divulgue o endereço da loja", d: "Mande o link da sua página no WhatsApp e no Instagram: cada visita entra aqui.", href: temNumero(r.lote?.numero) ? `/loja/${r.lote.numero}` : "/mundo", acao: "Abrir minha página" },
  ].filter(Boolean).slice(0, 4) as { t: string; d: string; href: string; acao: string }[];
  const cliquesTipos = Object.entries(r.cliques.porTipo).sort((a, b) => b[1] - a[1]);
  const maxClique = Math.max(1, ...cliquesTipos.map(([, n]) => n));
  const origemTotal = r.visitas.mapa + r.visitas.pagina;
  return (
    <>
      <CabecalhoApp atual="resultados" email={u.email} admin={ehAdmin(u)} />
      <section className="faixa pt-4">
        <div className="pg-topo" style={ativo ? ({ "--marca": ativo.cor } as React.CSSProperties) : undefined}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="pg-rotulo"><Icone nome="resultados" tamanho={15} />Resultados da loja{temNumero(r.lote?.numero) ? ` · ${rotuloLoja(r.lote.numero)}` : ""}</span>
              <h1>{ativo ? `O que a ${ativo.empresaNome} trouxe` : "Resultados da sua loja"}</h1>
            </div>
            {/* um período só para a página inteira; o "7 dias" (aviso semanal) aparece só quando é ele o escolhido */}
            <nav className="pg-acoes" aria-label="Período">
              {[...PERIODOS, ...(janela.periodo === "7" ? [{ id: "7", nome: "7 dias" }] : [])].map((p) => <Link key={p.id} href={`/app/resultados?periodo=${p.id}`} aria-current={janela.periodo === p.id ? "page" : undefined} className={`btn !px-4 !py-2 text-sm ${janela.periodo === p.id ? "btn-tinta" : "btn-claro"}`}>{p.nome}</Link>)}
            </nav>
          </div>
          {ativo && <p className="pg-sub"><b className="inline-flex items-center gap-1.5"><Icone nome="estrela" tamanho={16} className="text-[#F5C542]" />{seguidores.total} {seguidores.total === 1 ? "pessoa segue" : "pessoas seguem"} a sua loja</b>{seguidores.novos > 0 ? ` · ${seguidores.novos} ${seguidores.novos === 1 ? "nova" : "novas"} ${janela.rotulo}` : ""}. Quem segue recebe um aviso quando você liga uma promoção, marca um evento ou põe um produto novo.</p>}
          {!ativo && <p className="mt-4 max-w-[60ch] rounded-2xl bg-[#FFF4DB] px-4 py-3 text-[#5B4300]">Você ainda não tem uma loja aberta no mapa. Os números começam a contar quando o 1º mês do lote for pago. <Link prefetch={false} href="/mundo" className="font-semibold underline">Escolher meu lote</Link></p>}
        </div>
      </section>

      {ativo && vendas && <EquipeTrouxe r={r} v={vendas} j={janela} linkLoja={temNumero(r.lote?.numero) ? `/loja/${r.lote.numero}` : `/mundo?lote=${encodeURIComponent(ativo.chave)}`} />}

      <section className="faixa mt-8">
        <h2 className="rs-secao-titulo">Movimento da loja</h2>
        <p className="mt-1 text-[15px] text-[var(--tinta-2)]">Visitas, conversas, cliques, candidaturas e horários {janela.rotulo}, dia a dia.</p>
      </section>
      <section className="faixa mt-4">
        <GraficoResultados metricas={metricas} dias={r.dias} quando={janela.rotulo} />
      </section>

      <section className="faixa mt-6 grid gap-4 lg:grid-cols-2">
        <div className="pg-cartao p-5">
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
        <div className="pg-cartao p-5">
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
            <span><b className="inline-flex items-center gap-1.5 text-[17px] text-[#9F1239]"><Icone nome="cupom" tamanho={18} />Cupons</b><span className="mt-0.5 block text-[14px] text-[var(--tinta-2)]"><b className="text-[var(--tinta)] tabular-nums">{cupons.pegos}</b> pegos · <b className="text-[var(--tinta)] tabular-nums">{cupons.usados}</b> usados no período</span></span>
            <span className="text-[14px] font-semibold text-[#9F1239]">Criar e validar →</span>
          </Link>
          <Link href="/app/divulgar" className="flex items-center justify-between gap-3 rounded-2xl bg-[#1D2128] p-5 text-white hover:bg-black">
            <span><b className="inline-flex items-center gap-1.5 text-[17px]"><Icone nome="placa" tamanho={18} />Divulgar a loja</b><span className="mt-0.5 block text-[14px] text-white/70">Imagem para Stories e adesivo com QR Code</span></span>
            <span className="text-[14px] font-semibold">Abrir →</span>
          </Link>
        </section>
      )}

      <section id="indicacao" className="faixa mt-8 scroll-mt-6">
        <div className="rounded-2xl bg-[#EAF2FF] p-6 sm:p-7">
          <span className="text-[13px] font-semibold text-[var(--azul)]">Indique um vizinho</span>
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

// ======================= "Quanto a sua equipe trouxe" =======================
function EquipeTrouxe({ r, v, j, linkLoja }: { r: Res; v: Vendas; j: Janela; linkLoja: string }) {
  const conf = v.confirmadas, ag = v.aguardando, cn = v.clientesNovos;
  const ia = Math.round(v.iaBrl * 100); // em centavos, como as vendas
  const custo = ia > 0 ? <>custou <b>{curto(ia)}</b> de IA</> : <>não gastou nada de IA</>;
  const frase = conf.pedidos > 0 ? <>{j.Rotulo} a sua equipe trouxe <b>{curto(conf.centavos)}</b> em vendas e {custo}.</>
    : ag.pedidos > 0 ? <>{j.Rotulo} já há <b>{curto(ag.centavos)}</b> em pedidos esperando o Pix, e a equipe {custo}.</>
    : r.conversas.total > 0 ? <>{j.Rotulo} a sua equipe atendeu <b>{plural(r.conversas.total, "conversa", "conversas")}</b> e {custo}.</>
    : <>{j.Rotulo} a sua atendente ainda não conversou com ninguém.</>;
  const nota = conf.pedidos > 0 ? `Contam os pedidos pagos ou entregues, pelo dia do pagamento.${ia > 0 ? ` Cada R$ 1 de IA virou ${brl(conf.centavos / ia)} em vendas.` : ""}`
    : ag.pedidos > 0 ? "Quando o dinheiro cair na sua conta, marque o pedido como pago em Vendas."
    : "A primeira venda pela atendente aparece aqui. Faltam poucos passos:";
  const vitrineOk = r.produtosNaVitrine > 0;
  return (
    <>
      <section className="faixa mt-6">
        <div className="pg-cartao rs-trouxe">
          <div className="rs-trouxe-topo">
            <span className="rs-rotulo"><Icone nome="sacola" tamanho={16} />Quanto a sua equipe trouxe · {j.rotulo}</span>
            {v.temPedidos && <Link href="/app/vendas" className="rs-link">Abrir Vendas →</Link>}
          </div>
          <p className="rs-frase">{frase}</p>
          <p className="rs-frase-nota">{nota}</p>

          {v.temPedidos ? (
            <div className="rs-numeros">
              <div className="rs-num rs-num-destaque">
                <span><i className="rs-marca" aria-hidden="true" />Vendas confirmadas</span>
                <b>{centavos(conf.centavos)}</b>
                <small>{plural(conf.pedidos, "pedido pago ou entregue", "pedidos pagos ou entregues")}</small>
              </div>
              <div className="rs-num">
                <span>Aguardando pagamento</span>
                <b>{centavos(ag.centavos)}</b>
                <small>{plural(ag.pedidos, "pedido feito", "pedidos feitos")} {j.rotulo}{ag.pedidos > 0 && <> · <Link href="/app/vendas">confirmar</Link></>}</small>
              </div>
              <div className="rs-num">
                <span>Ticket médio</span>
                <b>{v.ticketCentavos !== null ? centavos(v.ticketCentavos) : "—"}</b>
                <small>por pedido pago</small>
              </div>
            </div>
          ) : (
            <ol className="rs-convite">
              <li className={vitrineOk ? "rs-feito" : ""}>
                <span className="rs-n">{vitrineOk ? <Icone nome="check" tamanho={16} /> : 1}</span>
                <div className="min-w-0"><b>Cadastre produtos na vitrine</b><p>Com foto e preço, a atendente oferece os produtos e anota o pedido na conversa.</p>
                  {vitrineOk ? <small>{plural(r.produtosNaVitrine, "produto", "produtos")} na vitrine</small> : <Link href="/app/vitrine">Montar a vitrine →</Link>}</div>
              </li>
              <li className={v.pixLigado ? "rs-feito" : ""}>
                <span className="rs-n">{v.pixLigado ? <Icone nome="check" tamanho={16} /> : 2}</span>
                <div className="min-w-0"><b>Ligue o Pix na página de Vendas</b><p>O cliente paga direto na sua chave Pix, e você confirma quando o dinheiro cair.</p>
                  {v.pixLigado ? <small>Pix ligado</small> : <Link href="/app/vendas">Ligar o Pix →</Link>}</div>
              </li>
              <li>
                <span className="rs-n">3</span>
                <div className="min-w-0"><b>Chame clientes para a loja</b><p>Mande o link da sua página no WhatsApp e no Instagram: quem chega conversa com a atendente.</p>
                  <Link href={linkLoja}>Abrir minha página →</Link></div>
              </li>
            </ol>
          )}

          <div className="rs-numeros">
            <div className="rs-num">
              <span>Clientes novos</span>
              <b>{cn.total.toLocaleString("pt-BR")}</b>
              <small>{cn.total ? `${plural(cn.peloContato, "deixou", "deixaram")} contato · ${plural(cn.compraram, "comprou", "compraram")}` : "contato na conversa ou compra"}</small>
            </div>
            <div className="rs-num">
              <span>Conversas atendidas</span>
              <b>{r.conversas.total.toLocaleString("pt-BR")}</b>
              <small>pela atendente de IA{r.conversas.total > 0 && <> · <Link href="/app/equipe?aba=visitantes">ler</Link></>}</small>
            </div>
            <div className="rs-num">
              <span>Horários marcados</span>
              <b>{(r.agendamentos?.total ?? 0).toLocaleString("pt-BR")}</b>
              <small>{r.agendaLigada ? "na agenda da loja" : <Link href="/app/agenda">abrir a agenda</Link>}</small>
            </div>
            <div className="rs-num">
              <span>Custo da IA</span>
              <b>{brl(v.iaBrl)}</b>
              <small>{j.periodo === "mes" ? `de ${brl(TETO_IA_MES)} por mês` : j.rotulo}</small>
            </div>
          </div>
        </div>
      </section>

      <section className={`faixa mt-4 rs-duas ${conf.pedidos > 0 ? "rs-duas-com-grafico" : ""}`}>
        {conf.pedidos > 0 && (
          <div className="pg-cartao rs-cartao">
            <h2>Vendas por dia</h2>
            <p className="rs-sub">Pedidos pagos ou entregues, pelo dia do pagamento. Passe o mouse ou toque numa barra para ver o dia.</p>
            <GraficoVendas serie={v.serie} quando={j.rotulo} />
          </div>
        )}
        <Funil r={r} v={v} j={j} />
      </section>
    </>
  );
}

// do visitante ao Pix: cada etapa com a taxa sobre a anterior; os pedidos são os feitos no período
function Funil({ r, v, j }: { r: Res; v: Vendas; j: Janela }) {
  const etapas = [
    { id: "visitas", nome: "Visitas à loja", n: r.visitas.total, cor: "#1D4ED8", verbo: "" },
    { id: "conversas", nome: "Conversas com a atendente", n: r.conversas.total, cor: "#16A34A", verbo: "conversaram com a atendente" },
    { id: "pedidos", nome: "Pedidos", n: v.funil.pedidos, cor: "#A78BFA", verbo: "viraram pedido" },
    { id: "pagos", nome: "Pagos", n: v.funil.pagos, cor: COR_VENDAS, verbo: "foram pagos" },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.n));
  const pct = (a: number, b: number) => (a > 0 ? Math.round((b / a) * 100) : null);
  const cada100 = r.visitas.total > 0 ? (v.funil.pagos / r.visitas.total) * 100 : 0;
  const rodape = r.visitas.total > 0 && v.funil.pagos > 0 ? <>De cada 100 visitas, <b>{cada100.toLocaleString("pt-BR", { maximumFractionDigits: cada100 < 10 ? 1 : 0 })}</b> viraram pedido pago.</>
    : v.funil.pedidos > 0 ? <>Os pedidos ainda esperam o Pix. Confirme em <Link href="/app/vendas" className="font-semibold text-[var(--azul)]">Vendas</Link> quando o dinheiro cair.</>
    : r.conversas.total > 0 ? <>Ninguém fez pedido ainda: com produtos na vitrine e o Pix ligado, a atendente anota o pedido na conversa.</>
    : <>Quando a loja receber visitas, o caminho até o Pix aparece aqui.</>;
  return (
    <div className="pg-cartao rs-cartao">
      <h2>Do visitante ao Pix</h2>
      <p className="rs-sub">Pedidos feitos {j.rotulo} e, desses, quantos já foram pagos.</p>
      <ol className="rs-etapas">
        {etapas.map((e, i) => {
          const t = i > 0 ? pct(etapas[i - 1].n, e.n) : null;
          return (
            <li key={e.id}>
              {/* acima de 100% (ex.: conversa de quem não abriu o cartão da loja) a taxa não ajuda: diz só que passou */}
              {i > 0 && <p className="rs-taxa">{t === null ? "—" : t > 100 ? "mais que na etapa anterior" : <><b>{t}%</b>{e.verbo}</>}</p>}
              <div className="rs-etapa-linha"><span>{e.nome}</span><b>{e.n.toLocaleString("pt-BR")}</b></div>
              <div className="rs-trilho" aria-hidden="true"><i style={{ width: `${e.n ? Math.max(1.5, (e.n / max) * 100) : 0}%`, background: e.cor }} /></div>
            </li>
          );
        })}
      </ol>
      <p className="rs-rodape">{rodape}</p>
    </div>
  );
}
