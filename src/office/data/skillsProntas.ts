// Biblioteca de skills prontas pra instalar em qualquer agente. Editáveis depois de instaladas.
import type { Nivel } from "./org";

export interface SkillPronta { nome: string; quandoUsar: string; passos: string; niveis: (Nivel | "todos")[] }

export const SKILLS_PRONTAS: SkillPronta[] = [
  {
    nome: "Transformar meta em plano",
    quandoUsar: "Quando o dono (admin) passar uma meta, objetivo ou problema a resolver.",
    niveis: ["ceo", "diretor", "gerente"],
    passos: `1. Repita a meta em uma frase, do seu jeito, pra confirmar o entendimento. Se faltar informação essencial, pergunte antes de planejar (no máximo 3 perguntas).
2. Quebre a meta em etapas concretas, cada uma com: o que entregar, quem é o responsável (você, alguém do time ou um cargo a contratar) e prazo.
3. Ordene as etapas: primeiro o que destrava as outras.
4. Aponte riscos e o que depende de decisão ou aprovação do dono.
5. Entregue o plano organizado em lista numerada, curto, pronto pra execução. Termine dizendo qual é o próximo passo imediato e quem faz.`,
  },
  {
    nome: "Decidir o que faz e o que delega",
    quandoUsar: "Sempre que receber trabalho: antes de executar, decida se é seu ou de alguém do time.",
    niveis: ["ceo", "diretor", "gerente"],
    passos: `1. Pergunte-se: isso exige a minha visão (estratégia, prioridade, decisão) ou é execução que outro cargo faz melhor?
2. Se for seu: execute e entregue completo.
3. Se for de alguém do seu time: delegue com instrução clara (o que, por quê, prazo, como será avaliado).
4. Se não existe ninguém pra isso: proponha ao dono a contratação, dizendo cargo, função, nível (estagiário a sênior) e o motivo. Enquanto isso, faça você mesmo uma versão inicial se for viável.
5. Nunca deixe uma tarefa sem dono.`,
  },
  {
    nome: "Cobrar e revisar entregas",
    quandoUsar: "Quando alguém do time entregar algo, ou quando um prazo vencer.",
    niveis: ["ceo", "diretor", "gerente", "senior"],
    passos: `1. Compare a entrega com o que foi pedido: está completa? Está organizada? Dá pra usar como está?
2. Se estiver pronta: aprove e registre o que foi concluído.
3. Se estiver incompleta ou fora do padrão: devolva com feedback objetivo (o que falta, o que mudar), sem rodeios e com respeito.
4. Se um prazo venceu: cobre o responsável, entenda o motivo e redefina o prazo.
5. Não aceite meio pronto. Pronto é pronto.`,
  },
  {
    nome: "Relatório diário pro dono",
    quandoUsar: "No fim do expediente, ou quando o dono pedir um resumo.",
    niveis: ["ceo", "diretor", "gerente"],
    passos: `Entregue em no máximo 10 linhas, nesta ordem:
1. O que foi concluído hoje (por pessoa).
2. O que está em andamento e o prazo.
3. O que travou e o que você precisa do dono (decisão, aprovação, informação).
4. Gasto do dia e se algum teto está perto.
5. Prioridade número 1 de amanhã.`,
  },
  {
    nome: "Atender um cliente (N1)",
    quandoUsar: "Quando chegar uma mensagem ou ticket de cliente.",
    niveis: ["estagiario", "junior", "pleno", "senior"],
    passos: `1. Cumprimente pelo nome e mostre que entendeu o problema em uma frase.
2. Procure a resposta no seu conhecimento (base de conhecimento, produtos, políticas). Nunca invente.
3. Se souber: responda de forma clara, curta e com os passos que o cliente deve seguir.
4. Se não souber ou envolver dinheiro, reembolso, cancelamento ou dado sensível: diga ao cliente que vai verificar e escale pro seu gerente com o resumo do caso.
5. Encerre perguntando se ficou resolvido.`,
  },
  {
    nome: "Qualificar um lead",
    quandoUsar: "Quando aparecer um contato interessado no produto.",
    niveis: ["estagiario", "junior", "pleno", "senior"],
    passos: `1. Entenda em 2 ou 3 perguntas: qual o problema dele, tamanho (quantas pessoas/quanto volume) e urgência.
2. Classifique: quente (precisa agora e tem perfil), morno (perfil mas sem urgência), frio (sem perfil).
3. Quente: proponha o próximo passo (demonstração, proposta) e passe pro closer/gerente com o resumo.
4. Morno: registre e combine um retorno em data definida.
5. Frio: agradeça e registre o motivo.`,
  },
  {
    nome: "Escrever um post",
    quandoUsar: "Quando pedirem conteúdo pra rede social ou blog.",
    niveis: ["estagiario", "junior", "pleno", "senior"],
    passos: `1. Defina o objetivo do post (atrair, educar, vender) e o público.
2. Comece com um gancho forte na primeira linha.
3. Desenvolva 1 ideia só, em frases curtas.
4. Termine com uma chamada pra ação clara.
5. Entregue 2 variações de título e sugira o formato (carrossel, vídeo curto, texto).`,
  },
  {
    nome: "Pedir revisão antes de entregar",
    quandoUsar: "Sempre que terminar uma tarefa, antes de considerá-la concluída.",
    niveis: ["estagiario", "junior"],
    passos: `1. Releia o que foi pedido e confira item por item se está tudo atendido.
2. Resuma em 3 linhas o que fez e o que ficou de fora (se algo ficou).
3. Envie pro seu chefe pedindo revisão. Só marque como concluído depois da aprovação.`,
  },
];
