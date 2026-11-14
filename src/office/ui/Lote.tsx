"use client";
// Cartão do lote (o que tem ali, status, "Quero esse chão") e o painel "Montar minha empresa" (nome, logo, cor),
// que reflete ao vivo na placa e no tapume do lote. Reservar precisa da conta do WorkEnd.
import { useEffect, useRef, useState } from "react";
import { useMundo, LOTE_POR_CHAVE, descricaoLote, linkCadastro, modoMundo, CORES_EMPRESA, useAgora, promocaoAtiva } from "../mundoStore";
import { NICHOS, bairroDoLote } from "../data/mundo";
import { NomearRua } from "./NomearRua";
import { FotoPredio } from "./FotoPredio";
import { useEscritorio } from "../store";
import { BotoesPersonagem } from "./BotoesPersonagem";
import { FLUTUANTE, LARGO, ESTREITO } from "./estilo";
import { ChatLoja, Contatos, Estrelas, useLoja } from "./ChatLoja";
import { AgendarLoja } from "./AgendarLoja";
import { BotaoSeguir } from "./BotaoSeguir";
import { PegarCupom } from "./PegarCupom";
import { VitrineLoja } from "./VitrineLoja";
import { PRACA_CHAVE } from "../data/praca";

// Contagem regressiva da reserva (usa o relógio do servidor); quando zera, recarrega (o lote volta a ficar livre)
function useContagem(ate: string | null | undefined) {
  const desvio = useMundo((s) => s.desvioRelogio);
  const carregar = useMundo((s) => s.carregar);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ate) return;
    const fim = new Date(ate).getTime();
    let avisou = false;
    const t = setInterval(() => {
      const n = Date.now(); setAgora(n);
      if (!avisou && fim - (n + desvio) <= 0) { avisou = true; carregar(); } // zerou: o lote voltou a ficar livre
    }, 1000);
    return () => clearInterval(t);
  }, [ate, desvio, carregar]);
  const resta = ate ? Math.max(0, new Date(ate).getTime() - (agora + desvio)) : null;
  return { resta, agora: agora + desvio };
}
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Cotação do Pix do meu lote (12/11/2026): oferta de entrada (fundador, feira, indicação) e crédito de indicação
interface Cotacao { valor: number; base: number; primeiroMes: number | null; oferta: { id: string; nome: string; desconto: number; detalhe: string } | null; creditoUsado: number; creditoDisponivel: number; admin: boolean }
function useCotacao(chave: string | null, ligado: boolean, versao: string) {
  const [cot, setCot] = useState<{ k: string; c: Cotacao } | null>(null);
  const k = `${chave}|${versao}`;
  useEffect(() => {
    if (!ligado || !chave) return;
    let vivo = true;
    fetch(`/api/terrenos/${encodeURIComponent(chave)}/pagar`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j) setCot({ k, c: j as Cotacao }); }).catch(() => {});
    return () => { vivo = false; };
  }, [chave, ligado, k]);
  return ligado && cot?.k === k ? cot.c : null;
}
function ResumoPreco({ cot, preco }: { cot: Cotacao | null; preco: number }) {
  if (!cot || (!cot.oferta && !cot.creditoUsado)) return null;
  const cheio = cot.admin ? preco : cot.base;
  return (
    <div className="mt-2 rounded-2xl bg-[#EAF7EE] px-3 py-2 text-xs text-[#166534]">
      {cot.oferta && <div><b>🎉 {cot.oferta.nome}:</b> 1º mês de <s>{brl(cheio)}</s> por <b>{brl(cot.valor + (cot.admin ? 0 : cot.creditoUsado))}</b>. <span className="opacity-80">{cot.oferta.detalhe}</span></div>}
      {cot.creditoUsado > 0 && <div className={cot.oferta ? "mt-1" : ""}><b>Desconto de indicação:</b> − {brl(cot.creditoUsado)}{cot.creditoDisponivel > cot.creditoUsado ? ` (sobram ${brl(cot.creditoDisponivel - cot.creditoUsado)} para as próximas)` : ""}.</div>}
    </div>
  );
}
// quem abriu o link de indicação em outro aparelho digita o código aqui
function CodigoIndicacao({ aoAplicar }: { aoAplicar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!aberto) return <button onClick={() => setAberto(true)} className="mt-2 w-full text-center text-[11px] font-semibold text-[#1D4ED8] hover:underline">Uma empresa do mapa te indicou? Use o código dela</button>;
  const aplicar = async () => {
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch("/api/workend/indicacao", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ ok: false, t: j.erro ?? `Erro ${r.status}` }); else { setMsg({ ok: true, t: `Indicação de ${j.empresa} aplicada.` }); aoAplicar(); }
    } finally { setEnviando(false); }
  };
  return (
    <div className="mt-2 rounded-2xl bg-[#F1F3F6] p-2">
      <div className="flex gap-1.5">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="Código (ex.: K7Q2MX)" aria-label="Código de indicação" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-base sm:text-xs" />
        <button onClick={aplicar} disabled={enviando || codigo.length < 4} className="rounded-lg bg-[#1D4ED8] px-3 text-xs font-bold text-white disabled:opacity-50">{enviando ? "…" : "Aplicar"}</button>
      </div>
      {msg && <div className={`mt-1 text-[11px] font-semibold ${msg.ok ? "text-[#166534]" : "text-[#B42318]"}`}>{msg.t}</div>}
    </div>
  );
}

