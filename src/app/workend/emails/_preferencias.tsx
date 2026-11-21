"use client";
// Formulário da página /emails (WE-17): as três escolhas e "parar todos", salvos pelo link assinado (sem login).
import { useState } from "react";

type Cat = "dicas" | "resumo" | "unidades";
type Prefs = Record<Cat, boolean>;

export function FormPreferencias({ token, email, inicial, categorias }: { token: string; email: string; inicial: Prefs; categorias: { id: Cat; titulo: string; texto: string }[] }) {
  const [p, setP] = useState<Prefs>(inicial);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | "erro">("");
  const [msg, setMsg] = useState("");
  const salvar = async (novo: Prefs) => {
    setEstado("salvando");
    try {
      const r = await fetch("/api/workend/emails", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token, ...novo }) });
      const j = (await r.json().catch(() => ({}))) as { preferencias?: Prefs; erro?: string };
      if (!r.ok || !j.preferencias) throw new Error(j.erro ?? "Não deu para salvar. Tente de novo.");
      setP(j.preferencias); setEstado("salvo");
      setMsg(Object.values(j.preferencias).some(Boolean) ? "Escolhas salvas." : "Pronto: você não recebe mais estes avisos.");
    } catch (e) { setEstado("erro"); setMsg((e as Error).message); }
  };
  const nenhum = !p.dicas && !p.resumo && !p.unidades;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[15px] text-[var(--tinta-2)]">Conta: <b className="break-all text-[var(--tinta)]">{email}</b></p>
      <form onSubmit={(e) => { e.preventDefault(); void salvar(p); }} className="flex flex-col gap-4">
        {categorias.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name={c.id} checked={p[c.id]} onChange={(e) => setP({ ...p, [c.id]: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[#0A6CFF]" />
            <span><b className="block text-[var(--tinta)]">{c.titulo}</b><span className="text-[14px] text-[var(--tinta-2)]">{c.texto}</span></span>
          </label>
        ))}
        <button type="submit" disabled={estado === "salvando"} className="btn btn-azul mt-1 justify-center">{estado === "salvando" ? "Salvando…" : "Salvar escolhas"}</button>
      </form>
      <div className="border-t border-[var(--linha)] pt-4">
        <button type="button" data-parar onClick={() => void salvar({ dicas: false, resumo: false, unidades: false })} disabled={nenhum || estado === "salvando"} className="btn btn-linha w-full justify-center">Parar todos estes avisos</button>
      </div>
      {(estado === "salvo" || estado === "erro") && <div role="status" className={`rounded-xl px-3 py-2 text-sm ${estado === "salvo" ? "bg-[#E3F6EA] text-[#1B8A4C]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`}>{msg}</div>}
    </div>
  );
}
