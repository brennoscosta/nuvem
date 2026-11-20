"use client";
// Página de créditos (20/11/2026, frente "creditos"): saldo (comprado e bônus), pacotes no Pix, Unidades de IA da empresa,
// extrato imutável e as regras (inclusive a devolução em até 7 dias). O Pix abre aqui mesmo e se confere sozinho.
import { useEffect, useState } from "react";
import { BotaoCobrar } from "@/office/ui/Cobrar";
import { Icone } from "@/office/ui/Icone";
import { useCreditos, novoIdem, fmtCreditos } from "@/office/creditosStore";

type Saldo = { comprado: number; bonus: number; total: number };
type Lanc = { id: string; tipo: string; comprado: number; bonus: number; saldoComprado: number; saldoBonus: number; descricao: string; motivo: string | null; criadoEm: string };
type Devolvivel = { pagamentoId: string; restante: number; valorReais: number; prazoAte: string };
type Pacote = { id: string; creditos: number; bonus: number };
type DadosCred = { saldo: Saldo; extrato: Lanc[]; devolviveis: Devolvivel[]; pacotes: Pacote[]; regras: string[]; diasDevolucao: number; pagamento: boolean; admin: boolean };
type DadosIA = { semLote?: boolean; chave?: string; empresa?: string; saldo?: { inclusa: number; comprada: number; total: number; baseMes: number; cobrada: boolean }; usadasMes?: number; respostas?: number; mensalidade?: number; aviso?: boolean; esgotado?: boolean;
  pacotes?: { id: string; unidades: number; creditos: number }[]; porAgente?: { agenteId: string; nome: string; nomeCategoria: string; usadas: number; vezes: number }[]; extrato?: { id: string; tipo: string; unidades: number; descricao: string; criadoEm: string }[] };
type Pix = { id: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; status?: string; creditos?: number };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");
const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const NOME_TIPO: Record<string, string> = { compra: "Compra", bonus: "Bônus", uso: "Uso", estorno: "Estorno", ajuste: "Ajuste", devolucao: "Devolução", mensalidade: "Mensalidade", vencimento: "Venceu" };
const paraAdmin = (admin: boolean, v: number) => (admin ? Math.max(0.01, Math.round(v) / 100) : v);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || `Erro ${r.status}`);
  return j as T;
}

// Pix aberto nesta página: QR, copia e cola e a conferência a cada 4 s
function PixDaPagina({ pix, aoPagar, fechar }: { pix: Pix; aoPagar: () => void; fechar: () => void }) {
  const [status, setStatus] = useState(pix.status ?? "pendente");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (status !== "pendente") return;
    const t = setInterval(async () => { const j = await api<{ status: string }>(`/api/pagamentos/${encodeURIComponent(pix.id)}`, { method: "POST" }).catch(() => null); if (j && j.status !== "pendente") { setStatus(j.status); if (j.status === "aprovado") aoPagar(); } }, 4000);
    return () => clearInterval(t);
  }, [status, pix.id, aoPagar]);
  if (status === "aprovado") return <div className="mt-3 rounded-2xl bg-[#E3F6EA] px-4 py-3 text-sm text-[#166534]" data-pago><b>Pagamento confirmado.</b> O saldo já foi atualizado. <button type="button" onClick={fechar} className="ml-1 font-semibold underline">Fechar</button></div>;
  if (status !== "pendente") return <div className="mt-3 rounded-2xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#8A2A2A]">Este Pix não foi aprovado. <button type="button" onClick={fechar} className="ml-1 font-semibold underline">Gerar outro</button></div>;
  const copiar = async () => { try { await navigator.clipboard.writeText(pix.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt("Copie o código Pix:", pix.codigo); } };
  return (
    <div className="mt-3 rounded-2xl border border-[#16A34A]/30 bg-[#F3FBF5] p-4 text-sm" data-pix={pix.id}>
      <div className="font-bold text-[#166534]">Pague {brl(pix.valor)} no Pix</div>
      {(pix.creditos ?? 0) > 0 && <div className="mt-1 text-[12px] text-[#166534]">{fmtCreditos(pix.creditos ?? 0)} créditos já estão reservados para esta compra; se o Pix não for pago, eles voltam.</div>}
      {pix.qrBase64 && <img src={`data:image/png;base64,${pix.qrBase64}`} alt="QR Code Pix" className="mx-auto mt-2 h-44 w-44 rounded-xl bg-white p-1" />}
      <button type="button" onClick={copiar} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white">{copiado ? "Código copiado" : "Copiar código Pix (copia e cola)"}</button>
      <div className="mt-1 text-center text-[11px] text-[#5B6472]">Confirmamos sozinhos assim que o banco avisar.</div>
    </div>
  );
}

