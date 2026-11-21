// Página pública da loja (11/11/2026): o endereço da empresa no WorkEnd para divulgar (workend.online/loja/N). Mostra o
// que a empresa faz, contatos, equipe, avaliações de quem já negociou e a conversa com a atendente de IA.
// Desde 12/11/2026 mostra também as vagas abertas ("Estamos contratando", com candidatura).
// WE-11 (21/11/2026): o endereço da loja é workend.online/<slug> (src/proxy.ts reescreve para cá; regras em
// src/server/enderecoLoja.ts); /loja/N e os endereços antigos levam a ele com redirecionamento permanente. Cada loja tem
// título, descrição, endereço canônico, a imagem da fachada para a prévia do link (api/workend/loja/[numero]/fachada) e o
// JSON-LD LocalBusiness (seo.ts › jsonLdLoja). O botão de WhatsApp vai para o topo.
// 17/11/2026 (frente acabamento): visual novo (topo escuro na cor da marca, cartões brancos, celular primeiro, conversa logo
// depois do topo) e uma versão própria para as SEDES (números 0, 901, 902, 903 — data/sedes.ts): site oficial em destaque,
// áreas do site e os departamentos da equipe (contagem e chefe de cada um, sem o treino). Estilos em ../loja.css (.lj-).
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { LOTES, NICHOS } from "@/office/data/mundo";
import { QUIOSQUE_POR_NUMERO } from "@/office/data/quiosques";
import { SEDE_POR_NUMERO, SEDE_POR_ID, type Sede } from "@/office/data/sedes";
import { faixasDoDia, paraHHMM, agendaUsavel } from "@/office/data/agenda";
import { configDe } from "@/server/agenda";
import { lerEndereco, numeroDaEmpresa, enderecoDaLoja, versaoFachada } from "@/server/enderecoLoja";
import { rotuloLoja } from "@/office/data/numeroLoja";
import { NaoEncontrada } from "../../_nao-encontrada";
import { usuarioAtual } from "@/server/usuarios";
import { lojaPublica } from "@/server/equipeCliente";
import { avaliacoesRecebidas } from "@/server/rede";
import { vagasAbertas } from "@/server/cidade";
import { ListaVagas, type VagaLista } from "../../_vagas";
import { Topo, Rodape } from "../../_partes";
import { meta, jsonLdLoja } from "../../seo";
import { ConversaDaLoja } from "./_conversa";
import { headers } from "next/headers";
import { registrarVisitaDia } from "@/server/resultados";
import { obterTerreno } from "@/server/terrenos";
import { LinkRastreado, type TipoClique } from "@/office/ui/LinkRastreado";
import { AgendarLoja } from "@/office/ui/AgendarLoja";
import { BotaoSeguir } from "@/office/ui/BotaoSeguir";
import { PegarCupom } from "@/office/ui/PegarCupom";
import { VitrineLoja } from "@/office/ui/VitrineLoja";
import { Icone } from "@/office/ui/Icone";
import { NotaEstrelas, EstrelaMedia } from "@/office/ui/NotaEstrelas";
import type { Escritorio } from "@/office/data/escritorio";
import "../loja.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ numero: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type Loja = NonNullable<Awaited<ReturnType<typeof carregar>>>;

