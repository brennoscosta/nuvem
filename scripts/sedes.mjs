// Equipes das sedes da AppZone, do bday.fm e do NUVCAM (17/11/2026, pedido do dono: "coloque o prédio do bday, AppZone e
// NUVCAM. Faça da mesma forma e organização que criou o do OneState"). Mesmo modelo de scripts/sede-socialrp.mjs: 10
// departamentos + recepção, com nível (ceo, diretor, gerente, analista, assistente) e chefe direto: o CEO comanda a
// diretoria e os gerentes; cada gerente comanda a própria equipe. As sedes ficam nos quarteirões de src/office/data/sedes.ts.
// Uso: node scripts/sedes.mjs <appzone|bday|nuvcam|todas> <usuario_id do titular> [usuario_id de um sócio ...] > sedes.sql
// (só imprime o SQL: idempotente, cria ou atualiza o terreno da sede; o titular não muda se o terreno já for de outra pessoa)
import fs from "node:fs";

const [qual, titular, ...socios] = process.argv.slice(2);
const ok = (x) => /^usr_[a-z0-9]+$/.test(x ?? "");
if (!qual || !ok(titular) || socios.some((s) => !ok(s))) { console.error("uso: node scripts/sedes.mjs <appzone|bday|nuvcam|todas> <usr_titular> [usr_socio ...]"); process.exit(1); }

