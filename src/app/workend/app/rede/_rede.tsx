"use client";
// Painel "Minha rede": o personagem, pedidos de amizade, amigos (online, conversar, negociar, call), conversas e negociações.
// Usa a mesma store do mapa (usePersonagem) e a mesma janela de chamada.
import { useEffect, useState } from "react";
import { usePersonagem, type Outro, type Amigo } from "@/office/personagemStore";
import { MiniAvatar, CorpoChat, LinksRedes } from "@/office/ui/Personagem";
import { JanelaChamada } from "@/office/ui/Chamada";

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
  const responderNegociacao = usePersonagem((s) => s.responderNegociacao);
  const desfazerAmizade = usePersonagem((s) => s.desfazerAmizade);
  const ligar = usePersonagem((s) => s.ligar);
  const [aba, setAba] = useState<Aba>("amigos");
  const [aviso, setAviso] = useState<string | null>(null);
  // carrega a rede e mantém presença (pra receber chamadas e ver quem está online) enquanto o painel está aberto
  useEffect(() => {
    void carregarRede();
    const t1 = setInterval(() => { if (document.visibilityState === "visible") { void batida(); } }, 4000);
    const t2 = setInterval(() => { if (document.visibilityState === "visible") void carregarRede(); }, 15000);
    const t3 = setInterval(() => { if (usePersonagem.getState().painel === "chat") void atualizarChat(); }, 2500);
    void batida();
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [carregarRede, batida, atualizarChat]);
  const recebidos = pedidos.filter((p) => p.direcao === "recebido");
  const abertas = negociacoes.filter((n) => n.status === "aberta");
  const online = amigos.filter((a) => a.online).length;
  const chamar = async (a: { usuarioId: string; nome: string; boneco: string; roupa: string; online?: boolean }) => { if (!a.online) { setAviso(`${a.nome} não está online agora.`); return; } const e = await ligar(a, true); setAviso(e); };

  if (!carregado) return <section className="faixa pt-4 text-[var(--tinta-2)]">Carregando sua rede…</section>;
  if (!ativo) return (
    <section className="faixa pt-4">
      <h1 className="text-[2rem] lg:text-[2.6rem]">Minha rede</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-[var(--cinza)] p-7">
          <h2 className="text-[1.5rem]">{meu ? `${meu.nome}, ative seu personagem` : "Crie seu personagem"}</h2>
          <p className="mt-2 max-w-[52ch] text-[var(--tinta-2)]">O WorkEnd é uma rede de network: com um personagem você anda pelo mundo, entra nas lojas, fala com a equipe, conversa com quem está online, faz amigos, negocia e faz calls. Quem não tem personagem só olha.</p>
          <div className="mt-4 text-[1.1rem]"><span className="text-[var(--tinta-2)] line-through">{brl(precoCheio)}</span> <b className="text-[1.6rem] text-[#166534]">{brl(preco)}</b><span className="text-sm text-[var(--tinta-2)]">/mês · promoção de lançamento</span></div>
          <a href="/mundo?personagem=1" className="btn btn-azul mt-5 inline-block">{meu ? "Ativar no mapa (Pix)" : "Montar meu personagem"}</a>
        </div>
        <ul className="grid gap-3 text-[15px]">
          {[["💬", "Conversar", "Chat ao vivo com quem está online; offline recebe quando entrar."], ["🤝", "Negociar", "Propostas com valor e status: aberta, aceita, concluída."], ["📹", "Fazer uma call", "Áudio e vídeo direto no navegador, sem instalar nada."], ["➕", "Amizade", "Amigos veem as redes sociais um do outro e ficam aqui no seu painel."]].map(([i, t, d]) => <li key={t} className="flex gap-3 rounded-2xl border border-[var(--linha)] p-4"><span className="text-2xl">{i}</span><div><div className="font-semibold">{t}</div><div className="text-sm text-[var(--tinta-2)]">{d}</div></div></li>)}
        </ul>
      </div>
    </section>
  );
  return (
    <section className="faixa pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">{meu && <MiniAvatar boneco={meu.boneco} roupa={meu.roupa} tamanho={56} />}<div className="min-w-0"><h1 className="text-[1.7rem] leading-tight sm:text-[2rem] lg:text-[2.4rem]">Minha rede</h1><p className="text-sm text-[var(--tinta-2)] sm:text-base">{meu?.nome ?? nome} · {amigos.length} amigo{amigos.length === 1 ? "" : "s"}{online > 0 && <span className="text-[#16A34A]"> · {online} online</span>}{meu?.pagoAte && <> · ativo até {dataBR(meu.pagoAte)}</>}</p></div></div>
        <div className="flex w-full gap-2 sm:w-auto"><a href="/mundo" className="btn btn-azul flex-1 text-center sm:flex-none">Entrar no mapa</a><a href="/mundo?personagem=1" className="btn btn-linha flex-1 text-center sm:flex-none">Editar personagem</a></div>
      </div>
      {aviso && <div className="mt-3 rounded-xl bg-[var(--cinza)] px-3 py-2 text-sm">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">fechar</button></div>}

      {recebidos.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[#DB2777]/30 bg-[#FDF2F8] p-5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#9D174D]">Pedidos de amizade</div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {recebidos.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white p-3"><MiniAvatar boneco={p.boneco} roupa={p.roupa} tamanho={40} /><div className="min-w-0 flex-1"><div className="font-semibold">{p.nome}</div><div className="truncate text-xs text-[var(--tinta-2)]">{p.bio || `pediu em ${dataBR(p.criadoEm)}`}</div></div><button onClick={() => void responderAmizade(p.id, true)} className="rounded-lg bg-[#DB2777] px-3 py-1.5 text-xs font-bold text-white">Aceitar</button><button onClick={() => void responderAmizade(p.id, false)} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5 text-xs font-bold">Recusar</button></li>)}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="sem-barra flex gap-1 overflow-x-auto border-b border-[var(--linha)] whitespace-nowrap">
            {([["amigos", `Amigos · ${amigos.length}`], ["conversas", `Conversas · ${conversas.length}`], ["negociacoes", `Negociações${abertas.length ? ` · ${abertas.length} aberta${abertas.length > 1 ? "s" : ""}` : ""}`]] as [Aba, string][]).map(([id, t]) => <button key={id} onClick={() => setAba(id)} className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold sm:px-4 ${aba === id ? "border-[var(--azul)] text-[var(--azul)]" : "border-transparent text-[var(--tinta-2)]"}`}>{t}</button>)}
          </div>
          {aba === "amigos" && (
            <ul className="mt-4 grid gap-3">
              {amigos.length === 0 && <li className="rounded-2xl bg-[var(--cinza)] p-6 text-center text-sm text-[var(--tinta-2)]">Você ainda não tem amigos no WorkEnd. Entre no mapa, clique num personagem e peça amizade.</li>}
              {amigos.map((a) => (
                <li key={a.usuarioId} className="rounded-2xl border border-[var(--linha)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <MiniAvatar boneco={a.boneco} roupa={a.roupa} tamanho={48} />
                    <div className="min-w-0 flex-1 basis-40"><div className="flex items-center gap-2 font-semibold">{a.nome}{a.online ? <span className="rounded-full bg-[#E3F6EA] px-1.5 py-0.5 text-[10px] font-bold text-[#166534]">online</span> : <span className="text-[10px] text-[var(--tinta-2)]">offline</span>}</div><div className="truncate text-sm text-[var(--tinta-2)]">{a.bio || `amigos desde ${dataBR(a.desde)}`}</div></div>
                    <div className="flex gap-1.5 text-xs font-bold">
                      <button onClick={() => void abrirChat(comoOutro(a))} className="rounded-lg bg-[#EEF3FF] px-3 py-2 text-[#1D4ED8]">💬 Conversar</button>
                      <button onClick={() => { void abrirChat(comoOutro(a)); setAviso(`Use o botão 🤝 Negociar dentro da conversa com ${a.nome}.`); }} className="rounded-lg bg-[#FFF4D6] px-3 py-2 text-[#7A5A00]">🤝 Negociar</button>
                      <button onClick={() => void chamar(a)} className={`rounded-lg px-3 py-2 ${a.online ? "bg-[#E3F6EA] text-[#166534]" : "bg-[var(--cinza)] text-[var(--tinta-2)]"}`}>📹 Call</button>
                      <button onClick={() => { if (window.confirm(`Desfazer a amizade com ${a.nome}?`)) void desfazerAmizade(a.usuarioId); }} className="rounded-lg px-2 py-2 text-[var(--tinta-2)]" title="Desfazer amizade">✕</button>
                    </div>
                  </div>
                  {a.redes && Object.values(a.redes).some(Boolean) && <LinksRedes redes={a.redes} />}
                </li>
              ))}
            </ul>
          )}
          {aba === "conversas" && (
            <ul className="mt-4 grid gap-2">
              {conversas.length === 0 && <li className="rounded-2xl bg-[var(--cinza)] p-6 text-center text-sm text-[var(--tinta-2)]">Nenhuma conversa ainda.</li>}
              {conversas.map((c) => <li key={c.outroId}><button onClick={() => void abrirChat(comoOutro({ usuarioId: c.outroId, nome: c.nome, boneco: c.boneco, roupa: c.roupa, online: c.online }))} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left hover:bg-[var(--cinza)] ${outro?.usuarioId === c.outroId ? "border-[var(--azul)]" : "border-[var(--linha)]"}`}><MiniAvatar boneco={c.boneco} roupa={c.roupa} tamanho={40} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 font-semibold">{c.nome}{c.online && <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />}</div><div className="truncate text-sm text-[var(--tinta-2)]">{c.tipo === "negocio" ? "🤝 proposta" : c.tipo === "negocio_status" ? "🤝 resposta da proposta" : c.tipo.startsWith("amizade") ? "➕ amizade" : c.ultimo}</div></div>{c.naoLidas > 0 && <span className="rounded-full bg-[var(--azul)] px-2 py-0.5 text-[11px] font-bold text-white">{c.naoLidas}</span>}<span className="text-xs text-[var(--tinta-2)]">{dataBR(c.quando)}</span></button></li>)}
            </ul>
          )}
          {aba === "negociacoes" && (
            <ul className="mt-4 grid gap-2">
              {negociacoes.length === 0 && <li className="rounded-2xl bg-[var(--cinza)] p-6 text-center text-sm text-[var(--tinta-2)]">Nenhuma negociação ainda. Abra uma conversa e clique em 🤝 Negociar.</li>}
              {negociacoes.map((n) => { const minha = n.deId !== n.outroId; const cor = n.status === "aceita" ? "#16A34A" : n.status === "recusada" || n.status === "cancelada" ? "#E2575B" : n.status === "concluida" ? "#1D4ED8" : "#D97706"; return (
                <li key={n.id} className="rounded-2xl border border-[var(--linha)] p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <MiniAvatar boneco={n.outroBoneco} roupa={n.outroRoupa} tamanho={40} />
                    <div className="min-w-0 flex-1"><div className="text-xs text-[var(--tinta-2)]">{minha ? `Você propôs pra ${n.outroNome}` : `${n.outroNome} propôs pra você`} · {dataBR(n.criadoEm)}</div><div className="font-semibold">{n.titulo}</div>{n.texto && <div className="text-sm text-[var(--tinta-2)]">{n.texto}</div>}{n.valor != null && <div className="mt-0.5 text-sm font-bold">{brl(Number(n.valor))}</div>}</div>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: cor }}>{n.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                    {n.status === "aberta" && !minha && <><button onClick={() => void responderNegociacao(n.id, "aceita")} className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-white">Aceitar</button><button onClick={() => void responderNegociacao(n.id, "recusada")} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5">Recusar</button></>}
                    {n.status === "aberta" && minha && <button onClick={() => void responderNegociacao(n.id, "cancelada")} className="rounded-lg bg-[var(--cinza)] px-3 py-1.5">Cancelar</button>}
                    {n.status === "aceita" && <button onClick={() => void responderNegociacao(n.id, "concluida")} className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-white">Marcar como concluído</button>}
                    <button onClick={() => void abrirChat(comoOutro({ usuarioId: n.outroId, nome: n.outroNome, boneco: n.outroBoneco, roupa: n.outroRoupa }))} className="rounded-lg bg-[#EEF3FF] px-3 py-1.5 text-[#1D4ED8]">💬 Conversar</button>
                  </div>
                </li>
              ); })}
            </ul>
          )}
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          {painel === "chat" && outro ? (
            <div className="painel-entra fixed inset-x-0 bottom-0 z-40 flex h-[78vh] flex-col overflow-hidden rounded-t-2xl border border-[var(--linha)] bg-white shadow-2xl lg:static lg:h-[min(70vh,600px)] lg:rounded-2xl lg:shadow-none">
              <div className="flex items-center justify-between border-b border-[var(--linha)] p-3"><div className="flex items-center gap-2"><MiniAvatar boneco={outro.boneco} roupa={outro.roupa} tamanho={36} /><div><div className="text-sm font-bold leading-tight">{outro.nome}</div><div className="text-[11px] text-[var(--tinta-2)]">{outro.online ? <span className="text-[#16A34A]">● online · ao vivo</span> : "offline · recebe quando entrar"}</div></div></div><button onClick={() => usePersonagem.getState().fechar()} className="rounded-full px-2 text-[var(--tinta-2)] hover:bg-[var(--cinza)]">✕</button></div>
              <CorpoChat o={outro} altura="flex-1" />
            </div>
          ) : (
            <div className="hidden rounded-2xl bg-[var(--cinza)] p-6 text-sm text-[var(--tinta-2)] lg:block"><div className="text-2xl">💬</div><div className="mt-2 font-semibold text-[var(--tinta)]">Escolha alguém pra conversar</div>Clique em Conversar num amigo ou numa conversa. Propostas e calls saem daqui também.</div>
          )}
        </aside>
      </div>
      <JanelaChamada />
    </section>
  );
}
