"use client";
// "Como funciona a personalização" (16/11/2026, pedido do dono): modal em 5 passos que explica o montador do personagem
// (src/office/ui/Personagem.tsx › PainelPersonagem). Cada passo tem uma cena animada feita com os bonecos de verdade
// (MiniAvatar) e os ícones próprios; nada de imagem pronta com letras. Setas do teclado trocam de passo, Esc fecha.
import { useEffect, useRef, useState } from "react";
import { MiniAvatar } from "@/office/ui/MiniAvatar";
import { Icone, ICONE_ACESSORIO, type NomeIcone } from "@/office/ui/Icone";
import { TIPOS_AVATAR } from "@/office/data/bonecos";
import { ACESSORIOS as TODOS_ACESSORIOS } from "@/office/data/acessorios";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ESTILOS = Array.from(new Set(TIPOS_AVATAR.map((t) => t.estilo)));
const ACESSORIOS = TODOS_ACESSORIOS.filter((a) => a.preco > 0); // os pagos (relógio, pulseira e brincos são grátis desde 20/11/2026)
const MENOR_ACESSORIO = Math.min(...ACESSORIOS.map((a) => a.preco));
const LUGAR: Record<string, string> = { cabeca: "cabeça", rosto: "rosto", pescoco: "pescoço", costas: "costas", pulso: "pulso" };

type Passo = { id: string; icone: NomeIcone; curto: string; titulo: string; texto: string; itens: [NomeIcone, string][] };

