"use client";
// Aba de e-mails do admin: edita assunto e corpo de cada modelo (com {{variáveis}}), pré-visualiza com dados de
// exemplo, manda um teste pra si mesmo, restaura o padrão e vê os últimos envios (inclusive os que ficaram sem chave).
import { useCallback, useEffect, useState } from "react";

interface Modelo { chave: string; nome: string; quando: string; variaveis: string[]; assunto: string; html: string; editado: boolean }
interface Envio { id: string; para: string; chave: string; assunto: string; status: string; erro: string | null; criadoEm: string }
interface Dados { modelos: Modelo[]; envios: Envio[]; ligado: boolean; remetente: string }

const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function EmailsAdmin() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [sel, setSel] = useState<string>("cadastro");
  // rascunho do editor por modelo (o que não foi mexido mostra o texto salvo)
  const [rascunho, setRascunho] = useState<Record<string, { assunto: string; html: string }>>({});
  const [previa, setPrevia] = useState<{ assunto: string; html: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = useCallback(async () => { const r = await fetch("/api/admin/emails"); if (r.ok) setDados(await r.json()); }, []);
  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);
  const modelo = dados?.modelos.find((m) => m.chave === sel) ?? null;
  const assunto = rascunho[sel]?.assunto ?? modelo?.assunto ?? "";
  const html = rascunho[sel]?.html ?? modelo?.html ?? "";
  const setAssunto = (v: string) => setRascunho((r) => ({ ...r, [sel]: { assunto: v, html } }));
  const setHtml = (v: string) => setRascunho((r) => ({ ...r, [sel]: { assunto, html: v } }));
  const escolher = (chave: string) => { setSel(chave); setPrevia(null); };
  const limparRascunho = () => setRascunho((r) => { const c = { ...r }; delete c[sel]; return c; });
  const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`); return j; };
  const tentar = async (f: () => Promise<string>) => { try { setAviso(await f()); } catch (e) { setAviso((e as Error).message); } };
  const prever = () => tentar(async () => { setPrevia(await post("/api/admin/emails/teste", { chave: sel, assunto, html })); return "Prévia atualizada (dados de exemplo)."; });
  const salvar = () => tentar(async () => { await post("/api/admin/emails", { acao: "salvar", chave: sel, assunto, html }); await carregar(); limparRascunho(); return "Modelo salvo."; });
  const restaurar = () => { if (!window.confirm("Voltar este modelo pro padrão do WorkEnd?")) return; tentar(async () => { await post("/api/admin/emails", { acao: "restaurar", chave: sel }); await carregar(); limparRascunho(); return "Padrão restaurado."; }); };
  const testar = () => tentar(async () => { await post("/api/admin/emails", { acao: "salvar", chave: sel, assunto, html }); const r = await post("/api/admin/emails/teste", { chave: sel, enviar: true }); await carregar(); return r.status === "enviado" ? "Teste enviado pro seu e-mail." : r.status === "sem_chave" ? "Salvo, mas o SendGrid ainda não está ligado (falta SENDGRID_API_KEY/EMAIL_REMETENTE no CapRover)." : `Erro no envio: ${r.erro}`; });
  if (!dados) return <section className="faixa mt-12"><h2 className="text-[1.4rem]">E-mails</h2><p className="mt-2 text-sm text-[var(--tinta-2)]">Carregando…</p></section>;
  return (
    <section className="faixa mt-12">
      <h2 className="text-[1.4rem]">E-mails</h2>
      <p className="mt-1 text-sm text-[var(--tinta-2)]">SendGrid: {dados.ligado ? <span className="font-semibold text-[#1B8A4C]">ligado</span> : <span className="font-semibold text-[#8A2A2A]">desligado</span>} · remetente <b>{dados.remetente}</b>. {!dados.ligado && "Pra ligar: SENDGRID_API_KEY e EMAIL_REMETENTE (remetente verificado) no CapRover. Enquanto isso os envios ficam só registrados abaixo."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {dados.modelos.map((m) => <button key={m.chave} onClick={() => escolher(m.chave)} className={`rounded-full border px-3 py-1.5 text-sm ${sel === m.chave ? "border-[var(--azul)] bg-[var(--azul-claro)] text-[var(--azul)]" : "border-[var(--linha)]"}`}>{m.nome}{m.editado && <span className="ml-1 text-xs text-[var(--tinta-2)]">· editado</span>}</button>)}
      </div>
      {modelo && (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-sm text-[var(--tinta-2)]">{modelo.quando} Variáveis: {modelo.variaveis.map((v) => <code key={v} className="mr-1 rounded bg-[var(--cinza)] px-1.5 py-0.5 text-xs">{`{{${v}}}`}</code>)}</p>
            <label className="campo mt-3">Assunto<input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></label>
            <label className="campo mt-3">Corpo (HTML; o cabeçalho e o rodapé do WorkEnd entram automaticamente)<textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={14} className="font-mono text-xs" /></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={prever} className="btn btn-linha">Pré-visualizar</button>
              <button onClick={salvar} className="btn btn-azul">Salvar</button>
              <button onClick={testar} className="btn btn-claro">Salvar e enviar teste pra mim</button>
              {modelo.editado && <button onClick={restaurar} className="btn btn-linha">Restaurar padrão</button>}
            </div>
            {aviso && <div className="mt-3 rounded-xl bg-[var(--cinza)] px-3 py-2 text-sm">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">fechar</button></div>}
          </div>
          <div>
            <div className="text-sm text-[var(--tinta-2)]">Prévia{previa && <> · <b>{previa.assunto}</b></>}</div>
            <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--linha)] bg-[#F5F6F8]">
              {previa ? <iframe title="prévia do e-mail" srcDoc={previa.html} className="h-[560px] w-full" sandbox="" /> : <div className="p-6 text-sm text-[var(--tinta-2)]">Clique em &ldquo;Pré-visualizar&rdquo; pra ver o e-mail montado com dados de exemplo.</div>}
            </div>
          </div>
        </div>
      )}
      <h3 className="mt-10 text-[1.1rem]">Últimos envios</h3>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--linha)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cinza)] text-left text-xs uppercase text-[var(--tinta-2)]"><tr><th className="p-3">Quando</th><th className="p-3">Para</th><th className="p-3">Modelo</th><th className="p-3">Assunto</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {dados.envios.length === 0 && <tr><td colSpan={5} className="p-4 text-[var(--tinta-2)]">Nenhum envio ainda.</td></tr>}
            {dados.envios.map((e) => (
              <tr key={e.id} className="border-t border-[var(--linha)]">
                <td className="p-3">{dt(e.criadoEm)}</td><td className="p-3">{e.para}</td><td className="p-3">{e.chave}</td><td className="p-3">{e.assunto}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.status === "enviado" ? "bg-[#E3F6EA] text-[#1B8A4C]" : e.status === "sem_chave" ? "bg-[#FFF4D6] text-[#7A5A00]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`}>{e.status}</span>{e.erro && e.status === "erro" && <div className="mt-1 max-w-[40ch] text-xs text-[#8A2A2A]">{e.erro}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
