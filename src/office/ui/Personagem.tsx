"use client";
// UI do personagem: montar/pagar (nome, gênero, tipo, bio, redes), ficha de outro personagem com as opções
// (conversa, chat ao vivo, negócios, trocar redes sociais), chat e caixa de entrada.
import { useEffect, useRef, useState } from "react";
import { usePersonagem, type Redes, type Outro } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { TIPOS_AVATAR, TODOS_BONECOS, type Genero } from "../data/bonecos";
import { PixAberto } from "./Lote";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR");

// Mini avatar em CSS (pele, cabelo, roupa)
export function MiniAvatar({ boneco, roupa, tamanho = 40 }: { boneco: string; roupa: string; tamanho?: number }) {
  const b = TODOS_BONECOS[boneco] ?? TODOS_BONECOS.classico;
  const semCamisa = b.traje === "semCamisa" || b.traje === "biquini";
  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded-full" style={{ width: tamanho, height: tamanho, background: semCamisa ? b.pele : roupa }}>
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: tamanho * 0.1, width: tamanho * 0.46, height: tamanho * 0.46, background: b.pele }} />
      {b.estiloCabelo !== "careca" && <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ top: tamanho * 0.06, width: tamanho * 0.5, height: tamanho * 0.22, background: b.cabelo }} />}
      {b.estiloCabelo === "longo" && <span className="absolute left-1/2 -translate-x-1/2 rounded-b-lg" style={{ top: tamanho * 0.22, width: tamanho * 0.58, height: tamanho * 0.3, background: b.cabelo, zIndex: 0 }} />}
      {b.oculos && <span className="absolute left-1/2 -translate-x-1/2 rounded bg-black/70" style={{ top: tamanho * 0.3, width: tamanho * 0.42, height: tamanho * 0.1 }} />}
      {b.chapeu && <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: tamanho * 0.02, width: tamanho * 0.7, height: tamanho * 0.12, background: b.chapeu }} />}
      {b.traje === "biquini" && <span className="absolute left-1/2 -translate-x-1/2 rounded" style={{ top: tamanho * 0.64, width: tamanho * 0.5, height: tamanho * 0.12, background: roupa }} />}
    </span>
  );
}

