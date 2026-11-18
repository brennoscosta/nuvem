"use client";
// Tela de Vendas do dono (17/11/2026): "Receber pelo Pix" (chave, nome e cidade de quem recebe), os números do momento e
// a lista de pedidos com filtro por status e o detalhe (no computador, ao lado; no celular, dentro do próprio pedido).
// A lista se atualiza sozinha a cada 20 s com a aba à mostra (pedido novo chega também pelo sino).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icone } from "@/office/ui/Icone";
import { SELO_STATUS, reaisBR, copiarTexto } from "@/office/ui/CartaoPedido";

type Status = "aguardando" | "pago" | "entregue" | "cancelado";
type TipoChave = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
type Pix = { tipo: TipoChave; tipoNome: string; chave: string; nome: string; cidade: string; comoAparece: string } | null;
type PedidoDono = {
  id: string; numero: number; status: Status; empresa: string; lojaNumero: number | null; itens: { nome: string; qtd: number; precoCentavos: number }[];
  subtotal: number; desconto: number; total: number; cupom: string | null; pix: string | null; temPix: boolean; criadoEm: string; pagoEm: string | null; atualizadoEm: string;
  canceladoPor: string | null; clienteNome: string; clienteContato: string; whatsapp: string | null; email: string | null;
};
type Dados = { pix: Pix; contagem: Record<Status | "todos", number>; somas: { aguardando: number; recebido30: number }; pedidos: PedidoDono[] };

const TIPOS: { id: TipoChave; nome: string; exemplo: string; teclado: "text" | "numeric" | "email" | "tel" }[] = [
  { id: "cpf", nome: "CPF", exemplo: "000.000.000-00", teclado: "numeric" },
  { id: "cnpj", nome: "CNPJ", exemplo: "00.000.000/0001-00", teclado: "numeric" },
  { id: "email", nome: "E-mail", exemplo: "voce@exemplo.com", teclado: "email" },
  { id: "telefone", nome: "Celular", exemplo: "(79) 99999-0000", teclado: "tel" },
  { id: "aleatoria", nome: "Aleatória", exemplo: "123e4567-e89b-12d3-a456-426614174000", teclado: "text" },
];
const FILTROS: { id: Status | "todos"; nome: string }[] = [{ id: "todos", nome: "Todos" }, { id: "aguardando", nome: "Aguardando" }, { id: "pago", nome: "Pagos" }, { id: "entregue", nome: "Entregues" }, { id: "cancelado", nome: "Cancelados" }];
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
// prévia do que o app do banco mostra (o servidor faz a mesma limpeza no BR Code)
const semAcento = (t: string, max: number) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .,\-/&]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
function adivinhar(s: string): TipoChave | null {
  const t = s.trim(); if (!t) return null;
  if (t.includes("@")) return "email";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return "aleatoria";
  if (t.startsWith("+") || /^\(\d{2}\)/.test(t)) return "telefone";
  const d = t.replace(/\D/g, "");
  return d.length === 14 ? "cnpj" : d.length === 11 ? "cpf" : null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as T;
}

