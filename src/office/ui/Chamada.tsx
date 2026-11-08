"use client";
// Janela da chamada (áudio/vídeo): toca → atender/recusar; ativa → vídeo do outro grande, o meu pequeno, mudo/câmera/desligar.
import { useEffect, useRef, useState } from "react";
import { useChamada } from "../chamadaStore";
import { MiniAvatar } from "./Personagem";

function Video({ stream, mudo = false, className }: { stream: MediaStream | null; mudo?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={mudo} className={className} />;
}
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function JanelaChamada() {
  const fase = useChamada((s) => s.fase);
  const c = useChamada((s) => s.chamada);
  const local = useChamada((s) => s.local);
  const remoto = useChamada((s) => s.remoto);
  const mudo = useChamada((s) => s.mudo);
  const semCamera = useChamada((s) => s.semCamera);
  const erro = useChamada((s) => s.erro);
  const fim = useChamada((s) => s.fim);
  const inicio = useChamada((s) => s.inicio);
  const atender = useChamada((s) => s.atender);
  const desligar = useChamada((s) => s.desligar);
  const alternarMudo = useChamada((s) => s.alternarMudo);
  const alternarCamera = useChamada((s) => s.alternarCamera);
  const [agora, setAgora] = useState(0);
  useEffect(() => { if (fase !== "ativa") return; const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, [fase]);
  if (fase === "nenhuma" || !c) return null;
  const nome = c.outroNome ?? "Personagem";
  const temVideoRemoto = !!remoto && remoto.getVideoTracks().some((t) => t.enabled);
  if (fase === "tocando") return (
    <div className="fixed inset-x-0 top-20 z-40 mx-auto w-[22rem] rounded-2xl bg-[#111418] p-4 text-white shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-3"><MiniAvatar boneco={c.outroBoneco ?? "classico"} roupa={c.outroRoupa ?? "#1D4ED8"} tamanho={48} /><div><div className="text-[10px] font-bold uppercase tracking-wide text-[#16A34A]">📹 Chamada chegando</div><div className="text-lg font-bold leading-tight">{nome}</div><div className="text-xs text-white/60">{c.video ? "vídeo e áudio" : "só áudio"}</div></div></div>
      {erro && <div className="mt-2 text-xs font-semibold text-[#FCA5A5]">{erro}</div>}
      <div className="mt-3 flex gap-2"><button onClick={() => void desligar("Chamada recusada.")} className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold">Recusar</button><button onClick={() => void atender()} className="flex-1 rounded-xl bg-[#16A34A] px-3 py-2.5 text-sm font-bold">Atender</button></div>
    </div>
  );
  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,26rem)] overflow-hidden rounded-2xl bg-[#111418] text-white shadow-2xl ring-1 ring-white/10">
      <div className="relative aspect-[4/3] bg-black">
        {temVideoRemoto ? <Video stream={remoto} className="h-full w-full object-cover" /> : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2"><MiniAvatar boneco={c.outroBoneco ?? "classico"} roupa={c.outroRoupa ?? "#1D4ED8"} tamanho={72} />{remoto && <Video stream={remoto} className="hidden" />}<div className="text-sm font-bold">{nome}</div><div className="text-xs text-white/60">{fase === "chamando" ? "Chamando…" : fase === "conectando" ? "Conectando…" : fase === "encerrada" ? fim : "sem câmera"}</div></div>
        )}
        {local && !semCamera && <Video stream={local} mudo className="absolute bottom-2 right-2 h-24 w-32 rounded-lg object-cover ring-2 ring-white/20" />}
        <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold">{fase === "ativa" && inicio ? `${nome} · ${mmss(Math.max(0, agora - inicio))}` : fase === "encerrada" ? fim : nome}</div>
        {erro && fase !== "encerrada" && <div className="absolute inset-x-2 bottom-28 rounded-lg bg-[#E2575B]/90 px-2 py-1 text-center text-[11px] font-semibold">{erro}</div>}
      </div>
      <div className="flex items-center justify-center gap-2 p-3">
        <button onClick={alternarMudo} title={mudo ? "Ativar microfone" : "Silenciar"} className={`rounded-full px-4 py-2 text-sm font-bold ${mudo ? "bg-[#E2575B]" : "bg-white/10"}`}>{mudo ? "🔇" : "🎙️"}</button>
        {c.video && <button onClick={alternarCamera} title={semCamera ? "Ligar câmera" : "Desligar câmera"} className={`rounded-full px-4 py-2 text-sm font-bold ${semCamera ? "bg-[#E2575B]" : "bg-white/10"}`}>{semCamera ? "🚫" : "📷"}</button>}
        <button onClick={() => void desligar()} className="rounded-full bg-[#E2575B] px-5 py-2 text-sm font-bold">Desligar</button>
      </div>
    </div>
  );
}
