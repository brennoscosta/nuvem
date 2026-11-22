// Roteiros do guia no mapa da cidade (/mundo), 21/11/2026, frente "tutorial". Quatro roteiros:
//  - cidade (quem só visita e quem acabou de chegar): andar, bicicleta, mapa, pessoas online, loja, recepcionista, praça;
//  - empresa: escolher o lote, reservar, pagar, quiosque, expandir o terreno e montar o escritório;
//  - escritorio: abre junto com o painel "Montar escritório" (prédio com os 15 modelos, abas e a vitrine de agentes);
//  - personagem: abre junto com o editor do personagem.
// Os passos abrem cartões pelo estado do mapa (selecionarLote, abrirPainel, setAbaEscritorio): não mexem na cena 3D além
// do que um toque da pessoa faria. Ao fechar, o guia fecha o cartão que ele mesmo abriu.
import { useMundo, LOTES, LOTE_POR_CHAVE } from "../mundoStore";
import { PRACA_CHAVE } from "../data/praca";
import { QUIOSQUES, ehQuiosque } from "../data/quiosques";
import { PRECO_QUIOSQUE, PRECO_LOTE, precoCurto } from "../data/precosTerreno";
import { MODELOS } from "../data/modelos";
import { TROCAS_LAYOUT_GRATIS, PRECO_TROCA_LAYOUT } from "../data/escritorio";
import { sedeDe } from "../data/sedes";
import { porTexto, primeiro } from "./alvos";
import { barraSimplesAgora } from "../ui/barraSimples";
import type { Roteiro } from "./tipos";

const LOTE = `${precoCurto(PRECO_LOTE)} por mês`; // data/precosTerreno.ts › PRECO_LOTE (WE-19)
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const m = () => useMundo.getState();

// o cartão que o guia abriu (para fechar ao sair, se a pessoa não foi para outro lugar nem está preenchendo um painel)
let doGuia: string | null = null;
function selecionar(chave: string | null) { doGuia = chave; m().selecionarLote(chave); }
export function desfazerSelecao() {
  const s = m();
  if (doGuia && s.loteSelecionado === doGuia && !s.painelEmpresa && !s.painelEscritorio) s.selecionarLote(null);
  doGuia = null;
}
// a tela final pede para mostrar um lote: fica aberto depois que o guia fecha
const mostrar = (chave: string | null) => setTimeout(() => { doGuia = null; m().selecionarLote(chave); }, 60);

const CARTAO = '[data-tour="cartao-loja"]';
const noCartao = (re: RegExp, sel = "button, a") => () => { const c = primeiro(CARTAO); return c ? porTexto(sel, re, c) : null; };
// pelo atributo data-guia (estável): o texto do botão pode mudar sem quebrar o guia
const noCartaoSel = (sel: string) => () => { const c = primeiro(CARTAO); return c ? primeiro(sel, c) : null; };
function lojaAberta() {
  const s = m(), minhas = new Set([s.meu, ...s.meus]);
  return Object.values(s.terrenos).find((t) => t.status === "ativo" && !t.anexoDe && !!t.escritorio && !ehQuiosque(t.chave) && t.chave !== PRACA_CHAVE && !!LOTE_POR_CHAVE[t.chave] && !sedeDe(t.chave) && !minhas.has(t.chave))?.chave ?? null;
}
const loteLivre = () => { const s = m(); return LOTES.find((l) => l.lote.tipo !== "praca" && l.chave !== PRACA_CHAVE && !s.terrenos[l.chave] && !sedeDe(l.chave))?.chave ?? null; };
const quiosqueLivre = () => { const s = m(); return QUIOSQUES.find((q) => !s.terrenos[q.chave])?.chave ?? null; };
const meuLote = () => { const s = m(); return s.meu && !sedeDe(s.meu) && !ehQuiosque(s.meu) ? s.meu : null; };
const reservaNoMapa = () => { const s = m(); return !!s.meu && s.terrenos[s.meu]?.status === "reservado"; };

