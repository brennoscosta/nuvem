"use client";
// Cupom do passaporte na tela de cupons do dono (20/11/2026, frente "visitante"): um dos cupons ativos pode ser o "do
// passaporte". Ele sai da lista pública da loja e a recepcionista oferece só para quem é atendido na recepção com o
// passaporte da cidade (src/server/passaporte.ts). O desconto e o Pix continuam do dono: o WorkEnd não recebe nada.
import { useCallback, useEffect, useState } from "react";

// WE-16 (22/11/2026): inicial = o cupom marcado que a página já trouxe do servidor (sem ele, a lista saía pronta e o bloco
// mostrava "Oferecer na recepção" em todos os cupons até esta busca voltar)
export function useCupomPassaporte(versao: number, inicial: string | null = null) {
  const [marcado, setMarcado] = useState<string | null>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/workend/passaporte/cupom", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j) setMarcado(j.cupomId ?? null); }).catch(() => {});
    return () => { vivo = false; };
  }, [versao]);
  const marcar = useCallback(async (id: string | null) => {
    setErro(null);
    const r = await fetch("/api/workend/passaporte/cupom", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cupomId: id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
    setMarcado(j.cupomId ?? null);
  }, []);
  return { marcado, marcar, erro };
}

export function MarcarPassaporte({ id, marcado, marcar }: { id: string; marcado: string | null; marcar: (id: string | null) => void }) {
  const eh = marcado === id;
  return (
    <div className="mt-2 rounded-xl bg-white/70 p-2 ring-1 ring-[#1E2A44]/10" data-guia="cupom-passaporte-dono">
      {eh ? (
        <>
          <span className="block text-[12.5px] font-bold text-[#1E2A44]">Cupom do passaporte</span>
          <span className="block text-[12px] text-[var(--tinta-2)]">A recepcionista oferece este cupom a quem é atendido na recepção. Ele não aparece na lista pública.</span>
          <button type="button" onClick={() => marcar(null)} className="mt-1 text-[12.5px] font-semibold text-[#B42318] hover:underline">Tirar do passaporte</button>
        </>
      ) : (
        <button type="button" onClick={() => marcar(id)} data-marcar-passaporte={id} className="text-left text-[12.5px] font-semibold text-[#1E2A44] hover:underline">Oferecer na recepção, para quem chega com o passaporte</button>
      )}
    </div>
  );
}
