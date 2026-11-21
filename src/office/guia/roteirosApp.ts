// Roteiros do guia nas páginas logadas (/app…) e em /encontrar (21/11/2026, frente "tutorial"). Textos curtos e concretos.
// Um passo cujo alvo não existe para esta conta é pulado (ex.: a loja aberta para quem ainda não tem lote; os links da
// barra no celular, onde eles moram no menu). Nada aqui depende de IA.
import { cartaoDoTitulo, linkDaBarra, menuDaBarra, porTexto, primeiro } from "./alvos";
import { PRECO_TELAO_DIA, SEGUNDOS_SLOT } from "../data/telao";
import type { Roteiro } from "./tipos";

const LOTE = "R$ 99 por mês"; // src/server/terrenos.ts › PRECO_LOTE
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const barra = (href: string) => () => linkDaBarra(href);
const PERFIL_PAINEL = '[data-teste="perfil-falta"], [data-teste="perfil-completo"]';
const aba = (re: RegExp) => () => porTexto("[aria-label='Seções da equipe'] [role='tab']", re);

export const ROTEIROS_APP: Roteiro[] = [
  // ---------- Meu escritório, para quem acabou de criar a conta ou ainda não tem a loja aberta ----------
  {
    id: "boas-vindas", tela: "painel", nome: "Primeiros passos", gatilho: "entrada", quando: (c) => !c.fatos.loteAtivo,
    passos: [
      { id: "ola", tipo: "manual", titulo: (c) => `Boas-vindas ao WorkEnd${c.nome ? `, ${c.nome}` : ""}`, texto: "Em poucos passos você vê onde fica cada coisa. Toque em Seguir. Se quiser parar, feche no X: o guia volta na próxima vez que você entrar." },
      { id: "perfil", tipo: "fato", fato: "perfil", alvo: PERFIL_PAINEL, titulo: "Seu perfil",
        texto: (c) => (c.fatos.perfil ? "Seu perfil está completo. É ele que aparece para quem procura o que você oferece." : "Conte o que você oferece e o que procura. Leva uns 2 minutos e faz você aparecer na busca da cidade.") },
      { id: "lote", tipo: "fato", fato: "loteAtivo", alvo: ".pn a.btn-grande[href^='/mundo']",
        titulo: (c) => (c.fatos.reservado ? "Falta pagar o 1º mês" : "O endereço da sua empresa"),
        texto: (c) => (c.fatos.reservado
          ? `Seu lote está reservado por 1 hora. Pague o 1º mês no mapa, com créditos ou Pix, e a loja abre na hora. São ${LOTE}, sem cobrança automática.`
          : `No mapa, escolha um lote livre e reserve por 1 hora. Depois pague o 1º mês com créditos ou Pix: ${LOTE}, sem cobrança automática.`) },
      { id: "mapa", tipo: "visita", tela: "mundo", alvo: barra("/mundo"), titulo: "Mapa da cidade", texto: "A cidade em 3D com todas as lojas. Lá você anda com o seu personagem, entra nas empresas e escolhe o seu lote." },
      { id: "menu", tipo: "manual", alvo: menuDaBarra, titulo: "As áreas ficam neste menu", texto: "Mapa da cidade, Encontrar e Minha rede: toque aqui para ir a cada uma." },
      { id: "creditos", tipo: "manual", alvo: ".cab [data-saldo-topo]", titulo: "Seus créditos", texto: "1 crédito vale R$ 1. Com créditos você paga o lote, os itens premium do personagem e os anúncios sem gerar um Pix novo a cada vez." },
      { id: "avisos", tipo: "manual", alvo: '.cab [data-tour="avisos"]', titulo: "Avisos", texto: "O sino junta num lugar só as mensagens, os pagamentos aprovados e as candidaturas às suas vagas." },
      { id: "encontrar", tipo: "manual", alvo: barra("/encontrar"), titulo: "Encontrar", texto: "Procure empresas, profissionais e vagas da cidade. Quem tem perfil completo aparece aqui." },
      { id: "rede", tipo: "manual", alvo: barra("/app/rede"), titulo: "Minha rede e personagem", texto: "Crie o seu personagem, de graça, para andar pela cidade, fazer amigos e negociar com as lojas." },
      { id: "guia", tipo: "manual", alvo: "[data-guia-botao]", titulo: "O guia fica aqui", texto: "Em qualquer tela, toque aqui para ver o passo a passo dela de novo." },
      { id: "fim", tipo: "manual", ultimo: true, titulo: (c) => (c.fatos.loteAtivo ? "Tudo pronto" : "Próximo passo: o seu lote"),
        texto: (c) => (c.fatos.loteAtivo ? "Sua loja já está aberta. Veja o guia da empresa no botão Guia." : "Escolha o lote no mapa. Quando a loja abrir, o guia mostra o painel da empresa."),
        acoes: (c) => (c.fatos.loteAtivo ? [] : [{ rotulo: "Escolher meu lote", href: "/mundo", principal: true }]) },
    ],
  },
  // ---------- Meu escritório, para quem tem a loja aberta ----------
  {
    id: "dono", tela: "painel", nome: "Sua empresa", gatilho: "entrada", quando: (c) => c.fatos.loteAtivo,
    passos: [
      { id: "ola", tipo: "manual", titulo: "Seu escritório no WorkEnd", texto: "Daqui você acompanha a loja e chega a cada ferramenta da empresa. São passos curtos; dá para fechar quando quiser." },
      { id: "loja", tipo: "manual", alvo: ".pn-loja", titulo: "Sua loja no mapa", texto: `Nome, endereço e até quando o lote está pago. O lote custa ${LOTE} no Pix, sem cobrança automática: quando faltar pouco, renove pelo mapa.` },
      { id: "montar", tipo: "manual", alvo: ".pn-loja a.btn-azul", titulo: "Montar o escritório", texto: "No mapa, toque no seu lote e em Montar escritório: prédio (são 15 modelos), fachada, interior, setores e equipe." },
      { id: "equipe", tipo: "manual", alvo: ".pn-equipe", titulo: "Sua equipe de IA", texto: "A atendente responde quem entra na loja e você dá tarefas ao CEO. Para crescer a equipe, contrate na vitrine do mapa: cada agente tem preço e personalidade." },
      { id: "vendas", tipo: "manual", alvo: ".pn-ferr a[href='/app/vendas']", titulo: "Vendas e pedidos", texto: "Os pedidos que a atendente anotou. O Pix do cliente cai direto na sua chave: você confere no banco e confirma aqui." },
      { id: "divulgar", tipo: "manual", alvo: ".pn-ferr a[href='/app/divulgar']", titulo: "Divulgar e anunciar na praça", texto: "Imagem pronta para os Stories, adesivo para a porta e anúncios no telão da praça e nos outdoors das avenidas." },
      { id: "resultados", tipo: "manual", alvo: () => linkDaBarra("/app/resultados") ?? primeiro(".pn a[href='/app/resultados']"), titulo: "Resultados", texto: "Visitas, conversas e cliques da semana, e de onde veio cada visita." },
      { id: "creditos", tipo: "manual", alvo: ".cab [data-saldo-topo]", titulo: "Créditos e Unidades de IA", texto: "Créditos pagam tudo no WorkEnd (1 crédito = R$ 1). As Unidades de IA são o que a equipe gasta para responder: todo lote ativo recebe 1.000 por mês." },
      { id: "perfil", tipo: "manual", alvo: PERFIL_PAINEL, titulo: "Perfil público",
        texto: (c) => (c.fatos.perfil ? "O seu endereço em workend.online/perfil. Por ele chega quem combina com o que você oferece." : "Complete o perfil para aparecer na busca de quem procura o que você oferece.") },
      { id: "fim", tipo: "manual", ultimo: true, titulo: "Pronto", texto: "Cada tela tem o próprio guia: toque em Guia, no alto, quando precisar.", acoes: [{ rotulo: "Abrir o mapa", href: "/mundo" }] },
    ],
  },
  // ---------- Créditos e Unidades de IA ----------
  {
    id: "creditos", tela: "creditos", nome: "Créditos", gatilho: "entrada",
    passos: [
      { id: "saldo", tipo: "manual", alvo: "[data-saldo]", titulo: "Saldo de créditos", texto: "1 crédito vale R$ 1. O que você comprou pode voltar em dinheiro em até 7 dias; o bônus não volta, mas paga tudo igual." },
      { id: "comprar", tipo: "manual", alvo: () => primeiro("[data-pacote]")?.closest("ul") ?? null, titulo: "Comprar créditos", texto: "Escolha um pacote e pague no Pix, com o QR na tela. Os pacotes maiores vêm com bônus." },
      { id: "unidades", tipo: "manual", alvo: "#unidades", titulo: "Unidades de IA", texto: "É o que a equipe de IA gasta para responder. Todo lote ativo recebe 1.000 por mês; as que você compra com créditos não vencem." },
      { id: "extrato", tipo: "manual", alvo: () => primeiro("[data-extrato]") ?? cartaoDoTitulo(/^Extrato de créditos/), titulo: "Extrato", texto: "Cada entrada e saída, com a data. Nada é apagado: uma correção vira um lançamento novo." },
      { id: "regras", tipo: "manual", ultimo: true, alvo: "[data-regras]", titulo: "Regras", texto: "Prazos de devolução e o que os créditos pagam: lote, quiosque, itens premium do personagem, anúncios e agentes." },
    ],
  },
  // ---------- Vendas e pedidos ----------
  {
    id: "vendas", tela: "vendas", nome: "Vendas", gatilho: "entrada",
    passos: [
      { id: "pix", tipo: "manual", alvo: "#pix", titulo: "Sua chave Pix", texto: "O cliente paga direto nesta chave. O WorkEnd não recebe nem repassa o dinheiro das vendas." },
      { id: "esperando", tipo: "manual", alvo: () => porTexto(".pg-cartao", /^Esperando pagamento/), titulo: "Esperando pagamento", texto: "Pedidos que a atendente anotou e ainda não foram pagos. Confira no aplicativo do banco antes de confirmar." },
      { id: "filtros", tipo: "manual", alvo: "[aria-label='Filtrar por status']", titulo: "Filtre os pedidos", texto: "Separe os que esperam pagamento, os pagos e os cancelados." },
      { id: "lista", tipo: "manual", alvo: "[aria-label='Lista de pedidos']", titulo: "Pedidos", texto: "Cada pedido tem o número, o total, o contato do cliente e o que foi combinado na conversa." },
      { id: "fim", tipo: "manual", ultimo: true, titulo: "Confirme só depois do banco", texto: "Viu o Pix cair no aplicativo do banco? Aí sim, confirme o pedido: o cliente recebe o aviso." },
    ],
  },
  // ---------- Resultados ----------
  {
    id: "resultados", tela: "resultados", nome: "Resultados", gatilho: "entrada",
    passos: [
      { id: "periodo", tipo: "manual", alvo: "nav[aria-label='Período']", titulo: "Escolha o período", texto: "Troque o período e todos os números da tela mudam juntos." },
      { id: "movimento", tipo: "manual", alvo: () => { const s = porTexto("h2", /^Movimento da loja/)?.closest("section"); return (s?.nextElementSibling as HTMLElement | null) ?? s ?? null; }, titulo: "Movimento da loja", texto: "Visitas, conversas com a equipe e cliques nos contatos, comparados com o período anterior." },
      { id: "origem", tipo: "manual", alvo: () => cartaoDoTitulo(/^De onde vieram as visitas/), titulo: "De onde vieram", texto: "Quantas visitas chegaram pelo mapa e quantas pela página da loja." },
      { id: "tocaram", tipo: "manual", alvo: () => cartaoDoTitulo(/^O que mais tocaram/), titulo: "O que mais tocaram", texto: "Os produtos e contatos que os visitantes mais abriram." },
      { id: "passos", tipo: "manual", alvo: () => porTexto("h2", /^Próximos passos/)?.closest("section") ?? null, titulo: "Próximos passos", texto: "Sugestões para trazer mais gente, a partir dos seus números." },
      { id: "indicacao", tipo: "manual", ultimo: true, alvo: "#indicacao", titulo: "Indique um vizinho", texto: "Mande o seu link para outra empresa. Quando ela abrir a loja, você ganha bônus na sua carteira de créditos." },
    ],
  },
  // ---------- Divulgar e anunciar na praça ----------
  {
    id: "divulgar", tela: "divulgar", nome: "Divulgar", gatilho: "entrada",
    passos: [
      { id: "ola", tipo: "manual", titulo: "Leve gente para a sua loja", texto: "Aqui ficam o material pronto para as redes e os anúncios dentro da cidade." },
      { id: "stories", tipo: "manual", alvo: () => cartaoDoTitulo(/^Imagem para Stories/), titulo: "Imagem para os Stories", texto: "Uma imagem com o seu prédio e um QR Code da loja, no tamanho dos Stories. Baixe e poste." },
      { id: "adesivo", tipo: "manual", alvo: () => cartaoDoTitulo(/^Adesivo para a loja/), titulo: "Adesivo para a porta", texto: "Imprima e cole na porta ou no balcão: quem aponta a câmera do celular cai na sua loja." },
      { id: "praca", tipo: "fato", fato: "anunciou", alvo: () => primeiro("#praca [role='tablist']") ?? primeiro("#praca"), titulo: "Anuncie na praça",
        texto: `Telão da praça (${SEGUNDOS_SLOT} s na rotação, ${brl(PRECO_TELAO_DIA)} por dia), evento em destaque, patrocínio e outdoors nas avenidas. Paga com créditos ou Pix.` },
      { id: "fim", tipo: "manual", ultimo: true, titulo: "Depois, confira", texto: "Em Resultados você vê de onde vieram as visitas: pelo mapa ou pela página da loja.", acoes: [{ rotulo: "Ver resultados", href: "/app/resultados" }] },
    ],
  },
  // ---------- Minha equipe (conversas e tarefas) ----------
  {
    id: "equipe", tela: "equipe", nome: "Minha equipe", gatilho: "entrada",
    passos: [
      { id: "org", tipo: "manual", alvo: "[aria-label='Organograma da equipe']", titulo: "Quem trabalha na sua loja", texto: "A atendente, o CEO e quem você contratou, cada um no seu setor. Toque numa pessoa para conversar com ela." },
      { id: "tarefa", tipo: "manual", alvo: "form[aria-label='Nova tarefa']", titulo: "Dê uma tarefa", texto: "Escreva o que precisa e escolha para quem. Você acompanha o andamento aqui mesmo." },
      { id: "abas", tipo: "manual", alvo: "[aria-label='Seções da equipe']", titulo: "As conversas da empresa", texto: "Conversar com a equipe, conversas internas entre eles, visitantes, vagas e o texto Sobre a empresa." },
      { id: "visitantes", tipo: "manual", alvo: aba(/^Visitantes/), titulo: "Conversas dos visitantes", texto: "Leia o que cada visitante perguntou à atendente e o que ela respondeu." },
      { id: "sobre", tipo: "manual", ultimo: true, alvo: aba(/^Sobre a empresa/), titulo: "Conte o que a empresa faz", texto: "Preços, horários e serviços. A atendente usa este texto para responder; sem ele, ela só anota o contato." },
    ],
  },
  // ---------- Minha rede e personagem ----------
  {
    id: "rede", tela: "rede", nome: "Minha rede", gatilho: "entrada",
    passos: [
      { id: "criar", tipo: "fato", fato: "personagem", alvo: ".rd-heroi .rd-botoes", quando: (c) => !c.fatos.personagem, titulo: "Crie o seu personagem", texto: "É grátis para quem tem conta. Com ele você anda pela cidade, faz amigos, conversa com quem está online e negocia com as lojas." },
      { id: "cabeca", tipo: "manual", alvo: ".rd-cabeca", titulo: "Sua rede", texto: "Seu personagem, quantos amigos você tem e quem está online agora." },
      { id: "mapa", tipo: "manual", alvo: ".rd-acoes a[href='/mundo']", titulo: "Entre no mapa", texto: "Seu personagem aparece na cidade. Chegue perto de alguém para conversar." },
      { id: "editar", tipo: "manual", alvo: ".rd-acoes a[href='/mundo?personagem=1']", titulo: "Editar o personagem", texto: "Rosto, cabelo, roupa e acessórios. Só as peças premium têm preço: R$ 5,90 cada." },
      { id: "pedidos", tipo: "manual", alvo: ".rd-pedidos", titulo: "Pedidos de amizade", texto: "Aceite ou recuse quem quer ser seu amigo." },
      { id: "como", tipo: "manual", ultimo: true, alvo: () => porTexto(".rd-acoes button", /Como funciona/), titulo: "Como funciona", texto: "Amizades, conversas, chamadas e negociações, explicadas passo a passo." },
    ],
  },
  // ---------- Meu perfil ----------
  {
    id: "perfil", tela: "perfil", nome: "Meu perfil", gatilho: "entrada",
    passos: [
      { id: "topo", tipo: "manual", alvo: ".cd-topo-painel", titulo: "Seu cartão no WorkEnd", texto: "Aparece em Encontrar, na ficha do seu personagem e no seu endereço próprio." },
      { id: "combina", tipo: "manual", alvo: () => porTexto(".cd-topo-painel a", /Quem combina comigo/), titulo: "Quem combina com você", texto: "Pessoas e empresas que procuram o que você oferece, e o contrário." },
      { id: "secao", tipo: "manual", alvo: "[data-etapa]", titulo: "Uma parte por vez", texto: "Cada bloco é uma parte do cadastro. As que faltam aparecem marcadas." },
      { id: "oferece", tipo: "manual", alvo: "#secao-oferece", titulo: "O que você oferece", texto: "É o que casa com quem procura. Use palavras simples, como bolo de pote ou site para loja." },
      { id: "completo", tipo: "fato", fato: "perfil", ultimo: true, titulo: "Perfil completo", texto: (c) => (c.fatos.perfil ? "Tudo respondido: você já aparece na busca da cidade." : "Quando todas as partes estiverem respondidas, você passa a aparecer na busca da cidade.") },
    ],
  },
  // ---------- Encontrar ----------
  {
    id: "encontrar", tela: "encontrar", nome: "Encontrar", gatilho: "entrada",
    passos: [
      { id: "abas", tipo: "manual", alvo: "[role='tablist']", titulo: "O que procurar", texto: "Perfis, profissionais, empresas e vagas da cidade." },
      { id: "busca", tipo: "manual", alvo: "input[placeholder]", titulo: "Busque pelo que precisa", texto: "Escreva um serviço, um produto ou uma cidade." },
      { id: "filtros", tipo: "manual", alvo: () => porTexto("label", /Online agora/)?.parentElement ?? null, titulo: "Filtros", texto: "Mostre só quem está disponível ou online agora." },
      { id: "perfil", tipo: "fato", fato: "perfil", quando: (c) => c.logado, alvo: () => porTexto("a.btn-azul", /Completar meu perfil|Montar meu perfil/), titulo: "Apareça na busca", texto: "Com o perfil completo, você também aparece para quem procura o que você oferece." },
      { id: "fim", tipo: "manual", ultimo: true, titulo: "Achou alguém?", texto: "Toque no cartão para ver o perfil, a loja ou a vaga. Na loja, a atendente responde na hora." },
    ],
  },
];