// Pix aberto no cartão: QR Code, copia e cola, relógio e conferência automática a cada 4 s
export function PixAberto({ chave }: { chave: string }) {
  const pix = useMundo((s) => s.pix);
  const conferir = useMundo((s) => s.conferirPagamento);
  const fechar = useMundo((s) => s.fecharPix);
  const [copiado, setCopiado] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const { resta } = useContagem(pix && pix.status === "pendente" ? pix.expiraEm : null);
  const pendente = !!pix && pix.status === "pendente" && pix.lote === chave;
  const painelEsc = useMundo((s) => s.painelEscritorio);
  useEffect(() => {
    if (!pendente || !pix) return;
    const t = setInterval(() => { void conferir(pix.id); }, 4000);
    return () => clearInterval(t);
  }, [pendente, pix, conferir]);
  if (!pix || pix.lote !== chave) return null;
  if (pix.tipo === "layout" && !painelEsc) return null; // o Pix da troca de prédio aparece dentro do painel do escritório
  const copiar = async () => { try { await navigator.clipboard.writeText(pix.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt("Copie o código Pix:", pix.codigo); } };
  if (pix.status === "aprovado") return (
    <div className="mt-3 rounded-2xl bg-[#E3F6EA] px-3 py-3 text-sm text-[#166534]"><div className="font-bold">Pagamento confirmado! 🎉</div><div className="mt-1 text-xs">{pix.tipo === "layout" ? "Crédito de troca de prédio liberado: salve o escritório com o prédio novo." : pix.tipo === "personagem" ? "Seu personagem está ativo por 30 dias. Clique no chão pra andar e nos outros pra conversar." : pix.tipo === "outdoor" ? "Seu anúncio já está no outdoor por 30 dias. Quem clicar nele vem até a sua loja." : pix.tipo === "barraca" ? "Sua barraca está garantida no sábado. Ela aparece na praça das 8h às 18h, com o seu nome na placa." : pix.tipo === "item" ? "Item liberado: o seu personagem já está usando." : "O chão é seu por 30 dias. Monte seu escritório pelos botões de edição."}</div><button onClick={fechar} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white">Fechar</button></div>
  );
  if (pix.status !== "pendente") return (
    <div className="mt-3 rounded-2xl bg-[#FDE8E8] px-3 py-3 text-sm text-[#8A2A2A]"><div className="font-bold">{pix.status === "expirado" ? "Este Pix expirou." : "Pagamento não aprovado."}</div><button onClick={fechar} className="mt-2 w-full rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white">Gerar outro Pix</button></div>
  );
  return (
    <div className="mt-3 rounded-2xl border border-[#16A34A]/30 bg-[#F3FBF5] p-3 text-sm">
      <div className="flex items-center justify-between"><div className="font-bold text-[#166534]">Pague {brl(pix.valor)} no Pix</div>{resta != null && <div className="text-xs text-[#5B6472]">vale {mmss(resta)}</div>}</div>
      {pix.qrBase64 && <img src={`data:image/png;base64,${pix.qrBase64}`} alt="QR Code Pix" className="mx-auto mt-2 h-44 w-44 rounded-xl bg-white p-1" />}
      <div className="mt-1 text-center text-[11px] text-[#5B6472]">Abra o app do seu banco, escolha Pix → ler QR Code, ou copie o código:</div>
      <button onClick={copiar} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white hover:bg-[#15803d]">{copiado ? "Código copiado ✓" : "Copiar código Pix (copia e cola)"}</button>
      <div className="mt-2 flex gap-2">
        <button onClick={async () => { setConferindo(true); await conferir(pix.id); setConferindo(false); }} disabled={conferindo} className="flex-1 rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs font-semibold text-[#1D4ED8] disabled:opacity-50">{conferindo ? "Conferindo…" : "Já paguei"}</button>
        <button onClick={fechar} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs font-semibold text-[#5B6472]">Fechar</button>
      </div>
      <div className="mt-1 text-center text-[10px] text-[#5B6472]">Confirmamos sozinhos assim que o banco avisar (segundos).</div>
    </div>
  );
}

export function CartaoLote() {
  const chave = useMundo((s) => s.loteSelecionado);
  const terreno = useMundo((s) => (chave ? s.terrenos[chave] : undefined));
  const meu = useMundo((s) => s.meu);
  const usuario = useMundo((s) => s.usuario);
  const admin = useMundo((s) => s.admin);
  const preco = useMundo((s) => s.preco);
  const fundador = useMundo((s) => s.fundador);
  const minutos = useMundo((s) => s.minutosReserva);
  const pagamentoLigado = useMundo((s) => s.pagamentoLigado);
  const pagando = useMundo((s) => s.pagando);
  const [recargaCot, setRecargaCot] = useState(0);
  const meuCedo = !!chave && !!terreno && (meu === chave || (!!usuario && terreno.usuarioId === usuario.id));
  const cot = useCotacao(chave, meuCedo && pagamentoLigado, `${terreno?.status}|${terreno?.pagoAte}|${recargaCot}`);
  const painel = useMundo((s) => s.painelEmpresa);
  const painelEsc = useMundo((s) => s.painelEscritorio);
  const abrirEscritorio = useMundo((s) => s.abrirEscritorio);
  const selecionarLote = useMundo((s) => s.selecionarLote);
  const abrirPainel = useMundo((s) => s.abrirPainel);
  const desistir = useMundo((s) => s.desistir);
  const pagar = useMundo((s) => s.pagar);
  const pixAberto = useMundo((s) => !!s.pix && s.pix.lote === s.loteSelecionado && s.pix.status === "pendente");
  const terrenos = useMundo((s) => s.terrenos);
  const carregar = useMundo((s) => s.carregar);
  const [ampliando, setAmpliando] = useState(false);
  const vagasDoLote = useMundo((s) => (s.loteSelecionado ? s.vagas[s.loteSelecionado] ?? 0 : 0));
  const agenteSelecionado = useEscritorio((s) => s.selecionado);
  const [confirma, setConfirma] = useState<string | null>(null); // lote cujo "Desistir" está aguardando confirmação
  const [erro, setErro] = useState<string | null>(null);
  const { resta, agora } = useContagem(terreno?.status === "reservado" ? terreno.reservadoAte : null);
  if (!chave || painel || painelEsc || agenteSelecionado) return null;
  if (chave === PRACA_CHAVE) return null; // a praça tem o cartão dela (ui/Praca.tsx)
  const confirmaDesistir = confirma === chave;
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const ehMeu = meu === chave || (!!terreno && !!usuario && terreno.usuarioId === usuario.id);
  // lote duplo (12/11/2026): este lote pode ser a ampliação de um vizinho (anexo) ou ter uma ampliação
  const principal = terreno?.anexoDe ? terrenos[terreno.anexoDe] : null;
  const ehAnexo = !!terreno?.anexoDe;
  const anexoDeste = !ehAnexo && terreno ? Object.values(terrenos).find((t) => t.anexoDe === chave) ?? null : null;
  const vizinho = `${l.i},${l.j},${l.k ^ 1}`; const vizinhoInfo = LOTE_POR_CHAVE[vizinho];
  const vizinhoLivre = !!vizinhoInfo && vizinhoInfo.lote.tipo !== "praca" && !terrenos[vizinho];
  const ampliar = async () => { setErro(null); setAmpliando(true); try { const r = await fetch(`/api/terrenos/${encodeURIComponent(vizinho)}/anexo`, { method: "POST" }); const j = await r.json().catch(() => ({})); if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; } await carregar(); selecionarLote(vizinho); } finally { setAmpliando(false); } };
  const livre = !terreno;
  const ativo = terreno?.status === "ativo";
  const diasRestantes = terreno?.pagoAte ? Math.ceil((new Date(terreno.pagoAte).getTime() - agora) / 86400000) : null;
  const clicarPagar = async (meses = 1) => { setErro(null); const e = await pagar(meses); if (e) setErro(e); };
  return (
    <div data-tour="cartao-loja" className={`${FLUTUANTE} ${ESTREITO} painel-entra !z-10 overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">WorkEnd · Lote {l.numero}</div>
          <div className="text-lg font-bold">{livre ? "À venda" : ehAnexo ? (ehMeu ? "Ampliação do seu prédio" : principal?.empresaNome ?? terreno.empresaNome) : ehMeu ? "Seu chão" : terreno.empresaNome}</div>
          <div className="text-xs text-[#5B6472]">20 × 20 m · {descricaoLote(l)}</div>
          {/* bairro do quarteirão (12/11/2026): só identidade visual, qualquer área compra em qualquer bairro */}
          {(() => { const b = bairroDoLote(chave); return b ? <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: b.cor }}>{b.nome}</span> : null; })()}
        </div>
        <button onClick={() => selecionarLote(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>

      {livre && (
        <>
          <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-[#5B6472]">Mensalidade</span><span className="font-semibold">{brl(preco)}/mês</span></div>
            {!!fundador && fundador.restam > 0 && <div className="mt-1.5 rounded-xl bg-[#EAF7EE] px-2 py-1.5 text-xs font-semibold text-[#166534]">🎉 Preço de fundador: 1º mês por {brl(fundador.valor)} · restam {fundador.restam} de {fundador.vagas} vagas</div>}
            <div className="mt-1 text-xs text-[#5B6472]">Você reserva por {minutos >= 60 ? `${Math.round(minutos / 60)} hora${minutos >= 120 ? "s" : ""}` : `${minutos} minutos`}, coloca o nome e a logo na placa e paga no Pix, direto aqui no mapa (QR Code, sem cadastro no Mercado Pago). Sem pagamento, o lote volta a ficar livre.</div>
          </div>
          {usuario?.banidoEm ? (
            <div className="mt-3 rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">Sua conta está suspensa por descumprir as políticas de uso. Fale com contato@workend.online.</div>
          ) : usuario ? (
            <button onClick={abrirPainel} className="mt-3 w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#1a44c2]">{meu && !admin ? "Trocar meu chão por este" : "Quero esse chão"}</button>
          ) : (
            <a href={linkCadastro(chave)} className="mt-3 block w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[#1a44c2]">Quero esse chão</a>
          )}
          {!usuario && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Você cria sua conta no WorkEnd e volta direto pra este lote.{!modoMundo() && " Abre em workend.online."}</div>}
          {usuario && meu && !admin && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Nesta fase cada conta tem um chão; a reserva atual (Lote {LOTE_POR_CHAVE[meu]?.numero}) fica livre.</div>}
        </>
      )}

      {!livre && (
        <>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#F1F3F6] px-3 py-2">
            {terreno.temLogo ? <img src={`/api/terrenos/${encodeURIComponent(chave)}/logo`} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" /> : <span className="h-10 w-10 rounded-lg" style={{ background: terreno.cor }} />}
            <div className="text-sm">
              <div className="font-semibold">{terreno.empresaNome}</div>
              <div className="text-xs text-[#5B6472]">{ehAnexo ? `Lote duplo com o Lote ${principal ? LOTE_POR_CHAVE[principal.chave]?.numero ?? "" : ""} · ` : ""}{ativo ? `${ehAnexo ? "ativo" : "Empresa ativa"} · até ${terreno.pagoAte ? dataBR(terreno.pagoAte) : "—"}` : resta != null ? `Reservado · expira em ${mmss(resta)}` : "Reservado"}</div>
            </div>
          </div>
          {ehAnexo && ehMeu && !ativo && <div className="mt-2 rounded-2xl bg-[#EEF3FF] px-3 py-2 text-xs text-[#1D4ED8]">Pagando este lote, o seu prédio cresce e passa a ocupar os dois terrenos. Cada lote tem a sua mensalidade.</div>}
          {ehAnexo && principal && <button onClick={() => selecionarLote(principal.chave)} className="mt-2 w-full rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs font-semibold text-[#1D4ED8]">Ir para o lote principal (Lote {LOTE_POR_CHAVE[principal.chave]?.numero})</button>}

          {ehMeu && <PixAberto chave={chave} />}
          {ehMeu && !ativo && !pixAberto && (
            <>
              <div className="mt-3 rounded-2xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Garanta o chão pagando o 1º mês agora. Sem pagamento, a reserva some em {resta != null ? mmss(resta) : `${minutos} min`}.</div>
              {pagamentoLigado
                ? <button onClick={() => clicarPagar(1)} disabled={pagando} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#15803d] disabled:opacity-50">{pagando ? "Gerando o Pix…" : `Pagar ${brl(cot?.valor ?? preco)} no Pix · 1º mês`}</button>
                : <div className="mt-2 rounded-xl bg-[#F1F3F6] px-3 py-2 text-center text-xs text-[#5B6472]">Pagamento em instantes: estamos ligando o Mercado Pago.</div>}
              {pagamentoLigado && <ResumoPreco cot={cot} preco={preco} />}
              {pagamentoLigado && cot?.primeiroMes != null && cot.oferta?.id !== "indicado" && !cot.admin && <CodigoIndicacao aoAplicar={() => setRecargaCot((n) => n + 1)} />}
            </>
          )}
          {ehMeu && ativo && diasRestantes != null && diasRestantes <= 7 && (
            <div className="mt-3 rounded-2xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">{diasRestantes > 0 ? `Vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}.` : "Vencido: você tem 5 dias de tolerância antes de o lote ficar livre."}</div>
          )}
          {ehMeu && ativo && pagamentoLigado && !pixAberto && (
            <button onClick={() => clicarPagar(1)} disabled={pagando} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2 text-sm font-bold text-white hover:bg-[#15803d] disabled:opacity-50">{pagando ? "Gerando o Pix…" : `Renovar +30 dias · ${brl(cot?.valor ?? preco)} no Pix`}</button>
          )}
          {ehMeu && ativo && pagamentoLigado && !pixAberto && <ResumoPreco cot={cot} preco={preco} />}
          {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
          {ehMeu && ativo && !ehAnexo && (
            // a equipe de IA do lote trabalha de verdade desde 11/11/2026 (tela Minha equipe)
            <a href="/app/equipe" className="mt-3 block w-full rounded-xl bg-[#1D2128] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-black">💬 Falar com a minha equipe de IA</a>
          )}
          {ehMeu && ativo && terreno.escritorio && (
            // chão comprado: só opções de edição (prédio, setores, equipe, marca, treino, contratação)
            <div className="mt-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Editar minha empresa</div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
                <button onClick={() => abrirEscritorio("predio")} className="rounded-xl bg-[#EEF3FF] px-2 py-2 text-[#1D4ED8] hover:bg-[#dfe8ff]"><div className="text-base">🏢</div>Prédio</button>
                <button onClick={() => abrirEscritorio("setores")} className="rounded-xl bg-[#EEF3FF] px-2 py-2 text-[#1D4ED8] hover:bg-[#dfe8ff]"><div className="text-base">🗂️</div>Setores · {terreno.escritorio.setores.length}</button>
                <button onClick={() => abrirEscritorio("equipe")} className="rounded-xl bg-[#EEF3FF] px-2 py-2 text-[#1D4ED8] hover:bg-[#dfe8ff]"><div className="text-base">👥</div>Equipe · {terreno.escritorio.equipe.length}</button>
                <button onClick={() => abrirEscritorio("contratar")} className="rounded-xl bg-[#E3F6EA] px-2 py-2 text-[#166534] hover:bg-[#d2efdc]"><div className="text-base">🛒</div>Contratar agentes</button>
                <button onClick={() => abrirEscritorio("treinar")} className="rounded-xl bg-[#FFF4D6] px-2 py-2 text-[#7A5A00] hover:bg-[#ffeab8]"><div className="text-base">🎓</div>Treinar</button>
                <button onClick={abrirPainel} className="rounded-xl bg-[#F1F3F6] px-2 py-2 text-[#1D2128] hover:bg-[#e6e9ee]"><div className="text-base">🎨</div>Marca e logo</button>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
                <button onClick={() => abrirEscritorio("interior")} className="rounded-xl bg-[#F6EEDF] px-2 py-2 text-[#7A4E1F] hover:bg-[#efe3cc]">🛋️ Interior</button>
                <a href="/app/equipe?aba=vagas" className="rounded-xl bg-[#FFF8D6] px-2 py-2 text-[#7A5A00] hover:bg-[#fff0b3]">📋 Vagas{vagasDoLote > 0 ? ` · ${vagasDoLote}` : ""}</a>
                <a href="/app/agenda" className="rounded-xl bg-[#EAF7EE] px-2 py-2 text-[#166534] hover:bg-[#d8f0e0]">📅 Agenda</a>
                <a href="/app/vitrine" className="rounded-xl bg-[#FCE7F3] px-2 py-2 text-[#9D174D] hover:bg-[#fbd5ea]">🛍️ Vitrine</a>
                <a href="/app/resultados" className="col-span-2 rounded-xl bg-[#1D2128] px-2 py-2 text-white hover:bg-black">📈 Resultados da loja</a>
              </div>
              <PromocaoDono chave={chave} />
              <div className="mt-1.5"><FotoPredio chave={chave} /></div>
              <NomearRua />
              {/* lote duplo: o vizinho do lado vira ampliação e o prédio cresce */}
              {anexoDeste ? (
                <button onClick={() => selecionarLote(anexoDeste.chave)} className="mt-2 w-full rounded-xl bg-[#EEF3FF] px-3 py-2 text-left text-xs text-[#1D4ED8]"><b>Lote duplo</b> com o Lote {LOTE_POR_CHAVE[anexoDeste.chave]?.numero} · {anexoDeste.status === "ativo" ? "ativo" : "reservado, falta pagar"} →</button>
              ) : vizinhoLivre ? (
                <div className="mt-2 rounded-2xl border border-dashed border-[#1D4ED8]/40 px-3 py-2.5">
                  <div className="text-xs font-bold text-[#1D2128]">Lote duplo: prédio maior</div>
                  <div className="mt-0.5 text-[11px] text-[#5B6472]">Compre o Lote {vizinhoInfo.numero}, aqui do lado, por {brl(preco)}/mês: seu prédio cresce e ocupa os dois terrenos, com a fachada mais larga da rua.</div>
                  <button onClick={ampliar} disabled={ampliando} className="mt-2 w-full rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ampliando ? "Reservando…" : `Reservar o Lote ${vizinhoInfo.numero} para ampliar`}</button>
                </div>
              ) : null}
            </div>
          )}
          {ehMeu && !ativo ? (
            <div className="mt-2 flex gap-2">
              <button onClick={abrirPainel} className="flex-1 rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold text-[#1D4ED8]">Editar placa</button>
              {confirmaDesistir
                ? <button onClick={() => { void desistir().then((e) => { if (e) window.alert(e); }); setConfirma(null); }} className="rounded-xl bg-[#E2575B] px-3 py-2 text-sm font-bold text-white">Confirmar</button>
                : <button onClick={() => setConfirma(chave)} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold text-[#5B6472]">Desistir</button>}
            </div>
          ) : ehMeu ? (admin ? <AcoesAdminLote chave={chave} /> : null) : admin ? (
            <><LojaNoMapa numero={l.numero} ativo={ativo} chave={principal?.chave ?? chave} /><AcoesAdminLote chave={chave} /></>
          ) : (
            <LojaNoMapa numero={l.numero} ativo={ativo} chave={principal?.chave ?? chave} />
          )}
        </>
      )}
    </div>
  );
}

// A loja de outra empresa (11/11/2026): o que ela faz, contatos, nota e a conversa com a atendente de IA
// Promoção na fachada (12/11/2026): o dono liga uma frase curta com hora para acabar
const SUGESTOES_PROMO = ["20% hoje", "Frete grátis", "Leve 3, pague 2", "Novidade", "Queima de estoque"];
const DURACOES_PROMO: [string, string][] = [["2h", "2 horas"], ["4h", "4 horas"], ["hoje", "Até o fim do dia"], ["24h", "24 horas"], ["3d", "3 dias"], ["7d", "7 dias"]];
const horaPromo = (iso: string, agora: number) => { const TZ = { timeZone: "America/Sao_Paulo" } as const; const d = new Date(iso); const dia = (x: Date) => x.toLocaleDateString("pt-BR", TZ); const h = d.toLocaleTimeString("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" }); return dia(d) === dia(new Date(agora)) ? `até ${h}` : `até ${d.toLocaleDateString("pt-BR", { ...TZ, day: "2-digit", month: "2-digit" })} às ${h}`; };
function PromocaoDono({ chave }: { chave: string }) {
  const terreno = useMundo((s) => s.terrenos[chave]);
  const carregar = useMundo((s) => s.carregar);
  const agora = useAgora();
  const promo = promocaoAtiva(terreno, agora);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [duracao, setDuracao] = useState("hoje");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chamar = async (metodo: "POST" | "DELETE") => {
    setEnviando(true); setErro(null);
    try {
      const r = await fetch(`/api/terrenos/${encodeURIComponent(chave)}/promocao`, { method: metodo, headers: { "content-type": "application/json" }, body: metodo === "POST" ? JSON.stringify({ texto, duracao }) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
      setAberto(false); setTexto(""); await carregar();
    } finally { setEnviando(false); }
  };
  if (promo && !aberto) return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-[#FFE4E9] px-3 py-2 text-xs text-[#9F1239]">
      <span><b>🏷️ {promo.texto}</b> · na fachada {horaPromo(promo.ate, agora)}</span>
      <span className="flex shrink-0 gap-1"><button onClick={() => { setTexto(promo.texto); setAberto(true); }} className="rounded-lg bg-white/70 px-2 py-1 font-semibold">Trocar</button><button onClick={() => chamar("DELETE")} disabled={enviando} className="rounded-lg bg-[#E11D48] px-2 py-1 font-bold text-white disabled:opacity-50">Encerrar</button></span>
    </div>
  );
  if (!aberto) return <button onClick={() => setAberto(true)} className="mt-1.5 w-full rounded-xl bg-[#FFE4E9] px-3 py-2 text-[11px] font-bold text-[#9F1239] hover:bg-[#ffd3dc]">🏷️ Ligar uma promoção na fachada</button>;
  return (
    <div className="mt-2 rounded-2xl border border-[#E11D48]/30 bg-[#FFF5F7] p-2.5">
      <div className="text-xs font-bold text-[#9F1239]">Promoção na fachada</div>
      <div className="mt-0.5 text-[11px] text-[#5B6472]">Aparece numa faixa na frente do prédio, no balão e no mini-mapa até a hora que você escolher.</div>
      <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 28))} placeholder="Ex.: 20% hoje" aria-label="Texto da promoção" className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-base sm:text-xs" />
      <div className="mt-1.5 flex flex-wrap gap-1">{SUGESTOES_PROMO.map((s) => <button key={s} onClick={() => setTexto(s)} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#9F1239] ring-1 ring-[#E11D48]/25">{s}</button>)}</div>
      <select value={duracao} onChange={(e) => setDuracao(e.target.value)} aria-label="Por quanto tempo" className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-base sm:text-xs">{DURACOES_PROMO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
      {erro && <div className="mt-1 text-[11px] font-semibold text-[#B42318]">{erro}</div>}
      <div className="mt-2 flex gap-1.5">
        <button onClick={() => chamar("POST")} disabled={enviando || texto.trim().length < 3} className="flex-1 rounded-xl bg-[#E11D48] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{enviando ? "Ligando…" : promo ? "Trocar a promoção" : "Ligar promoção"}</button>
        <button onClick={() => { setAberto(false); setErro(null); }} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#5B6472]">Cancelar</button>
      </div>
    </div>
  );
}

function LojaNoMapa({ numero, ativo, chave }: { numero: number; ativo: boolean; chave: string }) {
  const usuario = useMundo((s) => s.usuario);
  const vagas = useMundo((s) => s.vagas[chave] ?? 0);
  const terrenoLoja = useMundo((s) => s.terrenos[chave]);
  const agora = useAgora();
  const promo = promocaoAtiva(terrenoLoja, agora);
  const { loja, erro } = useLoja(ativo ? numero : null);
  const [conversa, setConversa] = useState(false);
  if (!ativo) return <div className="mt-3 text-xs text-[#5B6472]">Esta empresa está montando o escritório. A loja abre quando o 1º mês for pago.</div>;
  if (erro) return <div className="mt-3 text-xs text-[#5B6472]">{erro}</div>;
  if (!loja) return <div className="mt-3 text-xs text-[#5B6472]">Abrindo a loja…</div>;
  return (
    <div className="mt-3 space-y-2">
      {promo && <div className="flex items-center justify-between gap-2 rounded-xl bg-[#E11D48] px-3 py-2 text-xs font-bold text-white"><span>🏷️ {promo.texto}</span><span className="font-semibold text-white/80">{horaPromo(promo.ate, agora)}</span></div>}
      <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">{loja.nicho}</span><span className="flex items-center gap-2"><BotaoSeguir numero={numero} /><Estrelas media={loja.avaliacao.media} n={loja.avaliacao.n} /></span></div>
      {loja.sobre ? <p className="line-clamp-4 whitespace-pre-line text-xs text-[#1D2128]">{loja.sobre}</p> : <p className="text-xs text-[#5B6472]">A empresa ainda não contou o que faz. Pergunte à atendente.</p>}
      <Contatos c={loja.contatos} numero={numero} />
      {vagas > 0 && <a href={`/loja/${numero}#vagas`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-[#FFF8D6] px-3 py-2 text-xs font-bold text-[#7A5A00] hover:bg-[#fff0b3]"><span>📋 Estamos contratando · {vagas} {vagas === 1 ? "vaga" : "vagas"}</span><span>Ver e me candidatar ↗</span></a>}
      <VitrineLoja numero={numero} compacto />
      <PegarCupom numero={numero} compacto />
      <AgendarLoja numero={numero} cor={loja.cor} compacto />
      {conversa
        ? <ChatLoja loja={loja} logado={!!usuario} linkEntrar={`/entrar?destino=${encodeURIComponent(`/loja/${numero}`)}`} alto={240} />
        : loja.atendente && <button onClick={() => setConversa(true)} className="w-full rounded-xl bg-[#16A34A] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#15803d]">💬 Conversar com {loja.atendente.nome}</button>}
      <a href={`/loja/${numero}`} target="_blank" rel="noreferrer" className="block text-center text-[11px] font-semibold text-[#1D4ED8]">Abrir a página da loja ↗</a>
    </div>
  );
}

// Admin: liberar ou banir direto do mapa
function AcoesAdminLote({ chave }: { chave: string }) {
  const carregar = useMundo((s) => s.carregar);
  const [motivo, setMotivo] = useState("");
  const [modo, setModo] = useState<"nada" | "banir">("nada");
  const agir = async (acao: string) => { await fetch(`/api/admin/terrenos/${encodeURIComponent(chave)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao, motivo }) }); setModo("nada"); await carregar(); };
  return (
    <div className="mt-3 rounded-2xl border border-[#1D4ED8]/20 bg-[#EEF3FF] p-2 text-xs">
      <div className="mb-1 font-bold text-[#1D4ED8]">Admin</div>
      {modo === "banir" ? (
        <div className="flex flex-col gap-1">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (vai pro dono)" className="rounded-lg border border-black/10 px-2 py-1" />
          <div className="flex gap-1"><button onClick={() => agir("banir")} className="flex-1 rounded-lg bg-[#E2575B] px-2 py-1 font-bold text-white">Banir imóvel e suspender dono</button><button onClick={() => setModo("nada")} className="rounded-lg bg-white px-2 py-1">Cancelar</button></div>
        </div>
      ) : (
        <div className="flex gap-1">
          <button onClick={() => agir("liberar")} className="flex-1 rounded-lg bg-white px-2 py-1 font-semibold">Liberar lote</button>
          <button onClick={() => agir("ativar")} className="flex-1 rounded-lg bg-white px-2 py-1 font-semibold">+30 dias</button>
          <button onClick={() => setModo("banir")} className="flex-1 rounded-lg bg-[#E2575B] px-2 py-1 font-semibold text-white">Banir</button>
        </div>
      )}
    </div>
  );
}

// Voltou do Mercado Pago (?pagamento=ok|pendente|falhou&ref=…): confere e avisa
export function AvisoPagamento() {
  const conferir = useMundo((s) => s.conferirPagamento);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "pendente" | "falhou"; texto: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("pagamento"), ref = q.get("ref");
    if (!r) return;
    const url = new URL(window.location.href); url.searchParams.delete("pagamento"); url.searchParams.delete("ref"); ["collection_id", "collection_status", "payment_id", "status", "external_reference", "payment_type", "merchant_order_id", "preference_id", "site_id", "processing_mode", "merchant_account_id"].forEach((k) => url.searchParams.delete(k)); window.history.replaceState(null, "", url.toString());
    (async () => {
      const st = ref ? await conferir(ref) : r;
      if (st === "aprovado" || (r === "ok" && st !== "rejeitado")) setAviso({ tipo: "ok", texto: "Pagamento confirmado. Seu chão está ativo por 30 dias." });
      else if (st === "rejeitado" || r === "falhou") setAviso({ tipo: "falhou", texto: "O pagamento não foi aprovado. Você pode tentar de novo enquanto a reserva valer." });
      else setAviso({ tipo: "pendente", texto: "Pagamento em processamento (Pix ou boleto). Assim que o Mercado Pago confirmar, seu chão fica ativo." });
    })();
  }, [conferir]);
  if (!aviso) return null;
  const cor = aviso.tipo === "ok" ? "bg-[#16A34A]" : aviso.tipo === "falhou" ? "bg-[#E2575B]" : "bg-[#D97706]";
  return (
    <div className={`pointer-events-auto absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl ${cor} px-4 py-2.5 text-sm font-semibold text-white shadow-2xl`}>
      {aviso.texto}<button onClick={() => setAviso(null)} className="rounded-full bg-white/20 px-2">✕</button>
    </div>
  );
}

// Reduz a imagem pra 256 px (PNG) antes de enviar: logo pequeno, placa nítida
async function prepararLogo(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas"); const S = 256; c.width = S; c.height = S;
    const g = c.getContext("2d")!; const r = Math.min(S / img.width, S / img.height), w = img.width * r, h = img.height * r;
    g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

export function PainelEmpresa() {
  const aberto = useMundo((s) => s.painelEmpresa);
  const preco = useMundo((s) => s.preco);
  const fundador = useMundo((s) => s.fundador);
  const chave = useMundo((s) => s.loteSelecionado);
  const rascunho = useMundo((s) => s.rascunho);
  const setRascunho = useMundo((s) => s.setRascunho);
  const fechar = useMundo((s) => s.fecharPainel);
  const reservar = useMundo((s) => s.reservar);
  const meu = useMundo((s) => s.meu);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  if (!aberto || !chave || !rascunho) return null;
  const l = LOTE_POR_CHAVE[chave];
  const editando = meu === chave;
  const enviar = async () => { setEnviando(true); setErro(null); const e = await reservar(); setEnviando(false); if (e) setErro(e); };
  return (
    <div className={`${FLUTUANTE} ${LARGO} painel-entra overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">Lote {l?.numero} · {editando ? "sua placa" : "montar minha empresa"}</div>
          <div className="text-lg font-bold">{editando ? "Editar a placa" : "Como vai se chamar?"}</div>
          <div className="text-xs text-[#5B6472]">Olhe o lote no mapa: a placa e o tapume mudam enquanto você preenche.</div>
        </div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>

      <label className="mt-3 block text-xs font-semibold text-[#5B6472]">Nome da empresa
        <input autoFocus value={rascunho.empresaNome} onChange={(e) => setRascunho({ empresaNome: e.target.value.slice(0, 60) })} placeholder="Ex.: Padaria do Zé" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#1D4ED8]" />
      </label>

      <div className="mt-3 text-xs font-semibold text-[#5B6472]">Cor da marca</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {CORES_EMPRESA.map((c) => <button key={c} onClick={() => setRascunho({ cor: c })} className={`h-7 w-7 rounded-full border-2 ${rascunho.cor === c ? "border-[#1D2128]" : "border-transparent"}`} style={{ background: c }} aria-label={c} />)}
        <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-black/10 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Outra cor">
          <input type="color" value={rascunho.cor} onChange={(e) => setRascunho({ cor: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>

      <label className="mt-3 block text-xs font-semibold text-[#5B6472]">Nicho (aparece no balão da loja)
        <select value={rascunho.nicho} onChange={(e) => setRascunho({ nicho: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#1D4ED8]">
          {NICHOS.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
        </select>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-[#5B6472]">Quem é o CEO?
          <input value={rascunho.ceoNome} onChange={(e) => setRascunho({ ceoNome: e.target.value.slice(0, 24) })} placeholder="Ex.: Maria" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#1D4ED8]" />
        </label>
        <label className="block text-xs font-semibold text-[#5B6472]">Nome da atendente
          <input value={rascunho.atendenteNome} onChange={(e) => setRascunho({ atendenteNome: e.target.value.slice(0, 24) })} placeholder="Ex.: Ana" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#1D4ED8]" />
        </label>
      </div>
      <div className="mt-1 text-[11px] text-[#5B6472]">Todo escritório nasce com um CEO e uma atendente; depois você edita, treina e contrata mais gente em “Montar escritório”.</div>

      <div className="mt-3 text-xs font-semibold text-[#5B6472]">Logomarca (opcional)</div>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#F1F3F6]">
          {rascunho.logoDataUrl ? <img src={rascunho.logoDataUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-[#5B6472]">sem logo</span>}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => arquivo.current?.click()} className="rounded-xl bg-[#F1F3F6] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8]">{rascunho.logoDataUrl ? "Trocar imagem" : "Enviar imagem"}</button>
          {rascunho.logoDataUrl && <button onClick={() => setRascunho({ logoDataUrl: null })} className="text-left text-[11px] text-[#5B6472]">Remover</button>}
          <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setRascunho({ logoDataUrl: await prepararLogo(f) }); } catch { setErro("Não consegui ler essa imagem."); } e.target.value = ""; }} />
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-xs text-[#5B6472]">Reservar segura o lote por 1 hora pra você pagar o 1º mês ({fundador && fundador.restam > 0 ? <><b>{brl(fundador.valor)}</b> com o preço de fundador, depois {brl(preco)}/mês</> : brl(preco)}, Pix, direto no mapa). Ao reservar você concorda com as <a href="/politicas" target="_blank" className="font-semibold text-[#1D4ED8]">políticas de uso</a>: nada ofensivo, ilegal ou marca de terceiros na placa.</div>
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={fechar} className="rounded-xl px-4 py-2 text-sm text-[#5B6472]">Cancelar</button>
        <button onClick={enviar} disabled={enviando || rascunho.empresaNome.trim().length < 2} className="rounded-xl bg-[#1D4ED8] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{enviando ? "Salvando…" : editando ? "Salvar placa" : "Reservar por 1 hora e pagar"}</button>
      </div>
    </div>
  );
}

// Na barra do topo, quando estamos no mapa do WorkEnd: quem está logado (ou o botão de entrar)
export function ContaWorkend() {
  const usuario = useMundo((s) => s.usuario);
  const meu = useMundo((s) => s.meu);
  const sair = useMundo((s) => s.sairWorkend);
  const selecionarLote = useMundo((s) => s.selecionarLote);
  if (!modoMundo()) return null;
  if (!usuario) return <div className="flex items-center gap-1.5 whitespace-nowrap [&>*]:shrink-0"><BotoesPersonagem /><a href="/entrar" className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">Entrar</a></div>;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap [&>*]:shrink-0">
      <BotoesPersonagem />
      {meu && <button onClick={() => selecionarLote(meu)} className="rounded-full bg-[#1D4ED8] px-3 py-1.5 text-xs font-bold text-white">Meu chão · {LOTE_POR_CHAVE[meu]?.numero}</button>}
      <a href="/app" className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 sm:inline-block" title={usuario.email}>{usuario.nome.split(" ")[0]}</a>
      <button onClick={sair} className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 sm:inline-block">Sair</button>
    </div>
  );
}
