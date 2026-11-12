"use client";
// Vagas abertas (12/11/2026): a lista de vagas das empresas com o formulário de candidatura. Usada na busca
// (/encontrar?tipo=vagas) e na página da loja (/loja/N#vagas). É o outro lado da placa "Estamos contratando" do mapa.
import { useState } from "react";

export type VagaLista = {
  id: string; cargo: string; descricao: string; modelo: string; local: string; salario: string; criadoEm: string;
  empresa: { nome: string; cor: string; nicho: string; numero: number | null; chave: string; logo: string | null };
};
export const NOME_MODELO: Record<string, string> = { presencial: "Presencial", remoto: "Remoto", hibrido: "Híbrido" };
const ha = (iso: string) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return dias <= 0 ? "aberta hoje" : dias === 1 ? "aberta ontem" : dias < 30 ? `aberta há ${dias} dias` : `aberta em ${new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
};

export function ListaVagas({ vagas, logado, destino, mostrarEmpresa = true, ehDono = false }: { vagas: VagaLista[]; logado: boolean; destino: string; mostrarEmpresa?: boolean; ehDono?: boolean }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [enviadas, setEnviadas] = useState<string[]>([]);
  return (
    <ul className="mt-4 space-y-3">
      {vagas.map((v, i) => {
        const formAberto = aberta === v.id, enviada = enviadas.includes(v.id);
        return (
          <li key={v.id} className="busca-cartao relative overflow-hidden rounded-2xl border border-[var(--linha)] bg-[var(--surface)]" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: v.empresa.cor }} aria-hidden="true" />
            <div className="flex flex-wrap items-start gap-4 p-5 pl-6">
              {mostrarEmpresa && (v.empresa.logo
                ? <img src={v.empresa.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-[var(--linha)] bg-white object-contain p-1" />
                : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-black text-white" style={{ background: v.empresa.cor }}>{v.empresa.nome.slice(0, 2).toUpperCase()}</span>)}
              <div className="min-w-0 flex-1 basis-60">
                <b className="block text-[18px] leading-tight">{v.cargo}</b>
                {mostrarEmpresa && <span className="mt-0.5 block text-sm text-[var(--tinta-2)]"><span className="font-semibold" style={{ color: v.empresa.cor }}>{v.empresa.nome}</span>{v.empresa.numero != null && ` · Lote ${v.empresa.numero}`} · {v.empresa.nicho}</span>}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                  <span className="rounded-full bg-[var(--cinza)] px-2.5 py-0.5 font-semibold">{NOME_MODELO[v.modelo] ?? v.modelo}</span>
                  {v.local && <span className="rounded-full bg-[var(--cinza)] px-2.5 py-0.5">{v.local}</span>}
                  {v.salario && <span className="rounded-full bg-[#E3F6EA] px-2.5 py-0.5 font-semibold text-[#166534]">{v.salario}</span>}
                  <span className="px-1 py-0.5 text-[var(--tinta-2)]">{ha(v.criadoEm)}</span>
                </div>
                {v.descricao && <p className={`mt-2 whitespace-pre-line text-[14px] text-[var(--tinta-2)] ${formAberto ? "" : "line-clamp-3"}`}>{v.descricao}</p>}
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col sm:items-stretch">
                {ehDono ? (
                  <a href="/app/equipe?aba=vagas" className="btn btn-linha !py-2.5 text-sm">Gerenciar minhas vagas</a>
                ) : enviada ? (
                  <span className="rounded-xl bg-[#E3F6EA] px-4 py-2.5 text-center text-sm font-semibold text-[#166534]">Candidatura enviada ✓</span>
                ) : logado ? (
                  <button type="button" onClick={() => setAberta(formAberto ? null : v.id)} className="btn btn-azul !py-2.5 text-sm">{formAberto ? "Fechar" : "Quero me candidatar"}</button>
                ) : (
                  <a href={`/entrar?destino=${encodeURIComponent(destino)}`} className="btn btn-azul !py-2.5 text-sm">Entrar para me candidatar</a>
                )}
                {mostrarEmpresa && v.empresa.numero != null && <a href={`/loja/${v.empresa.numero}`} className="btn btn-linha !py-2.5 text-sm">Ver a loja</a>}
                {mostrarEmpresa && v.empresa.chave && <a href={`/mundo?lote=${encodeURIComponent(v.empresa.chave)}`} className="btn btn-claro !py-2.5 text-sm">Ver no mapa</a>}
              </div>
            </div>
            {formAberto && !enviada && <FormCandidatura vaga={v} enviado={() => { setEnviadas((l) => [...l, v.id]); setAberta(null); }} />}
          </li>
        );
      })}
    </ul>
  );
}

function FormCandidatura({ vaga, enviado }: { vaga: VagaLista; enviado: () => void }) {
  const [mensagem, setMensagem] = useState("");
  const [contato, setContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pronto = mensagem.trim().length >= 10 && contato.trim().length >= 6;
  const enviar = async () => {
    if (!pronto || enviando) return;
    setEnviando(true); setErro(null);
    try {
      const r = await fetch(`/api/workend/vagas/${encodeURIComponent(vaga.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mensagem, contato }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
      enviado();
    } catch (e) { setErro((e as Error).message); }
    setEnviando(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="equipe-entra border-t border-[var(--linha)] bg-[var(--cinza)] p-5 pl-6">
      <b className="block">Candidatura para {vaga.cargo} · {vaga.empresa.nome}</b>
      <p className="mt-0.5 text-sm text-[var(--tinta-2)]">A empresa recebe sua mensagem em Minha equipe e responde pelo contato que você deixar.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.6fr_1fr]">
        <label className="campo">Por que você é a pessoa certa?
          <textarea rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value.slice(0, 600))} placeholder="Conte sua experiência, o que você já fez parecido e quando pode começar." />
        </label>
        <div className="flex flex-col gap-3">
          <label className="campo">WhatsApp ou e-mail
            <input value={contato} onChange={(e) => setContato(e.target.value.slice(0, 80))} placeholder="79 99999-0000 ou voce@email.com" />
          </label>
          <button type="submit" disabled={!pronto || enviando} className="btn btn-azul">{enviando ? "Enviando…" : "Enviar candidatura"}</button>
          {!pronto && <small className="text-[12px] text-[var(--tinta-2)]">Escreva pelo menos uma frase e deixe um contato.</small>}
        </div>
      </div>
      {erro && <p className="mt-2 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
    </form>
  );
}
