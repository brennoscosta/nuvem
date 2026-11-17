// Equipe da sede da Social RP (antes OneState RP) como uma empresa de verdade (16/11/2026, pedido do dono: "que a empresa
// tenha suas áreas como assistentes, gerentes, CEO, setor financeiro", no lugar de uma sala por recurso do site).
// 10 departamentos + recepção, com nível (ceo, diretor, gerente, analista, assistente) e chefe direto de cada pessoa:
// o CEO comanda os gerentes; cada gerente comanda a própria equipe. As áreas do site viram responsabilidade de cada um.
// Grava (ou atualiza) o lote da sede, chave 1,1,0 (src/office/data/onestate.ts › CHAVE_SEDE), na conta indicada.
// Uso: node scripts/sede-socialrp.mjs <usuario_id> > sede.sql   (o SQL vai para o psql; nada é gravado daqui)
import fs from "node:fs";

const usuarioId = process.argv[2];
if (!/^usr_[a-z0-9]+$/.test(usuarioId ?? "")) { console.error("informe o id do usuário (usr_…)"); process.exit(1); }
const SITE = "onestatebr.com.br";

// [id, nome, cor, [ [cargo, nivel, o que faz] ... ]]  — o primeiro de cada departamento é o chefe (menos na diretoria)
const DEPARTAMENTOS = [
  ["diretoria", "Diretoria", "#D4A63A", [
    ["CEO da Social RP", "ceo", "Comanda a Social RP: define prioridades, distribui o trabalho para os gerentes de cada departamento, cobra prazos e entrega ao dono o resultado consolidado."],
    ["Diretor(a) de operações", "diretor", "Cuida do dia a dia da empresa: acompanha as metas de cada departamento, destrava problemas entre as equipes e prepara os números para o CEO."],
    ["Assistente executiva", "assistente", "Organiza a agenda do CEO, prepara pautas e atas das reuniões, resume relatórios e acompanha os pedidos do dono."],
  ]],
  ["financeiro", "Financeiro", "#16A34A", [
    ["Gerente financeiro(a)", "gerente", "Responde pelo caixa da Social RP: receitas de moedas, selo verificado, anúncios e destaques; custos, saques Pix e prêmios. Entrega relatórios e previsões."],
    ["Analista financeiro(a)", "analista", "Monta o fluxo de caixa, concilia pagamentos (Pix e cartão), calcula margens e acompanha o orçamento de cada área."],
    ["Assistente de pagamentos", "assistente", "Cuida de Moedas, presentes, saques e devoluções: confere cada pedido, registra e avisa quem precisa aprovar."],
    ["Analista antifraude", "analista", "Investiga pagamentos estranhos, contas suspeitas e abusos de prêmios; propõe regras para evitar fraude."],
  ]],
  ["comercial", "Comercial e Parcerias", "#F59E0B", [
    ["Gerente comercial", "gerente", "Traz receita com anunciantes, servidores parceiros e patrocínios; define preços, metas e propostas."],
    ["Executivo(a) de contas", "analista", "Atende marcas pelo Anuncie: monta propostas de mídia, destaques pagos e campanhas, e acompanha o resultado."],
    ["Analista de parcerias", "analista", "Cuida da área Servidores e das parcerias com donos de servidor: ranking, disputa, benefícios e contratos."],
    ["Assistente comercial", "assistente", "Organiza contatos, agenda reuniões com parceiros, prepara materiais e registra cada negociação."],
  ]],
  ["marketing", "Marketing e Conteúdo", "#EC4899", [
    ["Gerente de marketing e conteúdo", "gerente", "Planeja a divulgação da Social RP e o calendário editorial: Notícias, Guias, Vídeos, Atualizações e redes sociais."],
    ["Editor(a) de notícias", "analista", "Escreve e revisa as Notícias, as Atualizações e as matérias da Polícia, com apuração e títulos claros."],
    ["Redator(a) de guias", "analista", "Escreve os Guias e o guia de Dinheiro para novatos e veteranos, sempre com passo a passo."],
    ["Social media", "assistente", "Cria posts, legendas e cortes de vídeo para as redes e para Cenas, e responde comentários."],
  ]],
  ["produto", "Produto e Tecnologia", "#3B82F6", [
    ["Gerente de produto", "gerente", "Decide o que entra no site e no app: prioriza ideias, escreve as especificações e acompanha os lançamentos."],
    ["Desenvolvedor(a)", "analista", "Explica como as funções do site e do app funcionam, estima esforço e escreve especificações técnicas."],
    ["Designer de produto", "analista", "Desenha telas e fluxos do site e do app, e revisa a experiência de cada área."],
    ["Analista de dados", "analista", "Mede uso, retenção e receita de cada área do site e transforma os números em recomendações."],
  ]],
  ["rh-juridico", "RH e Jurídico", "#8B5CF6", [
    ["Gerente de RH e jurídico", "gerente", "Cuida das pessoas e das regras: contratações, moderadores voluntários, termos de uso e políticas."],
    ["Advogado(a)", "analista", "Revisa termos de uso, privacidade (LGPD), contratos com parceiros e respostas a pedidos legais."],
    ["Analista de compliance", "analista", "Confere se campanhas, prêmios e regras seguem a lei e as políticas das lojas de aplicativos e do AdSense."],
  ]],
  ["comunidade", "Comunidade e Moderação", "#14B8A6", [
    ["Gerente de comunidade", "gerente", "Cuida da convivência na Social RP: Feed RP, Grupos, OneMatch, Cenas e Perfil RP; define regras e prioridades da moderação."],
    ["Moderador(a) do Feed e Cenas", "assistente", "Revisa posts, comentários e vídeos do Feed RP e das Cenas, remove o que quebra as regras e orienta os jogadores."],
    ["Moderador(a) de Grupos e OneMatch", "assistente", "Acompanha os Grupos e o OneMatch, resolve conflitos e cuida para que todos se sintam seguros."],
    ["Analista de denúncias", "analista", "Analisa denúncias, perfis falsos e pedidos de Selo verificado, e decide com base nas regras."],
  ]],
  ["lives", "Lives e Criadores", "#F43F5E", [
    ["Gerente de lives e criadores", "gerente", "Cuida das Lives e dos Criadores: agenda, presentes, batalhas no palco e crescimento dos streamers."],
    ["Produtor(a) de lives", "analista", "Organiza as transmissões, roteiros, batalhas e a moderação do chat ao vivo."],
    ["Gestor(a) de criadores", "analista", "Recruta e acompanha os criadores de conteúdo, mede resultados e propõe parcerias."],
  ]],
  ["suporte", "Suporte ao jogador", "#0EA5E9", [
    ["Gerente de suporte", "gerente", "Responde pela fila de Suporte: prazos, qualidade das respostas e casos difíceis."],
    ["Atendente de suporte", "assistente", "Responde chamados de dúvidas, conta, login e uso do site com clareza e educação."],
    ["Especialista em contas", "analista", "Resolve problemas de conta, pagamentos de moedas, selo e recuperação de acesso."],
    ["Analista de chamados", "analista", "Organiza os chamados por tipo, encontra problemas que se repetem e propõe melhorias."],
  ]],
  ["eventos", "Eventos e Missões", "#FB923C", [
    ["Coordenador(a) de eventos", "gerente", "Planeja Eventos e o evento da semana: regras, premiação, divulgação e pódio."],
    ["Criador(a) de missões", "analista", "Cria as Missões da semana, os pontos e os prêmios, e acompanha quem participa."],
    ["Assistente de eventos", "assistente", "Organiza inscrições, avisos, resultados e a entrega dos prêmios."],
  ]],
];
const NOMES = ["Helena", "Ricardo", "Marina", "Paulo", "Camila", "Gustavo", "Larissa", "Tiago", "Bruna", "Felipe", "Juliana", "Rafael", "Patrícia", "André", "Beatriz",
  "Lucas", "Fernanda", "Diego", "Aline", "Mateus", "Carolina", "Vinícius", "Renata", "Eduardo", "Natália", "Bruno", "Isabela", "Gabriel", "Letícia", "Henrique",
  "Priscila", "Leonardo", "Vanessa", "Caio", "Débora", "Igor", "Sofia"];
