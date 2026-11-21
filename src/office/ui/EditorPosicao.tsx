"use client";
// Painel do modo "Editar posição" (21/11/2026; o estado é office/edicaoStore.ts, a cena é scene/EditorPosicao.tsx).
// Gaveta embaixo no celular (botões grandes) e no canto direito no computador, como os outros cartões do mapa:
// o que está acontecendo (vale ou não, e por quê), girar para cada lado, ajuste fino em cruz, centralizar, cancelar e
// confirmar. Também aqui: o botão "Editar posição" dos cartões do lote, do quiosque e da sede.
import { useEdicao, podeEditarPosicao } from "../edicaoStore";
import { useMundo } from "../mundoStore";
import { moverNaTela } from "../scene/EditorPosicao";
import { NOME_LADO, ladoDoVetor, nomeDoLugar, estruturasDoLote, quartosDoTerreno, anexosDe, type PosePredio } from "../data/posicaoPredio";
import { Icone } from "./Icone";
import { FLUTUANTE, ESTREITO } from "./estilo";

const NOME_LADO_QUIOSQUE = { l: "o calçadão da praia", o: "a Avenida Atlântica", n: "a passagem do lado norte", s: "a passagem do lado sul" } as const;
function frase(p: PosePredio) {
  const lado = ladoDoVetor(p.frente);
  if (p.tipo === "quiosque") return `O balcão fica de frente para ${NOME_LADO_QUIOSQUE[lado]}.`;
  const rua = p.terreno.abertos.includes(lado);
  // lote em quartos (21/11/2026): o lugar onde a estrutura encaixou e para onde ela olha
  if (p.estrutura) {
    const onde = nomeDoLugar(p.estrutura.tamanho, p.estrutura.lugar);
    if (p.estrutura.tamanho === "quiosque") return `No ${onde}. O balcão fica de frente para o ${NOME_LADO[lado]}${rua ? ", o lado da rua" : "; o cliente chega pelo caminho do lote"}.`;
    return `Na ${onde}. A porta fica de frente para o ${NOME_LADO[lado]}${rua ? ", o lado da rua" : "; o caminho vai pelo lote até a calçada"}.`;
  }
  return rua ? `A porta dá para a rua, do lado ${NOME_LADO[lado]}.` : `A porta fica virada para o ${NOME_LADO[lado]}; o caminho vai pelo lado do prédio até a calçada.`;
}

