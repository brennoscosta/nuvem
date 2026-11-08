"use client";
// Chamada de áudio/vídeo entre dois personagens: WebRTC direto entre os navegadores (STUN do Google), com a
// sinalização (offer/answer/ice) passando pelo nosso servidor por consulta a cada 1 s. Quem liga cria a oferta
// assim que o outro atende; quem atende responde. Sem TURN: em redes muito fechadas pode não conectar — avisamos.
import { create } from "zustand";

export interface ChamadaInfo { id: string; deId: string; paraId: string; video: boolean; status: string; outroNome?: string; outroBoneco?: string; outroRoupa?: string }
type Fase = "nenhuma" | "chamando" | "tocando" | "conectando" | "ativa" | "encerrada";
interface Estado {
  fase: Fase;
  chamada: ChamadaInfo | null;
  euId: string | null;
  local: MediaStream | null;
  remoto: MediaStream | null;
  mudo: boolean; semCamera: boolean;
  erro: string | null;
  fim: string | null; // motivo do fim (pra mostrar 4 s)
  inicio: number | null;
  ligar: (paraId: string, video: boolean, euId: string, outro?: { nome: string; boneco: string; roupa: string }) => Promise<string | null>;
  receber: (c: ChamadaInfo, euId: string) => void; // veio na batida: está tocando pra mim
  atender: () => Promise<void>;
  desligar: (motivo?: string) => Promise<void>;
  alternarMudo: () => void;
  alternarCamera: () => void;
}

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
let pc: RTCPeerConnection | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let seq = 0;
let ofertaFeita = false;
let candidatosPendentes: RTCIceCandidateInit[] = [];