const BONECOS = ["classico", "coque", "longo", "oculos", "ruivo", "careca", "suporte-1"];

let n = 0;
const pessoa = () => ({ nome: NOMES[n % NOMES.length], boneco: BONECOS[(n * 3 + 2) % BONECOS.length], i: n++ });
const setores = [];
const equipe = [];
// recepção (atende os visitantes do mapa)
const rec = pessoa();
setores.push({ id: "recepcao", nome: "Recepção", cor: "#E9C46A", mesas: 1 });
let ceoId = null;
for (const [sid, snome, cor, cargos] of DEPARTAMENTOS) {
  setores.push({ id: sid, nome: snome, cor, mesas: Math.min(4, cargos.length) });
  let chefe = null;
  cargos.forEach(([cargo, nivel, faz], k) => {
    const p = pessoa();
    const id = nivel === "ceo" ? "ceo" : `${sid}-${k + 1}`;
    const papel = nivel === "ceo" ? "ceo" : "profissional";
    if (nivel === "ceo") ceoId = id;
    // diretoria responde ao CEO; nos departamentos, o primeiro (gerente) responde ao CEO e os outros ao gerente
    const chefeId = nivel === "ceo" ? null : sid === "diretoria" || k === 0 ? "ceo" : chefe;
    if (k === 0 && sid !== "diretoria") chefe = id;
    equipe.push({ id, nome: p.nome, cargo, papel, setorId: sid, boneco: p.boneco, camisa: cor, nivel, chefeId,
      treino: { descricao: `${faz} Trabalha no departamento ${snome} da Social RP (antes OneState RP, ${SITE}).`, saudacao: nivel === "ceo" ? "" : `Oi! Sou ${p.nome}, ${cargo.toLowerCase()} da Social RP. Em que posso ajudar?` } });
  });
}
equipe.unshift({ id: "atendente", nome: rec.nome, cargo: "Recepção da sede", papel: "atendente", setorId: "recepcao", boneco: rec.boneco, camisa: "#D4A63A", nivel: "assistente", chefeId: "diretoria-3",
  treino: { descricao: `Recebe quem chega na sede da Social RP (antes OneState RP, ${SITE}): explica o que a empresa faz, indica o departamento certo e anota o contato de quem quer falar com a equipe.`, saudacao: "Olá! Bem-vindo à sede da Social RP. Com quem você quer falar? Posso te levar ao departamento certo." } });
