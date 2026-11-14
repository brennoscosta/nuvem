"use client";
// Cupons da loja para o visitante (13/11/2026): no cartão do mapa (compacto) e na página /loja/N. Com conta, "Pegar cupom"
// gera um código só dele para mostrar na hora da compra. O dono vê um atalho para validar. Sem cupom ativo, não aparece.
import { useEffect, useState } from "react";

type Cupom = { id: string; titulo: string; regra: string; validade: string; restam: number | null; meu: string | null; usado: boolean };
type Dados = { cupons: Cupom[]; ehDono: boolean; logado: boolean };
const dataCurta = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

export function PegarCupom({ numero, compacto }: { numero: number; compacto?: boolean }) {
  const [estado, setEstado] = useState<{ numero: number; v: number; d: Dados | null } | null>(null);
  const [versao, setVersao] = useState(0);
  const [pegando, setPegando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  useEffect(() => {
    if (!numero) return;
    let vivo = true;
    fetch(`/api/workend/cupons/loja/${numero}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => vivo && setEstado({ numero, v: versao, d: j as Dados | null })).catch(() => vivo && setEstado({ numero, v: versao, d: null }));
    return () => { vivo = false; };
  }, [numero, versao]);
  const d = estado?.numero === numero ? estado.d : null;
  if (!d?.cupons.length) return null;
  const pegar = async (id: string) => {
    setPegando(id); setErro(null);
    try {
      const r = await fetch(`/api/workend/cupons/${encodeURIComponent(id)}`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro(j.erro ?? `Erro ${r.status}`); else setVersao((x) => x + 1);
    } finally { setPegando(null); }
  };
  const copiar = async (c: string) => { try { await navigator.clipboard.writeText(c); setCopiado(c); setTimeout(() => setCopiado(null), 1800); } catch { /* sem área de transferência */ } };
  const entrar = `/entrar?destino=${encodeURIComponent(`/loja/${numero}#cupons`)}`;
  const t = compacto ? "text-[11px]" : "text-[13px]";
  return (
    <div id={compacto ? undefined : "cupons"} className={`scroll-mt-6 ${compacto ? "" : "rounded-2xl border border-[var(--linha,#E3E6EB)] bg-white p-5"}`}>
      {!compacto && <b className="text-[17px] text-[#1D2128]">🎟️ Cupons da loja</b>}
      {d.ehDono && <a href="/app/cupons" className={`mt-1 block rounded-xl bg-[#FFF8E6] px-3 py-2 ${t} font-semibold text-[#7A5200]`}>🎟️ Sua loja tem {d.cupons.length} cupom{d.cupons.length > 1 ? "s" : ""} ativo{d.cupons.length > 1 ? "s" : ""} · Validar um código ↗</a>}
      {!d.ehDono && (
        <ul className={`${compacto ? "space-y-1.5" : "mt-3 space-y-2"}`}>
          {d.cupons.map((c) => (
            <li key={c.id} className="relative overflow-hidden rounded-xl border border-dashed border-[#E11D48]/50 bg-[#FFF5F7] px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`${compacto ? "text-[13px]" : "text-[15px]"} font-black leading-tight text-[#9F1239]`}>{c.titulo}</div>
                  <div className={`${t} text-[#5B6472]`}>{c.regra ? `${c.regra} · ` : ""}até {dataCurta(c.validade)}{c.restam != null ? ` · restam ${c.restam}` : ""}</div>
                </div>
                {!c.meu && (d.logado
                  ? <button type="button" onClick={() => pegar(c.id)} disabled={pegando === c.id} className={`shrink-0 rounded-lg bg-[#E11D48] px-2.5 py-1.5 ${t} font-bold text-white hover:bg-[#c81a40] disabled:opacity-50`}>{pegando === c.id ? "…" : "Pegar cupom"}</button>
                  : <a href={entrar} className={`shrink-0 rounded-lg bg-[#E11D48] px-2.5 py-1.5 ${t} font-bold text-white`}>Entrar para pegar</a>)}
              </div>
              {c.meu && (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                  <span className={`${t} text-[#5B6472]`}>{c.usado ? "Usado ✓" : "Seu código:"} <b className={`font-mono ${compacto ? "text-[14px]" : "text-[17px]"} tracking-wider text-[#1D2128] ${c.usado ? "line-through opacity-60" : ""}`}>{c.meu}</b></span>
                  {!c.usado && <button type="button" onClick={() => copiar(c.meu as string)} className={`${t} font-semibold text-[#1D4ED8]`}>{copiado === c.meu ? "Copiado ✓" : "Copiar"}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {erro && <div className={`mt-1 ${t} font-semibold text-[#B42318]`}>{erro}</div>}
      {!d.ehDono && !compacto && <p className="mt-2 text-[12px] text-[#5B6472]">Mostre o código na hora da compra. Os seus cupons ficam em <a href="/app/cupons" className="font-semibold text-[#1D4ED8]">Meus cupons</a>.</p>}
    </div>
  );
}
