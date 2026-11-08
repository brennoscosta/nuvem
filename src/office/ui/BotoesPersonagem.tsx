"use client";
// Botões da barra de cima: meu personagem (ou criar) e conversas com contador
import { usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { MiniAvatar } from "./Personagem";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BotoesPersonagem() {
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const naoLidas = usePersonagem((s) => s.naoLidas);
  const pedidos = usePersonagem((s) => s.pedidos);
  const preco = usePersonagem((s) => s.preco);
  const abrir = usePersonagem((s) => s.abrir);
  const posicao = usePersonagem((s) => s.posicao);
  const irCamera = () => useMundo.setState({ alvoCamera: [posicao[0], 0.5, posicao[1]] });
  return (
    <>
      {ativo && meu ? (
        <>
          <button onClick={irCamera} title="Centralizar em mim" className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white"><MiniAvatar boneco={meu.boneco} roupa={meu.roupa} tamanho={18} />{meu.nome}</button>
          <button onClick={() => abrir("caixa")} className="relative rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">Conversas{naoLidas > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#E2575B] px-1.5 text-[10px] font-bold text-white">{naoLidas}</span>}</button>
          <a href="/app/rede" className="relative rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">Minha rede{pedidos > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#DB2777] px-1.5 text-[10px] font-bold text-white">{pedidos}</span>}</a>
          <button onClick={() => abrir("montar")} className="rounded-full bg-white/10 px-2.5 py-1.5 text-xs text-white/60" title="Editar personagem">✎</button>
        </>
      ) : (
        <button onClick={() => abrir("montar")} className="rounded-full bg-[#16A34A] px-3 py-1.5 text-xs font-bold text-white">{meu ? "Ativar meu personagem" : "Criar personagem"} · {brl(preco)}</button>
      )}
    </>
  );
}
