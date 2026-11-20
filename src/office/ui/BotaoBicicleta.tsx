"use client";
// Botão "Bicicleta" (19/11/2026): sobe e desce da bicicleta (também pela tecla B, em scene/Personagens.tsx). Fica na barra
// de baixo, ao lado de "Andar pela rua": com nome no computador e só o ícone no celular. A bolinha ao lado escolhe a cor do
// quadro (data/veiculos.ts), guardada junto do visual do personagem. Sem login ou sem personagem, o botão explica o que
// falta. O aviso curto (dentro do prédio não tem bicicleta e afins) aparece no alto e some sozinho.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { VEICULOS } from "../data/veiculos";
import { Icone } from "./Icone";

export function BotaoBicicleta({ celular = false }: { celular?: boolean }) {
  const usuario = useMundo((s) => s.usuario);
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const veiculo = usePersonagem((s) => s.veiculo);
  const cor = usePersonagem((s) => s.corBicicleta);
  const [aberto, setAberto] = useState<null | "explica" | "cores">(null);
  const caixa = useRef<HTMLSpanElement>(null);
  const fechar = useCallback(() => setAberto(null), []);
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) fechar(); };
    window.addEventListener("keydown", tecla); document.addEventListener("pointerdown", fora);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", fora); };
  }, [aberto, fechar]);
  const pode = ativo && !!meu;
  const montado = veiculo === "bicicleta";
  const acao = montado ? "Descer da bicicleta" : "Subir na bicicleta";
  const clicar = () => { if (!pode) { setAberto(aberto === "explica" ? null : "explica"); return; } setAberto(null); usePersonagem.getState().alternarBicicleta(); };
  const tam = celular ? "!h-9 !w-9" : "";
  return (
    <span ref={caixa} className="contents">
      <button type="button" onClick={clicar} aria-label={pode ? `${acao} (B)` : "Bicicleta: crie o seu personagem"} aria-pressed={pode ? montado : undefined} aria-expanded={!pode ? aberto === "explica" : undefined}
        className={celular ? `hud-btn hud-btn-icone ${tam}` : "hud-btn hud-btn-rotulo"} data-bicicleta="">
        <Icone nome="bicicleta" tamanho={celular ? 19 : 20} />
        {!celular && <span>Bicicleta</span>}
        {!celular && <span className="hud-dica" aria-hidden="true">{pode ? acao : "Bicicleta grátis com o personagem"}<kbd>B</kbd></span>}
      </button>
      {pode && (
        <button type="button" onClick={() => setAberto(aberto === "cores" ? null : "cores")} aria-expanded={aberto === "cores"} aria-label="Cor da bicicleta" className={`hud-btn hud-btn-icone ${tam}`}>
          <span className="hud-cor-bici" style={{ background: cor }} />
          {!celular && <span className="hud-dica" aria-hidden="true">Cor da bicicleta</span>}
        </button>
      )}
      {aberto === "cores" && <CoresBicicleta />}
      {aberto === "explica" && <ExplicaBicicleta logado={!!usuario} temPersonagem={!!meu} fechar={fechar} />}
    </span>
  );
}

function CoresBicicleta() {
  const cor = usePersonagem((s) => s.corBicicleta);
  const escolher = usePersonagem((s) => s.escolherCorBicicleta);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="hud-pop" role="dialog" aria-label="Cor da bicicleta">
      <b className="hud-pop-titulo"><Icone nome="bicicleta" tamanho={18} />Cor da bicicleta</b>
      <div className="hud-cores-bici" role="group" aria-label="Cores do quadro">
        {VEICULOS.bicicleta.cores.map((c) => (
          <button key={c.id} type="button" aria-label={c.nome} aria-pressed={cor.toUpperCase() === c.cor.toUpperCase()} title={c.nome}
            onClick={async () => { setErro(await escolher(c.cor)); }} style={{ background: c.cor }} />
        ))}
      </div>
      <p className="hud-nota">{erro ?? "Fica guardada com o seu personagem. Quem passa por você no mapa vê a cor nova."}</p>
    </div>
  );
}

function ExplicaBicicleta({ logado, temPersonagem, fechar }: { logado: boolean; temPersonagem: boolean; fechar: () => void }) {
  const abrir = usePersonagem((s) => s.abrir);
  const texto = !logado ? "Entre na sua conta e crie o seu personagem para pedalar pela cidade, bem mais rápido que a pé."
    : !temPersonagem ? "Crie o seu personagem para pedalar pela cidade, bem mais rápido que a pé."
    : "Ative o seu personagem para pedalar pela cidade, bem mais rápido que a pé.";
  return (
    <div className="hud-pop" role="dialog" aria-label="Bicicleta">
      <b className="hud-pop-titulo"><Icone nome="bicicleta" tamanho={18} />Bicicleta grátis</b>
      <p className="mt-2 text-[13px] leading-snug text-white/80">{texto} A bicicleta vem junto, sem pagar nada a mais.</p>
      <div className="mt-3 flex justify-end">
        {logado
          ? <button type="button" onClick={() => { fechar(); abrir("montar"); }} className="hud-btn hud-azul">{temPersonagem ? "Ativar personagem" : "Criar personagem"}</button>
          : <a href="/entrar" className="hud-btn hud-azul">Entrar</a>}
      </div>
    </div>
  );
}

// aviso curto da bicicleta, no alto da tela; some em 2,6 s
export function AvisoBicicleta() {
  const aviso = usePersonagem((s) => s.avisoVeiculo);
  const [visto, setVisto] = useState(0);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setVisto(aviso.n), 2600);
    return () => clearTimeout(t);
  }, [aviso]);
  if (!aviso || visto === aviso.n) return null;
  return (
    <div className="pointer-events-none absolute inset-x-2 top-24 z-30 flex justify-center" role="status">
      <span className="hud-ilha inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl"><Icone nome="bicicleta" tamanho={16} />{aviso.texto}</span>
    </div>
  );
}
