"use client";
// Login do admin (senha única, ADMIN_SENHA no CapRover) e cartão público do agente pra visitantes.
import { useState } from "react";
import { AREAS, NIVEL } from "../data/org";
import { SALA } from "../data/layout";
import { useEscritorio } from "../store";
import { STATUS } from "./PainelAgente";

export function ModalLogin() {
  const aberto = useEscritorio((s) => s.modalLogin);
  const setModal = useEscritorio((s) => s.setModalLogin);
  const login = useEscritorio((s) => s.login);
  const senhaConfigurada = useEscritorio((s) => s.senhaConfigurada);
  const [senha, setSenha] = useState(""); const [erro, setErro] = useState<string | null>(null); const [enviando, setEnviando] = useState(false);
  if (!aberto) return null;
  const enviar = async () => { setEnviando(true); setErro(null); const e = await login(senha); setEnviando(false); if (e) setErro(e); else setSenha(""); };
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-[#1D2128] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold">Entrar como admin</div>
        <div className="mt-1 text-xs text-[#5B6472]">Só o admin contrata, treina e conversa com os agentes. Visitantes só assistem.</div>
        {!senhaConfigurada && <div className="mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Defina a variável <b>ADMIN_SENHA</b> no CapRover (app nuvem → Configurações do App) e reinicie.</div>}
        <input type="password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} placeholder="Senha do admin" className="mt-4 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#4F7DF3]" />
        {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setModal(false)} className="rounded-xl px-4 py-2 text-sm text-[#5B6472]">Cancelar</button>
          <button onClick={enviar} disabled={enviando || !senha} className="rounded-xl bg-[#4F7DF3] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{enviando ? "Entrando…" : "Entrar"}</button>
        </div>
      </div>
    </div>
  );
}

// O que um visitante vê ao clicar num agente: nome, cargo, sala, status e a fala pública. Nada de conversa ou ficha.
export function CartaoPublico() {
  const id = useEscritorio((s) => s.selecionado);
  const a = useEscritorio((s) => (id ? s.agentes[id] : undefined));
  const selecionar = useEscritorio((s) => s.selecionar);
  const setModalLogin = useEscritorio((s) => s.setModalLogin);
  if (!a) return null;
  const st = STATUS[a.status]; const nv = NIVEL[a.nivel]; const area = AREAS[a.area];
  const fala = a.falaPublica || a.fala || (a.status === "trabalhando" ? "Tô online, focado numa entrega." : a.status === "reuniao" ? "Em reunião agora." : a.status === "pausa" ? "Dando uma pausa rápida." : "Online, pronto pra próxima tarefa.");
  return (
    <div className="absolute right-3 top-20 z-10 w-80 rounded-2xl bg-white/97 p-4 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: nv.cor }} /><span className="text-lg font-bold">{a.nome}</span></div>
          <div className="text-xs text-[#5B6472]">{nv.nome} · {a.funcao} · {area.nome} · {SALA[a.sala]?.nome}</div>
        </div>
        <button onClick={() => selecionar(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: st.cor }} />{st.nome}</div>
      <div className="mt-2 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-sm italic">“{fala}”</div>
      <button onClick={() => setModalLogin(true)} className="mt-3 w-full rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs font-semibold text-[#4F7DF3]">Sou o admin · entrar</button>
    </div>
  );
}