if (!ceoId) throw new Error("sem CEO");

const escritorio = { layout: "torre", setores, equipe };
const logo = fs.readFileSync(new URL("../public/socialrp/icone.png", import.meta.url)).toString("base64");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const esc = q(JSON.stringify(escritorio));
process.stdout.write(`-- sede da Social RP: ${setores.length} setores, ${equipe.length} pessoas
INSERT INTO terreno (chave, usuario_id, status, empresa_nome, cor, logo, logo_tipo, reservado_em, pago_ate, escritorio, nicho, inaugurado_em)
VALUES ('1,1,0', ${q(usuarioId)}, 'ativo', 'Social RP', '#D4A63A', decode(${q(logo)}, 'base64'), 'image/png', now(), now() + interval '10 years', ${esc}::jsonb, 'conteudo', now())
ON CONFLICT (chave) DO UPDATE SET empresa_nome = EXCLUDED.empresa_nome, logo = EXCLUDED.logo, logo_tipo = EXCLUDED.logo_tipo, escritorio = EXCLUDED.escritorio, atualizado_em = now()
  WHERE terreno.usuario_id = EXCLUDED.usuario_id
RETURNING chave, usuario_id, empresa_nome, jsonb_array_length(escritorio->'setores') AS setores, jsonb_array_length(escritorio->'equipe') AS equipe;
`);
