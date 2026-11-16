"use client";
// Painel "Minha rede": o personagem, pedidos de amizade, amigos (online, conversar, negociar, call), conversas e negociações.
// Usa a mesma store do mapa (usePersonagem) e a mesma janela de chamada.
import { useCallback, useEffect, useState } from "react";
import { usePersonagem, type Outro, type Amigo, type Negociacao } from "@/office/personagemStore";
import { MiniAvatar, CorpoChat, LinksRedes } from "@/office/ui/Personagem";
import { JanelaChamada } from "@/office/ui/Chamada";
import { PainelMissoes } from "./_missoes";
import { ComoFunciona } from "./_como";
import { Inclina } from "./_inclina";
import { Icone, type NomeIcone } from "@/office/ui/Icone";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
type Aba = "amigos" | "conversas" | "negociacoes";
const comoOutro = (a: { usuarioId: string; nome: string; boneco: string; roupa: string; bio?: string; online?: boolean; redes?: Amigo["redes"] }): Outro => ({ usuarioId: a.usuarioId, nome: a.nome, boneco: a.boneco, roupa: a.roupa, bio: a.bio ?? "", x: 0, z: 0, rot: 0, online: !!a.online, redes: a.redes, relacao: { status: "amigos", id: null } });

export function RedeDashboard({ nome }: { nome: string }) {
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const carregado = usePersonagem((s) => s.carregado);
  const preco = usePersonagem((s) => s.preco);
  const precoCheio = usePersonagem((s) => s.precoCheio);
  const amigos = usePersonagem((s) => s.amigos);
  const pedidos = usePersonagem((s) => s.listaPedidos);
  const negociacoes = usePersonagem((s) => s.negociacoes);
  const conversas = usePersonagem((s) => s.conversas);
  const outro = usePersonagem((s) => s.outroSelecionado);
  const painel = usePersonagem((s) => s.painel);
  const carregarRede = usePersonagem((s) => s.carregarRede);
  const batida = usePersonagem((s) => s.batida);
  const atualizarChat = usePersonagem((s) => s.atualizarChat);
  const abrirChat = usePersonagem((s) => s.abrirChat);
  const responderAmizade = usePersonagem((s) => s.responderAmizade);
  const desfazerAmizade = usePersonagem((s) => s.desfazerAmizade);
  const ligar = usePersonagem((s) => s.ligar);
  const [aba, setAba] = useState<Aba>("amigos");
  const [aviso, setAviso] = useState<string | null>(null);
  const [como, setComo] = useState(false);
  const fecharComo = useCallback(() => setComo(false), []);
  // carrega a rede e mantém presença (pra receber chamadas e ver quem está online) enquanto o painel está aberto
  useEffect(() => {
    void carregarRede();
    const t1 = setInterval(() => { if (document.visibilityState === "visible") { void batida(); } }, 4000);
    const t2 = setInterval(() => { if (document.visibilityState === "visible") void carregarRede(); }, 15000);
    const t3 = setInterval(() => { if (usePersonagem.getState().painel === "chat") void atualizarChat(); }, 2500);
    void batida();
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [carregarRede, batida, atualizarChat]);
  useEffect(() => {
    if (!carregado || !ativo) return;
    const q = new URLSearchParams(window.location.search); const com = q.get("com");
    if (!com || com === meu?.usuarioId) return;
    fetch(`/api/personagens/${encodeURIComponent(com)}`).then((r) => (r.ok ? r.json() : null)).then((p) => { if (!p) return; void abrirChat({ ...p, x: 0, z: 0, rot: 0, online: !!p.online }); setAba("conversas"); if (q.get("negociar")) setAviso(`Para propor um negócio a ${p.nome}, use o botão Negociar na conversa ao lado.`); }).catch(() => {});
    window.history.replaceState(null, "", "/app/rede");
  }, [carregado, ativo, meu?.usuarioId, abrirChat]);
  const recebidos = pedidos.filter((p) => p.direcao === "recebido");
  const abertas = negociacoes.filter((n) => n.status === "aberta" || (n.status === "entregue" && n.concluidaPor !== meu?.usuarioId));
  const online = amigos.filter((a) => a.online).length;
  const chamar = async (a: { usuarioId: string; nome: string; boneco: string; roupa: string; online?: boolean }) => { if (!a.online) { setAviso(`${a.nome} não está online agora.`); return; } const e = await ligar(a, true); setAviso(e); };

  if (!carregado) return <section className="faixa rd"><div className="rd-carregando"><span /><span /><span /></div></section>;
  if (!ativo) return (
    <section className="faixa rd">
      <div className="rd-topo">
        <h1>Minha rede</h1>
        <p>Com um personagem você anda pela cidade, entra nas lojas e faz negócios com quem está online.</p>
      </div>
      <div className="rd-heroi">
        <div className="rd-heroi-txt">
          <h2>{meu ? `${meu.nome}, falta ativar o seu personagem` : "Crie seu personagem e entre na cidade"}</h2>
          <p>O WorkEnd é uma rede de negócios em 3D: você entra nas lojas, fala com a equipe, conversa com quem está online, faz amigos, negocia e faz chamadas. Quem não tem personagem só olha.</p>
          <div className="rd-preco"><s>{brl(precoCheio)}</s><b>{brl(preco)}</b><span>por mês · promoção de lançamento</span></div>
          <div className="rd-botoes">
            <a href="/mundo?personagem=1" className="btn btn-azul btn-grande">{meu ? "Ativar no mapa com Pix" : "Montar meu personagem"}</a>
            <button type="button" onClick={() => setComo(true)} className="btn btn-linha btn-grande"><Icone nome="ajuda" tamanho={19} />Como funciona</button>
          </div>
          <ul className="rd-fatos">
            <li><Icone nome="cabide" tamanho={18} />12 visuais</li>
            <li><Icone nome="bone" tamanho={18} />11 acessórios</li>
            <li><Icone nome="raio" tamanho={18} />Pix, sem fidelidade</li>
          </ul>
        </div>
        <Inclina className="rd-heroi-img">
          <img src="/workend/rede/personagens.webp" alt="Quatro personagens do WorkEnd andando juntos por uma praça da cidade" width={1400} height={933} />
          <span className="rd-flut rd-flut-1" data-prof="60"><i className="rd-ponto" />Bia está online</span>
          <span className="rd-flut rd-flut-2" data-prof="90"><Icone nome="amizade" tamanho={16} />Novo amigo</span>
          <span className="rd-flut rd-flut-3" data-prof="40"><Icone nome="negociar" tamanho={16} />Negócio fechado</span>
        </Inclina>
      </div>
      <Recursos />
      <PainelMissoes />
      <ComoFunciona aberto={como} fechar={fecharComo} preco={preco} precoCheio={precoCheio} rotuloFinal={meu ? (ativo ? "Editar meu personagem" : "Ativar meu personagem") : "Montar meu personagem"} />
    </section>
  );
  return (
    <section className="faixa rd rd-ativo">
      <div className="rd-cabeca">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">{meu && <MiniAvatar boneco={meu.boneco} roupa={meu.roupa} tamanho={56} />}<div className="min-w-0"><h1>Minha rede</h1><p className="text-sm text-[var(--tinta-2)] sm:text-base">{meu?.nome ?? nome} · {amigos.length} amigo{amigos.length === 1 ? "" : "s"}{online > 0 && <span className="text-[#16A34A]"> · {online} online</span>}{meu?.pagoAte && <> · ativo até {dataBR(meu.pagoAte)}</>}</p></div></div>
        <div className="rd-acoes"><a href="/mundo" className="btn btn-azul"><Icone nome="pino" tamanho={18} />Entrar no mapa</a><a href="/mundo?personagem=1" className="btn btn-linha"><Icone nome="editar" tamanho={18} />Editar personagem</a><button type="button" onClick={() => setComo(true)} className="btn btn-linha"><Icone nome="ajuda" tamanho={18} />Como funciona</button></div>
      </div>
      {aviso && <div className="rd-aviso"><Icone nome="ajuda" tamanho={18} /><span className="flex-1">{aviso}</span><button onClick={() => setAviso(null)} aria-label="Fechar o aviso"><Icone nome="fechar" tamanho={16} /></button></div>}

      {recebidos.length > 0 && (
        <div className="rd-pedidos">
          <h3><Icone nome="amizade" tamanho={20} />{recebidos.length === 1 ? "1 pedido de amizade" : `${recebidos.length} pedidos de amizade`}</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {recebidos.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white p-3"><MiniAvatar boneco={p.boneco} roupa={p.roupa} tamanho={40} /><div className="min-w-0 flex-1"><div className="font-semibold">{p.nome}</div><div className="truncate text-xs text-[var(--tinta-2)]">{p.bio || `pediu em ${dataBR(p.criadoEm)}`}</div></div><button onClick={() => void responderAmizade(p.id, true)} className="rounded-lg bg-[#DB2777] px-3 py-1.5 text-xs font-bold text-white">Aceitar</button><button onClick={() => void responderAmizade(p.id, false)} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5 text-xs font-bold">Recusar</button></li>)}
          </ul>
        </div>
      )}

      <PainelMissoes />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="sem-barra flex gap-1 overflow-x-auto border-b border-[var(--linha)] whitespace-nowrap">
            {([["amigos", `Amigos · ${amigos.length}`, "amizade"], ["conversas", `Conversas · ${conversas.length}`, "conversar"], ["negociacoes", `Negociações${abertas.length ? ` · ${abertas.length} aberta${abertas.length > 1 ? "s" : ""}` : ""}`, "negociar"]] as [Aba, string, NomeIcone][]).map(([id, t, ic]) => <button key={id} onClick={() => setAba(id)} className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold sm:px-4 ${aba === id ? "border-[var(--azul)] text-[var(--azul)]" : "border-transparent text-[var(--tinta-2)]"}`}><Icone nome={ic} tamanho={17} />{t}</button>)}
          </div>
          {aba === "amigos" && (
            <ul className="mt-4 grid gap-3">
              {amigos.length === 0 && <li className="rd-vazio"><img src="/workend/rede/amizade.webp" alt="" width={120} height={120} /><span>Você ainda não tem amigos no WorkEnd. Entre no mapa, toque num personagem e peça amizade.</span></li>}
              {amigos.map((a) => (
                <li key={a.usuarioId} className="rounded-2xl border border-[var(--linha)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <MiniAvatar boneco={a.boneco} roupa={a.roupa} tamanho={48} />
                    <div className="min-w-0 flex-1 basis-40"><div className="flex items-center gap-2 font-semibold">{a.nome}{a.online ? <span className="rounded-full bg-[#E3F6EA] px-1.5 py-0.5 text-[10px] font-bold text-[#166534]">online</span> : <span className="text-[10px] text-[var(--tinta-2)]">offline</span>}</div><div className="truncate text-sm text-[var(--tinta-2)]">{a.bio || `amigos desde ${dataBR(a.desde)}`}</div></div>
                    <div className="flex gap-1.5 text-xs font-bold">
                      <button onClick={() => void abrirChat(comoOutro(a))} className="rd-acao rd-acao-azul"><Icone nome="conversar" tamanho={16} />Conversar</button>
                      <button onClick={() => { void abrirChat(comoOutro(a)); setAviso(`Use o botão Negociar dentro da conversa com ${a.nome}.`); }} className="rd-acao rd-acao-ouro"><Icone nome="negociar" tamanho={16} />Negociar</button>
                      <button onClick={() => void chamar(a)} className={`rd-acao ${a.online ? "rd-acao-verde" : "rd-acao-cinza"}`}><Icone nome="chamada" tamanho={16} />Chamada</button>
                      <button onClick={() => { if (window.confirm(`Desfazer a amizade com ${a.nome}?`)) void desfazerAmizade(a.usuarioId); }} className="rd-acao rd-acao-so" title="Desfazer amizade" aria-label={`Desfazer a amizade com ${a.nome}`}><Icone nome="fechar" tamanho={16} /></button>
                    </div>
                  </div>
                  {a.redes && Object.values(a.redes).some(Boolean) && <LinksRedes redes={a.redes} />}
                </li>
              ))}
            </ul>
          )}
          {aba === "conversas" && (
            <ul className="mt-4 grid gap-2">
              {conversas.length === 0 && <li className="rd-vazio"><img src="/workend/rede/conversar.webp" alt="" width={120} height={120} /><span>Nenhuma conversa ainda. Toque em Conversar num amigo ou em alguém no mapa.</span></li>}
              {conversas.map((c) => <li key={c.outroId}><button onClick={() => void abrirChat(comoOutro({ usuarioId: c.outroId, nome: c.nome, boneco: c.boneco, roupa: c.roupa, online: c.online }))} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left hover:bg-[var(--cinza)] ${outro?.usuarioId === c.outroId ? "border-[var(--azul)]" : "border-[var(--linha)]"}`}><MiniAvatar boneco={c.boneco} roupa={c.roupa} tamanho={40} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 font-semibold">{c.nome}{c.online && <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />}</div><div className="truncate text-sm text-[var(--tinta-2)]">{c.tipo === "negocio" || c.tipo === "negocio_status" ? <span className="inline-flex items-center gap-1"><Icone nome="negociar" tamanho={14} />{c.tipo === "negocio" ? "proposta" : "resposta da proposta"}</span> : c.tipo.startsWith("amizade") ? <span className="inline-flex items-center gap-1"><Icone nome="amizade" tamanho={14} />amizade</span> : c.ultimo}</div></div>{c.naoLidas > 0 && <span className="rounded-full bg-[var(--azul)] px-2 py-0.5 text-[11px] font-bold text-white">{c.naoLidas}</span>}<span className="text-xs text-[var(--tinta-2)]">{dataBR(c.quando)}</span></button></li>)}
            </ul>
          )}
          {aba === "negociacoes" && (
            <ul className="mt-4 grid gap-2">
              {negociacoes.length === 0 && <li className="rd-vazio"><img src="/workend/rede/negociar.webp" alt="" width={120} height={120} /><span>Nenhuma negociação ainda. Abra uma conversa e toque em Negociar.</span></li>}
              {negociacoes.map((n) => <CartaoNegocio key={n.id} n={n} euId={meu?.usuarioId ?? ""} conversar={() => void abrirChat(comoOutro({ usuarioId: n.outroId, nome: n.outroNome, boneco: n.outroBoneco, roupa: n.outroRoupa }))} />)}
            </ul>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {painel === "chat" && outro ? (
            <div className="painel-entra fixed inset-x-0 bottom-0 z-40 flex h-[78vh] flex-col overflow-hidden rounded-t-2xl border border-[var(--linha)] bg-white shadow-2xl lg:static lg:h-[min(70vh,600px)] lg:rounded-2xl lg:shadow-none">
              <div className="flex items-center justify-between border-b border-[var(--linha)] p-3"><div className="flex items-center gap-2"><MiniAvatar boneco={outro.boneco} roupa={outro.roupa} tamanho={36} /><div><div className="text-sm font-bold leading-tight">{outro.nome}</div><div className="text-[11px] text-[var(--tinta-2)]">{outro.online ? <span className="text-[#16A34A]">● online · ao vivo</span> : "offline · recebe quando entrar"}</div></div></div><button onClick={() => usePersonagem.getState().fechar()} aria-label="Fechar a conversa" className="grid h-8 w-8 place-items-center rounded-full text-[var(--tinta-2)] hover:bg-[var(--cinza)]"><Icone nome="fechar" tamanho={18} /></button></div>
              <CorpoChat o={outro} altura="flex-1" />
            </div>
          ) : (
            <div className="rd-aside-vazio hidden lg:block"><img src="/workend/rede/conversar.webp" alt="" width={360} height={360} /><b>Escolha alguém para conversar</b><span>Toque em Conversar num amigo ou numa conversa. Propostas e chamadas saem daqui também.</span></div>
          )}
        </aside>
      </div>
      <JanelaChamada />
      <ComoFunciona aberto={como} fechar={fecharComo} preco={preco} precoCheio={precoCheio} rotuloFinal={meu ? (ativo ? "Editar meu personagem" : "Ativar meu personagem") : "Montar meu personagem"} />
    </section>
  );
}

const ETAPA: Record<string, [string, string]> = {
  aberta: ["Aberta", "#D97706"], aceita: ["Em andamento", "#16A34A"], entregue: ["Esperando confirmação", "#7C3AED"],
  concluida: ["Concluída", "#1D4ED8"], recusada: ["Recusada", "#E2575B"], cancelada: ["Cancelada", "#E2575B"],
};
// Um negócio com as etapas de 11/11/2026: aceitar, marcar como concluído (o outro confirma) e avaliar
function CartaoNegocio({ n, euId, conversar }: { n: Negociacao; euId: string; conversar: () => void }) {
  const responder = usePersonagem((s) => s.responderNegociacao);
  const avaliar = usePersonagem((s) => s.avaliarNegociacao);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const minha = n.deId === euId;
  const [rotulo, cor] = ETAPA[n.status] ?? [n.status, "#5B6472"];
  const faz = async (st: "aceita" | "recusada" | "cancelada" | "concluida") => { setErro(null); const e = await responder(n.id, st); if (e) setErro(e); };
  const enviarNota = async () => { if (!nota) return; setEnviando(true); const e = await avaliar(n.id, nota, texto); setEnviando(false); if (e) setErro(e); };
  const pedi = n.status === "entregue" && n.concluidaPor === euId;
  return (
    <li className="rounded-2xl border border-[var(--linha)] p-4">
      <div className="flex flex-wrap items-start gap-3">
        <MiniAvatar boneco={n.outroBoneco} roupa={n.outroRoupa} tamanho={40} />
        <div className="min-w-0 flex-1"><div className="text-xs text-[var(--tinta-2)]">{minha ? `Você propôs pra ${n.outroNome}` : `${n.outroNome} propôs pra você`} · {dataBR(n.criadoEm)}</div><div className="font-semibold">{n.titulo}</div>{n.texto && <div className="text-sm text-[var(--tinta-2)]">{n.texto}</div>}{n.valor != null && <div className="mt-0.5 text-sm font-bold">{brl(Number(n.valor))}</div>}</div>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: cor }}>{rotulo}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
        {n.status === "aberta" && !minha && <><button onClick={() => void faz("aceita")} className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-white">Aceitar</button><button onClick={() => void faz("recusada")} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5">Recusar</button></>}
        {n.status === "aberta" && minha && <button onClick={() => void faz("cancelada")} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5">Cancelar</button>}
        {n.status === "aceita" && <button onClick={() => void faz("concluida")} className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-white">Marcar como concluído</button>}
        {n.status === "entregue" && !pedi && <><button onClick={() => void faz("concluida")} className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-white">Confirmar que foi concluído</button><button onClick={() => void faz("aceita")} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5">Ainda não terminou</button></>}
        {pedi && <span className="rounded-lg bg-[#F3EEFF] px-3 py-1.5 text-[#5B21B6]">Esperando {n.outroNome} confirmar</span>}
        <button onClick={conversar} className="inline-flex items-center gap-1 rounded-lg bg-[#EEF3FF] px-3 py-1.5 text-[#1D4ED8]"><Icone nome="conversar" tamanho={15} />Conversar</button>
      </div>
      {n.status === "concluida" && (n.minhaNota ? (
        <div className="mt-3 text-sm text-[var(--tinta-2)]">Você avaliou {n.outroNome}: <span className="text-[#B7791F]">{"★".repeat(n.minhaNota)}</span></div>
      ) : (
        <div className="mt-3 rounded-xl bg-[var(--cinza)] p-3">
          <div className="text-sm font-semibold">Como foi negociar com {n.outroNome}?</div>
          <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">{[1, 2, 3, 4, 5].map((k) => <button key={k} type="button" role="radio" aria-checked={nota === k} onClick={() => setNota(k)} className={`text-2xl transition ${k <= nota ? "scale-110 text-[#E8A317]" : "text-[var(--line-strong)] hover:text-[#E8A317]"}`}>★</button>)}</div>
          <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 400))} placeholder="Conte em uma frase (opcional; aparece no perfil dela)" className="mt-2 w-full rounded-lg border border-[var(--linha)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--azul)]" />
          <button type="button" disabled={!nota || enviando} onClick={() => void enviarNota()} className="btn btn-azul mt-2 !py-2 text-sm">{enviando ? "Enviando…" : "Enviar avaliação"}</button>
        </div>
      ))}
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
    </li>
  );
}

// Os quatro recursos do personagem (16/11/2026): cartões de tamanhos diferentes, cada um com a sua cena 3D
const RECURSOS: { id: string; icone: NomeIcone; titulo: string; texto: string; img: string; alt: string }[] = [
  { id: "conversar", icone: "conversar", titulo: "Conversar", texto: "Chat ao vivo com quem está online. Quem está fora recebe quando entrar, e o aviso chega no celular.", img: "/workend/rede/conversar.webp", alt: "Dois personagens conversando, com balões de fala acima deles" },
  { id: "negociar", icone: "negociar", titulo: "Negociar", texto: "Proposta com valor, acompanhamento até a conclusão e avaliação dos dois lados.", img: "/workend/rede/negociar.webp", alt: "Dois personagens apertando as mãos sobre uma mesa com um contrato e moedas" },
  { id: "chamada", icone: "chamada", titulo: "Chamada de vídeo", texto: "Áudio e vídeo direto no navegador, sem instalar nada.", img: "/workend/rede/chamada.webp", alt: "Personagem acenando para outra pessoa numa chamada de vídeo no notebook" },
  { id: "amizade", icone: "amizade", titulo: "Amizade", texto: "Amigos veem as redes sociais um do outro e ficam aqui no seu painel, com quem está online na hora.", img: "/workend/rede/amizade.webp", alt: "Dois personagens batendo as mãos no alto, com corações flutuando" },
];
function Recursos() {
  return (
    <div className="rd-recursos">
      {RECURSOS.map((r, i) => (
        <Inclina key={r.id} className={`rd-rec rd-rec-${r.id}`} style={{ ["--i" as string]: i }} suave>
          <div className="rd-rec-img"><img src={r.img} alt={r.alt} width={720} height={720} loading="lazy" decoding="async" /></div>
          <div className="rd-rec-txt">
            <span className="rd-rec-ico"><Icone nome={r.icone} tamanho={22} /></span>
            <div><h3>{r.titulo}</h3><p>{r.texto}</p></div>
          </div>
        </Inclina>
      ))}
    </div>
  );
}