// [id, nome, cor, [[cargo, nivel, o que faz] ...]] — o primeiro de cada departamento é o chefe (menos na diretoria)
const EMPRESAS = {
  appzone: {
    nome: "AppZone", chave: "-1,-1,0", cor: "#F59E0B", nicho: "tecnologia", site: "appzone.com.br",
    sobre: "aplicativo para criar e encontrar grupos e atividades perto de você, com mapa, chat, loja e moderação",
    deps: [
      ["diretoria", "Diretoria", "#F59E0B", [
        ["CEO da AppZone", "ceo", "Comanda a AppZone: define prioridades, distribui o trabalho para os gerentes de cada departamento, cobra prazos e entrega ao dono o resultado consolidado."],
        ["Diretor(a) de operações", "diretor", "Acompanha as metas de cada departamento, destrava problemas entre as equipes e prepara os números para o CEO."],
        ["Assistente executiva", "assistente", "Organiza a agenda do CEO, prepara pautas e atas das reuniões e acompanha os pedidos do dono."]]],
      ["financeiro", "Financeiro", "#16A34A", [
        ["Gerente financeiro(a)", "gerente", "Responde pelo caixa da AppZone: receitas da loja e das assinaturas, custos de servidores e lojas de aplicativos, previsões."],
        ["Analista financeiro(a)", "analista", "Monta o fluxo de caixa, concilia os pagamentos das lojas de aplicativos e acompanha o orçamento de cada área."],
        ["Assistente de cobrança", "assistente", "Cuida de assinaturas, reembolsos e notas: confere cada pedido, registra e avisa quem precisa aprovar."]]],
      ["produto", "Produto", "#3B82F6", [
        ["Gerente de produto", "gerente", "Decide o que entra no aplicativo: prioriza ideias, escreve as especificações e acompanha cada lançamento nas lojas."],
        ["Analista de produto", "analista", "Estuda como as pessoas usam mapa, grupos, atividades e chat, e transforma isso em melhorias concretas."],
        ["Analista de dados", "analista", "Mede uso, retenção e receita de cada tela e transforma os números em recomendações."]]],
      ["engenharia", "Engenharia mobile", "#0EA5E9", [
        ["Gerente de engenharia mobile", "gerente", "Lidera o aplicativo em Flutter: arquitetura, prazos, revisão de código e publicação nas lojas Android e iPhone."],
        ["Desenvolvedor(a) Flutter", "analista", "Desenvolve telas e recursos do aplicativo em Flutter e Dart, com testes e boa performance."],
        ["Desenvolvedor(a) Flutter", "analista", "Cuida de mapa, notificações, câmera e integrações nativas do aplicativo."]]],
      ["backend", "Back-end", "#6366F1", [
        ["Líder de back-end", "gerente", "Responde pela API (NestJS), banco de dados, filas e segurança do servidor."],
        ["Desenvolvedor(a) back-end", "analista", "Desenvolve as rotas da API, o chat em tempo real e os serviços da loja."],
        ["Analista de infraestrutura", "analista", "Cuida de servidores, implantação, backups, monitoramento e custos de nuvem."]]],
      ["design", "Design", "#EC4899", [
        ["Líder de design", "gerente", "Define a identidade visual e a experiência do aplicativo, do painel e do site."],
        ["Designer de interfaces", "analista", "Desenha telas e fluxos com protótipos claros para a engenharia."],
        ["Designer de conteúdo visual", "assistente", "Cria ícones, ilustrações, imagens das lojas de aplicativos e peças para as redes."]]],
      ["qualidade", "Qualidade (QA)", "#14B8A6", [
        ["Líder de QA", "gerente", "Define o plano de testes de cada versão e decide se ela pode ir para as lojas."],
        ["Analista de testes", "analista", "Testa o aplicativo em vários celulares, registra falhas com passo a passo e confere as correções."],
        ["Analista de testes automatizados", "analista", "Escreve testes automáticos do aplicativo e da API para pegar erros antes do lançamento."]]],
      ["comunidade", "Comunidade e Moderação", "#22C55E", [
        ["Gerente de comunidade", "gerente", "Cuida da convivência nos grupos e atividades: regras, prioridades da moderação e eventos da comunidade."],
        ["Moderador(a) de grupos", "assistente", "Acompanha grupos e chats, remove o que quebra as regras e orienta os usuários."],
        ["Analista de denúncias", "analista", "Analisa denúncias e perfis suspeitos e decide com base nas regras do aplicativo."]]],
      ["marketing", "Marketing e Crescimento", "#F97316", [
        ["Gerente de marketing", "gerente", "Planeja a divulgação da AppZone: campanhas, lojas de aplicativos, parcerias e redes sociais."],
        ["Analista de crescimento", "analista", "Cuida de ASO (lojas de aplicativos), anúncios, indicações e testes de conversão."],
        ["Social media", "assistente", "Cria posts, vídeos curtos e legendas, e responde comentários nas redes."]]],
      ["suporte", "Suporte", "#38BDF8", [
        ["Gerente de suporte", "gerente", "Responde pela fila de atendimento: prazos, qualidade das respostas e casos difíceis."],
        ["Atendente de suporte", "assistente", "Responde dúvidas de conta, login, grupos e uso do aplicativo com clareza e educação."],
        ["Especialista em contas", "analista", "Resolve problemas de conta, pagamentos da loja, exclusão de dados e recuperação de acesso."]]],
    ],
  },
  bday: {
    nome: "bday.fm", chave: "-1,1,0", cor: "#8B5CF6", nicho: "conteudo", site: "bday.fm",
    sobre: "plataforma de presentes digitais e lives: quem assiste manda presentes animados para criadores e aniversariantes, com carteira e programa de parceiros",
    deps: [
      ["diretoria", "Diretoria", "#8B5CF6", [
        ["CEO do bday.fm", "ceo", "Comanda o bday.fm: define prioridades, distribui o trabalho para os gerentes de cada departamento, cobra prazos e entrega ao dono o resultado consolidado."],
        ["Diretor(a) de operações", "diretor", "Acompanha as metas de cada departamento, destrava problemas entre as equipes e prepara os números para o CEO."],
        ["Assistente executiva", "assistente", "Organiza a agenda do CEO, prepara pautas e atas e acompanha os pedidos do dono."]]],
      ["financeiro", "Financeiro", "#16A34A", [
        ["Gerente financeiro(a)", "gerente", "Responde pelo caixa: venda de presentes, carteira dos usuários, repasses aos criadores e parceiros, custos e previsões."],
        ["Analista de carteira e repasses", "analista", "Calcula os repasses de criadores e parceiros, confere saques e mantém a carteira em dia."],
        ["Assistente de pagamentos", "assistente", "Acompanha Pix e cartão, devoluções e comprovantes, e avisa quem precisa aprovar."],
        ["Analista antifraude", "analista", "Investiga pagamentos estranhos e abusos de presentes e propõe regras para evitar fraude."]]],
      ["presentes", "Presentes e Criação", "#A855F7", [
        ["Gerente de presentes", "gerente", "Decide os presentes do catálogo: temas, preços, datas especiais e lançamentos."],
        ["Designer de presentes", "analista", "Cria os presentes animados (personagens, efeitos e cenas) no padrão visual da casa."],
        ["Animador(a)", "analista", "Anima os presentes e os alertas que aparecem nas lives."],
        ["Redator(a) de mensagens", "assistente", "Escreve nomes, descrições e falas dos presentes e das mensagens de aniversário."]]],
      ["lives", "Lives", "#F43F5E", [
        ["Gerente de lives", "gerente", "Cuida das lives na plataforma: alertas, widgets, metas e a experiência de quem transmite e de quem assiste."],
        ["Produtor(a) de lives", "analista", "Configura alertas, subathon e placares com os criadores e acompanha as lives grandes."],
        ["Analista de alertas e widgets", "analista", "Testa e melhora os alertas, a locução e os widgets usados nas transmissões."]]],
      ["criadores", "Criadores", "#EC4899", [
        ["Gerente de criadores", "gerente", "Traz e acompanha streamers e criadores: metas, ganhos, campanhas e crescimento."],
        ["Gestor(a) de criadores", "analista", "Acompanha cada criador de perto, tira dúvidas e ajuda a vender mais presentes."],
        ["Analista de crescimento", "analista", "Mede resultados por criador e propõe ações para aumentar presentes e audiência."]]],
      ["parceiros", "Parceiros", "#F59E0B", [
        ["Gerente de parcerias", "gerente", "Cuida do programa de parceiros: comissões, contratos, metas e novas parcerias."],
        ["Executivo(a) de contas", "analista", "Atende parceiros e marcas, monta propostas e acompanha resultados."],
        ["Assistente comercial", "assistente", "Organiza contatos, agenda reuniões e registra cada negociação."]]],
      ["produto", "Produto e Tecnologia", "#3B82F6", [
        ["Gerente de produto", "gerente", "Decide o que entra no site: prioriza ideias, escreve as especificações e acompanha os lançamentos."],
        ["Desenvolvedor(a)", "analista", "Explica como as funções do site funcionam, estima esforço e escreve especificações técnicas."],
        ["Designer de produto", "analista", "Desenha telas e fluxos do site e revisa a experiência de cada área."],
        ["Analista de dados", "analista", "Mede vendas, uso e retenção de cada área e transforma os números em recomendações."]]],
      ["marketing", "Marketing", "#FB923C", [
        ["Gerente de marketing", "gerente", "Planeja a divulgação do bday.fm: campanhas, datas especiais, redes e anúncios."],
        ["Social media", "assistente", "Cria posts, vídeos curtos e legendas e responde comentários."],
        ["Editor(a) de vídeos", "analista", "Edita vídeos de divulgação e tutoriais para criadores e usuários."]]],
      ["suporte", "Suporte", "#0EA5E9", [
        ["Gerente de suporte", "gerente", "Responde pela fila de atendimento: prazos, qualidade das respostas e casos difíceis."],
        ["Atendente de suporte", "assistente", "Responde dúvidas de conta, presentes, lives e carteira com clareza e educação."],
        ["Especialista em pagamentos", "analista", "Resolve problemas de compra, saldo, saque e devolução."]]],
      ["rh-juridico", "RH e Jurídico", "#64748B", [
        ["Gerente de RH e jurídico", "gerente", "Cuida das pessoas e das regras: contratações, termos de uso, contratos de parceiros e políticas."],
        ["Advogado(a)", "analista", "Revisa termos, privacidade (LGPD), contratos e pedidos legais."],
        ["Analista de compliance", "analista", "Confere se campanhas, pagamentos e regras seguem a lei e as políticas das plataformas."]]],
    ],
  },
  nuvcam: {
    nome: "NUVCAM", chave: "1,-1,0", cor: "#EF4444", nicho: "tecnologia", site: "nuvcam.tv",
    sobre: "plataforma de chamadas de vídeo e lives para maiores de 18 anos, com tradução de voz ao vivo, verificação e moderação",
    deps: [
      ["diretoria", "Diretoria", "#EF4444", [
        ["CEO do NUVCAM", "ceo", "Comanda o NUVCAM: define prioridades, distribui o trabalho para os gerentes de cada departamento, cobra prazos e entrega ao dono o resultado consolidado."],
        ["Diretor(a) de operações", "diretor", "Acompanha as metas de cada departamento, destrava problemas entre as equipes e prepara os números para o CEO."],
        ["Assistente executiva", "assistente", "Organiza a agenda do CEO, prepara pautas e atas e acompanha os pedidos do dono."]]],
      ["financeiro", "Financeiro", "#16A34A", [
        ["Gerente financeiro(a)", "gerente", "Responde pelo caixa: receitas, custos de servidores de vídeo e tradução, previsões e orçamento."],
        ["Analista financeiro(a)", "analista", "Monta o fluxo de caixa, concilia pagamentos e acompanha o custo por minuto de vídeo."],
        ["Assistente de pagamentos", "assistente", "Acompanha cobranças, devoluções e comprovantes e avisa quem precisa aprovar."]]],
      ["produto", "Produto e Tecnologia", "#3B82F6", [
        ["Gerente de produto", "gerente", "Decide o que entra na plataforma: prioriza ideias, escreve especificações e acompanha lançamentos."],
        ["Desenvolvedor(a) web", "analista", "Desenvolve as telas do site e do aplicativo com foco em velocidade."],
        ["Desenvolvedor(a) de tempo real", "analista", "Cuida das chamadas e lives em tempo real (WebRTC), da qualidade de vídeo e da tradução de voz."],
        ["Designer de produto", "analista", "Desenha telas e fluxos e revisa a experiência de cada área."]]],
      ["infraestrutura", "Infraestrutura", "#0EA5E9", [
        ["Líder de infraestrutura", "gerente", "Responde por servidores, banco de dados, servidores de mídia, backups e disponibilidade."],
        ["Engenheiro(a) de servidores de vídeo", "analista", "Mantém os servidores de mídia e de conexão funcionando com baixa latência."],
        ["Analista de monitoramento", "analista", "Acompanha alertas, quedas e custos e avisa a equipe antes que o usuário perceba."]]],
      ["seguranca", "Confiança e Segurança", "#22C55E", [
        ["Gerente de confiança e segurança", "gerente", "Define as regras de segurança da plataforma: verificação de idade, bloqueios e proteção dos usuários."],
        ["Analista de verificação", "analista", "Confere cadastros e verificações de idade e cuida dos casos que precisam de revisão."],
        ["Analista de segurança da informação", "analista", "Protege contas e dados, revisa acessos e investiga incidentes."]]],
      ["moderacao", "Moderação", "#FACC15", [
        ["Gerente de moderação", "gerente", "Organiza a moderação: regras, escalas, prioridades e a qualidade das decisões."],
        ["Moderador(a)", "assistente", "Acompanha denúncias e transmissões e aplica as regras da plataforma."],
        ["Moderador(a)", "assistente", "Revisa perfis e conteúdos denunciados e registra cada decisão."],
        ["Analista de denúncias", "analista", "Analisa denúncias complexas, encontra padrões e propõe regras novas."]]],
      ["lives", "Lives", "#F43F5E", [
        ["Gerente de lives", "gerente", "Cuida das lives: agenda, destaques, qualidade e crescimento de quem transmite."],
        ["Produtor(a) de lives", "analista", "Acompanha as transmissões, ajuda quem transmite e cuida dos destaques."],
        ["Analista de tradução de voz", "analista", "Testa e melhora a tradução de voz ao vivo em vários idiomas."]]],
      ["marketing", "Marketing", "#FB923C", [
        ["Gerente de marketing", "gerente", "Planeja a divulgação do NUVCAM com textos sóbrios e profissionais, campanhas e parcerias."],
        ["Analista de crescimento", "analista", "Cuida de anúncios, conversão e retenção, sempre dentro das regras das plataformas."],
        ["Social media", "assistente", "Cria posts e legendas institucionais e responde comentários."]]],
      ["suporte", "Suporte", "#60A5FA", [
        ["Gerente de suporte", "gerente", "Responde pela fila de atendimento: prazos, qualidade das respostas e casos difíceis."],
        ["Atendente de suporte", "assistente", "Responde dúvidas de conta, login, chamadas e pagamentos com clareza e educação."],
        ["Especialista em contas", "analista", "Resolve problemas de conta, bloqueios, recuperação de acesso e exclusão de dados."]]],
      ["compliance", "Jurídico e Compliance", "#64748B", [
        ["Gerente jurídico e de compliance", "gerente", "Cuida das regras da empresa: termos de uso, privacidade, verificação de idade e pedidos legais."],
        ["Advogado(a)", "analista", "Revisa termos, contratos e respostas a autoridades."],
        ["Analista de privacidade", "analista", "Cuida da LGPD: dados pessoais, retenção, pedidos dos titulares e registros."]]],
    ],
  },
};

