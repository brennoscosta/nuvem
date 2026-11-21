// Painel do dono, "Meu escritório" (refeito em 16/11/2026: "melhore totalmente essa página"). Três situações:
//  - loja aberta: o prédio da empresa, a semana em números, hoje na loja, o que falta para a loja ficar completa,
//    as ferramentas com prévia de verdade, a equipe de IA, a indicação e o catálogo de especialistas por setor;
//  - lote reservado: contagem da reserva e o preço do 1º mês já com a oferta;
//  - sem lote: o convite com o preço de entrada, os 3 passos e o catálogo.
//    WE-13 (21/11/2026): antes do convite, "Sua página grátis" (Plano Vitrine): publicar a página da loja sem pagar e, publicada,
//    o link, os 3 produtos e o atalho para editar (./_pagina-gratis.tsx).
// Os dados vêm de src/server/painel.ts; o movimento fica em ./_painel.tsx e ./painel.css.
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, empresasDoUsuario, ehAdmin, PRECO_LOTE, type Terreno } from "@/server/terrenos";
import { sedeDe } from "@/office/data/sedes";
import { painelDoDono, painelReserva, ofertaDeEntrada, saudacaoBR, type Painel, type Numero } from "@/server/painel";
import { resumoVendas } from "@/server/pedidos";
import { Rodape, SETORES, ESPECIALISTAS, DEMO } from "../_partes";
import { CabecalhoApp } from "../_cabecalho";
import { Contador, ContagemReserva, CopiarLink, Catalogo } from "./_painel";
import { Icone } from "@/office/ui/Icone";
import { MedirUmaVez } from "../_cookies";
import { AssinaturaPainel } from "./_assinatura"; // pagamento automático (WE-09)
import { LembretePerfil } from "../_lembrete-perfil"; // o que falta no perfil do cadastro (20/11/2026)
import { PaginaGratis, type DadosPaginaGratis } from "./_pagina-gratis"; // Plano Vitrine (WE-13)
import { paginaDoUsuario, perfilDaConta, empresaDaConta, PRODUTOS_VITRINE_GRATIS } from "@/server/planoVitrine";
import { vitrineResumo } from "@/server/vitrine";
import { enderecoAtual } from "@/server/enderecoLoja";
import { RESPOSTAS_MES_VITRINE } from "@/server/unidadesIA";
import type { Usuario } from "@/server/usuarios";
import { meta } from "../seo";
import "./painel.css";

export const metadata = meta({ titulo: "Meu escritório — WorkEnd", caminho: "/app", indexar: false });
export const dynamic = "force-dynamic";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

