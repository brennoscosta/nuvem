// Grava a sede do OneState RP como o "lote" de uma conta (16/11/2026, pedido do dono: "associe o prédio à conta
// layon.enzo@gmail.com como dono, coloque vários agentes para trabalhar em cada um desses setores").
// Chave 1,1,0 (quarteirão da sede, src/office/data/onestate.ts › CHAVE_SEDE), ativa por 10 anos, logo do OneState,
// 23 setores (as áreas do site) com 3 agentes de IA cada, mais o CEO e a recepcionista. Os agentes são criados pelo
// próprio WorkEnd quando o dono abre Minha equipe (src/server/equipeCliente.ts › sincronizarEquipe).
// Uso: node scripts/sede-onestate.mjs <usuario_id> > sede.sql   (o SQL vai para o psql; nada é gravado daqui)
import fs from "node:fs";

const usuarioId = process.argv[2];
if (!/^usr_[a-z0-9]+$/.test(usuarioId ?? "")) { console.error("informe o id do usuário (usr_…)"); process.exit(1); }

// mesmas áreas de src/office/data/onestate.ts (ordem do menu do onestatebr.com.br), com o foco e os cargos de cada sala
const AREAS = [
  ["perfilRp", "Perfil RP", "/perfil", "#F2C14E", "o Perfil RP: a história do personagem, as fotos, as redes e a reputação na cidade", ["Curador(a) de perfis RP", "Revisor(a) de histórias", "Suporte de perfil"]],
  ["oneMatch", "OneMatch", "/onematch", "#EC4899", "o OneMatch: encontros entre personagens, conversas e boa convivência", ["Cupido do OneMatch", "Moderador(a) do OneMatch", "Analista de compatibilidade"]],
  ["feedRp", "Feed RP", "/feed", "#60A5FA", "o Feed RP: posts, stories, comentários e o que está bombando na comunidade", ["Editor(a) do Feed RP", "Moderador(a) do Feed", "Analista de engajamento"]],
  ["cenas", "Cenas", "/cenas", "#A78BFA", "as Cenas: vídeos curtos de RP, cortes das lives e os melhores momentos", ["Curador(a) de Cenas", "Editor(a) de vídeo curto", "Moderador(a) de Cenas"]],
  ["lives", "Lives", "/lives", "#F43F5E", "as Lives: transmissões ao vivo, presentes, batalhas no palco e o chat", ["Produtor(a) de lives", "Moderador(a) de chat ao vivo", "Analista de audiência"]],
  ["grupos", "Grupos", "/grupos", "#22C55E", "os Grupos: comunidades, facções e organizações do RP e o chat de cada uma", ["Gestor(a) de comunidades", "Moderador(a) de grupos", "Organizador(a) de encontros"]],
  ["mercado", "Mercado", "/mercado", "#F59E0B", "o Mercado: anúncios de compra e venda entre jogadores, com segurança", ["Gerente do Mercado", "Verificador(a) de anúncios", "Mediador(a) de negócios"]],
  ["x1", "Desafio X1", "/x1", "#EF4444", "o Desafio X1: partidas valendo, regras, resultados e devoluções de saldo", ["Organizador(a) de desafios", "Juiz(a) de partidas", "Suporte de saldo X1"]],
  ["noticias", "Notícias", "/categoria/noticias", "#E5E7EB", "as Notícias: o que acontece na cidade e no servidor, com apuração", ["Editor(a)-chefe", "Repórter da cidade", "Revisor(a) de texto"]],
  ["dinheiro", "Dinheiro", "/noticias/guia-dinheiro-onestate-rp", "#34D399", "como ganhar dinheiro no OneState RP: empregos, negócios e economia do jogo", ["Consultor(a) de economia RP", "Redator(a) de guias de dinheiro", "Analista de mercado do jogo"]],
  ["guias", "Guias", "/categoria/guias", "#38BDF8", "os Guias: passo a passo para novatos e veteranos, regras e dicas", ["Redator(a) de guias", "Instrutor(a) de novatos", "Revisor(a) de guias"]],
  ["criadores", "Criadores", "/criadores", "#C084FC", "os Criadores: streamers e produtores de conteúdo do OneState", ["Gerente de criadores", "Captador(a) de talentos", "Analista de parcerias"]],
  ["missoes", "Missões", "/missoes", "#FBBF24", "as Missões: desafios da semana, pontos e prêmios da comunidade", ["Criador(a) de missões", "Avaliador(a) de missões", "Gestor(a) de prêmios"]],
  ["verificado", "Selo verificado", "/verificado", "#3B82F6", "o Selo verificado: verificação de contas, vantagens e renovação anual", ["Analista de verificação", "Suporte do selo", "Auditor(a) de contas"]],
  ["moedas", "Moedas", "/moedas", "#FACC15", "as Moedas: compra, presentes, saldo e devoluções", ["Gestor(a) de moedas", "Suporte de pagamentos", "Analista antifraude"]],
  ["eventos", "Eventos", "/eventos", "#FB923C", "os Eventos: agenda da cidade, o evento da semana e o pódio", ["Produtor(a) de eventos", "Divulgador(a) de eventos", "Coordenador(a) de agenda"]],
  ["servidores", "Servidores", "/servidores", "#94A3B8", "os Servidores: lista, disputa, ranking e o painel de quem tem servidor", ["Gestor(a) de servidores", "Analista de ranking", "Suporte a donos de servidor"]],
  ["videos", "Vídeos", "/categoria/videos", "#F87171", "os Vídeos: reportagens, tutoriais e os melhores momentos em vídeo", ["Editor(a) de vídeos", "Roteirista", "Curador(a) de vídeos"]],
  ["atualizacoes", "Atualizações", "/categoria/atualizacoes", "#2DD4BF", "as Atualizações: novidades do jogo e do site, explicadas com clareza", ["Redator(a) de atualizações", "Testador(a) de novidades", "Analista de mudanças do jogo"]],
  ["policia", "Polícia", "/categoria/policia", "#2563EB", "a Polícia: as regras de RP policial, abordagens corretas e guias para jogadores", ["Especialista em RP policial", "Redator(a) de guias da polícia", "Mediador(a) de ocorrências"]],
  ["anuncie", "Anuncie", "/anuncie", "#F472B6", "o Anuncie: destaques pagos, mídia kit e campanhas para marcas e servidores", ["Executivo(a) de contas", "Planejador(a) de mídia", "Analista de campanhas"]],
  ["suporte", "Suporte", "/suporte", "#4ADE80", "o Suporte: chamados, dúvidas de conta, pagamentos e denúncias", ["Atendente de suporte", "Especialista em contas", "Analista de chamados"]],
  ["sobre", "Sobre", "/sobre", "#CBD5E1", "o Sobre: a história do OneState, a equipe, as políticas e a imprensa", ["Relações públicas", "Guardião(ã) da marca", "Redator(a) institucional"]],
];
const NOMES = ["Ana", "Bruno", "Carla", "Davi", "Elisa", "Fábio", "Gabriela", "Heitor", "Isabela", "João", "Karina", "Leonardo", "Mariana", "Nicolas", "Olívia", "Pedro",
  "Quézia", "Rafael", "Sabrina", "Tiago", "Úrsula", "Vinícius", "Wesley", "Yasmin", "Alice", "Bernardo", "Cecília", "Diego", "Eduarda", "Felipe", "Giovana", "Hugo",
  "Ingrid", "Júlio", "Lara", "Matheus", "Natália", "Otávio", "Paula", "Renan", "Sofia", "Thales", "Valentina", "Caio", "Débora", "Enzo", "Fernanda", "Gustavo",
  "Helena", "Igor", "Joana", "Kauã", "Lívia", "Murilo", "Nina", "Arthur", "Bianca", "Cauã", "Daniela", "Emanuel", "Flávia", "Gael", "Iara", "Lorenzo", "Maitê",
  "Noah", "Priscila", "Raul", "Stella", "Tomás", "Vitória", "Ximena", "Zeca"];
