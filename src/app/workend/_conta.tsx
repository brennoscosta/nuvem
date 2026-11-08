"use client";
// Formulários de conta do WorkEnd (cadastro e entrada). Depois de entrar, vai pro dashboard.
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

// Veio do mapa querendo um lote (?lote=…)? Depois de entrar volta pro mundo, direto no lote escolhido.
const destino = () => { const q = new URLSearchParams(window.location.search); const l = q.get("lote"); const d = q.get("destino"); if (l) return `/mundo?lote=${encodeURIComponent(l)}`; return d && d.startsWith("/") && !d.startsWith("//") ? d : "/app"; };

// query atual (?lote=…) só no navegador, sem erro de hidratação
const semAssinatura = () => () => {};
const useBusca = () => useSyncExternalStore(semAssinatura, () => window.location.search, () => "");

const api = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j;
};


// Botão "Entrar com Google" (leva o ?lote= junto pra voltar direto pro lote)
export function BotaoGoogle({ texto = "Continuar com Google" }: { texto?: string }) {
  const busca = useBusca();
  const lote = typeof window !== "undefined" ? new URLSearchParams(busca).get("lote") : null;
  const erro = typeof window !== "undefined" ? new URLSearchParams(busca).get("erro") : null;
  return (
    <div className="flex flex-col gap-2">
      <a href={`/api/workend/google${lote ? `?lote=${encodeURIComponent(lote)}` : ""}`} className="btn btn-linha justify-center gap-2 text-[1rem]">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
        {texto}
      </a>
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro}</div>}
      <div className="my-1 flex items-center gap-3 text-xs text-[var(--tinta-2)]"><span className="h-px flex-1 bg-[var(--linha)]" />ou com e-mail<span className="h-px flex-1 bg-[var(--linha)]" /></div>
    </div>
  );
}

export function FormCadastro() {
  const busca = useBusca();
  const [f, setF] = useState({ nome: "", empresaNome: "", email: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setOcupado(true);
    try { await api("/api/workend/cadastro", f); window.location.href = destino(); } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <BotaoGoogle texto="Criar conta com Google" />
      <label className="campo">Seu nome<input value={f.nome} onChange={set("nome")} autoComplete="name" required /></label>
      <label className="campo">Nome da empresa (opcional)<input value={f.empresaNome} onChange={set("empresaNome")} autoComplete="organization" placeholder="Vai ser o nome do prédio" /></label>
      <label className="campo">E-mail<input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>
      <label className="campo">Senha<input type="password" value={f.senha} onChange={set("senha")} autoComplete="new-password" minLength={8} required placeholder="pelo menos 8 caracteres" /></label>
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro}</div>}
      <button type="submit" disabled={ocupado} className="btn btn-azul mt-2 justify-center text-[1.05rem]">{ocupado ? "Criando sua conta…" : "Criar conta"}</button>
      <p className="text-sm text-[var(--tinta-2)]">Já tem conta? <Link href={"/entrar" + busca} className="font-semibold text-[var(--azul)]">Entrar</Link></p>
    </form>
  );
}

export function FormEntrar() {
  const busca = useBusca();
  const [f, setF] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setOcupado(true);
    try { await api("/api/workend/entrar", f); window.location.href = destino(); } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <BotaoGoogle texto="Entrar com Google" />
      <label className="campo">E-mail<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required /></label>
      <label className="campo">Senha<input type="password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} autoComplete="current-password" required /></label>
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro}</div>}
      <button type="submit" disabled={ocupado} className="btn btn-azul mt-2 justify-center text-[1.05rem]">{ocupado ? "Entrando…" : "Entrar"}</button>
      <p className="text-sm text-[var(--tinta-2)]">Ainda não tem conta? <Link href={"/cadastro" + busca} className="font-semibold text-[var(--azul)]">Criar conta</Link></p>
    </form>
  );
}

export function BotaoSair() {
  return <button onClick={async () => { await fetch("/api/workend/sair", { method: "POST" }); window.location.href = "/"; }} className="btn btn-linha">Sair</button>;
}

export function BotaoAvisar({ marcado }: { marcado: boolean }) {
  const [ok, setOk] = useState(marcado);
  const [ocupado, setOcupado] = useState(false);
  if (ok) return <span className="inline-flex items-center gap-2 rounded-full bg-[#E3F6EA] px-4 py-2 text-sm font-semibold text-[#1B8A4C]">✓ Você está na lista: avisamos quando abrir</span>;
  return <button disabled={ocupado} onClick={async () => { setOcupado(true); try { await fetch("/api/workend/interesse", { method: "POST" }); setOk(true); } finally { setOcupado(false); } }} className="btn btn-tinta">{ocupado ? "Anotando…" : "Me avisar quando der pra comprar"}</button>;
}
