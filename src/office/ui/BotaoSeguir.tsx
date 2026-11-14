"use client";
// Seguir a loja (13/11/2026): quem segue recebe no sino (e no celular) a promoção, o evento na praça e o produto novo.
// No cartão do mapa e na página /loja/N. Sem conta: leva para entrar. O dono vê só quantos seguidores tem.
import { useEffect, useState } from "react";

interface Estado { seguindo: boolean; seguidores: number; meu: boolean; logado: boolean }
const n = (x: number) => `${x} ${x === 1 ? "seguidor" : "seguidores"}`;

export function BotaoSeguir({ numero, claro = false }: { numero: number; claro?: boolean }) {
  const [e, setE] = useState<{ numero: number; estado: Estado } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/workend/seguir?numero=${numero}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j) setE({ numero, estado: j }); }).catch(() => {});
    return () => { vivo = false; };
  }, [numero]);
  const est = e?.numero === numero ? e.estado : null;
  if (!est) return null;
  if (est.meu) return <span className={`text-[12px] font-semibold ${claro ? "text-white/85" : "text-[#5B6472]"}`}>⭐ {n(est.seguidores)}</span>;
  const base = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${claro ? "" : "ring-1"}`;
  const cor = est.seguindo
    ? (claro ? "bg-white/20 text-white" : "bg-[#FFF7DB] text-[#7A5A00] ring-[#F5C542]/60")
    : (claro ? "bg-white text-[#1D2128]" : "bg-white text-[#1D4ED8] ring-[#1D4ED8]/30 hover:bg-[#EEF3FF]");
  if (!est.logado) return <a href={`/entrar?destino=${encodeURIComponent(`/loja/${numero}`)}`} className={`${base} ${cor}`}>☆ Seguir <span className="font-semibold opacity-70">· {est.seguidores}</span></a>;
  const alternar = async () => {
    setOcupado(true); setErro(null);
    try {
      const r = await fetch("/api/workend/seguir", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ numero }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro(j.erro ?? `Erro ${r.status}`); else setE({ numero, estado: { ...j, logado: true } });
    } finally { setOcupado(false); }
  };
  return (
    <span className="inline-flex flex-col">
      <button onClick={alternar} disabled={ocupado} aria-pressed={est.seguindo} title={est.seguindo ? "Você recebe os avisos desta loja. Toque para deixar de seguir." : "Receba um aviso quando a loja ligar uma promoção, marcar um evento ou puser um produto novo."} className={`${base} ${cor} disabled:opacity-60`}>
        {est.seguindo ? "★ Seguindo" : "☆ Seguir"} <span className="font-semibold opacity-70">· {est.seguidores}</span>
      </button>
      {erro && <span className={`mt-1 text-[11px] font-semibold ${claro ? "text-white" : "text-[#B42318]"}`}>{erro}</span>}
    </span>
  );
}