export default async function App() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar");
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  // as outras empresas da pessoa (17/11/2026): próprias e como sócia (sedes divididas)
  const outras = (await empresasDoUsuario(u.id).catch(() => [])).filter((e) => e.chave !== chao?.chave);
  const nome = u.nome.split(" ")[0];
  const empresa = chao?.empresaNome || u.empresaNome || `Empresa de ${nome}`;
  const { oi, data } = saudacaoBR();
  const ativo = chao?.status === "ativo";
  const [p, reserva, entrada, vendas, gratis] = await Promise.all([
    ativo && chao ? painelDoDono(u, chao).catch((e) => { console.error("[painel]", (e as Error).message); return null; }) : null,
    chao && !ativo ? painelReserva(u, chao) : null,
    !chao ? ofertaDeEntrada(u) : null,
    ativo ? resumoVendas(u.id).catch(() => null) : null, // pedidos pela atendente (17/11/2026)
    !chao ? dadosPaginaGratis(u).catch((e) => { console.error("[página grátis]", (e as Error).message); return null; }) : null,
  ]);
  const linkLote = chao ? (sedeDe(chao.chave) ? `/mundo?sede=${sedeDe(chao.chave)!.id}` : `/mundo?lote=${encodeURIComponent(chao.chave)}`) : "/mundo";

  return (
    <div className="pn">
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />

      <section className="faixa pn-oi">
        <p className="pn-data">{data}</p>
        <h1>{oi}, {nome}.</h1>
        <p className="pn-sub">
          {ativo ? <>A <b>{empresa}</b> está aberta no mapa. Veja como foi a semana e o que dá para fazer hoje.</>
            : chao ? <>Falta pagar o 1º mês para a <b>{empresa}</b> abrir as portas no mapa.</>
            : gratis?.pagina ? <>A página da <b>{gratis.pagina.empresaNome}</b> está no ar, grátis. Quando quiser, leve a loja para a cidade.</>
            : <>Publique agora a página grátis da sua empresa. O endereço na cidade vem quando você quiser.</>}
        </p>
        <LembretePerfil usuarioId={u.id} />
      </section>

      {ativo && chao && p ? <LojaAberta chao={chao} p={p} empresa={empresa} linkLote={linkLote} vendas={vendas} />
        : chao && reserva ? <Reservado chao={chao} r={reserva} linkLote={linkLote} />
        : <>{gratis && <PaginaGratis d={gratis} />}<SemLote fundador={entrada?.fundador ?? null} paginaNoAr={!!gratis?.pagina} /></>}

      {outras.length > 0 && (
        <section className="faixa pn-bloco">
          <div className="pn-titulo"><div><h2>Minhas empresas</h2><p>As outras empresas em que você é dono ou sócio. Cada uma tem a sua equipe de IA.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outras.map((e) => {
              const sd = sedeDe(e.chave);
              return (
                <div key={e.chave} className="rounded-2xl p-4 text-white shadow-lg" style={{ background: sd ? `linear-gradient(150deg, color-mix(in srgb, ${sd.cor} 32%, #0E1013), #0E1013)` : "var(--night)" }}>
                  {sd ? <img src={sd.logo} alt={e.nome} className="h-8 w-auto max-w-[70%] object-contain object-left" /> : <b className="text-lg">{e.nome}</b>}
                  <p className="mt-2 text-[13px] text-white/70">{sd ? `Sede · ${sd.tipo}` : "Loja"}{e.socio ? " · você é sócio" : " · você é o titular"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
                    <Link href={`/app/equipe?lote=${encodeURIComponent(e.chave)}`} className="rounded-lg bg-white px-3 py-1.5 text-[var(--ink)]">Minha equipe</Link>
                    <Link href={sd ? `/mundo?sede=${sd.id}` : `/mundo?lote=${encodeURIComponent(e.chave)}`} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15">Ver no mapa</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* catálogo: um setor por vez, com quem já está na equipe marcado */}
      <section className="faixa pn-bloco">
        <div className="pn-titulo">
          <div>
            <h2>Especialistas de IA para a sua equipe</h2>
            <p>Cada setor tem um gerente, que recebe suas ordens e aprova o que sai, e quem executa. Você contrata no mapa, em Contratar agentes, e conversa com eles em Minha equipe.</p>
          </div>
          <span className="pn-nota">{ESPECIALISTAS.length} prontos · incluídos no lote</span>
        </div>
        <Catalogo setores={SETORES.map(({ id, nome, cor, entrega }) => ({ id, nome, cor, entrega }))} especialistas={ESPECIALISTAS} contratados={p?.contratados ?? []}
          link={linkLote} rotulo={ativo ? "Contratar no mapa" : chao ? "Pagar o lote para contratar" : "Escolher lote para contratar"} />
      </section>

      <div className="h-16" />
      <Rodape />
    </div>
  );
}

// ======================= loja aberta =======================
type ResumoVendas = Awaited<ReturnType<typeof resumoVendas>>;
function LojaAberta({ chao, p, empresa, linkLote, vendas }: { chao: Terreno; p: Painel; empresa: string; linkLote: string; vendas: ResumoVendas | null }) {
  const dias = p.diasRestam ?? 0;
  const vencendo = p.diasRestam !== null && dias <= 5;
  const feitos = p.passos.filter((x) => x.feito).length;
  return (
    <>
      {/* a loja: o prédio da empresa, endereço, prazo e atalhos */}
      <section className="faixa">
        <div className="pn-loja" style={{ ["--marca" as string]: chao.cor || "#0A6CFF" }}>
          <div className="pn-loja-texto">
            <div className="flex items-center gap-3">
              {p.logo ? <img src={p.logo} alt="" className="pn-logo" /> : <span className="pn-logo pn-logo-letra" aria-hidden="true">{empresa.slice(0, 1)}</span>}
              <span className="pn-aberta"><i aria-hidden="true" />{p.inaugurouHoje ? "Inauguração hoje" : "Aberta no mapa"}</span>
            </div>
            <h2>{empresa}</h2>
            <p className="pn-endereco">{[p.sede ? "Sede no quarteirão sudeste" : null, p.numero ? `Loja nº ${p.numero}` : null, p.bairro?.nome, p.nicho].filter(Boolean).join(" · ")}</p>
            {p.promo && <p className="pn-promo-linha"><b>Promoção na fachada:</b> {p.promo.texto} <span>({p.promo.quando})</span></p>}
            <div className={`pn-prazo ${vencendo ? "pn-prazo-alerta" : ""}`}>
              <div className="pn-prazo-txt">
                <span>{p.diasRestam === null ? (p.sede ? `Sede ativa até ${p.pagoAte}` : "Lote ativo") : dias > 0 ? `Pago até ${p.pagoAte}` : "Venceu: você está na tolerância de 5 dias"}</span>
                {p.diasRestam !== null && dias > 0 && <b>{plural(dias, "dia", "dias")}</b>}
              </div>
              <div className="pn-prazo-trilho"><i style={{ width: `${p.sede ? 100 : Math.max(3, Math.min(100, (dias / 30) * 100))}%` }} /></div>
              {vencendo && <p className="pn-prazo-aviso">Renove pelo mapa para manter o endereço. Se o lote sair do mapa, a marca e a equipe ficam guardadas na conta.</p>}
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href={linkLote} className="btn btn-azul">{vencendo ? "Renovar no mapa" : "Ver minha loja no mapa"}</Link>
              {p.numero && <Link href={`/loja/${p.numero}`} className="btn pn-btn-vidro">Página da loja</Link>}
            </div>
          </div>
          {p.sede ? <div className="pn-predio pn-predio-sede" aria-hidden="true"><img src={p.sedeLogo ?? "/socialrp/logo.png"} alt="" width={809} height={240} /></div> : <div className="pn-predio" aria-hidden="true">
            <span className="pn-balao">{p.logo ? <img src={p.logo} alt="" /> : <i>{empresa.slice(0, 1)}</i>}<b>{empresa}</b></span>
            <img src={`/workend/predios/${p.layout}.webp`} alt="" width={420} height={400} />
          </div>}
        </div>
      </section>

      {!p.sede && <AssinaturaPainel chave={chao.chave} pagoAte={chao.pagoAte ? new Date(chao.pagoAte).toISOString() : null} linkPix={linkLote} />}

      {/* vendas do mês (17/11/2026): a linha que leva ao "Quanto a sua equipe trouxe", em Resultados */}
      {p.vendasMes && <VendasDoMes v={p.vendasMes} />}

      {/* a semana em números */}
      {p.semana && (
        <section className="faixa pn-bloco">
          <div className="pn-titulo">
            <div><h2>Sua loja nos últimos 7 dias</h2><p>Comparado com os 7 dias anteriores.{p.semana.topDia ? ` O dia mais movimentado foi ${p.semana.topDia}.` : ""}</p></div>
            <Link href="/app/resultados" className="pn-link">Ver resultados completos</Link>
          </div>
          <div className="pn-numeros">
            <CartaoNumero rotulo="Visitas na loja" n={p.semana.visitas} grande unidade={["visita", "visitas"]} />
            <CartaoNumero rotulo="Conversas com a equipe" n={p.semana.conversas} unidade={["conversa", "conversas"]} />
            <CartaoNumero rotulo="Cliques nos contatos" n={p.semana.cliques} unidade={["clique", "cliques"]} />
            {p.semana.horarios ? <CartaoNumero rotulo="Horários marcados" n={p.semana.horarios} unidade={["horário", "horários"]} />
              : <div className="pn-num pn-num-seg"><span className="pn-num-rot">Seguidores da loja</span><span className="pn-num-val"><Contador valor={p.seguidores.total} /></span><span className="pn-delta">{p.seguidores.novos ? `+${p.seguidores.novos} nos últimos 30 dias` : "Quem segue recebe suas promoções"}</span></div>}
          </div>
          {p.semana.horarios && <p className="pn-rodape-num">{p.seguidores.total ? <><b>{plural(p.seguidores.total, "pessoa segue", "pessoas seguem")}</b> a loja{p.seguidores.novos ? ` (+${p.seguidores.novos} nos últimos 30 dias)` : ""} e recebe as suas promoções.</> : <>Ninguém segue a loja ainda. Quem segue recebe as suas promoções e eventos no celular.</>}</p>}
        </section>
      )}

      {/* hoje + o que falta */}
      <section className="faixa pn-bloco pn-duas">
        <div className="pn-cartao">
          <h3>Hoje na loja</h3>
          <ul className="pn-hoje">
            {p.proximos.map((a) => (
              <li key={a.id}>
                <span className={`pn-hora ${a.hoje ? "pn-hora-hoje" : ""}`}><b>{a.hora}</b><small>{a.hoje ? "hoje" : a.dia}</small></span>
                <span className="min-w-0"><b className="block truncate">{a.servico}</b><small>com {a.nome}</small></span>
              </li>
            ))}
            {!p.proximos.length && (
              <li className="pn-hoje-vazio"><span className="pn-hora"><b>—</b></span><span><b className="block">{p.semana?.agendaLigada ? "Nenhum horário marcado" : "Agenda desligada"}</b><small>{p.semana?.agendaLigada ? "Quando alguém marcar, aparece aqui." : "Se você atende com hora marcada, ligue em Agenda."}</small></span></li>
            )}
            <li>
              <span className="pn-hoje-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /></svg></span>
              <span className="min-w-0"><b className="block">{p.visitantes24h ? plural(p.visitantes24h, "visitante falou", "visitantes falaram") + " com a atendente" : "Ninguém falou com a atendente hoje"}</b><small>{p.visitantes24h ? "Nas últimas 24 horas." : "Quem entra na loja pelo mapa é atendido por ela."}</small></span>
              {p.visitantes24h > 0 && <Link href="/app/equipe?aba=visitantes" className="pn-link">Ler</Link>}
            </li>
            {(vendas?.aguardando ?? 0) > 0 && (
              <li>
                <span className="pn-hoje-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z M9 8h6 M9 12h6" /></svg></span>
                <span className="min-w-0"><b className="block">{plural(vendas!.aguardando, "pedido esperando", "pedidos esperando")} pagamento</b><small>{reais(vendas!.valorAguardando / 100)} · confira no app do banco e confirme.</small></span>
                <Link href="/app/vendas?status=aguardando" className="pn-link">Ver</Link>
              </li>
            )}
            {(p.semana?.candidaturas ?? 0) > 0 && (
              <li>
                <span className="pn-hoje-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z M14 3v4h4" /></svg></span>
                <span className="min-w-0"><b className="block">{plural(p.semana!.candidaturas, "candidatura nova", "candidaturas novas")}</b><small>Nas suas vagas, nesta semana.</small></span>
                <Link href="/app/equipe?aba=vagas" className="pn-link">Ver</Link>
              </li>
            )}
            {p.avisosNaoLidos > 0 && (
              <li>
                <span className="pn-hoje-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20h4" /></svg></span>
                <span className="min-w-0"><b className="block">{plural(p.avisosNaoLidos, "aviso não lido", "avisos não lidos")}</b><small>Toque no sino, no alto da página.</small></span>
              </li>
            )}
          </ul>
          <Link href="/app/agenda" className="pn-link mt-4 inline-block">Abrir a agenda</Link>
        </div>

        <div className="pn-cartao">
          <div className="flex items-center gap-4">
            <Anel feitos={feitos} total={p.passos.length} />
            {/* WE-01: checklist_completo na 1ª vez que o dono vê os 6 itens prontos */}
            {p.passos.length > 0 && feitos === p.passos.length && <MedirUmaVez evento="checklist_completo" chave={`checklist:${chao.chave}`} />}
            <div>
              <h3>{feitos === p.passos.length ? "Sua loja está completa" : "Deixe a loja completa"}</h3>
              <p className="pn-mudo">{feitos === p.passos.length ? "Tudo montado. Agora é divulgar." : `${feitos} de ${p.passos.length} prontos. Lojas completas recebem mais conversas.`}</p>
            </div>
          </div>
          <ul className="pn-passos">
            {p.passos.map((x, i) => (
              <li key={x.id} className={x.feito ? "pn-feito" : ""} style={{ ["--i" as string]: i }}>
                <span className="pn-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" /></svg></span>
                <span className="min-w-0"><b className="block">{x.titulo}</b>{!x.feito && <small>{x.texto}</small>}</span>
                {!x.feito && <Link href={x.link} className="pn-passo-btn">{x.acao}</Link>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ferramentas da loja: cada uma mostra o que já tem */}
      <section className="faixa pn-bloco">
        <div className="pn-titulo"><div><h2>Ferramentas da loja</h2><p>Tudo o que aparece para o cliente no mapa e na página da loja.</p></div></div>
        <div className="pn-ferr">
          <Link href="/app/vitrine" className="pn-f pn-f-largo">
            <div className="pn-f-topo"><b>Vitrine</b><span>{p.vitrine.ativos} de {p.vitrine.max} produtos</span></div>
            <div className="pn-vitrine">
              {p.vitrine.primeiros.map((x) => (
                <figure key={x.id}>
                  {x.foto ? <img src={x.foto} alt="" loading="lazy" decoding="async" /> : <span className="pn-vitrine-letra" style={{ background: chao.cor }}>{x.nome.slice(0, 1)}</span>}
                  <figcaption><span className="truncate">{x.nome}</span>{x.preco !== null && <b>{reais(x.preco / 100)}</b>}</figcaption>
                </figure>
              ))}
              {Array.from({ length: Math.max(0, (p.vitrine.primeiros.length ? 4 : 3) - p.vitrine.primeiros.length) }).map((_, i) => <figure key={`v${i}`} className="pn-vitrine-vazio"><span>+</span></figure>)}
            </div>
            <p className="pn-f-rodape">{p.vitrine.ativos ? "Pedido pelo WhatsApp com vários produtos de uma vez." : "Mostre até 12 produtos com foto e preço."}</p>
          </Link>

          {/* vendas pela atendente (17/11/2026): pedido com o Pix do dono */}
          <Link href="/app/vendas" className="pn-f pn-f-largo">
            <div className="pn-f-topo"><b>Vendas</b><span>{vendas?.aguardando ? plural(vendas.aguardando, "pedido esperando", "pedidos esperando") : vendas?.semana ? `${plural(vendas.semana, "pedido", "pedidos")} em 7 dias` : "pela atendente de IA"}</span></div>
            <div className="pn-vendas">
              <span className="pn-recibo" aria-hidden="true" />
              <div className="min-w-0"><b className="pn-vendas-valor">{reais((vendas?.valorAguardando ?? 0) / 100)}</b><small className="block">esperando pagamento</small></div>
              {!!vendas?.ultimos.length && <ul className="pn-vendas-lista">{vendas.ultimos.map((o) => <li key={o.numero}><span className="truncate"><b>#{o.numero}</b> {o.nome}</span><span>{reais(o.total / 100)}</span></li>)}</ul>}
            </div>
            <p className={`pn-f-rodape ${vendas && !vendas.temPix ? "pn-vendas-alerta" : ""}`}>{vendas && !vendas.temPix ? "Cadastre a sua chave Pix para receber os pedidos." : "A atendente monta o pedido e passa o Pix com a sua chave."}</p>
          </Link>

          <Link href="/app/agenda" className="pn-f">
            <div className="pn-f-topo"><b>Agenda</b><span>{p.semana?.agendaLigada ? "ligada" : "desligada"}</span></div>
            <div className={`pn-cal ${p.semana?.agendaLigada ? "" : "pn-cal-off"}`}>
              <div className="pn-cal-folha"><small>{p.proximos[0] ? (p.proximos[0].hoje ? "hoje" : p.proximos[0].dia.split(" ")[0]) : p.hoje.semana}</small><b>{p.proximos[0]?.diaNum ?? p.hoje.num}</b></div>
              <div className="min-w-0">{p.proximos[0] ? <><b className="block">{p.proximos[0].hora}</b><small className="block truncate">{p.proximos[0].servico}</small></> : <small>{p.semana?.agendaLigada ? "Sem horários marcados" : "Ligue para receber horários"}</small>}</div>
            </div>
            <p className="pn-f-rodape">O cliente marca pelo mapa ou pedindo à atendente.</p>
          </Link>

          <Link href="/app/cupons" className="pn-f">
            <div className="pn-f-topo"><b>Cupons</b><span>{plural(p.cupons.ativos, "ativo", "ativos")}</span></div>
            <div className={`pn-ticket ${p.cupons.primeiro ? "" : "pn-ticket-vazio"}`} style={{ ["--marca" as string]: chao.cor || "#0A6CFF" }}>
              <b className="truncate">{p.cupons.primeiro ?? "Crie o primeiro cupom"}</b>
              <small className="truncate">{p.cupons.primeiro ? `${plural(p.cupons.pegos, "pego", "pegos")} · ${plural(p.cupons.usados, "usado", "usados")}` : "ex.: 10% na primeira compra"}</small>
            </div>
            <p className="pn-f-rodape">Cada cliente pega um código só dele, e você confere no balcão.</p>
          </Link>

          <Link href={linkLote} className="pn-f pn-f-largo">
            <div className="pn-f-topo"><b>Promoção na fachada</b><span>{p.promo ? p.promo.quando : "nenhuma agora"}</span></div>
            <div className={`pn-faixa ${p.promo ? "" : "pn-faixa-vazia"}`} style={{ ["--marca" as string]: chao.cor || "#0A6CFF" }}>
              {p.promo ? <div className="pn-faixa-rolo" aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <span key={i}>{p.promo!.texto}</span>)}</div> : <span>Ligue uma faixa de promoção na frente do prédio</span>}
              {p.promo && <span className="sr-only">{p.promo.texto}</span>}
            </div>
            <p className="pn-f-rodape">{p.promo ? "Quem segue a loja recebe o aviso no celular." : "Liga no cartão do lote, no mapa. Quem segue a loja é avisado."}</p>
          </Link>

          <Link href="/app/divulgar" className="pn-f pn-f-largo">
            <div className="pn-f-topo"><b>Divulgar</b><span>Stories e adesivo</span></div>
            <div className="pn-story" style={{ ["--marca" as string]: chao.cor || "#0A6CFF" }}>
              <span className="pn-story-tela"><span className="pn-qr" /><i className="pn-scan" /></span>
              <small>Imagem com QR Code e o seu link de indicação.</small>
            </div>
          </Link>

          <Link href="/app/equipe?aba=vagas" className="pn-f pn-f-largo">
            <div className="pn-f-topo"><b>Vagas</b><span>{plural(p.semana?.vagasAbertas ?? 0, "aberta", "abertas")}</span></div>
            <div className="pn-vagas">
              <span className="pn-folhas" aria-hidden="true"><i /><i /><i /></span>
              <small>{(p.semana?.candidaturas ?? 0) > 0 ? `${plural(p.semana!.candidaturas, "candidatura", "candidaturas")} nesta semana` : "Contrate gente de verdade pela cidade."}</small>
            </div>
          </Link>
        </div>
      </section>

      {/* equipe de IA + indicação */}
      <section className="faixa pn-bloco pn-duas pn-duas-larga">
        <div className="pn-equipe">
          <h3>Sua equipe está no escritório</h3>
          <p>{plural(p.equipe.length, "pessoa", "pessoas")} trabalhando: CEO, atendente{p.especialistas ? ` e ${plural(p.especialistas, "especialista", "especialistas")}` : ""}. Peça tarefas, aprove o que entregam e leia o que os visitantes perguntaram.</p>
          <ul className="pn-rostos">
            {p.equipe.slice(0, 9).map((m, i) => (
              <li key={m.id} style={{ ["--i" as string]: i }} title={`${m.nome} · ${m.cargo}`}>
                {m.foto ? <img src={m.foto} alt={`${m.nome}, ${m.cargo}`} width={56} height={56} /> : <span style={{ background: m.camisa }}>{m.nome.slice(0, 1)}</span>}
              </li>
            ))}
            {p.equipe.length > 9 && <li className="pn-rostos-mais"><span>+{p.equipe.length - 9}</span></li>}
          </ul>
          {/* medidor "Unidades de IA" (20/11/2026): saldo, consumo do mês e estimativa em respostas, nunca em tokens */}
          {p.ia.unidades?.cobrada ? (
            <div className="pn-ia" data-medidor-ia={p.ia.unidades.saldo}>
              <div className="flex justify-between gap-2 text-sm"><span>Unidades de IA</span><b>{p.ia.unidades.saldo.toLocaleString("pt-BR")} · ≈ {p.ia.unidades.respostas.toLocaleString("pt-BR")} respostas</b></div>
              <div className="pn-ia-trilho"><i style={{ width: `${Math.max(2, Math.min(100, (p.ia.unidades.saldo / Math.max(1, p.ia.unidades.mes)) * 100))}%`, ...(p.ia.unidades.esgotado ? { background: "#E2575B" } : p.ia.unidades.aviso ? { background: "#F59E0B" } : {}) }} /></div>
              <div className="mt-1 flex justify-between gap-2 text-[12px] opacity-80"><span>{p.ia.unidades.usadas.toLocaleString("pt-BR")} usadas neste mês{p.ia.unidades.esgotado ? " · acabaram" : p.ia.unidades.aviso ? " · restam menos de 20%" : ""}</span><Link href="/app/creditos#unidades" className="font-semibold underline">Comprar unidades</Link></div>
            </div>
          ) : (
            <div className="pn-ia">
              <div className="flex justify-between text-sm"><span>IA usada neste mês</span><b>{reais(p.ia.gasto)} de {reais(p.ia.teto)}</b></div>
              <div className="pn-ia-trilho"><i style={{ width: `${Math.max(2, Math.min(100, (p.ia.gasto / p.ia.teto) * 100))}%` }} /></div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/app/equipe" className="btn btn-azul">Falar com a equipe</Link>
            <Link href={linkLote} className="btn pn-btn-vidro">Contratar no mapa</Link>
          </div>
        </div>

        <div className="pn-cartao pn-indica">
          <h3>Indique um vizinho</h3>
          <p className="pn-mudo">Cada empresa que entrar pelo seu link e pagar o lote vale {p.indicacao.porEmpresa} créditos de bônus na sua carteira, que pagam a mensalidade, agentes e o que mais o WorkEnd vende. Ela ganha {p.indicacao.descontoIndicado}% no 1º mês.</p>
          {p.indicacao.codigo && p.indicacao.link ? (
            <>
              <div className="pn-codigo"><span>Seu código</span><b>{p.indicacao.codigo}</b></div>
              <p className="pn-link-ind">{p.indicacao.link}</p>
              <CopiarLink texto={p.indicacao.link} />
            </>
          ) : <p className="pn-mudo">O seu código aparece aqui em instantes. Recarregue a página.</p>}
          <dl className="pn-indica-num">
            <div><dt>Saldo de créditos</dt><dd><Contador valor={p.indicacao.credito} prefixo="" casas={2} /></dd></div>
            <div><dt>Indicações pagas</dt><dd>{p.indicacao.pagas}</dd></div>
            <div><dt>Esperando pagar</dt><dd>{p.indicacao.esperando}</dd></div>
          </dl>
        </div>
      </section>

      <Rede />
    </>
  );
}

function VendasDoMes({ v }: { v: { centavos: number; pedidos: number; aguardando: number } }) {
  return (
    <section className="faixa">
      <Link href="/app/resultados" className="pn-mes">
        <span className="pn-mes-txt">
          <span className="pn-mes-ico" aria-hidden="true"><Icone nome="sacola" tamanho={18} /></span>
          <span className="min-w-0">
            {v.pedidos ? <>Este mês: <b>{reais(v.centavos / 100)}</b> em vendas · <b>{plural(v.pedidos, "pedido", "pedidos")}</b>{v.aguardando > 0 && <small> · {v.aguardando} esperando o Pix</small>}</>
              : v.aguardando ? <>Este mês: <b>{plural(v.aguardando, "pedido", "pedidos")}</b> esperando o Pix</>
              : <>Este mês: nenhuma venda pela atendente ainda</>}
          </span>
        </span>
        <span className="pn-link">{v.pedidos || v.aguardando ? "Ver resultados" : "Como vender pela atendente"}</span>
      </Link>
    </section>
  );
}

function CartaoNumero({ rotulo, n, unidade, grande }: { rotulo: string; n: Numero; unidade: [string, string]; grande?: boolean }) {
  const max = Math.max(1, ...n.serie.map((s) => s.n));
  const dif = n.total - n.anterior;
  const pct = n.anterior > 0 ? Math.round((dif / n.anterior) * 100) : null;
  return (
    <div className={`pn-num ${grande ? "pn-num-grande" : ""}`}>
      <span className="pn-num-rot">{rotulo}</span>
      <span className="pn-num-val"><Contador valor={n.total} /></span>
      <span className={`pn-delta ${dif > 0 ? "pn-sobe" : dif < 0 ? "pn-desce" : ""}`}>
        {dif === 0 ? (n.total ? "igual à semana anterior" : "nenhuma ainda") : <><svg viewBox="0 0 10 10" aria-hidden="true"><path d={dif > 0 ? "M5 2l4 5H1z" : "M5 8L1 3h8z"} /></svg>{dif > 0 ? "+" : "−"}{plural(Math.abs(dif), unidade[0], unidade[1])}{pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}</>}
      </span>
      <div className="pn-barras" role="img" aria-label={`${rotulo} por dia: ${n.serie.map((s) => `${s.rotulo}, ${s.n}`).join("; ")}`}>
        {n.serie.map((s, i) => (
          <i key={s.rotulo} title={`${s.rotulo}: ${plural(s.n, unidade[0], unidade[1])}`} className={i === n.serie.length - 1 ? "pn-barra-hoje" : s.n === 0 ? "pn-barra-zero" : ""}
            style={{ height: `${s.n ? Math.max(10, (s.n / max) * 100) : 6}%`, ["--i" as string]: i }} />
        ))}
      </div>
      <div className="pn-barras-dias" aria-hidden="true">{n.serie.map((s, i) => <span key={s.rotulo}>{i === n.serie.length - 1 ? "hoje" : s.rotulo.split(" ")[0]}</span>)}</div>
    </div>
  );
}

function Anel({ feitos, total }: { feitos: number; total: number }) {
  const r = 24, c = 2 * Math.PI * r, f = total ? feitos / total : 0;
  return (
    <span className="pn-anel" role="img" aria-label={`${feitos} de ${total} prontos`}>
      <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r={r} className="pn-anel-fundo" /><circle cx="30" cy="30" r={r} className="pn-anel-cheio" style={{ strokeDasharray: c, ["--fim" as string]: c * (1 - f), ["--c" as string]: c }} /></svg>
      <b>{feitos}/{total}</b>
    </span>
  );
}

// ======================= lote reservado =======================
function Reservado({ chao, r, linkLote }: { chao: Terreno; r: { valor: number | null; base: number; oferta: { nome: string; detalhe: string } | null; creditoUsado: number; restaMs: number | null }; linkLote: string }) {
  return (
    <>
      <section className="faixa">
        <div className="pn-loja pn-loja-reserva" style={{ ["--marca" as string]: chao.cor || "#0A6CFF" }}>
          <div className="pn-loja-texto">
            <span className="pn-aberta pn-aberta-espera"><i aria-hidden="true" />Lote reservado</span>
            <h2>{chao.empresaNome}</h2>
            {r.restaMs !== null && <p className="mt-3"><ContagemReserva restaMs={r.restaMs} /></p>}
            <div className="pn-preco">
              <span>1º mês</span>
              {r.valor !== null && r.valor < r.base && <s>{reais(r.base)}</s>}
              <b>{reais(r.valor ?? r.base)}</b>
            </div>
            {r.oferta && <p className="pn-oferta"><b>{r.oferta.nome}.</b> {r.oferta.detalhe}</p>}
            {r.creditoUsado > 0 && <p className="pn-oferta">Inclui {reais(r.creditoUsado)} do seu crédito de indicação.</p>}
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href={linkLote} className="btn btn-azul btn-grande">Pagar com Pix no mapa</Link>
            </div>
          </div>
          <div className="pn-predio pn-predio-passo" aria-hidden="true"><img src="/workend/passos/fachada.webp" alt="" width={480} height={360} /></div>
        </div>
      </section>
      <Passos atual={2} />
      <Rede />
    </>
  );
}

// ======================= sem lote =======================
// Sua página grátis (Plano Vitrine, WE-13): a página da conta, o "Sobre" e os contatos, o endereço e os 3 produtos
async function dadosPaginaGratis(u: Usuario): Promise<DadosPaginaGratis> {
  const empId = empresaDaConta(u.id);
  const [pg, perfil, endereco, vit] = await Promise.all([paginaDoUsuario(u.id), perfilDaConta(u.id), enderecoAtual(empId), vitrineResumo(u.id, PRODUTOS_VITRINE_GRATIS)]);
  const publicada = pg?.publicadaEm ? pg : null;
  return {
    pagina: publicada ? { numero: publicada.numero, empresaNome: publicada.empresaNome, cor: publicada.cor, nicho: publicada.nicho, logo: publicada.temLogo ? `/api/terrenos/pagina-${publicada.numero}/logo?v=${new Date(publicada.atualizadoEm).getTime()}` : null } : null,
    endereco, sobre: perfil.sobre, whatsapp: perfil.contatos.whatsapp ?? "", instagram: perfil.contatos.instagram ?? "", nomeConta: u.empresaNome || "",
    produtos: vit.primeiros.map((x) => ({ id: x.id, nome: x.nome, preco: x.preco, foto: x.foto })), ativos: vit.ativos, maxGratis: PRODUTOS_VITRINE_GRATIS, respostas: RESPOSTAS_MES_VITRINE,
  };
}

function SemLote({ fundador, paginaNoAr = false }: { fundador: { valor: number; vagas: number; restam: number } | null; paginaNoAr?: boolean }) {
  return (
    <>
      <section className="faixa">
        <div className="pn-chegar">
          <div className="pn-chegar-texto">
            <h2>{paginaNoAr ? "Leve a mesma loja para a cidade" : "Escolha o endereço da sua empresa"}</h2>
            <p>Um lote de 20 × 20 m numa cidade 3D aberta 24 horas, com o seu prédio, a sua placa e uma equipe de IA atendendo quem passa.{paginaNoAr ? " A página, o endereço, a vitrine e a atendente continuam os mesmos, e a vitrine passa a mostrar até 12 produtos." : ""}</p>
            {fundador ? (
              <div className="pn-preco pn-preco-claro">
                <span>1º mês</span><s>{reais(PRECO_LOTE)}</s><b>{reais(fundador.valor)}</b>
                <small>Preço de fundador para as {fundador.vagas} primeiras empresas: {fundador.restam === 1 ? "resta 1 vaga" : `restam ${fundador.restam} vagas`}. Depois, {reais(PRECO_LOTE)} por mês.</small>
              </div>
            ) : (
              <div className="pn-preco pn-preco-claro"><span>Por mês</span><b>{reais(PRECO_LOTE)}</b><small>Pix direto no mapa. Sem fidelidade.</small></div>
            )}
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link prefetch={false} href="/mundo" className="btn btn-azul btn-grande">Escolher meu lote no mapa</Link>
              <a href={DEMO} target="_blank" rel="noreferrer" className="btn btn-linha btn-grande">Ver um escritório ao vivo</a>
            </div>
          </div>
          <div className="pn-chegar-img pn-rua" aria-hidden="true">
            <span className="pn-nuvem" /><span className="pn-nuvem pn-nuvem-2" />
            <span className="pn-chao" />
            <img className="pn-r1" src="/workend/predios/torre.webp" alt="" />
            <img className="pn-r2" src="/workend/predios/moderno.webp" alt="" />
            <span className="pn-vazio"><b>Seu lote</b></span>
            <img className="pn-r3" src="/workend/predios/loja.webp" alt="" />
          </div>
        </div>
      </section>
      <Passos atual={1} />
      <Rede encontrar />
    </>
  );
}

const PASSOS = [
  { img: "/workend/passos/lote.webp", titulo: "Escolha o lote", texto: "Ande pelo mapa, veja os bairros e reserve o lote por 1 hora." },
  { img: "/workend/passos/fachada.webp", titulo: "Ponha a sua marca", texto: "Nome e logomarca na placa, tipo de prédio e cores. Pague com Pix." },
  { img: "/workend/passos/equipe.webp", titulo: "A equipe começa a trabalhar", texto: "CEO e atendente de IA atendem quem entra. Contrate mais especialistas quando quiser." },
];
function Passos({ atual }: { atual: number }) {
  return (
    <section className="faixa pn-bloco">
      <div className="pn-titulo"><div><h2>Como a sua loja abre</h2></div></div>
      <ol className="pn-passos3">
        {PASSOS.map((x, i) => (
          <li key={x.titulo} className={i + 1 < atual ? "pn-p-feito" : i + 1 === atual ? "pn-p-agora" : ""} style={{ ["--i" as string]: i }}>
            <div className="pn-p-img"><img src={x.img} alt="" loading="lazy" decoding="async" width={480} height={360} /></div>
            <div className="pn-p-txt">
              <span className="pn-p-n">{i + 1 < atual ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg> : i + 1}</span>
              <div><b>{x.titulo}</b><p>{x.texto}</p></div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Rede({ encontrar }: { encontrar?: boolean }) {
  return (
    <section className="faixa pn-bloco">
      <div className="pn-rede">
        <svg className="pn-rede-svg" viewBox="0 0 160 90" aria-hidden="true">
          <path d="M22 60L62 24L104 46L140 18M62 24L78 74L104 46M22 60L78 74" />
          {[[22, 60], [62, 24], [104, 46], [140, 18], [78, 74]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 ? 9 : 6} style={{ ["--i" as string]: i }} />)}
        </svg>
        <div className="pn-rede-txt">
          <h3>Minha rede</h3>
          <p>Com um personagem você anda pelo mundo, fala com a equipe das lojas, faz amigos, negocia e faz chamadas com quem está online.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/app/rede" className="btn btn-tinta">Abrir minha rede</Link>
          {encontrar && <Link href="/encontrar" className="btn btn-linha">Encontrar profissionais</Link>}
        </div>
      </div>
    </section>
  );
}