export function PainelCreditos() {
  const [c, setC] = useState<DadosCred | null>(null);
  const [ia, setIa] = useState<DadosIA | null>(null);
  const [versao, setVersao] = useState(0);
  const [pix, setPix] = useState<(Pix & { de: string }) | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const recarregarSaldo = useCreditos((s) => s.carregar);
  useEffect(() => {
    let vivo = true;
    api<DadosCred>("/api/workend/creditos").then((d) => vivo && setC(d)).catch((e) => vivo && setErro((e as Error).message));
    api<DadosIA>("/api/workend/unidades").then((d) => vivo && setIa(d)).catch(() => vivo && setIa({ semLote: true }));
    void recarregarSaldo();
    return () => { vivo = false; };
  }, [versao, recarregarSaldo]);
  const atualizar = () => setVersao((v) => v + 1);
  const comprarPacote = async (p: Pacote) => {
    setErro(null); setAviso(null); setOcupado(`p${p.id}`);
    try { const j = await api<Pix>("/api/workend/creditos", { method: "POST", body: JSON.stringify({ pacote: p.id, idem: novoIdem() }) }); setPix({ ...j, de: `p${p.id}` }); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };
  const comprarUnidades = async (id: string, creditos: boolean) => {
    if (!ia?.chave) return;
    setErro(null); setAviso(null); setOcupado(`u${id}`);
    try {
      const j = await api<Pix>("/api/workend/unidades", { method: "POST", body: JSON.stringify({ chave: ia.chave, pacote: id, creditos, idem: novoIdem() }) });
      if (j.status === "aprovado") { setAviso(`Pago com ${fmtCreditos(j.creditos ?? 0)} créditos. As unidades já estão na empresa.`); atualizar(); }
      else setPix({ ...j, de: `u${id}` });
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(null); }
  };
  if (!c) return <section className="faixa mt-8 text-[var(--tinta-2)]">{erro ?? "Carregando…"}</section>;
  const u = ia?.saldo; const base = Math.max(1, u?.baseMes ?? 0); const pct = u ? Math.min(100, Math.round((u.total / base) * 100)) : 0;
  return (
    <>
      <section className="faixa mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.15fr] [&>*]:min-w-0">
        <div className="rounded-2xl border border-[var(--linha)] bg-white p-5" data-saldo={c.saldo.total}>
          <div className="text-[13px] font-semibold text-[var(--tinta-2)]">Saldo de créditos</div>
          <div className="mt-1 text-[2.2rem] font-bold leading-none tracking-tight">{fmtCreditos(c.saldo.total)}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--tinta-2)]"><span>Comprado: <b className="text-[var(--tinta)]" data-comprado={c.saldo.comprado}>{fmtCreditos(c.saldo.comprado)}</b></span><span>Bônus: <b className="text-[var(--tinta)]" data-bonus={c.saldo.bonus}>{fmtCreditos(c.saldo.bonus)}</b></span></div>
          {c.devolviveis.length > 0 && <div className="mt-3 rounded-xl bg-[#F1F3F6] px-3 py-2 text-[12.5px] text-[var(--tinta-2)]">{c.devolviveis.map((d) => <div key={d.pagamentoId}>Você pode pedir a devolução de {fmtCreditos(d.restante)} créditos comprados (R$ {d.valorReais.toFixed(2).replace(".", ",")}) até {new Date(d.prazoAte).toLocaleDateString("pt-BR")}: escreva para contato@workend.online.</div>)}</div>}
          <h2 className="mt-5 !text-[1.1rem]">Comprar créditos</h2>
          <p className="text-[13px] text-[var(--tinta-2)]">No Pix, com o QR na tela. Os pacotes maiores vêm com bônus, separado do que você comprou.</p>
          <ul className="mt-2 divide-y divide-[var(--linha)] rounded-xl border border-[var(--linha)]">
            {c.pacotes.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5" data-pacote={p.id}>
                <div className="min-w-0 flex-1"><div className="font-semibold">{num(p.creditos)} créditos{p.bonus > 0 && <span className="ml-1.5 rounded-full bg-[#E3F6EA] px-2 py-0.5 text-[11px] font-bold text-[#166534]">+{fmtCreditos(p.bonus)} de bônus</span>}</div><div className="text-[12px] text-[var(--tinta-2)]">{brl(paraAdmin(c.admin, p.creditos))} no Pix{p.bonus > 0 ? ` · você recebe ${fmtCreditos(p.creditos + p.bonus)}` : ""}</div></div>
                <button type="button" disabled={!c.pagamento || !!ocupado} onClick={() => void comprarPacote(p)} className="shrink-0 rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ocupado === `p${p.id}` ? "Gerando…" : "Comprar"}</button>
              </li>
            ))}
          </ul>
          {!c.pagamento && <div className="mt-2 text-[12px] text-[var(--tinta-2)]">O Pix ainda não está ligado: os pacotes abrem em instantes.</div>}
          {pix?.de.startsWith("p") && <PixDaPagina key={pix.id} pix={pix} aoPagar={atualizar} fechar={() => setPix(null)} />}
        </div>

        <div id="unidades" className="rounded-2xl bg-[#1D2128] p-5 text-white" data-unidades={u?.total ?? ""}>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white/70"><Icone nome="unidades" tamanho={16} />Unidades de IA{ia?.empresa ? ` · ${ia.empresa}` : ""}</div>
          {ia?.semLote || !u ? <p className="mt-2 text-[14px] text-white/75">As unidades de IA são da empresa: aparecem aqui quando o seu lote estiver ativo. Todo lote recebe {num(1000)} unidades por mês.</p> : (
            <>
              <div className="mt-1 flex items-end gap-3"><div className="text-[2.2rem] font-bold leading-none">{num(u.total)}</div><div className="pb-1 text-[13px] text-white/70">≈ {num(ia.respostas ?? 0)} respostas</div></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15" role="meter" aria-valuemin={0} aria-valuemax={base} aria-valuenow={u.total} aria-label="Unidades de IA restantes"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: ia.esgotado ? "#E2575B" : ia.aviso ? "#F59E0B" : "#38E07B" }} /></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-white/70"><span>Inclusas do mês: <b className="text-white">{num(u.inclusa)}</b></span><span>Compradas (não vencem): <b className="text-white">{num(u.comprada)}</b></span><span>Usadas no mês: <b className="text-white">{num(ia.usadasMes ?? 0)}</b></span></div>
              {ia.esgotado && <div className="mt-3 rounded-xl bg-[#E2575B]/20 px-3 py-2 text-[13px]">As unidades acabaram: a equipe responde com o recado fixo até você comprar mais ou a mensalidade do mês que vem chegar.</div>}
              {!ia.esgotado && ia.aviso && <div className="mt-3 rounded-xl bg-[#F59E0B]/20 px-3 py-2 text-[13px]">Restam menos de 20% das unidades deste mês.</div>}
              <div className="mt-4 text-[13px] font-semibold">Comprar unidades</div>
              <ul className="mt-1 space-y-2">
                {(ia.pacotes ?? []).map((p) => (
                  <li key={p.id} className="rounded-xl bg-white/[0.06] p-3" data-pacote-ia={p.id}>
                    <div className="flex items-center justify-between text-[13.5px]"><span><b>{num(p.unidades)}</b> unidades</span><span className="text-white/70">{fmtCreditos(paraAdmin(c.admin, p.creditos))} créditos</span></div>
                    <BotaoCobrar valor={paraAdmin(c.admin, p.creditos)} rotuloPix={`Comprar · ${brl(paraAdmin(c.admin, p.creditos))} no Pix`} rotuloCreditos="Comprar" compacto pixLigado={c.pagamento} pagando={!!ocupado} onPagar={(cr) => void comprarUnidades(p.id, cr)} />
                  </li>
                ))}
              </ul>
              {pix?.de.startsWith("u") && <PixDaPagina key={pix.id} pix={pix} aoPagar={atualizar} fechar={() => setPix(null)} />}
              <div className="mt-4 text-[13px] font-semibold">Consumo do mês por agente</div>
              {(ia.porAgente ?? []).length === 0 ? <div className="mt-1 text-[12.5px] text-white/60">Nenhum uso de IA neste mês.</div> : (
                <ul className="mt-1 text-[12.5px]">{(ia.porAgente ?? []).map((a) => <li key={`${a.agenteId}${a.nomeCategoria}`} className="flex justify-between border-b border-white/10 py-1"><span>{a.nome} · {a.nomeCategoria} ({a.vezes}x)</span><b>{num(a.usadas)}</b></li>)}</ul>
              )}
            </>
          )}
        </div>
      </section>
      {(erro || aviso) && <section className="faixa mt-3"><div className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${erro ? "bg-[#FDE8E8] text-[#8A2A2A]" : "bg-[#E3F6EA] text-[#166534]"}`}>{erro ?? aviso}</div></section>}

      <section className="faixa mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div className="rounded-2xl border border-[var(--linha)] bg-white p-5">
          <h2 className="!text-[1.1rem]">Extrato de créditos</h2>
          {c.extrato.length === 0 ? <p className="mt-1 text-[13px] text-[var(--tinta-2)]">Nada por aqui ainda.</p> : (
            <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-[13px]" data-extrato>
              <thead className="text-[11.5px] text-[var(--tinta-2)]"><tr><th className="py-1 pr-2 font-semibold">Quando</th><th className="py-1 pr-2 font-semibold">O quê</th><th className="py-1 pr-2 text-right font-semibold">Valor</th><th className="py-1 text-right font-semibold">Saldo</th></tr></thead>
              <tbody>{c.extrato.map((l) => { const v = l.comprado + l.bonus; return (
                <tr key={l.id} className="border-t border-[var(--linha)] align-top"><td className="whitespace-nowrap py-1.5 pr-2 text-[var(--tinta-2)]">{quando(l.criadoEm)}</td><td className="py-1.5 pr-2"><span className="mr-1 rounded bg-[#F1F3F6] px-1.5 py-0.5 text-[11px] font-semibold">{NOME_TIPO[l.tipo] ?? l.tipo}</span>{l.descricao}{l.motivo && <span className="block text-[11.5px] text-[var(--tinta-2)]">Motivo: {l.motivo}</span>}{l.bonus !== 0 && l.comprado !== 0 && <span className="block text-[11.5px] text-[var(--tinta-2)]">comprado {fmtCreditos(l.comprado)} · bônus {fmtCreditos(l.bonus)}</span>}</td><td className={`whitespace-nowrap py-1.5 pr-2 text-right font-semibold ${v >= 0 ? "text-[#166534]" : "text-[var(--tinta)]"}`}>{v >= 0 ? "+" : ""}{fmtCreditos(v)}</td><td className="whitespace-nowrap py-1.5 text-right">{fmtCreditos(l.saldoComprado + l.saldoBonus)}</td></tr>
              ); })}</tbody>
            </table></div>
          )}
          {(ia?.extrato ?? []).length > 0 && (
            <>
              <h3 className="mt-5 text-[1rem] font-bold">Extrato das unidades de IA</h3>
              <ul className="mt-1 text-[12.5px]">{(ia?.extrato ?? []).slice(0, 15).map((l) => <li key={l.id} className="flex justify-between gap-3 border-t border-[var(--linha)] py-1"><span className="min-w-0"><span className="mr-1 text-[var(--tinta-2)]">{quando(l.criadoEm)}</span>{l.descricao}</span><b className="shrink-0">{l.unidades > 0 ? "+" : ""}{num(l.unidades)}</b></li>)}</ul>
            </>
          )}
        </div>
        <div className="rounded-2xl bg-[#F1F3F6] p-5" data-regras>
          <h2 className="!text-[1.1rem]">Regras dos créditos</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-[var(--tinta-2)]">{c.regras.map((r) => <li key={r}>{r}</li>)}</ul>
          <h3 className="mt-4 text-[0.98rem] font-bold">Unidades de IA</h3>
          <ul className="mt-1 list-disc space-y-1.5 pl-5 text-[13px] text-[var(--tinta-2)]">
            <li>São da empresa, não da pessoa: 1 unidade cobre R$ 0,01 de IA. Uma resposta comum gasta 1 ou 2 unidades; uma imagem, perto de 116.</li>
            <li>Todo lote ativo recebe {num(1000)} unidades por mês. As inclusas vencem no fim do mês; as compradas não vencem.</li>
            <li>A equipe usa primeiro as inclusas. Quando acaba tudo, ela responde com o recado fixo e você recebe um aviso. Os visitantes da loja não pagam nada.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
