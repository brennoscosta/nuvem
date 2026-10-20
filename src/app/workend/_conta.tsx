"use client";
// Formulários de conta do WorkEnd (cadastro e entrada). Depois de entrar, vai pro dashboard.
import { useState } from "react";
import Link from "next/link";

const api = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j;
};

export function FormCadastro() {
  const [f, setF] = useState({ nome: "", empresaNome: "", email: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setOcupado(true);
    try { await api("/api/workend/cadastro", f); window.location.href = "/app"; } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label className="campo">Seu nome<input value={f.nome} onChange={set("nome")} autoComplete="name" required /></label>
      <label className="campo">Nome da empresa (opcional)<input value={f.empresaNome} onChange={set("empresaNome")} autoComplete="organization" placeholder="Vai ser o nome do prédio" /></label>
      <label className="campo">E-mail<input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>
      <label className="campo">Senha<input type="password" value={f.senha} onChange={set("senha")} autoComplete="new-password" minLength={8} required placeholder="pelo menos 8 caracteres" /></label>
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro}</div>}
      <button type="submit" disabled={ocupado} className="btn btn-azul mt-2 justify-center text-[1.05rem]">{ocupado ? "Criando sua conta…" : "Criar conta"}</button>
      <p className="text-sm text-[var(--tinta-2)]">Já tem conta? <Link href="/entrar" className="font-semibold text-[var(--azul)]">Entrar</Link></p>
    </form>
  );
}

export function FormEntrar() {
  const [f, setF] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setOcupado(true);
    try { await api("/api/workend/entrar", f); window.location.href = "/app"; } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label className="campo">E-mail<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required /></label>
      <label className="campo">Senha<input type="password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} autoComplete="current-password" required /></label>
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro}</div>}
      <button type="submit" disabled={ocupado} className="btn btn-azul mt-2 justify-center text-[1.05rem]">{ocupado ? "Entrando…" : "Entrar"}</button>
      <p className="text-sm text-[var(--tinta-2)]">Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-[var(--azul)]">Criar conta</Link></p>
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
