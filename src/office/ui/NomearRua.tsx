"use client";
// Ruas com nome (12/11/2026): no cartão do dono, a empresa fundadora (1º mês pago com o preço de fundador) escolhe UMA
// rua livre e dá o nome. Só aparece para fundador que ainda não deu nome; depois de dar, mostra a confirmação uma vez.
import { useState } from "react";
import { RUAS } from "../data/mundo";
import { useRuas, recarregarRuas } from "../scene/RuasPlacas";
import { useMundo } from "../mundoStore";

export function NomearRua() {
  const { eu, dadas, nomes } = useRuas();
  const [aberto, setAberto] = useState(false);
  const [rua, setRua] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  if (feito) return <div className="mt-2 rounded-2xl bg-[#E8F1FF] px-3 py-2 text-xs text-[#1B4E9B]">🪧 Pronto: a <b>{feito}</b> já tem placa nas esquinas da cidade.</div>;
  if (!eu?.podeNomear) return null;
  const livres = RUAS.filter((r) => !dadas[r.id]);
  if (!livres.length) return null;
  const escolhida = RUAS.find((r) => r.id === rua) ?? null;
  const previa = escolhida && nome.trim().length >= 3 ? `${escolhida.tipo} ${nome.trim().replace(/^(rua|avenida|av\.?)\s+/i, "")}` : null;
  const enviar = async () => {
    setEnviando(true); setErro(null);
    try {
      const r = await fetch("/api/workend/ruas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rua, nome }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
      setFeito(j.nome); await recarregarRuas();
    } finally { setEnviando(false); }
  };
  // mostrar a rua no mapa: a câmera desliza até o meio dela
  const verNoMapa = (id: string) => { const r = RUAS.find((x) => x.id === id); if (!r) return; useMundo.setState({ alvoCamera: r.eixo === "z" ? [0, 0.5, r.valor] : [r.valor, 0.5, 0], loteSelecionado: null }); };
  if (!aberto) return (
    <button onClick={() => setAberto(true)} className="mt-2 w-full rounded-2xl border border-[#1B4E9B]/25 bg-[#E8F1FF] px-3 py-2.5 text-left text-xs text-[#1B4E9B] hover:bg-[#dce9ff]">
      <b>🪧 Você é fundador: dê nome a uma rua da cidade</b>
      <span className="mt-0.5 block text-[11px] text-[#3A5A8C]">A placa azul aparece nas esquinas. O primeiro que escolher fica com a rua.</span>
    </button>
  );
  return (
    <div className="mt-2 rounded-2xl border border-[#1B4E9B]/25 bg-[#F4F8FF] p-2.5">
      <div className="text-xs font-bold text-[#1B4E9B]">Dar nome a uma rua</div>
      <select value={rua} onChange={(e) => setRua(e.target.value)} aria-label="Rua" className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-base sm:text-xs">
        <option value="">Escolha a rua…</option>
        {livres.map((r) => <option key={r.id} value={r.id}>{nomes[r.id] ?? r.padrao} ({r.eixo === "z" ? "leste–oeste" : "norte–sul"})</option>)}
      </select>
      {rua && <button onClick={() => verNoMapa(rua)} className="mt-1 text-[11px] font-semibold text-[#1D4ED8] hover:underline">Ver essa rua no mapa</button>}
      <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 36))} placeholder="Ex.: Padaria do Bairro, dos Fundadores" aria-label="Nome da rua" className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-base sm:text-xs" />
      {previa && <div className="mt-1.5 inline-block rounded-md bg-[#1B4E9B] px-2 py-1 text-[11px] font-bold text-white ring-2 ring-white">{previa}</div>}
      <div className="mt-1 text-[10px] text-[#5B6472]">De 3 a 28 letras. Nada ofensivo, link ou marca de terceiros: o admin pode devolver a rua ao nome padrão.</div>
      {erro && <div className="mt-1 text-[11px] font-semibold text-[#B42318]">{erro}</div>}
      <div className="mt-2 flex gap-1.5">
        <button onClick={enviar} disabled={enviando || !rua || nome.trim().length < 3} className="flex-1 rounded-xl bg-[#1B4E9B] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{enviando ? "Salvando…" : "Dar o nome"}</button>
        <button onClick={() => { setAberto(false); setErro(null); }} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#5B6472]">Cancelar</button>
      </div>
    </div>
  );
}
