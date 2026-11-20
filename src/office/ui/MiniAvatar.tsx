// Mini avatar do personagem (17/11/2026, revisão geral): separado de ui/Personagem.tsx, que carrega a prévia 3D
// (three.js). Assim as páginas que só mostram o rostinho (Encontrar, Minha rede, conversas) não baixam o motor 3D.
import type { CSSProperties } from "react";
import { TODOS_BONECOS, bonecoDe } from "../data/bonecos";
import { ACESSORIO_POR_ID, type LugarAcessorio } from "../data/acessorios";
import { Icone, ICONE_ACESSORIO } from "./Icone";
import { RetratoBoneco } from "./RetratoBoneco";

// Mini avatar: retrato em SVG do visual do personagem (ui/RetratoBoneco.tsx); com acessórios, o ícone de cada um
// aparece no lugar dele
// relógio, pulseira e brinco (20/11/2026) não ganham ícone: o brinco aparece no próprio retrato e o pulso não aparece
const POS_ICONE: Partial<Record<LugarAcessorio, (t: number) => CSSProperties>> = {
  cabeca: (t) => ({ left: "50%", top: -t * 0.2, transform: "translateX(-50%)", fontSize: t * 0.42 }),
  rosto: (t) => ({ left: "50%", top: t * 0.2, transform: "translateX(-50%)", fontSize: t * 0.3 }),
  pescoco: (t) => ({ left: "50%", top: t * 0.56, transform: "translateX(-50%)", fontSize: t * 0.28 }),
  costas: (t) => ({ right: -t * 0.14, bottom: -t * 0.04, fontSize: t * 0.32 }),
};
export function MiniAvatar({ boneco, roupa, tamanho = 40, acessorios }: { boneco: string; roupa: string; tamanho?: number; acessorios?: string[] }) {
  const usados = (acessorios ?? []).map((i) => ACESSORIO_POR_ID[i]).filter((a) => a && POS_ICONE[a.lugar]);
  const avatar = <AvatarRetrato boneco={boneco} roupa={roupa} tamanho={tamanho} acessorios={acessorios} />;
  if (!usados.length) return avatar;
  return (
    <span className="relative inline-block shrink-0" style={{ width: tamanho, height: tamanho }}>
      {avatar}
      {usados.map((a) => { const st = POS_ICONE[a.lugar]!(tamanho), t = Number(st.fontSize) || tamanho * 0.3; return <span key={a.id} aria-hidden className="pointer-events-none absolute grid select-none place-items-center leading-none" style={{ ...st, fontSize: undefined, color: a.cor === "#FFFFFF" ? "#8C97A6" : a.cor, filter: "drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1px #fff)" }}><Icone nome={ICONE_ACESSORIO[a.id] ?? "mais"} tamanho={Math.round(t * 1.15)} traco={2.2} /></span>; })}
    </span>
  );
}
function AvatarRetrato({ boneco, roupa, tamanho, acessorios }: { boneco: string; roupa: string; tamanho: number; acessorios?: string[] }) {
  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded-full" style={{ width: tamanho, height: tamanho }}>
      <RetratoBoneco def={bonecoDe(boneco, TODOS_BONECOS.classico)} roupa={roupa} tamanho={tamanho} acessorios={acessorios} />
    </span>
  );
}
