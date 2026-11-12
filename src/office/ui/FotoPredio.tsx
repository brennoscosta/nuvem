"use client";
// Botão "Foto do meu prédio" (12/11/2026), para o cartão do dono no mapa: escolhe a hora (agora, de dia ou de noite) e
// baixa um PNG de 1920 × 1080 com o prédio enquadrado de frente, um pouco de lado, sem a interface do mapa.
// Durante a foto o cartão some por um instante (a moldura do lote selecionado não pode aparecer na foto) e volta sozinho.
import { useState } from "react";
import { tirarFotoPredio, type HoraFoto, LARGURA_FOTO, ALTURA_FOTO } from "../scene/fotoPredio";

const HORAS: [HoraFoto, string][] = [["agora", "Agora"], ["dia", "De dia"], ["noite", "De noite"]];
// guarda o resultado fora do componente: o cartão desmonta e monta de novo durante a foto
let ultimo: { chave: string; texto: string; ok: boolean } | null = null;

export function FotoPredio({ chave }: { chave: string }) {
  const [aberto, setAberto] = useState(false);
  const [hora, setHora] = useState<HoraFoto>("agora");
  const [tirando, setTirando] = useState(false);
  const [msg, setMsg] = useState(() => (ultimo?.chave === chave ? ultimo : null));
  const tirar = async () => {
    setTirando(true); setMsg(null);
    const r = await tirarFotoPredio(chave, hora);
    ultimo = { chave, ok: r.ok, texto: r.ok ? `Foto baixada: ${r.arquivo}` : r.erro };
    setTirando(false); setMsg(ultimo);
  };
  if (!aberto) return (
    <div>
      <button onClick={() => { setAberto(true); setMsg(null); ultimo = null; }} className="w-full rounded-xl bg-[#F1F3F6] px-3 py-2 text-[11px] font-bold text-[#1D2128] hover:bg-[#e6e9ee]">📸 Foto do meu prédio para postar</button>
      {msg && <div className={`mt-1 text-center text-[11px] font-semibold ${msg.ok ? "text-[#166534]" : "text-[#B42318]"}`}>{msg.texto}</div>}
    </div>
  );
  return (
    <div className="rounded-2xl bg-[#F1F3F6] p-2.5">
      <div className="text-xs font-bold text-[#1D2128]">Foto do meu prédio</div>
      <div className="mt-0.5 text-[11px] text-[#5B6472]">{LARGURA_FOTO} × {ALTURA_FOTO}, sem os botões do mapa, pronta para Instagram, WhatsApp ou site.</div>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Hora da foto">
        {HORAS.map(([v, n]) => <button key={v} role="radio" aria-checked={hora === v} onClick={() => setHora(v)} className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${hora === v ? "bg-[#1D2128] text-white" : "bg-white text-[#1D2128]"}`}>{n}</button>)}
      </div>
      <div className="mt-2 flex gap-1.5">
        <button onClick={tirar} disabled={tirando} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{tirando ? "Tirando…" : "Baixar a foto"}</button>
        <button onClick={() => setAberto(false)} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#5B6472]">Fechar</button>
      </div>
      {msg && <div className={`mt-1.5 text-[11px] font-semibold ${msg.ok ? "text-[#166534]" : "text-[#B42318]"}`}>{msg.texto}</div>}
    </div>
  );
}