const api = async (url: string, body?: unknown, method = body ? "POST" : "GET") => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`); return j; };

async function pegarMidia(video: boolean): Promise<MediaStream> {
  try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: { ideal: 640 }, height: { ideal: 480 } } : false }); }
  catch { if (video) return navigator.mediaDevices.getUserMedia({ audio: true, video: false }); throw new Error("Não consegui usar o microfone. Libere a permissão no navegador."); }
}

export const useChamada = create<Estado>((set, get) => {
  const limpar = () => {
    if (timer) { clearInterval(timer); timer = null; }
    pc?.close(); pc = null; seq = 0; ofertaFeita = false; candidatosPendentes = [];
    get().local?.getTracks().forEach((t) => t.stop());
  };
  const terminar = (motivo: string) => {
    limpar();
    set({ fase: "encerrada", fim: motivo, local: null, remoto: null });
    setTimeout(() => { if (get().fase === "encerrada") set({ fase: "nenhuma", chamada: null, fim: null, inicio: null, erro: null }); }, 4000);
  };
  const prepararPC = (chamadaId: string) => {
    const p = new RTCPeerConnection({ iceServers: ICE });
    const remoto = new MediaStream();
    p.ontrack = (ev) => { ev.streams[0]?.getTracks().forEach((t) => remoto.addTrack(t)); if (!ev.streams[0]) remoto.addTrack(ev.track); set({ remoto }); };
    p.onicecandidate = (ev) => { if (ev.candidate) void api(`/api/chamadas/${chamadaId}`, { tipo: "ice", dados: ev.candidate.toJSON() }).catch(() => {}); };
    p.onconnectionstatechange = () => { if (p.connectionState === "connected") set({ fase: "ativa", inicio: get().inicio ?? Date.now() }); if (p.connectionState === "failed") set({ erro: "Não deu pra conectar o áudio/vídeo direto entre vocês (rede fechada). Continuem pelo chat." }); if (p.connectionState === "disconnected") set({ erro: "Conexão instável…" }); };
    get().local?.getTracks().forEach((t) => p.addTrack(t, get().local!));
    pc = p; return p;
  };
  const aplicarSinal = async (chamadaId: string, s: { tipo: string; dados: unknown }) => {
    const p = pc ?? prepararPC(chamadaId);
    if (s.tipo === "offer") {
      await p.setRemoteDescription(s.dados as RTCSessionDescriptionInit);
      for (const c of candidatosPendentes) await p.addIceCandidate(c).catch(() => {}); candidatosPendentes = [];
      const answer = await p.createAnswer(); await p.setLocalDescription(answer);
      await api(`/api/chamadas/${chamadaId}`, { tipo: "answer", dados: { type: answer.type, sdp: answer.sdp } });
    } else if (s.tipo === "answer") {
      if (!p.currentRemoteDescription) await p.setRemoteDescription(s.dados as RTCSessionDescriptionInit);
      for (const c of candidatosPendentes) await p.addIceCandidate(c).catch(() => {}); candidatosPendentes = [];
    } else if (s.tipo === "ice") {
      if (p.remoteDescription) await p.addIceCandidate(s.dados as RTCIceCandidateInit).catch(() => {}); else candidatosPendentes.push(s.dados as RTCIceCandidateInit);
    }
  };
  // consulta a cada 1 s: estado da chamada + sinais novos
  const vigiar = (chamadaId: string) => {
    if (timer) clearInterval(timer);
    timer = setInterval(async () => {
      try {
        const { chamada, sinais } = await api(`/api/chamadas/${chamadaId}?desde=${seq}`) as { chamada: ChamadaInfo; sinais: { seq: number; tipo: string; dados: unknown }[] };
        const st = get(); if (!st.chamada || st.chamada.id !== chamadaId) return;
        if (chamada.status === "ativa" && (st.fase === "chamando" || st.fase === "tocando")) {
          set({ fase: "conectando", chamada: { ...st.chamada, status: "ativa" } });
          // quem ligou faz a oferta assim que o outro atende
          if (chamada.deId === st.euId && !ofertaFeita) { ofertaFeita = true; const p = pc ?? prepararPC(chamadaId); const offer = await p.createOffer(); await p.setLocalDescription(offer); await api(`/api/chamadas/${chamadaId}`, { tipo: "offer", dados: { type: offer.type, sdp: offer.sdp } }); }
        }
        if (["encerrada", "recusada", "perdida"].includes(chamada.status)) { terminar(chamada.status === "recusada" ? "Chamada recusada." : chamada.status === "perdida" ? "Ninguém atendeu." : "Chamada encerrada."); return; }
        for (const s of sinais) { seq = Math.max(seq, s.seq); await aplicarSinal(chamadaId, s); }
      } catch { /* tenta no próximo segundo */ }
    }, 1000);
  };
  return {
    fase: "nenhuma", chamada: null, euId: null, local: null, remoto: null, mudo: false, semCamera: false, erro: null, fim: null, inicio: null,
    ligar: async (paraId, video, euId, outro) => {
      if (get().fase !== "nenhuma") return "Você já está numa chamada.";
      try {
        const local = await pegarMidia(video);
        const c0 = await api("/api/chamadas", { paraId, video }) as ChamadaInfo;
        const c: ChamadaInfo = { ...c0, outroNome: outro?.nome, outroBoneco: outro?.boneco, outroRoupa: outro?.roupa };
        set({ fase: "chamando", chamada: c, euId, local, remoto: null, erro: null, fim: null, mudo: false, semCamera: !local.getVideoTracks().length });
        prepararPC(c.id); vigiar(c.id);
        return null;
      } catch (e) { get().local?.getTracks().forEach((t) => t.stop()); set({ local: null }); return (e as Error).message; }
    },
    receber: (c, euId) => { const st = get(); if (st.fase !== "nenhuma" || st.chamada?.id === c.id) return; set({ fase: "tocando", chamada: c, euId, erro: null, fim: null }); vigiar(c.id); },
    atender: async () => {
      const c = get().chamada; if (!c || get().fase !== "tocando") return;
      try { const local = await pegarMidia(c.video); set({ local, semCamera: !local.getVideoTracks().length, mudo: false }); prepararPC(c.id); await api(`/api/chamadas/${c.id}`, { acao: "atender" }); set({ fase: "conectando" }); }
      catch (e) { set({ erro: (e as Error).message }); }
    },
    desligar: async (motivo) => { const c = get().chamada; if (c) void api(`/api/chamadas/${c.id}`, { acao: "encerrar" }).catch(() => {}); terminar(motivo ?? (get().fase === "tocando" ? "Chamada recusada." : "Chamada encerrada.")); },
    alternarMudo: () => { const l = get().local; const m = !get().mudo; l?.getAudioTracks().forEach((t) => { t.enabled = !m; }); set({ mudo: m }); },
    alternarCamera: () => { const l = get().local; const s = !get().semCamera; l?.getVideoTracks().forEach((t) => { t.enabled = !s; }); set({ semCamera: s }); },
  };
});
if (typeof window !== "undefined") (window as unknown as { __chamada: typeof useChamada }).__chamada = useChamada;