const PAINEL_ESC = () => porTexto(".painel-entra", /Seu prédio, do seu jeito/);
const abaEsc = (re: RegExp) => () => { const p = PAINEL_ESC(); return p ? porTexto("button", re, p) : null; };
const EDITOR = "[data-editor-personagem]";
// barra simples para quem chega (WE-22, ui/barraSimples.ts): a bicicleta, girar e as vistas ficam dentro de Ajustes. O passo
// da bicicleta acende o botão dela quando está na barra e, senão, o botão Ajustes (data-guia="ajustes-mapa")
const BICICLETA = "button[aria-label*='icicleta']:not([aria-label='Cor da bicicleta'])";
const AJUSTES = '[data-guia="ajustes-mapa"]';

export const ROTEIROS_MUNDO: Roteiro[] = [
  // ---------- a cidade: para quem só visita e para quem acabou de chegar ----------
  {
    id: "cidade", tela: "mundo", nome: "A cidade", gatilho: "entrada", aoFechar: desfazerSelecao,
    passos: [
      { id: "ola", tipo: "manual", alvo: '[data-tour="camera"]', recadoNoCelular: true, antes: (pronto) => { selecionar(null); pronto(); }, titulo: "Bem-vindo à cidade do WorkEnd",
        texto: (c) => (c.celular ? "Cada prédio é uma empresa de verdade. Arraste com o dedo para passear e use dois dedos para aproximar." : barraSimplesAgora() ? "Cada prédio é uma empresa de verdade. Arraste para passear; esta barra anda pela rua, passeia de drone e aproxima. Girar e as vistas de cima e da rua ficam em Ajustes."
          : "Cada prédio é uma empresa de verdade. Arraste para passear; esta barra gira, aproxima e mostra a cidade de cima ou da rua.") },
      { id: "andar", tipo: "manual", alvo: "button[aria-label^='Andar pela rua']", titulo: "Andar pela rua",
        texto: (c) => (!c.fatos.personagem ? "Com um personagem você anda pela rua e entra nas lojas a pé. Ele é grátis: toque em Criar personagem grátis, no alto."
          : c.celular ? "Toque aqui e ande com o seu personagem pelo joystick." : "Toque aqui (ou na tecla C) e ande com o seu personagem pelas setas ou W, A, S, D.") },
      { id: "bicicleta", tipo: "manual", alvo: () => primeiro(BICICLETA) ?? primeiro(AJUSTES), titulo: "Bicicleta",
        texto: (c) => `Grátis para quem tem personagem: anda mais rápido pela cidade.${primeiro(BICICLETA) ? "" : " Ela fica aqui em Ajustes, junto com girar e as vistas."}${c.celular ? "" : " Tecla B para subir e descer."}` },
      { id: "mapa", tipo: "manual", alvo: '[data-tour="mapa"]', titulo: "Mapa da cidade", texto: "As lojas por área. Toque num lote do mapa para voar até ele." },
      { id: "online", tipo: "manual", alvo: ".hud-online", titulo: "Quem está na cidade", texto: "Toque aqui para ver quantas pessoas estão na cidade agora, quem são e onde estão." },
      { id: "loja", tipo: "manual", antes: (pronto) => { selecionar(lojaAberta()); pronto(); }, alvo: CARTAO, titulo: "Cartão da loja", texto: "Toque num prédio para ver a empresa: o que ela faz, a vitrine, os cupons e as vagas." },
      // ui/Recepcao.tsx › BotaoEntrar: data-guia="entrar-predio" nos dois jeitos do botão (sem personagem ativo, desde a
      // WE-14, ele também diz "Entrar no prédio" e abre a recepção na tela); o texto fica só de reserva, para um cartão que
      // ainda não tenha o atributo
      { id: "recepcao", tipo: "manual", alvo: () => noCartaoSel('[data-guia="entrar-predio"]')() ?? noCartao(/^(Entrar no prédio|Crie seu personagem( para entrar| grátis))$/)(), titulo: "Fale com a recepcionista",
        texto: (c) => (c.fatos.personagem ? "Em Entrar no prédio, o seu personagem vai até a porta. Lá dentro a recepcionista pergunta o que você procura e chama o setor certo." : "Em Entrar no prédio, a recepcionista te atende na hora, mesmo sem conta: pergunta o que você procura e chama o setor certo. Com um personagem grátis, você vai até lá a pé.") },
      { id: "praca", tipo: "manual", antes: (pronto) => { selecionar(PRACA_CHAVE); pronto(); },
        alvo: () => { const c = primeiro('[data-tour="praca"]'); return c ? (porTexto("b", /^Anuncie no telão/, c)?.parentElement ?? c) : null; },
        titulo: "Praça e telão", texto: "Na praça acontecem lives e lançamentos, e aos sábados tem feira. O telão passa os anúncios das empresas da cidade." },
      { id: "personagem", tipo: "fato", fato: "personagem", antes: (pronto) => { selecionar(null); pronto(); }, alvo: '[data-tour="personagem"]', titulo: "Seu personagem",
        texto: (c) => (c.fatos.personagem ? "Este é você na cidade. O lápis muda o visual; em Conversas ficam as mensagens com quem você conheceu." : "Crie o seu personagem, de graça: ele anda pela cidade, conversa com quem está online e negocia com as empresas.") },
      // passaporte da cidade (frente "visitante"): o botão da barra (ui/Passaporte.tsx › BotaoPassaporte, só com personagem
      // ativo); [data-guia="passaporte"] é a janela já aberta. Sem o botão na tela, o passo é pulado e não fica pendente
      { id: "passaporte", tipo: "manual", opcional: true, quando: (c) => c.logado, pularSe: () => !primeiro('[data-guia="botao-passaporte"]'), alvo: '[data-guia="botao-passaporte"]', titulo: "Passaporte da cidade",
        texto: "Cada loja em que a recepcionista atende você e cada pedido dos moradores vira um carimbo. Toque aqui para ver o que já conquistou." },
      { id: "fim", tipo: "manual", ultimo: true, titulo: (c) => (c.fatos.loteAtivo ? "Boa visita" : "E a sua empresa?"),
        texto: (c) => (c.fatos.loteAtivo ? "Visite as vizinhas. Cada painel tem o próprio guia no botão Guia, no canto da tela." : "Quer um endereço na cidade? O próximo guia mostra como escolher, reservar e pagar o seu lote."),
        acoes: (c) => (c.fatos.loteAtivo ? [] : [{ rotulo: "Ver como ter a minha empresa", roteiro: "empresa", principal: true }]) },
    ],
  },
  // ---------- ter uma empresa: lote, reserva, pagamento, quiosque, expandir e montar ----------
  {
    id: "empresa", tela: "mundo", nome: "Ter uma empresa", gatilho: "entrada", aoFechar: desfazerSelecao,
    passos: [
      { id: "escolher", tipo: "manual", antes: (pronto) => { selecionar(loteLivre()); pronto(); }, alvo: CARTAO, titulo: "Escolha um lote livre",
        texto: (c) => `Os lotes livres aparecem como ponto disponível. O cartão mostra o preço: ${LOTE}, com créditos ou Pix, sem cobrança automática.${c.logado ? "" : " Sem conta, o botão leva ao cadastro e volta para este mesmo lote."}` },
      { id: "reservar", tipo: "fato", fato: "lote", quando: (c) => c.logado && !c.fatos.lote,
        antes: (pronto) => { const ch = loteLivre(); if (m().loteSelecionado !== ch) selecionar(ch); const t = setTimeout(() => { m().abrirPainel(); pronto(); }, 250); return () => clearTimeout(t); },
        // ui/Lote.tsx › PainelEmpresa: data-guia="formulario-reserva" (WE-07, 21/11/2026); o título fica de reserva
        alvo: () => primeiro('[data-guia="formulario-reserva"]') ?? porTexto(".painel-entra", /Como vai se chamar\?/), titulo: "Reserve por 1 hora",
        texto: "Escreva o nome da empresa, escolha a cor da placa e toque em Reservar. O lote fica guardado para você por 1 hora, até o pagamento. Nicho, equipe e logo ficam para depois, já sugeridos." },
      { id: "pagar", tipo: "fato", fato: "loteAtivo", quando: (c) => c.logado && !c.fatos.loteAtivo, pularSe: () => !reservaNoMapa(),
        antes: (pronto) => { const s = m(); if (s.meu && s.loteSelecionado !== s.meu) selecionar(s.meu); pronto(); },
        alvo: () => { const c = primeiro(CARTAO); return c ? primeiro("[data-cobranca]", c) : null; }, titulo: "Pague o 1º mês",
        texto: "Com créditos ou no Pix, com o QR na tela. Aprovado o pagamento, a loja abre no mapa na hora e você confere o nicho, os nomes da equipe e a logo." },
      { id: "pagar-recado", tipo: "manual", quando: (c) => !c.fatos.loteAtivo, pularSe: reservaNoMapa, titulo: "Depois, pague o 1º mês",
        texto: "Com o lote reservado, o cartão mostra o botão de pagar: créditos ou Pix, com o QR na tela. Aprovado o pagamento, a loja abre no mapa na hora e você confere o nicho, os nomes da equipe e a logo." },
      { id: "quiosque", tipo: "manual", antes: (pronto) => { selecionar(quiosqueLivre()); pronto(); }, alvo: CARTAO, titulo: `Quiosque por ${brl(PRECO_QUIOSQUE)}`,
        texto: `Um balcão menor na praça, no comércio ou na orla, com a atendente de IA. Custa ${brl(PRECO_QUIOSQUE)} por mês e também tem reserva de 1 hora.` },
      { id: "expandir", tipo: "fato", fato: "expandiu", quando: (c) => c.fatos.loteAtivo, antes: (pronto) => { selecionar(meuLote()); pronto(); },
        alvo: noCartao(/Expandir terreno|Terreno expandido/), titulo: "Expandir o terreno",
        texto: "Junte o lote do lado ao seu: o prédio cresce e ocupa os dois terrenos. O lote extra renova junto com o principal, num pagamento só." },
      // modo "Editar posição" (frente "editor"): o botão do cartão só aparece para o dono, o sócio e o admin (ui/EditorPosicao.tsx)
      { id: "posicao", tipo: "manual", opcional: true, quando: (c) => c.fatos.loteAtivo, antes: (pronto) => { if (m().loteSelecionado !== meuLote()) selecionar(meuLote()); pronto(); },
        alvo: noCartaoSel("[data-editar-posicao]"), titulo: "Gire e posicione o prédio",
        texto: (c) => (c.celular ? "Em Editar posição você gira o prédio e arrasta dentro do lote. A porta precisa de caminho até a calçada; confirme para valer no mapa."
          : "Em Editar posição você gira (tecla R) e arrasta o prédio dentro do lote. A porta precisa de caminho até a calçada; Enter confirma.") },
      // lote em quartos (21/11/2026, ui/EspacoLote.tsx): só aparece no lote dividido em quartos (quiosque ou prédio médio)
      { id: "espaco", tipo: "manual", opcional: true, quando: (c) => c.fatos.loteAtivo, pularSe: () => !noCartaoSel('[data-guia="espaco-lote"]')(), antes: (pronto) => { if (m().loteSelecionado !== meuLote()) selecionar(meuLote()); pronto(); },
        alvo: noCartaoSel('[data-guia="espaco-lote"]'), titulo: "Use o espaço livre do lote",
        texto: "Os quartos livres ficam marcados no chão. Em Usar este espaço você põe mais um quiosque ou um prédio médio, sem pagar a mais pelo lote." },
      { id: "montar", tipo: "manual", auto: true, quando: (c) => c.fatos.loteAtivo, antes: (pronto) => { if (m().loteSelecionado !== meuLote()) selecionar(meuLote()); pronto(); },
        alvo: noCartao(/^Montar escritório$/), titulo: "Monte o escritório", texto: "Prédio, fachada, interior, setores e equipe. Toque em Montar escritório: o painel tem o próprio guia." },
      { id: "fim", tipo: "manual", ultimo: true, titulo: (c) => (c.fatos.loteAtivo ? "Sua empresa já tem endereço" : "Pronto para escolher?"),
        texto: (c) => (c.fatos.loteAtivo ? "Quando quiser rever, toque em Guia, no canto da tela." : c.logado ? "Toque num lote livre do mapa para começar." : "Crie a sua conta e escolha o lote. A reserva vale 1 hora."),
        acoes: (c) => (c.fatos.loteAtivo ? [] : c.logado ? [{ rotulo: "Mostrar um lote livre", fazer: () => mostrar(loteLivre()), principal: true }] : [{ rotulo: "Criar minha conta", href: "/cadastro", principal: true }]) },
    ],
  },
  // ---------- painel "Montar escritório" ----------
  {
    id: "escritorio", tela: "mundo", nome: "Montar escritório", gatilho: "escritorio",
    passos: [
      { id: "abas", tipo: "manual", alvo: () => abaEsc(/^Prédio$/)()?.parentElement ?? null, titulo: "Montar escritório",
        texto: "Cinco abas: prédio, fachada, interior, setores e equipe. O mapa mostra cada mudança na hora, mas ela só vale depois de Salvar." },
      { id: "predio", tipo: "manual", antes: (pronto) => { m().setAbaEscritorio("predio"); pronto(); }, alvo: () => primeiro("[data-modelo]")?.closest<HTMLElement>(".space-y-2") ?? null,
        titulo: `Prédio: ${MODELOS.length} modelos`, texto: `Cada modelo mostra a foto, a categoria e o preço. Você tem ${TROCAS_LAYOUT_GRATIS} trocas de prédio grátis; depois, cada troca custa ${brl(PRECO_TROCA_LAYOUT)}.` },
      // lote em quartos (21/11/2026): quanto do lote usar (ui/EspacoLote.tsx › TamanhoNoLote)
      { id: "tamanho", tipo: "manual", opcional: true, pularSe: () => !primeiro('[data-guia="tamanho-lote"]'), alvo: '[data-guia="tamanho-lote"]', titulo: "Quanto do lote usar",
        texto: "Só um quiosque (1/4), um prédio médio (meio lote) ou o prédio grande. O que sobra fica livre para crescer depois, sem comprar outro lote." },
      { id: "fachada", tipo: "manual", alvo: abaEsc(/^Fachada$/), titulo: "Fachada", texto: "Cores, letreiro e altura da fachada, com a sua marca." },
      { id: "interior", tipo: "manual", alvo: abaEsc(/^Interior$/), titulo: "Interior", texto: "Móveis e decoração das salas. Ao abrir esta aba, a câmera entra no prédio." },
      { id: "setores", tipo: "manual", alvo: abaEsc(/^Setores/), titulo: "Setores", texto: "As salas da empresa, como vendas e marketing. Cada setor tem mesas para a equipe." },
      { id: "vitrine", tipo: "fato", fato: "contratou", antes: (pronto) => { m().setAbaEscritorio("contratar"); pronto(); }, alvo: "[data-vitrine], [data-abrir-vitrine]", titulo: "Contrate na vitrine",
        texto: "Cada agente de IA tem preço e personalidade. Toque num deles para ver a ficha e contratar com créditos ou Pix." },
      { id: "salvar", tipo: "manual", ultimo: true, alvo: () => { const p = PAINEL_ESC(); return p ? porTexto("button", /^Salvar escritório$/, p) : null; }, titulo: "Salve",
        texto: "Nada muda para os visitantes até você salvar. Cancelar desfaz o que não foi salvo." },
    ],
  },
  // ---------- editor do personagem ----------
  {
    id: "personagem", tela: "mundo", nome: "Seu personagem", gatilho: "personagem", quando: (c) => c.logado,
    passos: [
      { id: "previa", tipo: "manual", alvo: () => primeiro(`${EDITOR} [aria-label='Aleatório']`)?.parentElement?.parentElement ?? null, titulo: "Seu boneco, ao vivo", texto: "Cada mudança aparece aqui na hora. Arraste para girar." },
      { id: "abas", tipo: "manual", alvo: `${EDITOR} [role='tablist']`, titulo: "Partes do personagem",
        texto: "Visual pronto, corpo, rosto, cabelo, roupa, acessórios, uniforme da sua empresa e perfil profissional. Role para o lado para ver todas." },
      { id: "sortear", tipo: "manual", alvo: `${EDITOR} [aria-label='Aleatório']`, titulo: "Sem ideia? Sorteie", texto: "O dado monta um visual aleatório; a seta ao lado desfaz a última mudança." },
      { id: "pecas", tipo: "manual", alvo: `${EDITOR} [role='tabpanel']`, titulo: "Peças e acessórios", texto: "Só as peças premium têm preço (R$ 5,90 cada); o resto é grátis. Tudo fica em rascunho até você salvar." },
      { id: "salvar", tipo: "fato", fato: "personagem", ultimo: true, alvo: () => primeiro("[data-salvar-personagem]") ?? porTexto(`${EDITOR} button`, /^Ativar/),
        titulo: "Salvar",
        texto: (c) => (c.fatos.personagem ? "Salve para todo mundo ver o visual novo no mapa." : "Criar o personagem é grátis para quem tem conta: salve e ele entra no mapa. A bicicleta vem junto.") },
    ],
  },
];