export function PainelPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const preco = usePersonagem((s) => s.preco);
  const precoCheio = usePersonagem((s) => s.precoCheio);
  const pagamentoLigado = usePersonagem((s) => s.pagamentoLigado);
  const salvar = usePersonagem((s) => s.salvar);
  const pagar = usePersonagem((s) => s.pagar);
  const fechar = usePersonagem((s) => s.fechar);
  const pix = useMundo((s) => s.pix);
  const usuario = useMundo((s) => s.usuario);
  const [genero, setGenero] = useState<Genero | "todos">("todos");
  const [f, setF] = useState({ nome: "", tipo: TIPOS_AVATAR[0].id, bio: "", redes: {} as Redes, mostrarRedes: false });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const carregadoDe = useRef<string | null>(null);
  // preenche o formulário com o que já existe (uma vez por personagem)
  useEffect(() => { if (painel === "montar" && meu && carregadoDe.current !== meu.usuarioId) { carregadoDe.current = meu.usuarioId; setF({ nome: meu.nome, tipo: meu.tipo, bio: meu.bio, redes: meu.redes ?? {}, mostrarRedes: meu.mostrarRedes }); } }, [painel, meu]);
  if (painel !== "montar") return null;
  if (!usuario) return (
    <div className="absolute right-3 top-20 z-20 w-80 rounded-2xl bg-white/97 p-4 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="text-lg font-bold">Seu personagem no mundo</div>
      <p className="mt-1 text-sm text-[#5B6472]">Ande pelo mapa, entre nas lojas, converse com quem está online, troque contatos e faça negócios.</p>
      <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-sm"><span className="text-[#5B6472] line-through">{brl(precoCheio)}</span> <b className="text-[#16A34A]">{brl(preco)}/mês</b></div>
      <a href="/cadastro" className="mt-3 block w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-center text-sm font-bold text-white">Criar conta e montar meu personagem</a>
      <button onClick={fechar} className="mt-2 w-full rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm text-[#5B6472]">Agora não</button>
    </div>
  );
  const tipos = TIPOS_AVATAR.filter((t) => genero === "todos" || t.genero === genero);
  const tipo = TIPOS_AVATAR.find((t) => t.id === f.tipo) ?? TIPOS_AVATAR[0];
  const clicarSalvar = async () => { setErro(null); setSalvando(true); const e = await salvar(f); setSalvando(false); if (e) setErro(e); };
  const clicarPagar = async () => { setErro(null); setPagando(true); const e1 = meu ? null : await salvar(f); if (e1) { setErro(e1); setPagando(false); return; } const e = await pagar(1); setPagando(false); if (e) setErro(e); };
  const setRede = (k: keyof Redes, v: string) => setF({ ...f, redes: { ...f.redes, [k]: v } });
  return (
    <div className="absolute right-3 top-20 z-20 flex max-h-[calc(100vh-7rem)] w-[22rem] flex-col rounded-2xl bg-white/97 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between p-4 pb-2">
        <div><div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">Meu personagem</div><div className="text-lg font-bold">{meu ? meu.nome : "Monte seu personagem"}</div>
          <div className="text-xs text-[#5B6472]">{ativo ? `Ativo até ${meu?.pagoAte ? dataBR(meu.pagoAte) : "—"} · clique no chão pra andar` : "Ande pelo mapa, converse e faça negócios."}</div></div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <div className="flex items-center gap-3 rounded-2xl bg-[#F1F3F6] p-3"><MiniAvatar boneco={tipo.boneco} roupa={tipo.roupa} tamanho={56} /><div><div className="font-bold">{tipo.nome}</div><div className="text-xs text-[#5B6472]">{tipo.genero} · {tipo.estilo}</div></div></div>
        <label className="mt-3 block text-xs font-semibold text-[#5B6472]">Nome no balãozinho<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.slice(0, 24) })} placeholder="Ex.: Bia" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal outline-none focus:border-[#1D4ED8]" /></label>
        <div className="mt-3 text-xs font-semibold text-[#5B6472]">Gênero</div>
        <div className="mt-1 flex gap-1.5">{(["todos", "feminino", "masculino", "neutro"] as const).map((g) => <button key={g} onClick={() => setGenero(g)} className={`rounded-full px-3 py-1 text-xs font-semibold ${genero === g ? "bg-[#1D4ED8] text-white" : "bg-[#F1F3F6] text-[#5B6472]"}`}>{g === "todos" ? "Todos" : g[0].toUpperCase() + g.slice(1)}</button>)}</div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {tipos.map((t) => <button key={t.id} onClick={() => setF({ ...f, tipo: t.id })} title={t.nome} className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 ${f.tipo === t.id ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-transparent bg-[#F7F8FA]"}`}><MiniAvatar boneco={t.boneco} roupa={t.roupa} tamanho={36} /><span className="w-full truncate text-center text-[10px] font-semibold">{t.nome}</span></button>)}
        </div>
        <label className="mt-3 block text-xs font-semibold text-[#5B6472]">Sobre você (aparece na ficha)<textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value.slice(0, 200) })} rows={2} placeholder="Ex.: Dona de loja de roupas em Aracaju, procuro fornecedores." className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal outline-none focus:border-[#1D4ED8]" /></label>
        <div className="mt-3 text-xs font-semibold text-[#5B6472]">Redes sociais (pra trocar com quem você quiser)</div>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <input value={f.redes.instagram ?? ""} onChange={(e) => setRede("instagram", e.target.value)} placeholder="Instagram (@)" className="rounded-xl border border-black/10 px-3 py-1.5 text-sm" />
          <input value={f.redes.whatsapp ?? ""} onChange={(e) => setRede("whatsapp", e.target.value)} placeholder="WhatsApp (DDD+nº)" className="rounded-xl border border-black/10 px-3 py-1.5 text-sm" />
          <input value={f.redes.linkedin ?? ""} onChange={(e) => setRede("linkedin", e.target.value)} placeholder="LinkedIn" className="rounded-xl border border-black/10 px-3 py-1.5 text-sm" />
          <input value={f.redes.site ?? ""} onChange={(e) => setRede("site", e.target.value)} placeholder="Site" className="rounded-xl border border-black/10 px-3 py-1.5 text-sm" />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-[#5B6472]"><input type="checkbox" checked={f.mostrarRedes} onChange={(e) => setF({ ...f, mostrarRedes: e.target.checked })} /> Mostrar minhas redes pra todo mundo (senão só pra quem eu aceitar)</label>
        {!ativo && (
          <div className="mt-3 rounded-2xl border border-[#16A34A]/30 bg-[#F3FBF5] p-3">
            <div className="text-sm"><span className="text-[#5B6472] line-through">{brl(precoCheio)}</span> <b className="text-lg text-[#166534]">{brl(preco)}</b><span className="text-xs text-[#5B6472]">/mês · promoção de lançamento</span></div>
            <div className="mt-1 text-[11px] text-[#5B6472]">Entre no mapa como personagem, converse ao vivo, troque contatos e feche negócios com quem está online.</div>
            {pix?.lote === "personagem" ? <PixAberto chave="personagem" /> : pagamentoLigado
              ? <button onClick={clicarPagar} disabled={pagando} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pagando ? "Gerando o Pix…" : `Ativar por ${brl(preco)} no Pix`}</button>
              : <div className="mt-2 rounded-xl bg-[#F1F3F6] px-3 py-2 text-center text-xs text-[#5B6472]">Pagamento em instantes.</div>}
          </div>
        )}
        {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      </div>
      <div className="flex gap-2 border-t border-black/5 p-4 pt-3">
        <button onClick={fechar} className="rounded-xl bg-[#F1F3F6] px-3 py-2.5 text-sm font-semibold text-[#5B6472]">Fechar</button>
        <button onClick={clicarSalvar} disabled={salvando || f.nome.trim().length < 2} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{salvando ? "Salvando…" : meu ? "Salvar personagem" : "Criar personagem"}</button>
      </div>
    </div>
  );
}

// Ficha de outro personagem com as 4 opções
export function FichaPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const o = usePersonagem((s) => s.outroSelecionado);
  const ativo = usePersonagem((s) => s.ativo);
  const meu = usePersonagem((s) => s.meu);
  const abrirChat = usePersonagem((s) => s.abrirChat);
  const enviar = usePersonagem((s) => s.enviar);
  const abrir = usePersonagem((s) => s.abrir);
  const fechar = usePersonagem((s) => s.fechar);
  const [fichaDe, setFichaDe] = useState<{ id: string; dados: Outro | null }>({ id: "", dados: null });
  const [avisoDe, setAvisoDe] = useState<{ id: string; texto: string | null }>({ id: "", texto: null });
  useEffect(() => {
    if (painel !== "ficha" || !o) return;
    const id = o.usuarioId; let vivo = true;
    fetch(`/api/personagens/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (vivo) setFichaDe({ id, dados: d }); }).catch(() => {});
    return () => { vivo = false; };
  }, [painel, o]);
  if (painel !== "ficha" || !o) return null;
  const ficha = fichaDe.id === o.usuarioId ? fichaDe.dados : null;
  const aviso = avisoDe.id === o.usuarioId ? avisoDe.texto : null;
  const setAviso = (t: string | null) => setAvisoDe({ id: o.usuarioId, texto: t });
  const p = ficha ?? o;
  const precisa = !ativo;
  const acao = async (tipo: string, texto: string, depoisChat = true) => {
    if (precisa) { abrir("montar"); return; }
    if (depoisChat) { await abrirChat(o); if (texto) await enviar(tipo, texto); return; }
    const e = await enviar(tipo, texto); setAviso(e ?? "Pedido enviado! Quando aceitar, as redes aparecem aqui.");
  };
  const redes = p.redes && Object.values(p.redes).some(Boolean) ? p.redes : null;
  return (
    <div className="absolute right-3 top-20 z-20 w-80 rounded-2xl bg-white/97 p-4 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3"><MiniAvatar boneco={p.boneco} roupa={p.roupa} tamanho={48} /><div><div className="text-lg font-bold leading-tight">{p.nome}</div><div className="text-xs text-[#5B6472]">{p.online ? <span className="text-[#16A34A]">● online agora</span> : "offline"}{meu?.usuarioId === p.usuarioId && " · você"}</div></div></div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      {p.bio && <p className="mt-2 text-sm text-[#1D2128]">{p.bio}</p>}
      {meu?.usuarioId !== p.usuarioId && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-center text-[12px] font-semibold">
          <button onClick={() => acao("chat", "")} className="rounded-xl bg-[#EEF3FF] px-2 py-2.5 text-[#1D4ED8]"><div className="text-base">💬</div>Conversa</button>
          <button onClick={() => acao("chat", "")} className="rounded-xl bg-[#E3F6EA] px-2 py-2.5 text-[#166534]"><div className="text-base">⚡</div>Chat ao vivo</button>
          <button onClick={() => acao("negocio", "")} className="rounded-xl bg-[#FFF4D6] px-2 py-2.5 text-[#7A5A00]"><div className="text-base">🤝</div>Negócios</button>
          <button onClick={() => (redes ? setAviso("As redes já estão aí embaixo.") : acao("redes_pedido", "Quer trocar redes sociais?", false))} className="rounded-xl bg-[#FDE8F3] px-2 py-2.5 text-[#9D174D]"><div className="text-base">🔗</div>Trocar redes</button>
        </div>
      )}
      {redes && (
        <div className="mt-3 rounded-2xl bg-[#F1F3F6] p-3 text-sm">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Redes sociais</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {redes.instagram && <a href={`https://instagram.com/${redes.instagram}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#9D174D]">@{redes.instagram}</a>}
            {redes.whatsapp && <a href={`https://wa.me/55${redes.whatsapp}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#166534]">WhatsApp</a>}
            {redes.linkedin && <a href={redes.linkedin.startsWith("http") ? redes.linkedin : `https://linkedin.com/in/${redes.linkedin}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">LinkedIn</a>}
            {redes.site && <a href={redes.site.startsWith("http") ? redes.site : `https://${redes.site}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1D2128]">Site</a>}
          </div>
        </div>
      )}
      {precisa && <div className="mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Pra conversar, fazer negócios e trocar redes você precisa do seu personagem (<b>de R$ 19,90 por R$ 5,90/mês</b>). <button onClick={() => abrir("montar")} className="font-bold underline">Montar agora</button></div>}
      {aviso && <div className="mt-2 text-xs font-semibold text-[#166534]">{aviso}</div>}
    </div>
  );
}

// Chat (conversa e chat ao vivo são a mesma janela; "negócios" entra como mensagem marcada)
export function ChatPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const o = usePersonagem((s) => s.outroSelecionado);
  const meu = usePersonagem((s) => s.meu);
  const mensagens = usePersonagem((s) => s.mensagens);
  const enviar = usePersonagem((s) => s.enviar);
  const fechar = usePersonagem((s) => s.fechar);
  const selecionarOutro = usePersonagem((s) => s.selecionarOutro);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"chat" | "negocio">("chat");
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens.length]);
  if (painel !== "chat" || !o) return null;
  const mandar = async () => { if (!texto.trim()) return; const e = await enviar(tipo, texto.trim()); if (e) setErro(e); else { setTexto(""); setErro(null); setTipo("chat"); } };
  const aceitarRedes = async () => { const e = await enviar("redes_aceite", ""); if (e) setErro(e); };
  const pediuRedes = mensagens.some((m) => m.tipo === "redes_pedido" && m.deId === o.usuarioId) && !mensagens.some((m) => m.tipo === "redes_aceite" && m.deId === meu?.usuarioId);
  return (
    <div className="absolute right-3 top-20 z-20 flex h-[min(70vh,520px)] w-[22rem] flex-col rounded-2xl bg-white/97 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-black/5 p-3">
        <button onClick={() => selecionarOutro(o)} className="flex items-center gap-2 text-left"><MiniAvatar boneco={o.boneco} roupa={o.roupa} tamanho={36} /><div><div className="text-sm font-bold leading-tight">{o.nome}</div><div className="text-[11px] text-[#5B6472]">{o.online ? <span className="text-[#16A34A]">● online · chat ao vivo</span> : "offline · ele recebe quando entrar"}</div></div></button>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {mensagens.length === 0 && <div className="py-6 text-center text-xs text-[#5B6472]">Diga oi 👋</div>}
        {mensagens.map((m) => { const minha = m.deId === meu?.usuarioId; return (
          <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${minha ? "bg-[#1D4ED8] text-white" : "bg-[#F1F3F6] text-[#1D2128]"} ${m.tipo === "negocio" ? "ring-2 ring-[#D97706]" : ""}`}>
              {m.tipo === "negocio" && <div className={`text-[9px] font-black uppercase ${minha ? "text-white/70" : "text-[#D97706]"}`}>🤝 Negócios</div>}
              {m.tipo === "redes_pedido" && <div className={`text-[9px] font-black uppercase ${minha ? "text-white/70" : "text-[#9D174D]"}`}>🔗 Pedido de redes</div>}
              {m.tipo === "redes_aceite" && <div className={`text-[9px] font-black uppercase ${minha ? "text-white/70" : "text-[#166534]"}`}>🔗 Redes liberadas</div>}
              {m.texto}
            </div>
          </div>
        ); })}
        {pediuRedes && <button onClick={aceitarRedes} className="w-full rounded-xl bg-[#FDE8F3] px-3 py-2 text-xs font-bold text-[#9D174D]">Aceitar e liberar minhas redes pra {o.nome}</button>}
        <div ref={fim} />
      </div>
      <div className="border-t border-black/5 p-2">
        <div className="mb-1 flex gap-1 text-[11px]"><button onClick={() => setTipo("chat")} className={`rounded-full px-2 py-0.5 font-semibold ${tipo === "chat" ? "bg-[#1D4ED8] text-white" : "bg-[#F1F3F6]"}`}>Mensagem</button><button onClick={() => setTipo("negocio")} className={`rounded-full px-2 py-0.5 font-semibold ${tipo === "negocio" ? "bg-[#D97706] text-white" : "bg-[#F1F3F6]"}`}>🤝 Proposta de negócio</button></div>
        <div className="flex gap-1.5"><input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void mandar(); }} placeholder={tipo === "negocio" ? "Descreva a proposta…" : "Escreva…"} className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#1D4ED8]" /><button onClick={mandar} className="rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white">Enviar</button></div>
        {erro && <div className="mt-1 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      </div>
    </div>
  );
}

// Caixa de entrada (lista de conversas)
export function CaixaPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const conversas = usePersonagem((s) => s.conversas);
  const carregarCaixa = usePersonagem((s) => s.carregarCaixa);
  const abrirChat = usePersonagem((s) => s.abrirChat);
  const fechar = usePersonagem((s) => s.fechar);
  useEffect(() => { if (painel === "caixa") void carregarCaixa(); }, [painel, carregarCaixa]);
  if (painel !== "caixa") return null;
  return (
    <div className="absolute right-3 top-20 z-20 w-80 rounded-2xl bg-white/97 p-3 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between px-1"><div className="text-sm font-bold">Minhas conversas</div><button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button></div>
      <div className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto">
        {conversas.length === 0 && <div className="py-6 text-center text-xs text-[#5B6472]">Nenhuma conversa ainda. Clique num personagem no mapa.</div>}
        {conversas.map((c) => (
          <button key={c.outroId} onClick={() => abrirChat({ usuarioId: c.outroId, nome: c.nome, boneco: c.boneco, roupa: c.roupa, bio: "", x: 0, z: 0, rot: 0, online: c.online })} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-[#F1F3F6]">
            <MiniAvatar boneco={c.boneco} roupa={c.roupa} tamanho={36} />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-1 text-sm font-bold">{c.nome}{c.online && <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />}</div><div className="truncate text-xs text-[#5B6472]">{c.tipo === "negocio" ? "🤝 " : ""}{c.ultimo}</div></div>
            {c.naoLidas > 0 && <span className="rounded-full bg-[#1D4ED8] px-1.5 py-0.5 text-[10px] font-bold text-white">{c.naoLidas}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