export function ComoFunciona({ aberto, fechar, preco, precoCheio, rotuloFinal }: { aberto: boolean; fechar: () => void; preco: number; precoCheio: number; rotuloFinal: string }) {
  const [st, setSt] = useState({ i: 0, dir: 1 });
  const caixa = useRef<HTMLDivElement>(null);
  const PASSOS: Passo[] = [
    { id: "visual", icone: "cabide", curto: "Visual", titulo: "Escolha o seu visual",
      texto: `São ${TIPOS_AVATAR.length} visuais prontos, nos estilos ${ESTILOS.join(", ").replace(/, ([^,]*)$/, " e $1")}. Filtre por gênero e toque no que tem a sua cara. Dá para trocar depois, sem pagar de novo.`,
      itens: [["cabide", `${TIPOS_AVATAR.length} visuais para escolher`], ["equipe", "Feminino, masculino ou neutro"], ["editar", "Troca quando quiser"]] },
    { id: "nome", icone: "etiqueta", curto: "Nome", titulo: "Nome no balão e apresentação",
      texto: "O nome aparece no balãozinho em cima do seu personagem, para quem passa por você no mapa (até 24 letras). Em “Sobre você” conte em uma frase o que você faz: é o que aparece na sua ficha quando alguém toca em você.",
      itens: [["etiqueta", "Nome com até 24 letras"], ["perfil", "Apresentação com até 200 letras"], ["selo", "Os selos das missões aparecem na ficha"]] },
    { id: "redes", icone: "link", curto: "Redes", titulo: "Redes sociais e perfil profissional",
      texto: "Coloque Instagram, WhatsApp, LinkedIn e site. Você decide: mostrar para todo mundo ou só para quem você aceitar como amigo. Se você presta serviço, ligue o perfil profissional e apareça na busca de Encontrar.",
      itens: [["link", "Redes visíveis para todos ou só para amigos"], ["maleta", "Perfil profissional: o que faz, preço e onde atende"], ["encontrar", "Empresas acham você em Encontrar"]] },
    { id: "acessorios", icone: "bone", curto: "Acessórios", titulo: "Roupas e acessórios",
      texto: `${ACESSORIOS.length} itens a partir de ${brl(MENOR_ACESSORIO)}, pagos no Pix. Um por lugar do corpo: cabeça, rosto, pescoço, costas e pulso; relógio, pulseira e brincos são grátis. Comprou, é seu para sempre: tira e põe quando quiser, e quem passa por você no mapa vê o visual novo.`,
      itens: [["bone", "Boné, chapéu, cartola, coroa e fone"], ["oculosSol", "Óculos, cachecol, colar, mochila e asinhas"], ["check", "Comprou uma vez, usa sempre"]] },
    { id: "ativar", icone: "raio", curto: "Ativar", titulo: "Ative e entre na cidade",
      texto: `${brl(preco)} por mês na promoção de lançamento (de ${brl(precoCheio)}), no Pix e sem fidelidade. Ativo, você toca no chão para andar, entra nas lojas, fala com a equipe, conversa com quem está online, faz amigos, negocia e faz chamadas.`,
      itens: [["pino", "Toque no chão para andar"], ["conversar", "Conversas, negócios e chamadas"], ["explorador", "Missões que viram selos"]] },
  ];
  const ultimo = PASSOS.length - 1;
  const ir = (i: number) => setSt((s) => ({ i: Math.max(0, Math.min(ultimo, i)), dir: i >= s.i ? 1 : -1 }));

  // teclado, rolagem da página presa enquanto aberto e foco no modal
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight") setSt((s) => ({ i: Math.min(ultimo, s.i + 1), dir: 1 }));
      if (e.key === "ArrowLeft") setSt((s) => ({ i: Math.max(0, s.i - 1), dir: -1 }));
    };
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tecla);
    caixa.current?.focus();
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  }, [aberto, fechar, ultimo]);

  if (!aberto) return null;
  const p = PASSOS[st.i];
  return (
    <div className="cf-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={caixa} className="cf" role="dialog" aria-modal="true" aria-labelledby="cf-titulo" tabIndex={-1}>
        <button type="button" className="cf-fechar" onClick={fechar} aria-label="Fechar"><Icone nome="fechar" tamanho={20} /></button>
        <div className="cf-palco" data-passo={p.id}>
          <div key={p.id} className={`cf-cena ${st.dir > 0 ? "cf-vem-dir" : "cf-vem-esq"}`}><Cena id={p.id} preco={preco} /></div>
        </div>
        <div className="cf-texto">
          <ol className="cf-passos" aria-label="Passos">
            {PASSOS.map((x, i) => (
              <li key={x.id}>
                <button type="button" onClick={() => ir(i)} aria-current={i === st.i ? "step" : undefined} className={i < st.i ? "cf-feito" : ""}>
                  <Icone nome={i < st.i ? "check" : x.icone} tamanho={16} /><span>{x.curto}</span>
                </button>
              </li>
            ))}
          </ol>
          <div key={p.id} className={`cf-corpo ${st.dir > 0 ? "cf-vem-dir" : "cf-vem-esq"}`}>
            <span className="cf-conta">Passo {st.i + 1} de {PASSOS.length}</span>
            <h2 id="cf-titulo">{p.titulo}</h2>
            <p>{p.texto}</p>
            <ul className="cf-itens">
              {p.itens.map(([ic, t], k) => <li key={t} style={{ ["--i" as string]: k }}><span><Icone nome={ic} tamanho={18} /></span>{t}</li>)}
            </ul>
          </div>
          <div className="cf-nav">
            <button type="button" className="btn btn-linha !py-2.5" onClick={() => ir(st.i - 1)} disabled={st.i === 0}>Voltar</button>
            <div className="cf-pontos" aria-hidden="true">{PASSOS.map((x, i) => <i key={x.id} className={i === st.i ? "cf-ponto-on" : ""} />)}</div>
            {st.i < ultimo
              ? <button type="button" className="btn btn-azul !py-2.5" onClick={() => ir(st.i + 1)}>Próximo<Icone nome="seta" tamanho={18} /></button>
              : <a href="/mundo?personagem=1" className="btn btn-azul !py-2.5">{rotuloFinal}</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- as cenas de cada passo ----------
function Cena({ id, preco }: { id: string; preco: number }) {
  if (id === "visual") {
    const n = TIPOS_AVATAR.length, passo = 360 / n;
    return (
      <div className="cf-carrossel" aria-hidden="true">
        <div className="cf-anel">
          {TIPOS_AVATAR.map((t, i) => (
            <span key={t.id} className="cf-anel-item" style={{ transform: `rotateY(${i * passo}deg) translateZ(var(--raio))` }}>
              <MiniAvatar boneco={t.boneco} roupa={t.roupa} tamanho={66} />
              <small>{t.nome}</small>
            </span>
          ))}
        </div>
        <div className="cf-chao" />
      </div>
    );
  }
  if (id === "nome") {
    return (
      <div className="cf-nome" aria-hidden="true">
        <div className="cf-boneco">
          <span className="cf-balao"><i />Bia</span>
          <MiniAvatar boneco="praia-3" roupa="#7C3AED" tamanho={110} />
          <span className="cf-sombra" />
        </div>
        <div className="cf-ficha">
          <div className="flex items-center gap-2"><MiniAvatar boneco="praia-3" roupa="#7C3AED" tamanho={34} /><b>Bia</b><span className="cf-online">online</span></div>
          <p className="cf-digita"><span>Fotógrafa de produtos em Aracaju. Procuro lojas para parcerias.</span></p>
          <div className="cf-selos">{(["explorador", "conversar", "estrela"] as NomeIcone[]).map((ic, i) => <span key={ic} style={{ ["--i" as string]: i }}><Icone nome={ic} tamanho={15} /></span>)}</div>
        </div>
      </div>
    );
  }
  if (id === "redes") {
    const redes: [NomeIcone, string, string][] = [["instagram", "Instagram", "#D6337A"], ["telefone", "WhatsApp", "#16A34A"], ["perfil", "LinkedIn", "#0A66C2"], ["globo", "Site", "#5B6472"]];
    return (
      <div className="cf-redes" aria-hidden="true">
        <div className="cf-cartao-perfil">
          <div className="flex items-center gap-2.5"><MiniAvatar boneco="oculos" roupa="#0EA5A4" tamanho={44} /><div><b>Rafael</b><small>Designer · Remoto</small></div></div>
          <div className="cf-chips">{redes.map(([ic, n, cor], i) => <span key={n} style={{ ["--i" as string]: i, color: cor }}><Icone nome={ic} tamanho={16} /><em>{n}</em></span>)}</div>
          <div className="cf-chave"><span>Todo mundo</span><span>Só amigos</span><i /></div>
        </div>
        <div className="cf-busca"><Icone nome="encontrar" tamanho={16} /><span>designer</span><b>Rafael aparece aqui</b></div>
      </div>
    );
  }
  if (id === "acessorios") {
    return (
      <div className="cf-orbita" aria-hidden="true">
        <div className="cf-orbita-centro"><MiniAvatar boneco="classico" roupa="#0A6CFF" tamanho={104} /><span className="cf-sombra" /></div>
        <div className="cf-orbita-anel">
          {ACESSORIOS.map((a, i) => (
            <span key={a.id} className="cf-orbita-item" style={{ offsetDistance: `${(i / ACESSORIOS.length) * 100}%`, animationDelay: `${(-(i / ACESSORIOS.length) * 15).toFixed(2)}s`, ["--cor" as string]: a.cor === "#FFFFFF" ? "#8C97A6" : a.cor }} title={`${a.nome} · ${LUGAR[a.lugar]}`}>
              <span><Icone nome={ICONE_ACESSORIO[a.id] ?? "mais"} tamanho={22} /></span>
            </span>
          ))}
        </div>
        <span className="cf-preco-tag">a partir de {brl(MENOR_ACESSORIO)}</span>
      </div>
    );
  }
  return (
    <div className="cf-mapa" aria-hidden="true">
      <div className="cf-mapa-chao">
        <i className="cf-lote cf-l1" /><i className="cf-lote cf-l2" /><i className="cf-lote cf-l3" /><i className="cf-lote cf-l4" />
        <span className="cf-alvo" />
        <span className="cf-andando"><MiniAvatar boneco="coque" roupa="#DB2777" tamanho={40} /></span>
      </div>
      <div className="cf-selos-voam">{(["explorador", "conversar", "maleta"] as NomeIcone[]).map((ic, i) => <span key={ic} style={{ ["--i" as string]: i }}><Icone nome={ic} tamanho={16} /></span>)}</div>
      <span className="cf-preco-tag">{brl(preco)} por mês</span>
    </div>
  );
}