export function PainelVendas({ pedidoInicial, statusInicial, temLoja }: { pedidoInicial: string | null; statusInicial: string | null; temLoja: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [filtro, setFiltro] = useState<Status | "todos">(FILTROS.some((f) => f.id === statusInicial) ? (statusInicial as Status) : "todos");
  const [aberto, setAberto] = useState<string | null>(pedidoInicial);
  useEffect(() => {
    let vivo = true;
    api<Dados>("/api/workend/vendas").then((d) => { if (vivo) { setDados(d); setErroLista(null); } }).catch((e) => vivo && setErroLista((e as Error).message));
    return () => { vivo = false; };
  }, [versao]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") setVersao((v) => v + 1); }, 20000);
    return () => clearInterval(t);
  }, []);
  if (!dados) return <section className="faixa mt-6"><p className="text-[var(--tinta-2)]">{erroLista ?? "Carregando as vendas…"}</p></section>;
  const lista = dados.pedidos.filter((p) => filtro === "todos" || p.status === filtro);
  const sel = dados.pedidos.find((p) => p.id === aberto) ?? null;
  const atualizar = (p: Partial<PedidoDono> & { id: string }) => { setDados((d) => (d ? { ...d, pedidos: d.pedidos.map((x) => (x.id === p.id ? { ...x, ...p } : x)) } : d)); setVersao((v) => v + 1); };

  return (
    <>
      <section className="faixa mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
        <ReceberPix pix={dados.pix} salvo={() => setVersao((v) => v + 1)} />
        <div className="grid grid-cols-2 gap-3 self-start [&>*]:min-w-0">
          <div className="pg-cartao col-span-2 p-4 sm:p-5">
            <span className="text-[13px] font-semibold text-[var(--tinta-2)]">Esperando pagamento</span>
            <div className="mt-1 text-[1.8rem] font-bold leading-none tabular-nums">{reaisBR(dados.somas.aguardando)}</div>
            <p className="mt-1.5 text-[13.5px] text-[var(--tinta-2)]">{dados.contagem.aguardando} {dados.contagem.aguardando === 1 ? "pedido" : "pedidos"} · confira no app do banco antes de confirmar</p>
          </div>
          <div className="pg-cartao p-4"><span className="text-[13px] font-semibold text-[var(--tinta-2)]">Recebido em 30 dias</span><div className="mt-1 text-[1.25rem] font-bold tabular-nums">{reaisBR(dados.somas.recebido30)}</div></div>
          <div className="pg-cartao p-4"><span className="text-[13px] font-semibold text-[var(--tinta-2)]">Pedidos</span><div className="mt-1 text-[1.25rem] font-bold tabular-nums">{dados.contagem.todos}</div></div>
        </div>
      </section>

      <section className="faixa mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.4rem]">Pedidos</h2>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por status">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={`rounded-full px-3 py-1.5 text-[13.5px] font-semibold ${filtro === f.id ? "bg-[var(--ink)] text-white" : "bg-[var(--surface)] text-[var(--tinta-2)] hover:bg-[var(--surface-dim)]"}`}>
                {f.nome} <span className="tabular-nums opacity-70">{dados.contagem[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
        {!dados.pedidos.length ? (
          <div className="pg-cartao mt-4 p-6 text-center sm:p-8">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#E3F6EA] text-[#16A34A]"><Icone nome="recibo" tamanho={26} /></span>
            <b className="mt-3 block text-[17px]">Nenhum pedido ainda</b>
            <p className="mx-auto mt-1 max-w-[52ch] text-[14.5px] text-[var(--tinta-2)]">Quando um visitante pedir à atendente, o pedido aparece aqui e no sino. {temLoja ? "Vitrine com preço e chave Pix cadastrada ajudam a fechar a venda na hora." : "Abra a sua loja no mapa para começar a vender."}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2"><Link href="/app/vitrine" className="btn btn-azul">Montar a vitrine</Link><Link href="/app/cupons" className="btn btn-linha">Criar cupom</Link></div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.05fr] [&>*]:min-w-0">
            <ul className="space-y-2.5" aria-label="Lista de pedidos">
              {!lista.length && <li className="rounded-2xl bg-[var(--surface)] p-5 text-[14.5px] text-[var(--tinta-2)]">Nenhum pedido com esse status.</li>}
              {lista.map((p) => {
                const ativo = p.id === aberto;
                return (
                  <li key={p.id} className={`pg-cartao overflow-hidden ${ativo ? "!border-[var(--azul)] shadow-md" : ""}`}>
                    <button type="button" onClick={() => setAberto(ativo ? null : p.id)} aria-expanded={ativo} className="flex w-full items-center gap-3 p-3.5 text-left sm:p-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[15px] font-bold tabular-nums">#{p.numero}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15.5px]">{p.clienteNome}</b>
                        <small className="block truncate text-[13px] text-[var(--tinta-2)]">{p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ")}</small>
                      </span>
                      <span className="shrink-0 text-right">
                        <b className="block text-[15.5px] tabular-nums">{reaisBR(p.total)}</b>
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-bold ${SELO_STATUS[p.status].cls}`}>{p.status === "aguardando" ? "Aguardando" : SELO_STATUS[p.status].t}</span>
                      </span>
                    </button>
                    {ativo && <div className="border-t border-[var(--line)] p-4 lg:hidden"><Detalhe p={p} atualizar={atualizar} /></div>}
                  </li>
                );
              })}
            </ul>
            <aside className="hidden lg:block">
              <div className="pg-cartao sticky top-24 p-5">
                {sel ? <Detalhe key={sel.id} p={sel} atualizar={atualizar} /> : <p className="py-10 text-center text-[14.5px] text-[var(--tinta-2)]">Escolha um pedido para ver os itens, o contato do cliente e as ações.</p>}
              </div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}

function Detalhe({ p, atualizar }: { p: PedidoDono; atualizar: (p: Partial<PedidoDono> & { id: string }) => void }) {
  const [confirmar, setConfirmar] = useState<"pago" | "entregue" | "cancelar" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const agir = async (acao: "pago" | "entregue" | "cancelar") => {
    setOcupado(true); setErro(null);
    try { const r = await api<Partial<PedidoDono>>(`/api/workend/vendas/${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify({ acao }) }); atualizar({ ...r, id: p.id, pix: p.pix /* o dono continua vendo o copia e cola */ }); setConfirmar(null); }
    catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  const primeiro = p.clienteNome.split(" ")[0];
  const zap = p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Olá, ${primeiro}! Aqui é da ${p.empresa}, sobre o seu pedido #${p.numero} (${reaisBR(p.total)}).`)}` : null;
  const PERGUNTA = { pago: `Você conferiu no app do banco que o Pix de ${reaisBR(p.total)} caiu na sua conta?`, entregue: "Marcar o pedido como entregue ao cliente?", cancelar: p.status === "pago" ? "Cancelar este pedido? Se o cliente já pagou, devolva o Pix pelo seu banco." : "Cancelar este pedido? O cupom, se houver, volta a valer para o cliente." } as const;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[1.2rem]">Pedido #{p.numero}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-bold ${SELO_STATUS[p.status].cls}`}>{SELO_STATUS[p.status].t}{p.status === "cancelado" && p.canceladoPor ? (p.canceladoPor === "cliente" ? " pelo cliente" : " por você") : ""}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--tinta-2)]">Feito em {quando(p.criadoEm)} pela atendente de IA{p.empresa ? ` · ${p.empresa}` : ""}{p.pagoEm ? ` · pago em ${quando(p.pagoEm)}` : ""}</p>

      <div className="mt-4 rounded-xl bg-[var(--surface)] p-3.5">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--tinta-2)]">Cliente</span>
        <b className="mt-0.5 block text-[15.5px]">{p.clienteNome}</b>
        <span className="block break-all text-[14px] text-[var(--tinta-2)]">{p.clienteContato}</span>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {zap && <a href={zap} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-2 text-[13.5px] font-bold text-white hover:bg-[#15803d]"><Icone nome="conversar" tamanho={16} />Chamar no WhatsApp</a>}
          {p.email && <a href={`mailto:${p.email}?subject=${encodeURIComponent(`Seu pedido #${p.numero}`)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13.5px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)]"><Icone nome="enviar" tamanho={16} />Mandar e-mail</a>}
        </div>
      </div>

      <table className="mt-4 w-full text-[14.5px]">
        <caption className="sr-only">Itens do pedido</caption>
        <tbody>
          {p.itens.map((i, k) => <tr key={k} className="border-b border-[var(--line)]/60"><td className="py-1.5 pr-2">{i.qtd}× {i.nome}<small className="block text-[12px] text-[var(--tinta-2)]">{reaisBR(i.precoCentavos)} cada</small></td><td className="py-1.5 text-right tabular-nums">{reaisBR(i.precoCentavos * i.qtd)}</td></tr>)}
          {p.desconto > 0 && <>
            <tr><td className="pt-2 text-[var(--tinta-2)]">Subtotal</td><td className="pt-2 text-right tabular-nums text-[var(--tinta-2)]">{reaisBR(p.subtotal)}</td></tr>
            <tr><td className="text-[#15803D]">Cupom {p.cupom}</td><td className="text-right tabular-nums text-[#15803D]">−{reaisBR(p.desconto)}</td></tr>
          </>}
          <tr><td className="pt-2 text-[16px] font-bold">Total</td><td className="pt-2 text-right text-[16px] font-bold tabular-nums">{reaisBR(p.total)}</td></tr>
        </tbody>
      </table>

      <div className="mt-4 text-[13.5px]">
        {p.temPix
          ? <div className="rounded-xl border border-[var(--line)] p-3">
              <p>O cliente recebeu um <b>Pix copia e cola com a sua chave</b> e o valor do pedido. Se precisar mandar de novo:</p>
              {p.pix && <code className="mt-2 block max-h-16 overflow-hidden break-all rounded-lg bg-[var(--surface)] px-2 py-1.5 text-[11.5px] text-[var(--tinta-2)]">{p.pix}</code>}
              {p.pix && <button type="button" onClick={async () => { await copiarTexto(p.pix!); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--azul)] hover:underline"><Icone nome={copiado ? "check" : "copiar"} tamanho={15} />{copiado ? "Copiado" : "Copiar o Pix copia e cola"}</button>}
            </div>
          : <p className="rounded-xl bg-[#FFF4DB] p-3 text-[#5B4300]">Este pedido foi feito sem chave Pix cadastrada: <b>combine o pagamento com o cliente</b> pelo contato acima.</p>}
      </div>

      {(p.status === "aguardando" || p.status === "pago") && (
        <div className="mt-5">
          {confirmar ? (
            <div className="rounded-xl bg-[var(--surface)] p-3.5" role="alertdialog" aria-label="Confirmar ação">
              <p className="text-[14.5px] font-semibold">{PERGUNTA[confirmar]}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={ocupado} onClick={() => void agir(confirmar)} className={`btn !py-2.5 ${confirmar === "cancelar" ? "bg-[#E2575B] text-white" : "btn-azul"}`}>{ocupado ? "Salvando…" : confirmar === "pago" ? "Sim, o Pix caiu" : confirmar === "entregue" ? "Sim, foi entregue" : "Sim, cancelar"}</button>
                <button type="button" disabled={ocupado} onClick={() => setConfirmar(null)} className="btn btn-linha !py-2.5">Voltar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.status === "aguardando" && <button type="button" onClick={() => setConfirmar("pago")} className="btn btn-azul !py-2.5"><Icone nome="check" tamanho={17} />Confirmar pagamento</button>}
              {p.status === "pago" && <button type="button" onClick={() => setConfirmar("entregue")} className="btn btn-azul !py-2.5"><Icone nome="sacola" tamanho={17} />Marcar como entregue</button>}
              <button type="button" onClick={() => setConfirmar("cancelar")} className="btn btn-linha !py-2.5 text-[#9B1C1C]">Cancelar</button>
            </div>
          )}
          {erro && <p className="mt-2 text-[14px] font-semibold text-[#B42318]" role="alert">{erro}</p>}
          <p className="mt-3 text-[12.5px] text-[var(--tinta-2)]">O WorkEnd não vê o dinheiro: só você sabe se o Pix caiu. Quando você confirma, o cartão do pedido muda na conversa do cliente e ele recebe um aviso.</p>
        </div>
      )}
    </div>
  );
}

function ReceberPix({ pix, salvo }: { pix: Pix; salvo: () => void }) {
  const [editando, setEditando] = useState(!pix);
  const [f, setF] = useState({ tipo: (pix?.tipo ?? "") as TipoChave | "", chave: pix?.chave ?? "", nome: pix?.nome ?? "", cidade: pix?.cidade ?? "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [remover, setRemover] = useState(false);
  const tipo = f.tipo || adivinhar(f.chave) || "";
  const t = TIPOS.find((x) => x.id === tipo);
  const salvar = async () => {
    setOcupado(true); setErro(null); setAviso(null);
    try { await api("/api/workend/vendas/pix", { method: "POST", body: JSON.stringify({ ...f, tipo }) }); setAviso("Chave Pix salva. Os próximos pedidos já saem com o seu Pix."); setEditando(false); salvo(); }
    catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  const apagar = async () => {
    setOcupado(true); setErro(null);
    try { await api("/api/workend/vendas/pix", { method: "DELETE" }); setF({ tipo: "", chave: "", nome: "", cidade: "" }); setEditando(true); setRemover(false); setAviso(null); salvo(); }
    catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  return (
    <div id="pix" className={`pg-cartao scroll-mt-24 p-5 sm:p-6 ${!pix ? "!border-[#E9B949] !bg-[#FFFBEF]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 !text-[1.25rem]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E3F6EA] text-[#16A34A]"><Icone nome="banco" tamanho={20} /></span>Receber pelo Pix</h2>
          <p className="mt-1.5 max-w-[56ch] text-[14.5px] text-[var(--tinta-2)]">
            {pix ? "Cada pedido sai com um Pix copia e cola com esta chave e o valor certo. O dinheiro vai direto para você." : <><b className="text-[var(--ink)]">Cadastre a sua chave Pix para receber os pedidos.</b> Sem ela, o pedido é criado do mesmo jeito, mas você precisa combinar o pagamento com cada cliente.</>}
          </p>
        </div>
        {pix && !editando && <button type="button" onClick={() => { setEditando(true); setAviso(null); }} className="btn btn-linha !px-3.5 !py-2 text-[14px]"><Icone nome="editar" tamanho={16} />Alterar</button>}
      </div>
      {aviso && <p className="mt-3 rounded-lg bg-[#E3F6EA] px-3 py-2 text-[14px] text-[#166534]" role="status">{aviso}</p>}

      {pix && !editando && (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-[14.5px] sm:grid-cols-2 [&>*]:min-w-0">
          <div><dt className="text-[12.5px] font-semibold text-[var(--tinta-2)]">Chave ({pix.tipoNome})</dt><dd className="break-all font-semibold">{pix.chave}</dd></div>
          <div><dt className="text-[12.5px] font-semibold text-[var(--tinta-2)]">Como aparece no app do banco</dt><dd className="break-words font-semibold">{pix.comoAparece}</dd></div>
          <div className="sm:col-span-2">
            {remover
              ? <span className="flex flex-wrap items-center gap-2 text-[13.5px]"><b>Tirar a chave? Os próximos pedidos saem sem Pix.</b><button type="button" disabled={ocupado} onClick={() => void apagar()} className="rounded-lg bg-[#E2575B] px-3 py-1.5 font-bold text-white">Tirar</button><button type="button" onClick={() => setRemover(false)} className="rounded-lg bg-[var(--surface)] px-3 py-1.5 font-semibold">Voltar</button></span>
              : <button type="button" onClick={() => setRemover(true)} className="text-[13.5px] font-semibold text-[#9B1C1C] hover:underline">Tirar a chave Pix</button>}
          </div>
        </dl>
      )}

      {editando && (
        <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="mt-4 space-y-3">
          <fieldset>
            <legend className="text-[13.5px] font-semibold text-[var(--tinta-2)]">Tipo da chave</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TIPOS.map((x) => <button key={x.id} type="button" aria-pressed={tipo === x.id} onClick={() => setF({ ...f, tipo: x.id })} className={`rounded-full px-3 py-1.5 text-[13.5px] font-semibold ring-1 ${tipo === x.id ? "bg-[var(--ink)] text-white ring-[var(--ink)]" : "bg-white text-[var(--tinta-2)] ring-[var(--line)]"}`}>{x.nome}</button>)}
            </div>
          </fieldset>
          <label className="campo">Chave Pix
            <input value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value.slice(0, 80) })} inputMode={t?.teclado ?? "text"} autoComplete="off" placeholder={t?.exemplo ?? "CPF, CNPJ, e-mail, celular ou chave aleatória"} required />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <label className="campo">Nome de quem recebe <small className="!m-0 inline text-[12px] font-normal">(como no banco, até 25)</small>
              <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.slice(0, 25) })} maxLength={25} placeholder="Ex.: Ana Souza" required />
            </label>
            <label className="campo">Cidade <small className="!m-0 inline text-[12px] font-normal">(até 15)</small>
              <input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value.slice(0, 15) })} maxLength={15} placeholder="Ex.: Aracaju" required />
            </label>
          </div>
          {(f.nome || f.cidade) && <p className="text-[13px] text-[var(--tinta-2)]">No app do banco do cliente aparece: <b className="text-[var(--ink)]">{semAcento(f.nome, 25) || "…"} · {semAcento(f.cidade, 15) || "…"}</b></p>}
          {erro && <p className="rounded-lg bg-[#FDECEC] px-3 py-2 text-[14px] text-[#9B1C1C]" role="alert">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={ocupado || !f.chave.trim() || !f.nome.trim() || !f.cidade.trim()} className="btn btn-azul">{ocupado ? "Salvando…" : "Salvar chave Pix"}</button>
            {pix && <button type="button" onClick={() => { setEditando(false); setErro(null); setF({ tipo: pix.tipo, chave: pix.chave, nome: pix.nome, cidade: pix.cidade }); }} className="btn btn-linha">Cancelar</button>}
          </div>
          <p className="text-[12.5px] text-[var(--tinta-2)]">O WorkEnd só usa a chave para montar o Pix copia e cola dos seus pedidos. Como em qualquer cobrança por Pix, a chave vai dentro do código que o cliente recebe.</p>
        </form>
      )}
    </div>
  );
}