const BONECOS = ["classico", "coque", "longo", "oculos", "ruivo", "careca", "suporte-1"];
let n = 0;
const proximo = () => { const nome = NOMES[n % NOMES.length]; const boneco = BONECOS[(n * 3 + 1) % BONECOS.length]; n++; return { nome, boneco }; };

const setores = AREAS.map(([id, nome, , cor]) => ({ id, nome, cor, mesas: 3 }));
const equipe = [];
const atend = proximo(), ceo = proximo();
equipe.push({ id: "atendente", nome: atend.nome, cargo: "Recepção da sede", papel: "atendente", setorId: null, boneco: atend.boneco, camisa: "#D4A63A",
  treino: { descricao: "Recebe quem chega na sede do OneState RP: explica o que é cada área do site (onestatebr.com.br), indica o andar e a página certa e anota o contato de quem quer falar com a equipe.", saudacao: "Olá! Bem-vindo à sede do OneState RP. Quer conhecer alguma área do site? Posso te indicar o andar certo." } });
equipe.push({ id: "ceo", nome: ceo.nome, cargo: "CEO do OneState RP", papel: "ceo", setorId: null, boneco: ceo.boneco, camisa: "#1F2630",
  treino: { descricao: "Comanda a sede do OneState RP: define as prioridades de cada área do site, aprova o que as equipes entregam e acompanha os resultados da comunidade.", saudacao: "" } });
for (const [id, nomeArea, href, cor, foco, cargos] of AREAS) {
  cargos.forEach((cargo, k) => {
    const p = proximo();
    equipe.push({ id: `${id}-${k + 1}`, nome: p.nome, cargo, papel: "profissional", setorId: id, boneco: p.boneco, camisa: cor,
      treino: { descricao: `${cargo} da área ${nomeArea} do OneState RP. Cuida de ${foco}. Página: onestatebr.com.br${href}.`, saudacao: `Oi! Sou ${p.nome}, da área ${nomeArea} do OneState. Em que posso ajudar?` } });
  });
}
const escritorio = { layout: "torre", setores, equipe };
const logo = fs.readFileSync(new URL("../public/onestate/icone.png", import.meta.url)).toString("base64");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
process.stdout.write(`-- sede do OneState: ${setores.length} setores, ${equipe.length} pessoas na equipe
INSERT INTO terreno (chave, usuario_id, status, empresa_nome, cor, logo, logo_tipo, reservado_em, pago_ate, escritorio, nicho, inaugurado_em)
VALUES ('1,1,0', ${q(usuarioId)}, 'ativo', 'OneState RP', '#D4A63A', decode(${q(logo)}, 'base64'), 'image/png', now(), now() + interval '10 years', ${q(JSON.stringify(escritorio))}::jsonb, 'conteudo', now())
ON CONFLICT (chave) DO NOTHING
RETURNING chave, usuario_id, jsonb_array_length(escritorio->'setores') AS setores, jsonb_array_length(escritorio->'equipe') AS equipe;
`);
