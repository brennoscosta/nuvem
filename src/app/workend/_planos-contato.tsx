"use client";
// "Fale com a gente" da escada de planos (WE-19, 22/11/2026): abre um formulário curto dentro do degrau (Sede sob consulta
// ou o interesse no Equipe). Grava em /api/workend/planos/contato; o admin vê no sino e em /app/admin. O WorkEnd não
// mostra e-mail nem WhatsApp próprio aqui: o dono ainda não definiu.
import { useId, useState } from "react";
import type { PlanoContato } from "@/office/data/planos";

export function FaleComAGente({ plano, origem, rotulo }: { plano: PlanoContato; origem: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<"livre" | "enviando" | "feito">("livre");
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ nome: "", empresa: "", contato: "", mensagem: "", site: "" });
  const base = useId();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "enviando") return;
    setEstado("enviando"); setErro("");
    try {
      const r = await fetch("/api/workend/planos/contato", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, plano, origem }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu para enviar agora. Tente de novo.");
      setEstado("feito");
    } catch (x) { setErro((x as Error).message); setEstado("livre"); }
  }

  if (estado === "feito") return <p className="wpl-feito" role="status" data-teste={`contato-${plano}-ok`}><b>Recebemos o seu contato.</b> A equipe do WorkEnd responde pelo WhatsApp ou e-mail que você deixou.</p>;
  if (!aberto) return <button type="button" className={`wi-btn ${plano === "equipe" ? "wi-btn-tinta" : "wi-btn-linha"}`} onClick={() => setAberto(true)} aria-expanded={false} data-teste={`abrir-contato-${plano}`}>{rotulo}</button>;
  return (
    <form className="wpl-form" onSubmit={enviar} data-teste={`form-contato-${plano}`}>
      <label className="wi-campo" htmlFor={`${base}-nome`}>Seu nome<input id={`${base}-nome`} name="nome" value={f.nome} onChange={set("nome")} required minLength={2} maxLength={80} autoComplete="name" /></label>
      <label className="wi-campo" htmlFor={`${base}-empresa`}>Empresa<input id={`${base}-empresa`} name="empresa" value={f.empresa} onChange={set("empresa")} maxLength={80} autoComplete="organization" /></label>
      <label className="wi-campo" htmlFor={`${base}-contato`}>WhatsApp com DDD ou e-mail<input id={`${base}-contato`} name="contato" value={f.contato} onChange={set("contato")} required maxLength={120} inputMode="email" autoComplete="email" /></label>
      <label className="wi-campo" htmlFor={`${base}-msg`}>Conte o que precisa (se quiser)<textarea id={`${base}-msg`} name="mensagem" value={f.mensagem} onChange={set("mensagem")} maxLength={600} rows={3} /></label>
      {/* campo escondido: só robô preenche */}
      <input className="wpl-isca" name="site" value={f.site} onChange={set("site")} tabIndex={-1} autoComplete="off" aria-hidden />
      {erro && <p className="wpl-erro" role="alert">{erro}</p>}
      <button type="submit" className="wi-btn wi-btn-tinta" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar"}</button>
    </form>
  );
}