// generateMetadata e a página leem a loja uma vez só por requisição
const carregar = cache(async (numero: number) => lojaPublica(numero).catch(() => null));
// o que o endereço pede: /loja/N chega com o número; workend.online/<slug>, com o slug (sede: o id dela). Endereço antigo
// de uma empresa leva ao atual; endereço sem loja no ar dá null
const ehNumero = (p: string) => /^\d{1,6}$/.test(p);
const resolver = cache(async (p: string): Promise<{ antigo: false; numero: number } | { antigo: true; atual: string } | null> => {
  if (ehNumero(p)) return { antigo: false, numero: Number(p) };
  const sede = SEDE_POR_ID[p]; if (sede) return { antigo: false, numero: sede.numeroLoja };
  const e = await lerEndereco(p).catch((x: Error) => { console.error("[loja] endereço:", x.message); return null; });
  if (!e) return null;
  if (e.atual !== p) return { antigo: true, atual: e.atual };
  const numero = await numeroDaEmpresa(e.empresaId).catch((x: Error) => { console.error("[loja] endereço:", x.message); return null; });
  return numero == null ? null : { antigo: false, numero };
});
const enderecoDe = cache(async (l: Loja) => enderecoDaLoja(l).catch((x: Error) => { console.error("[loja] endereço:", x.message); return null; }));
// a busca do endereço (?ind= da indicação, por exemplo) segue no redirecionamento
async function comBusca(caminho: string, sp: Props["searchParams"]) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await sp)) for (const x of Array.isArray(v) ? v : v != null ? [v] : []) q.append(k, x);
  const s = q.toString(); return s ? `${caminho}?${s}` : caminho;
}
const imagemDaFachada = (l: Loja, slug: string | null) => ({ url: `/api/workend/loja/${l.numero}/fachada?v=${versaoFachada({ ...l, slug })}`, width: 1200, height: 630, alt: `Fachada da ${l.nome} no WorkEnd`, type: "image/jpeg" });
const linkZap = (z: string) => `https://wa.me/${z.length <= 11 ? `55${z}` : z}`;
const primeiraLetra = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// a primeira frase do "Sobre" (para o topo e o compartilhamento)
const resumoDe = (t: string, max = 200) => { const s = t.replace(/\s+/g, " ").trim(); const p = s.match(/^.{20,}?[.!?](\s|$)/)?.[0] ?? s; return p.length > max ? `${p.slice(0, max - 1).trimEnd()}…` : p.trim(); };

const tituloDe = (l: Loja, sede: Sede | null) => (sede ? `${l.nome} — sede no WorkEnd` : `${l.nome} · ${l.nicho} — WorkEnd`);
const descricaoDe = (l: Loja, sede: Sede | null) => resumoDe(l.sobre || (sede ? sede.resumo : `${l.nome} tem endereço no WorkEnd, a cidade 3D das empresas. Converse com a equipe e peça seu orçamento.`), 155);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { numero: p } = await params;
  const r = await resolver(p);
  const l = r && !r.antigo ? await carregar(r.numero) : null;
  if (!l) return meta({ titulo: "Loja fechada — WorkEnd", caminho: ehNumero(p) ? `/loja/${p}` : `/${p}`, indexar: false });
  const slug = await enderecoDe(l);
  const sede = SEDE_POR_NUMERO[l.numero] ?? null;
  return meta({ titulo: tituloDe(l, sede), descricao: descricaoDe(l, sede), caminho: slug ? `/${slug}` : `/loja/${l.numero}`, imagem: imagemDaFachada(l, slug) });
}

