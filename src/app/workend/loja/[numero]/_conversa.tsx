"use client";
// A conversa com a atendente na página da loja (o mesmo componente do mapa).
import { ChatLoja, type LojaInfo } from "@/office/ui/ChatLoja";
export function ConversaDaLoja({ loja, logado }: { loja: LojaInfo; logado: boolean }) {
  if (!loja.atendente) return null;
  return (
    <div>
      <b className="mb-2 block text-[1.1rem]">Fale com a {loja.nome}</b>
      <ChatLoja loja={loja} logado={logado} linkEntrar={`/entrar?destino=${encodeURIComponent(`/loja/${loja.numero}`)}`} alto={380} />
      <p className="mt-2 text-[13px] text-[var(--tinta-2)]">{loja.atendente.nome} é a atendente de IA da loja: responde na hora e passa o seu contato para o dono.</p>
    </div>
  );
}
