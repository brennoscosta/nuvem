"use client";
// Vitrine de produtos da loja (12/11/2026): foto, nome e preço, com o botão "Pedir no WhatsApp" que abre a conversa com
// o dono já com a mensagem do produto. O WorkEnd não passa dinheiro adiante. Sem WhatsApp, o botão leva à atendente de
// IA da loja. No cartão do mapa (compacto) é uma faixa que rola de lado; na página /loja/N, uma grade.
// Cada pedido no WhatsApp conta um clique no painel de resultados do dono (/api/workend/clique).
import { avisarClique } from "./LinkRastreado";
import { useEffect, useState } from "react";

export type ProdutoVitrine = { id: string; nome: string; preco: number | null; descricao: string; foto: string | null };
export type DadosVitrine = { numero: number; empresa: string; cor: string; whatsapp: string | null; atendente: string | null; produtos: ProdutoVitrine[] };

export const precoBR = (centavos: number | null) => (centavos == null ? "Sob consulta" : (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const numeroZap = (n: string) => (n.length <= 11 ? `55${n}` : n);
export function linkPedido(whatsapp: string, p: ProdutoVitrine) {
  const preco = p.preco == null ? "sob consulta" : precoBR(p.preco).replace(/\s/g, " ");
  return `https://wa.me/${numeroZap(whatsapp)}?text=${encodeURIComponent(`Olá! Vi o produto ${p.nome} (${preco}) na sua loja do WorkEnd.`)}`;
}
// pedido com vários produtos (13/11/2026): uma mensagem só, com itens, quantidades e total (sob consulta entra sem preço)
export type Pedido = Record<string, number>;
export function textoPedido(d: DadosVitrine, pedido: Pedido) {
  const itens = d.produtos.filter((p) => (pedido[p.id] ?? 0) > 0);
  const linhas = itens.map((p) => { const q = pedido[p.id]; return `• ${q}× ${p.nome} — ${p.preco == null ? "sob consulta" : precoBR(p.preco * q).replace(/\s/g, " ")}`; });
  const total = itens.reduce((a, p) => a + (p.preco ?? 0) * pedido[p.id], 0), consulta = itens.some((p) => p.preco == null);
  return `Olá! Quero fazer um pedido pela sua loja do WorkEnd:\n${linhas.join("\n")}\nTotal: ${total ? precoBR(total).replace(/\s/g, " ") : "a combinar"}${consulta && total ? " (+ itens sob consulta)" : ""}`;
}
function contarClique(numero: number, produtoId: string) {
  avisarClique(numero, "produto", produtoId); // conta no painel e faz sair o motoboy da loja na cena
}

// Leva a pergunta até a conversa com a atendente: preenche o campo do chat (página da loja ou cartão do mapa); com o
// chat fechado, abre pelo botão "Conversar com…"; sem login, mostra o "Entrar para conversar".
const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
function campoDoChat() { return Array.from(document.querySelectorAll<HTMLInputElement>('input[placeholder^="Escreva para"]')).find(visivel) ?? null; }
function preencher(el: HTMLInputElement, texto: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, texto);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus({ preventScroll: true });
}
function irParaEntrar() {
  const a = Array.from(document.querySelectorAll("a")).find((x) => /Entrar para conversar/.test(x.textContent ?? "") && visivel(x));
  if (a) { a.scrollIntoView({ block: "center", behavior: "smooth" }); a.focus({ preventScroll: true }); return true; }
  return false;
}
export function perguntarAtendente(texto: string) {
  const campo = campoDoChat(); if (campo) { preencher(campo, texto); return; }
  if (irParaEntrar()) return;
  const botao = Array.from(document.querySelectorAll("button")).find((b) => /^💬 Conversar com/.test((b.textContent ?? "").trim()) && visivel(b));
  if (!botao) return;
  botao.click();
  let tentativas = 0;
  const procurar = () => { const c = campoDoChat(); if (c) return preencher(c, texto); if (irParaEntrar() || ++tentativas > 20) return; setTimeout(procurar, 80); };
  setTimeout(procurar, 60);
}

function Foto({ p, cor, classe }: { p: ProdutoVitrine; cor: string; classe: string }) {
  if (p.foto) return <img src={p.foto} alt={p.nome} loading="lazy" decoding="async" className={`${classe} object-cover`} />;
  return <span aria-hidden="true" className={`${classe} grid place-items-center text-2xl font-black text-white/90`} style={{ background: `linear-gradient(135deg, ${cor}, #161C25 140%)` }}>{p.nome.slice(0, 1).toUpperCase()}</span>;
}

function BotaoPedido({ d, p, previa, pequeno }: { d: DadosVitrine; p: ProdutoVitrine; previa?: boolean; pequeno?: boolean }) {
  const cls = pequeno ? "mt-1.5 block w-full rounded-lg px-2 py-1.5 text-center text-[11px] font-bold" : "mt-3 block w-full rounded-xl px-3 py-2 text-center text-sm font-bold";
  if (d.whatsapp) {
    if (previa) return <span className={`${cls} bg-[#16A34A] text-white`}>Pedir no WhatsApp</span>;
    return <a href={linkPedido(d.whatsapp, p)} target="_blank" rel="noreferrer nofollow" onClick={() => contarClique(d.numero, p.id)} className={`${cls} bg-[#16A34A] text-white hover:bg-[#15803d]`}>Pedir no WhatsApp</a>;
  }
  if (!d.atendente) return null;
  if (previa) return <span className={`${cls} bg-[#EEF3FF] text-[#1D4ED8]`}>Perguntar à atendente</span>;
  return <button type="button" onClick={() => perguntarAtendente(`Oi! Quero saber do produto ${p.nome} (${p.preco == null ? "sob consulta" : precoBR(p.preco)}).`)} className={`${cls} bg-[#EEF3FF] text-[#1D4ED8] hover:bg-[#dfe8ff]`}>Perguntar à atendente</button>;
}

// Só o desenho (usado na loja e na prévia do dono em /app/vitrine). previa = botões que não abrem nada.
function Contador({ q, mudar, pequeno }: { q: number; mudar: (n: number) => void; pequeno?: boolean }) {
  const alto = pequeno ? "h-7 text-[12px]" : "h-9 text-sm";
  if (!q) return <button type="button" onClick={() => mudar(1)} className={`${pequeno ? "mt-1.5" : "mt-2"} ${alto} w-full rounded-lg border border-[#16A34A] font-bold text-[#15803d] hover:bg-[#EAF7EE]`}>+ Adicionar ao pedido</button>;
  return (
    <div className={`${pequeno ? "mt-1.5" : "mt-2"} ${alto} flex w-full items-center justify-between rounded-lg bg-[#EAF7EE] font-bold text-[#166534]`} role="group" aria-label="Quantidade">
      <button type="button" onClick={() => mudar(q - 1)} aria-label="Tirar um" className="h-full w-9 rounded-l-lg hover:bg-[#d8f0e0]">−</button>
      <span className="tabular-nums">{q}</span>
      <button type="button" onClick={() => mudar(Math.min(99, q + 1))} aria-label="Pôr mais um" className="h-full w-9 rounded-r-lg hover:bg-[#d8f0e0]">+</button>
    </div>
  );
}
function BarraPedido({ d, pedido, limpar, pequeno }: { d: DadosVitrine; pedido: Pedido; limpar: () => void; pequeno?: boolean }) {
  const itens = d.produtos.filter((p) => (pedido[p.id] ?? 0) > 0); if (!itens.length) return null;
  const n = itens.reduce((a, p) => a + pedido[p.id], 0), total = itens.reduce((a, p) => a + (p.preco ?? 0) * pedido[p.id], 0), consulta = itens.some((p) => p.preco == null);
  const texto = textoPedido(d, pedido);
  const enviar = () => avisarClique(d.numero, "produto", "pedido"); // conta como pedido e faz sair o motoboy
  const cls = `${pequeno ? "px-2 py-1.5 text-[11px]" : "px-4 py-2.5 text-sm"} rounded-xl font-bold text-white`;
  return (
    <div className={`${pequeno ? "mt-2 rounded-xl p-2" : "sticky bottom-3 z-10 mt-4 rounded-2xl p-3 shadow-xl"} flex flex-wrap items-center justify-between gap-2 bg-[#1D2128] text-white`}>
      <span className={pequeno ? "text-[11px]" : "text-sm"}>🧺 <b>{n} {n === 1 ? "item" : "itens"}</b> · {total ? precoBR(total) : "a combinar"}{consulta && total ? " + sob consulta" : ""}</span>
      <span className="flex items-center gap-1.5">
        <button type="button" onClick={limpar} className={`${pequeno ? "text-[11px]" : "text-sm"} rounded-lg px-2 py-1 text-white/70 hover:text-white`}>Limpar</button>
        {d.whatsapp
          ? <a href={`https://wa.me/${numeroZap(d.whatsapp)}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer nofollow" onClick={enviar} className={`${cls} bg-[#16A34A] hover:bg-[#15803d]`}>Enviar pedido no WhatsApp</a>
          : d.atendente ? <button type="button" onClick={() => { enviar(); perguntarAtendente(texto.replace(/\n/g, " ")); }} className={`${cls} bg-[#1D4ED8] hover:bg-[#1a44c2]`}>Mandar à atendente</button> : null}
      </span>
    </div>
  );
}

export function VitrineVisual({ d, compacto, previa }: { d: DadosVitrine; compacto?: boolean; previa?: boolean }) {
  const [pedido, setPedido] = useState<Pedido>({});
  if (!d.produtos.length) return null;
  const mudar = (id: string) => (n: number) => setPedido((p) => ({ ...p, [id]: Math.max(0, n) }));
  const podePedir = !previa && (!!d.whatsapp || !!d.atendente);
  if (compacto) return (
    <div className="rounded-2xl border border-black/5 bg-[#F6F8FB] p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#5B6472]">🛍️ Vitrine · {d.produtos.length} {d.produtos.length === 1 ? "produto" : "produtos"}</span>
        {!previa && <a href={`/loja/${d.numero}#vitrine`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#1D4ED8] hover:underline">Ver tudo ↗</a>}
      </div>
      <ul className="sem-barra flex snap-x snap-mandatory gap-2 overflow-x-auto pb-0.5" aria-label={`Produtos da ${d.empresa}`}>
        {d.produtos.map((p) => (
          <li key={p.id} className="w-[8.6rem] shrink-0 snap-start rounded-xl bg-white p-1.5 shadow-sm">
            <Foto p={p} cor={d.cor} classe="aspect-[4/3] w-full rounded-lg" />
            <div className="mt-1 line-clamp-2 min-h-[2.1rem] text-[12px] font-bold leading-tight text-[#1D2128]">{p.nome}</div>
            <div className={`text-[12px] font-semibold ${p.preco == null ? "text-[#5B6472]" : "text-[#15803d]"}`}>{precoBR(p.preco)}</div>
            {podePedir ? <Contador q={pedido[p.id] ?? 0} mudar={mudar(p.id)} pequeno /> : <BotaoPedido d={d} p={p} previa={previa} pequeno />}
          </li>
        ))}
      </ul>
      {podePedir && <BarraPedido d={d} pedido={pedido} limpar={() => setPedido({})} pequeno />}
    </div>
  );
  return (
    <>
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {d.produtos.map((p) => (
        <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--linha,#E3E6EB)] bg-white">
          <Foto p={p} cor={d.cor} classe="aspect-square w-full" />
          <div className="flex flex-1 flex-col p-3">
            <b className="line-clamp-2 text-[15px] leading-snug text-[#1D2128]">{p.nome}</b>
            <span className={`mt-0.5 text-[15px] font-semibold ${p.preco == null ? "text-[var(--tinta-2,#5B6472)]" : "text-[#15803d]"}`}>{precoBR(p.preco)}</span>
            {p.descricao && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-[var(--tinta-2,#5B6472)]">{p.descricao}</p>}
            <div className="mt-auto">{podePedir ? <Contador q={pedido[p.id] ?? 0} mudar={mudar(p.id)} /> : <BotaoPedido d={d} p={p} previa={previa} />}</div>
          </div>
        </li>
      ))}
    </ul>
    {podePedir && <BarraPedido d={d} pedido={pedido} limpar={() => setPedido({})} />}
    </>
  );
}

export function VitrineLoja({ numero, compacto }: { numero: number; compacto?: boolean }) {
  // guardado com o número: trocar de loja não mostra os produtos da anterior
  const [estado, setEstado] = useState<{ numero: number; d: DadosVitrine | null } | null>(null);
  useEffect(() => {
    if (!numero) return;
    let vivo = true;
    fetch(`/api/workend/loja/${numero}/vitrine`).then((r) => (r.ok ? r.json() : null)).then((j) => vivo && setEstado({ numero, d: j?.produtos ? (j as DadosVitrine) : null })).catch(() => vivo && setEstado({ numero, d: null }));
    return () => { vivo = false; };
  }, [numero]);
  const d = estado?.numero === numero ? estado.d : null;
  if (!d?.produtos.length) return null;
  if (compacto) return <VitrineVisual d={d} compacto />;
  return (
    <section id="vitrine" className="scroll-mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[1.5rem]">Vitrine</h2>
        <span className="text-sm text-[var(--tinta-2,#5B6472)]">{d.whatsapp ? `Peça direto no WhatsApp da ${d.empresa}. O pagamento é combinado com a loja.` : "Pergunte à atendente sobre prazo e entrega."}</span>
      </div>
      <VitrineVisual d={d} />
    </section>
  );
}
