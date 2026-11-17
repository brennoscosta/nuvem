"use client";
// Botões da barra de cima: meu personagem (ou criar) e conversas com contador. 16/11/2026: ícones próprios, sem emoji.
import { usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { MiniAvatar } from "./Personagem";
import { Icone } from "./Icone";

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
    <div data-tour="personagem" className="flex items-center gap-1 whitespace-nowrap [&>*]:shrink-0">
      {ativo && meu ? (
        <>
          <button onClick={irCamera} title="Ir até o meu personagem" className="hud-btn !pl-1.5"><MiniAvatar boneco={meu.boneco} roupa={meu.roupa} tamanho={26} acessorios={meu.acessorios} /><span className="hud-rotulo">{meu.nome}</span></button>
          <button onClick={() => abrir("caixa")} aria-label={naoLidas ? `Conversas: ${naoLidas} não lidas` : "Conversas"} title="Conversas" className="hud-btn"><Icone nome="conversar" tamanho={18} /><span className="hud-rotulo">Conversas</span>{naoLidas > 0 && <span className="hud-selo">{naoLidas}</span>}</button>
          <a href="/app/rede" aria-label={pedidos ? `Minha rede: ${pedidos} pedidos de amizade` : "Minha rede"} title="Minha rede" className="hud-btn"><Icone nome="rede" tamanho={18} /><span className="hud-rotulo">Minha rede</span>{pedidos > 0 && <span className="hud-selo hud-selo-rosa">{pedidos}</span>}</a>
          <button onClick={() => abrir("montar")} className="hud-btn hud-btn-icone" title="Editar personagem" aria-label="Editar personagem"><Icone nome="editar" tamanho={18} /></button>
        </>
      ) : (
        <button onClick={() => abrir("montar")} className="hud-cta" aria-label={meu ? "Ativar personagem" : "Criar personagem"} title={meu ? "Ativar personagem" : "Criar personagem"}><Icone nome="pessoa" tamanho={18} /><span className="hud-rotulo">{meu ? "Ativar personagem" : "Criar personagem"}</span><span className="hud-preco">{brl(preco)}</span></button>
      )}
    </div>
  );
}