export function EditorPosicaoPainel() {
  const s = useEdicao();
  if (!s.chave || !s.pose) return null;
  const ok = !!s.conf?.ok, mudou = !!s.inicial && (s.inicial.giro !== s.giro || s.inicial.desloc[0] !== s.desloc[0] || s.inicial.desloc[1] !== s.desloc[1]);
  const so180 = s.pose.terreno.so180 || s.tamanho === "medio", quartos = !!s.estrutura;
  const btn = "grid place-items-center rounded-xl bg-[#EEF3FF] text-[#1D4ED8] hover:bg-[#dfe8ff] active:scale-95 transition disabled:opacity-40";
  const seta = (d: "cima" | "baixo" | "esq" | "dir", rot: string, rotulo: string) => (
    <button type="button" onClick={() => moverNaTela(d)} className={`${btn} h-12 w-12 sm:h-10 sm:w-10`} aria-label={rotulo} title={rotulo}><Icone nome="seta" tamanho={20} className={rot} /></button>
  );
  return (
    <div data-editor-posicao className={`${FLUTUANTE} ${ESTREITO} painel-entra !z-30 overflow-y-auto p-4`} role="dialog" aria-label={`Editar posição: ${s.nome}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1 text-[12px] font-semibold text-[#1D4ED8]"><Icone nome="posicao" tamanho={14} />Editar posição</div>
          <div className="text-lg font-bold leading-tight">{s.nome}</div>
        </div>
        <button type="button" onClick={s.cancelar} className="-mr-2 -mt-2 grid h-11 w-11 place-items-center rounded-full text-[#5B6472] hover:bg-black/5 sm:h-8 sm:w-8" title="Fechar sem salvar (Esc)"><Icone nome="fechar" tamanho={16} /><span className="sr-only">Fechar sem salvar</span></button>
      </div>
      {quartos && <TrocarEstrutura />}
      <div data-estado={ok ? "vale" : "nao-vale"} className={`mt-3 rounded-2xl px-3 py-2 text-[13px] leading-snug ${ok ? "bg-[#E3F6EA] text-[#166534]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`}>
        <div className="flex items-center gap-1.5 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} />{ok ? "Posição válida" : "Esta posição não vale"}</div>
        <div className="mt-0.5">{ok ? frase(s.pose) : s.conf?.motivo}</div>
      </div>
      {(s.aviso || (ok && s.conf?.avisos.length)) ? (
        <div className="mt-2 space-y-1 rounded-2xl bg-[#FFF4D6] px-3 py-2 text-[12px] leading-snug text-[#7A5A00]">
          {s.aviso && <div>{s.aviso}</div>}
          {ok && s.conf?.avisos.slice(0, 4).map((a) => <div key={a}>{a}</div>)}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
        <div className="grid grid-cols-3 gap-1.5">
          <span />{seta("cima", "-rotate-90", "Mover para cima na tela")}<span />
          {seta("esq", "rotate-180", "Mover para a esquerda na tela")}
          <button type="button" onClick={s.centralizar} className={`${btn} h-12 w-12 sm:h-10 sm:w-10`} aria-label={quartos ? "Voltar para onde estava" : "Centralizar no terreno"} title={quartos ? "Voltar para onde estava" : "Centralizar"}><Icone nome="centralizar" tamanho={20} /></button>
          {seta("dir", "", "Mover para a direita na tela")}
          <span />{seta("baixo", "rotate-90", "Mover para baixo na tela")}<span />
        </div>
        <div className="space-y-1.5">
          <button type="button" onClick={() => s.girar(1)} className={`${btn} h-12 w-full grid-flow-col gap-1.5 px-3 text-sm font-bold sm:h-10`} title="Girar para a esquerda (Shift+R)"><Icone nome="girarEsq" tamanho={18} />{so180 ? "Meia volta" : "Girar à esquerda"}</button>
          <button type="button" onClick={() => s.girar(-1)} className={`${btn} h-12 w-full grid-flow-col gap-1.5 px-3 text-sm font-bold sm:h-10`} title="Girar para a direita (R)"><Icone nome="girarDir" tamanho={18} />{so180 ? "Meia volta" : "Girar à direita"}</button>
          <div className="text-center text-[11px] text-[#5B6472]">{s.tamanho === "medio" ? "Prédio médio: de frente ou de costas na metade." : so180 ? "Prédio de dois lotes: só de frente ou de costas para a rua." : `Giro de ${s.giro * 90}°`}</div>
        </div>
      </div>
      {quartos ? (
        <>
          <div className="mt-2 hidden text-[11px] leading-snug text-[#5B6472] sm:block">Arraste para outro {s.tamanho === "medio" ? "lado do lote (encaixa numa metade livre)" : "quarto livre (encaixa no quarto)"}. <b>R</b> gira; as setas levam ao lugar livre do lado; <b>Enter</b> confirma e <b>Esc</b> cancela.</div>
          <div className="mt-2 text-[11px] leading-snug text-[#5B6472] sm:hidden">Arraste com um dedo para outro {s.tamanho === "medio" ? "lado livre do lote" : "quarto livre"}. Com dois dedos, você mexe a câmera.</div>
        </>
      ) : (
        <>
          <div className="mt-2 hidden text-[11px] leading-snug text-[#5B6472] sm:block">Arraste o prédio no chão (encaixa de 0,5 em 0,5 m). <b>R</b> gira para a direita e <b>Shift+R</b> para a esquerda; as setas ajustam; <b>Enter</b> confirma e <b>Esc</b> cancela.</div>
          <div className="mt-2 text-[11px] leading-snug text-[#5B6472] sm:hidden">Arraste o prédio com um dedo. Com dois dedos, você mexe a câmera.</div>
        </>
      )}
      {s.erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{s.erro}</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={s.cancelar} className="h-12 rounded-xl bg-[#F1F3F6] px-4 text-sm font-semibold text-[#5B6472] sm:h-11">Cancelar</button>
        <button type="button" data-confirmar onClick={() => void s.confirmar()} disabled={!ok || s.salvando} className="h-12 flex-1 rounded-xl bg-[#1D4ED8] px-3 text-sm font-bold text-white hover:bg-[#1a44c2] disabled:opacity-50 sm:h-11">{s.salvando ? "Salvando…" : mudou ? "Confirmar posição" : "Confirmar"}</button>
      </div>
    </div>
  );
}

// lote em quartos: qual estrutura está em edição (o prédio médio e cada quiosque); trocar descarta o que não foi confirmado
function TrocarEstrutura() {
  const chave = useEdicao((s) => s.chave), atual = useEdicao((s) => s.estrutura);
  const terrenos = useMundo((s) => s.terrenos);
  const t = chave ? terrenos[chave] : null, q = t?.escritorio ? quartosDoTerreno(t, anexosDe(terrenos)[chave!] ?? null) : null;
  if (!chave || !t?.escritorio || !q) return null;
  const ests = estruturasDoLote(q, t.escritorio); if (ests.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="O que posicionar">
      {ests.map((x, i) => {
        const n = x.tamanho === "medio" ? "Prédio médio" : `Quiosque ${q.quiosques.findIndex((k) => k.id === x.id) + 1}`;
        return <button key={x.id} type="button" data-estrutura={x.id} aria-pressed={x.id === atual} onClick={() => { if (x.id !== atual) useEdicao.getState().abrir(chave, x.id); }} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${x.id === atual ? "bg-[#1D4ED8] text-white" : "bg-[#F1F3F6] text-[#1D2128] hover:bg-[#E5E9F0]"}`}>{n || `Parte ${i + 1}`}</button>;
      })}
    </div>
  );
}

// "Editar posição" nos cartões: só aparece para quem pode (dono do lote ou do quiosque; a sede, a conta admin)
export function BotaoEditarPosicao({ chave, className = "", compacto = false }: { chave: string; className?: string; compacto?: boolean }) {
  useMundo((s) => `${s.usuario?.id ?? ""}|${s.admin}|${s.terrenos[chave]?.status ?? ""}|${s.meus.join(",")}`); // redesenha quando muda quem pode
  const p = podeEditarPosicao(chave);
  if (!p.pode) return null;
  const abrir = () => { const erro = useEdicao.getState().abrir(chave); if (erro) window.setTimeout(() => useEdicao.setState({ erro }), 0); };
  return (
    <button type="button" data-editar-posicao onClick={abrir} className={`${compacto ? "rounded-xl px-2 py-2 text-[12px]" : "block w-full rounded-xl px-3 py-2.5 text-sm"} bg-[#EEF3FF] text-center font-bold text-[#1D4ED8] hover:bg-[#dfe8ff] ${className}`}>
      <Icone nome="posicao" tamanho={compacto ? 15 : 17} className="mr-1 inline align-[-3px]" />Editar posição
    </button>
  );
}