const NOMES = ["Clara", "Otávio", "Lívia", "Rodrigo", "Manuela", "Hugo", "Valentina", "Samuel", "Yasmin", "Daniel", "Alice", "Murilo", "Lorena", "Pedro", "Giovanna",
  "Arthur", "Cecília", "Enzo", "Bianca", "João", "Heloísa", "Nicolas", "Laura", "Miguel", "Rafaela", "Gael", "Isadora", "Théo", "Elisa", "Benício", "Joana",
  "Lorenzo", "Mariana", "Davi", "Luiza", "Heitor", "Sara", "Antônio", "Melissa", "Vicente"];
const BONECOS = ["classico", "coque", "longo", "oculos", "ruivo", "careca", "suporte-1"];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function sqlDa(id, deslocNomes) {
  const emp = EMPRESAS[id]; if (!emp) throw new Error(`sede desconhecida: ${id}`);
  let n = deslocNomes;
  const pessoa = () => ({ nome: NOMES[n % NOMES.length], boneco: BONECOS[(n * 3 + 2) % BONECOS.length], i: n++ });
  const setores = [{ id: "recepcao", nome: "Recepção", cor: "#E9C46A", mesas: 1 }];
  const equipe = [];
  const rec = pessoa();
  for (const [sid, snome, cor, cargos] of emp.deps) {
    setores.push({ id: sid, nome: snome, cor, mesas: Math.min(4, cargos.length) });
    let chefe = null;
    cargos.forEach(([cargo, nivel, faz], k) => {
      const p = pessoa();
      const mid = nivel === "ceo" ? "ceo" : `${sid}-${k + 1}`;
      const papel = nivel === "ceo" ? "ceo" : "profissional";
      const chefeId = nivel === "ceo" ? null : sid === "diretoria" || k === 0 ? "ceo" : chefe;
      if (k === 0 && sid !== "diretoria") chefe = mid;
      equipe.push({ id: mid, nome: p.nome, cargo, papel, setorId: sid, boneco: p.boneco, camisa: cor, nivel, chefeId,
        treino: { descricao: `${faz} Trabalha no departamento ${snome} da ${emp.nome} (${emp.site}), ${emp.sobre}.`, saudacao: nivel === "ceo" ? "" : `Oi! Sou ${p.nome}, ${cargo.toLowerCase()} da ${emp.nome}. Em que posso ajudar?` } });
    });
  }
  equipe.unshift({ id: "atendente", nome: rec.nome, cargo: "Recepção da sede", papel: "atendente", setorId: "recepcao", boneco: rec.boneco, camisa: emp.cor, nivel: "assistente", chefeId: "diretoria-3",
    treino: { descricao: `Recebe quem chega na sede da ${emp.nome} (${emp.site}), ${emp.sobre}: explica o que a empresa faz, indica o departamento certo e anota o contato de quem quer falar com a equipe.`, saudacao: `Olá! Bem-vindo à sede da ${emp.nome}. Com quem você quer falar? Posso te levar ao departamento certo.` } });
  const escritorio = { layout: "torre", setores, equipe };
  const logo = fs.readFileSync(new URL(`../public/sedes/${id}/icone.png`, import.meta.url)).toString("base64");
  const socs = `ARRAY[${socios.map(q).join(", ")}]::text[]`;
  return `-- sede da ${emp.nome}: ${setores.length} setores, ${equipe.length} pessoas
INSERT INTO terreno (chave, usuario_id, status, empresa_nome, cor, logo, logo_tipo, reservado_em, pago_ate, escritorio, nicho, inaugurado_em, socios)
VALUES (${q(emp.chave)}, ${q(titular)}, 'ativo', ${q(emp.nome)}, ${q(emp.cor)}, decode(${q(logo)}, 'base64'), 'image/png', now(), now() + interval '10 years', ${q(JSON.stringify(escritorio))}::jsonb, ${q(emp.nicho)}, now(), ${socs})
ON CONFLICT (chave) DO UPDATE SET empresa_nome = EXCLUDED.empresa_nome, cor = EXCLUDED.cor, logo = EXCLUDED.logo, logo_tipo = EXCLUDED.logo_tipo, escritorio = EXCLUDED.escritorio, nicho = EXCLUDED.nicho, socios = EXCLUDED.socios, atualizado_em = now()
  WHERE terreno.usuario_id = EXCLUDED.usuario_id
RETURNING chave, usuario_id, empresa_nome, socios, jsonb_array_length(escritorio->'setores') AS setores, jsonb_array_length(escritorio->'equipe') AS equipe;
`;
}

const ids = qual === "todas" ? ["appzone", "bday", "nuvcam"] : [qual];
process.stdout.write(ids.map((id, k) => sqlDa(id, k * 13)).join("\n"));
