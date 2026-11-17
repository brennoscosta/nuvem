// Estrelas de avaliação com o ícone próprio (17/11/2026, revisão geral: eram ★ e ☆ de texto). Cheias na cor da nota,
// vazias em cinza; o leitor de tela ouve "Nota N de 5".
import { Icone } from "./Icone";

export const CHEIA = "[&_path]:[fill-opacity:1]";
export function NotaEstrelas({ nota, tamanho = 14 }: { nota: number; tamanho?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-[-2px]" role="img" aria-label={`Nota ${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((k) => <Icone key={k} nome="estrela" tamanho={tamanho} className={k <= nota ? `text-[#B7791F] ${CHEIA}` : "text-[#A9B4C2]"} />)}
    </span>
  );
}
// uma estrela cheia antes de uma média ("4,8")
export function EstrelaMedia({ tamanho = 13 }: { tamanho?: number }) {
  return <Icone nome="estrela" tamanho={tamanho} className={`mr-0.5 inline align-[-2px] text-[#B7791F] ${CHEIA}`} />;
}
