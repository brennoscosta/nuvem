"use client";
// A conversa com a atendente na página da loja (o mesmo componente do mapa). 17/11/2026: num cartão próprio, logo depois
// do topo no celular e fixo à direita no computador (o link "Conversar agora" do topo traz para cá).
import { ChatLoja, type LojaInfo } from "@/office/ui/ChatLoja";
export function ConversaDaLoja({ loja, logado }: { loja: LojaInfo; logado: boolean }) {
  if (!loja.atendente) return null;
  return (
    <section id="conversa" className="pg-cartao lj-bloco scroll-mt-6" aria-label={`Conversa com ${loja.atendente.nome}`}>
      <h2 className="!text-[1.15rem]">Converse com a recepção</h2>
      <p className="mb-3 mt-1 text-[14px] text-[var(--tinta-2)]">{loja.atendente.nome} é a atendente de IA: responde na hora e passa o seu contato para a equipe.</p>
      <ChatLoja loja={loja} logado={logado} linkEntrar={`/entrar?destino=${encodeURIComponent(`/loja/${loja.numero}`)}`} alto={340} />
    </section>
  );
}