export default async function Pagina({ params, searchParams }: Props) {
  const { numero: p } = await params;
  const r = await resolver(p);
  if (!r) notFound();
  if (r.antigo) permanentRedirect(await comBusca(`/${r.atual}`, searchParams));
  const n = r.numero;
  // quiosque (20/11/2026): endereço próprio a partir de 101, com a mesma página
  const quiosque = QUIOSQUE_POR_NUMERO[n] ?? null;
  const lote = LOTES.find((x) => x.numero === n) ?? (quiosque ? { chave: quiosque.chave } : null);
  // lote duplo: o número da ampliação leva ao número da loja principal (um número só por loja, 17/11/2026)
  const t0 = lote ? await obterTerreno(lote.chave).catch(() => null) : null;
  const principal = t0?.anexoDe ? LOTES.find((x) => x.chave === t0.anexoDe) : null;
  if (principal) { // direto para o endereço da loja principal, sem passar por /loja/N de novo
    const lp = await carregar(principal.numero), sp = lp ? await enderecoDe(lp) : null;
    permanentRedirect(await comBusca(sp ? `/${sp}` : `/loja/${principal.numero}`, searchParams));
  }
  const l = await carregar(n);
  if (!l) {
    if (!lote) notFound();
    // a loja não está aberta: endereço livre (dá para reservar) ou empresa montando o escritório
    const livre = !t0 || (t0.status !== "ativo" && t0.status !== "reservado");
    return livre
      ? <NaoEncontrada livre chaveLote={lote.chave} titulo={quiosque ? `O quiosque ${n} está livre` : `O lote ${n} está livre`} texto={quiosque ? "Ninguém abriu este quiosque ainda. Reserve no mapa, ponha a marca da sua empresa no toldo e tenha a atendente de IA no balcão." : "Ninguém abriu loja neste endereço ainda. Reserve no mapa e ponha a marca da sua empresa na placa, com equipe de IA atendendo quem chega."} />
      : <NaoEncontrada chaveLote={lote.chave} titulo="Esta loja não está aberta agora" texto="A empresa deste endereço está montando o escritório ou com o aluguel em dia por pagar. Enquanto isso, passeie pela cidade e conheça as outras lojas." />;
  }
  const slug = await enderecoDe(l);
  if (ehNumero(p) && slug) permanentRedirect(await comBusca(`/${slug}`, searchParams)); // /loja/N leva ao endereço da loja
  const u = await usuarioAtual().catch(() => null);
  // painel de resultados do dono: uma visita por pessoa por dia (o próprio dono não conta)
  void registrarVisitaDia(await headers(), { chave: l.chave, donoId: l.donoId }, u?.id ?? null, "pagina");
  const sede = SEDE_POR_NUMERO[l.numero] ?? null;
  const [avals, vagasBrutas, terreno, agenda] = await Promise.all([
    avaliacoesRecebidas(l.donoId, 6).catch(() => []),
    vagasAbertas({ donoId: l.donoId }).catch(() => []),
    obterTerreno(l.chave).catch(() => null),
    sede ? null : configDe(l.donoId).catch(() => null), // horário de funcionamento do JSON-LD
  ]);
  // as vagas de quem é dono de várias empresas (sedes) não se misturam: só as desta
  const vagas: VagaLista[] = vagasBrutas.filter((v) => !("chave" in v) || (v as { chave?: string }).chave === l.chave).map((v) => ({ ...v, criadoEm: new Date(v.criadoEm).toISOString() }));
  const ehDono = u?.id === l.donoId || (!!u && (terreno?.socios ?? []).includes(u.id));
  const promo = terreno?.promocao ?? null; // promoção na fachada (12/11/2026)
  const cor = sede?.cor ?? l.cor;
  const linkMapa = sede ? `/mundo?sede=${sede.id}` : `/mundo?lote=${encodeURIComponent(l.chave)}`;
  // botão de WhatsApp no topo só sem atendente: com ela, o WhatsApp fica no topo da conversa (WE-14, ChatLoja) e nos contatos
  const zap = l.contatos.whatsapp && !l.atendente ? linkZap(l.contatos.whatsapp) : null;
  const caminho = slug ? `/${slug}` : `/loja/${l.numero}`;
  const horarios = agenda && agendaUsavel(agenda) ? [0, 1, 2, 3, 4, 5, 6].flatMap((dia) => faixasDoDia(agenda.horarios[String(dia)]).map(([a, b]) => ({ dia, abre: paraHHMM(a), fecha: paraHHMM(b) }))) : [];
  const ld = jsonLdLoja({ nome: l.nome, caminho, titulo: tituloDe(l, sede), descricao: descricaoDe(l, sede), nichoId: NICHOS.find((x) => x.nome === l.nicho)?.id ?? "negocios", logo: sede ? sede.icone : l.logo, imagem: imagemDaFachada(l, slug).url, contatos: l.contatos, horarios, avaliacao: l.avaliacao });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <Topo logado={!!u} nome={u?.nome} />
      <main className="faixa mt-4">
        <section className="pg-topo lj-topo" style={{ "--marca": cor, background: sede ? `linear-gradient(160deg, ${sede.escura}, #0E1013 75%)` : undefined } as React.CSSProperties} aria-label={l.nome}>
          <div className="min-w-0">
            {sede
              ? <img src={sede.logo} alt={l.nome} className="lj-logo-sede" />
              : l.logo ? <img src={l.logo} alt={`Logo da ${l.nome}`} className="lj-logo" /> : <span className="lj-logo lj-logo-letra" aria-hidden>{l.nome.slice(0, 2).toUpperCase()}</span>}
            <div className="pg-rotulo mt-4">{sede ? `Sede · ${primeiraLetra(sede.tipo)}` : `${rotuloLoja(l.numero)} · ${l.nicho}`}</div>
            <h1>{l.nome}</h1>
            <p className="lj-resumo">{resumoDe(l.sobre || (sede ? sede.resumo : "A empresa ainda não escreveu a apresentação. A atendente responde as suas dúvidas na hora."))}</p>
            <div className="lj-selos">
              <span className="lj-selo"><Avaliacao media={l.avaliacao.media} n={l.avaliacao.n} /></span>
              {l.atendente && <span className="lj-selo lj-selo-vivo"><i />{l.atendente.nome} atende agora</span>}
              {sede && <span className="lj-selo"><Icone nome="equipe" tamanho={14} />{l.equipe.length} agentes de IA</span>}
              {promo && <span className="lj-selo lj-promo"><Icone nome="etiqueta" tamanho={14} />{promo.texto} · até {new Date(promo.ate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
            <div className="pg-acoes mt-5">
              {sede && <a href={sede.site} target="_blank" rel="noopener" className="btn lj-btn-marca"><Icone nome="globo" tamanho={17} />Abrir {sede.dominio}</a>}
              {zap && !sede && <LinkRastreado numero={l.numero} tipo="whatsapp" href={zap} target="_blank" rel="noreferrer nofollow" className="btn lj-btn-marca"><Icone nome="telefone" tamanho={17} />Chamar no WhatsApp</LinkRastreado>}
              <Link prefetch={false} href={`${linkMapa}&entrar=1`} className={sede || zap ? "btn btn-linha" : "btn lj-btn-marca"}><Icone nome="casa" tamanho={17} />{sede ? "Entrar na sede" : "Entrar no prédio"}</Link>
              <Link prefetch={false} href={linkMapa} className="btn btn-linha"><Icone nome="mapa" tamanho={17} />Ver a loja na cidade</Link>
              <BotaoSeguir numero={l.numero} claro />
              {vagas.length > 0 && <a href="#vagas" className="btn btn-linha"><Icone nome="candidato" tamanho={17} />Contratando · {vagas.length} {vagas.length === 1 ? "vaga" : "vagas"}</a>}
              {ehDono && <Link href={`/app/equipe?lote=${encodeURIComponent(l.chave)}`} className="btn btn-linha"><Icone nome="equipe" tamanho={17} />{sede ? "Esta sede é sua · equipe" : "Esta é a sua loja · equipe"}</Link>}
            </div>
          </div>
          {l.atendente && (
            <aside className="lj-recepcao hidden lg:block" aria-label="Recepção">
              <div className="text-[12.5px] font-semibold text-white/60">Recepção</div>
              <div className="lj-recepcao-pessoa mt-2">
                <span className="lj-avatar" style={{ background: l.atendente.camisa }}>{l.atendente.nome.slice(0, 1)}</span>
                <span className="min-w-0"><b className="block truncate text-[16px] text-white">{l.atendente.nome}</b><span className="block truncate text-[13px] text-white/65">{l.atendente.cargo} · responde na hora</span></span>
              </div>
              <p className="mt-3 text-[13.5px] leading-snug text-white/75">{l.atendente.saudacao}</p>
              <a href="#conversa" className="btn lj-btn-marca mt-3 w-full !py-2.5 text-[14.5px]"><Icone nome="conversar" tamanho={16} />Conversar agora</a>
            </aside>
          )}
        </section>

        <div className="lj-grade">
          <div className="lj-lado">
            <div className="lj-o1"><ConversaDaLoja loja={l} logado={!!u} /></div>
            {!sede && <div className="lj-o3"><PegarCupom numero={l.numero} /></div>}
            {!sede && <div className="lj-o3"><AgendarLoja numero={l.numero} cor={l.cor} /></div>}
            <div className="lj-o4"><Contatos c={l.contatos} numero={l.numero} site={sede?.site} /></div>
          </div>

          <div className="lj-principal lj-o2">
            <section className="pg-cartao lj-bloco">
              <h2>{sede ? `Sobre ${l.nome}` : `O que a ${l.nome} faz`}</h2>
              {l.sobre ? <p className="lj-sobre">{l.sobre}</p> : <p className="lj-nota-txt">A empresa ainda não escreveu a apresentação. Pergunte à atendente: ela responde na hora.</p>}
            </section>

            {sede && <AreasDoSite sede={sede} />}
            {sede && terreno?.escritorio && <Departamentos e={terreno.escritorio} total={l.equipe.length} />}
            {!sede && <VitrineLoja numero={l.numero} />}

            {vagas.length > 0 && (
              <section id="vagas" className="pg-cartao lj-bloco scroll-mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2>Estamos contratando</h2>
                  <span className="text-sm text-[var(--tinta-2)]">{vagas.length} {vagas.length === 1 ? "vaga aberta" : "vagas abertas"} · <a href="/encontrar?tipo=vagas" className="font-semibold text-[var(--azul)] hover:underline">ver vagas de outras empresas</a></span>
                </div>
                <ListaVagas vagas={vagas} logado={!!u} destino={`${caminho}#vagas`} mostrarEmpresa={false} ehDono={ehDono} />
              </section>
            )}

            {!sede && l.equipe.length > 0 && (
              <section className="pg-cartao lj-bloco">
                <h2>Quem trabalha aqui</h2>
                <p className="lj-nota-txt">Equipe de agentes de IA da {l.nome}: atende, orça e passa o seu contato para quem decide.</p>
                <ul className="lj-equipe">
                  {l.equipe.map((m) => (
                    <li key={`${m.nome}-${m.cargo}`} className="lj-pessoa">
                      {m.foto ? <img src={m.foto} alt="" width={34} height={34} /> : <span aria-hidden>{m.nome.slice(0, 1)}</span>}
                      <span className="min-w-0"><b className="truncate">{m.nome}</b><small className="truncate">{m.cargo}</small></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="pg-cartao lj-bloco">
              <h2>Avaliações</h2>
              {avals.length ? (
                <ul className="mt-2">
                  {avals.map((a) => (
                    <li key={a.id} className="lj-aval">
                      <div className="flex flex-wrap items-baseline justify-between gap-2"><b>{a.deNome}</b><NotaEstrelas nota={a.nota} /></div>
                      {a.texto && <p className="mt-1 text-[15px]">{a.texto}</p>}
                      <small className="text-[var(--tinta-2)]">{a.titulo} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}</small>
                    </li>
                  ))}
                </ul>
              ) : <p className="lj-nota-txt">Ainda não há avaliações. Elas aparecem quando um negócio fechado pelo WorkEnd é concluído.</p>}
            </section>
          </div>
        </div>
      </main>
      <div className="h-16" />
      <Rodape />
    </>
  );
}

function Avaliacao({ media, n }: { media: number | null; n: number }) {
  if (!n || media == null) return <>Sem avaliações ainda</>;
  return <><EstrelaMedia />{media.toFixed(1).replace(".", ",")} · {n} {n === 1 ? "avaliação" : "avaliações"}</>;
}

// sedes: as áreas do site oficial, cada uma levando à página dela
function AreasDoSite({ sede }: { sede: Sede }) {
  return (
    <section className="pg-cartao lj-bloco" style={{ "--marca": sede.cor } as React.CSSProperties}>
      <h2>Áreas do site {sede.dominio}</h2>
      <p className="lj-nota-txt">As áreas que aparecem iluminadas na fachada da sede, no mapa.</p>
      <div className="lj-areas">
        {sede.areas.map((a) => (
          <a key={a.id} href={`${sede.site}${a.href}`} target="_blank" rel="noopener" className="lj-area"><span className="lj-ponto" style={{ background: a.cor }} aria-hidden />{a.nome}</a>
        ))}
      </div>
    </section>
  );
}

// sedes: os departamentos (tamanho de cada um e quem comanda), sem o treino de ninguém
function Departamentos({ e, total }: { e: Escritorio; total: number }) {
  const deps = e.setores.filter((s) => s.id !== "recepcao").map((s) => {
    const pessoas = e.equipe.filter((m) => (m.setorId ?? (m.papel === "ceo" ? "diretoria" : "")) === s.id);
    const chefe = pessoas.find((m) => m.nivel === "ceo") ?? pessoas.find((m) => m.nivel === "gerente") ?? pessoas.find((m) => m.nivel === "diretor") ?? null;
    return { s, n: pessoas.length, chefe };
  }).filter((d) => d.n > 0);
  if (!deps.length) return null;
  return (
    <section className="pg-cartao lj-bloco">
      <h2>Como a empresa se organiza</h2>
      <p className="lj-nota-txt">{total} agentes de IA em {deps.length} departamentos, cada um com um chefe que divide o trabalho com a equipe.</p>
      <div className="lj-barra" role="img" aria-label={deps.map((d) => `${d.s.nome}: ${d.n}`).join(", ")}>
        {deps.map((d, i) => <i key={d.s.id} title={`${d.s.nome}: ${d.n}`} style={{ flex: d.n, background: d.s.cor, animationDelay: `${0.1 + i * 0.05}s` }} />)}
      </div>
      <ul className="lj-deps">
        {deps.map((d) => (
          <li key={d.s.id} className="lj-dep">
            <span className="lj-ponto" style={{ background: d.s.cor }} aria-hidden />
            <span className="min-w-0"><b className="block truncate">{d.s.nome}</b>{d.chefe && <small className="truncate">{d.chefe.nome}, {d.chefe.nivel === "ceo" ? "CEO" : d.chefe.cargo.toLowerCase()}</small>}</span>
            <em>{d.n}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Contatos({ c, numero, site }: { c: Loja["contatos"]; numero: number; site?: string }) {
  const itens = [
    c.whatsapp && ["WhatsApp", linkZap(c.whatsapp), c.whatsapp, "whatsapp"],
    c.instagram && ["Instagram", `https://instagram.com/${c.instagram}`, `@${c.instagram}`, "instagram"],
    (c.site || site) && ["Site", (c.site || site) as string, ((c.site || site) as string).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), "site"],
    c.email && ["E-mail", `mailto:${c.email}`, c.email, "email"],
  ].filter(Boolean) as string[][];
  if (!itens.length) return null;
  return (
    <section className="pg-cartao lj-bloco">
      <h2 className="!text-[1.15rem]">Contatos</h2>
      <ul className="mt-2">{itens.map(([t, href, rot, tipo]) => <li key={t} className="lj-contato"><span className="text-[var(--tinta-2)]">{t}</span><LinkRastreado numero={numero} tipo={tipo as TipoClique} href={href} target="_blank" rel="noreferrer nofollow" className="truncate font-semibold text-[var(--azul)] hover:underline">{rot}</LinkRastreado></li>)}</ul>
    </section>
  );
}
