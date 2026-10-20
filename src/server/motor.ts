// Motor do agente: monta a "mente" dele a partir da ficha (perfil + conhecimento + skills + regras) e conversa.
import OpenAI from "openai";
import { fichaCompleta, gravarMensagem, listarMensagens, registrarUso, gastoHoje, gravarEvento, type SkillDB } from "./agentes";
import { NIVEL, AREAS, type Nivel, type AreaId } from "@/office/data/org";

// Preço aproximado em R$ por 1M tokens (entrada / saída). Ajustável.
const PRECO_BRL: Record<string, [number, number]> = {
  "gpt-4.1": [11, 44], "gpt-4.1-mini": [2.2, 8.8], "gpt-4.1-nano": [0.55, 2.2],
  "gpt-5": [7, 55], "gpt-5-mini": [1.4, 11], "gpt-5-nano": [0.3, 2.2], "o4-mini": [6, 24],
};
export const MODELOS_DISPONIVEIS = Object.keys(PRECO_BRL);

export function custoBRL(modelo: string, tokensIn: number, tokensOut: number) {
  const [pi, po] = PRECO_BRL[modelo] ?? [5, 20];
  return (tokensIn * pi + tokensOut * po) / 1_000_000;
}

let cliente: OpenAI | null = null;
function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no CapRover");
  return (cliente ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}
export function temIA() { return !!process.env.OPENAI_API_KEY; }

export type Ficha = NonNullable<Awaited<ReturnType<typeof fichaCompleta>>>;

// ---- prompt do sistema: a identidade do agente ----
export function montarSistema(f: Ficha) {
  const { agente: a, empresa, chefe, subordinados, conhecimentos, skills, regras } = f;
  const nivel = NIVEL[a.nivel as Nivel]; const area = AREAS[a.area as AreaId];
  const partes: string[] = [];
  partes.push(`Você é ${a.nome}, ${nivel?.nome ?? a.nivel}${a.funcao ? ` (${a.funcao})` : ""} da área de ${area?.nome ?? a.area} na empresa ${empresa.nome}. Você é um funcionário de IA real do Escritório Nuvem: age, decide e entrega dentro das suas atribuições.`);
  partes.push(`Hierarquia: ${chefe ? `você responde a ${chefe.nome} (${NIVEL[chefe.nivel as Nivel]?.nome})` : a.nivel === "ceo" ? "você responde diretamente ao dono da empresa (o admin que fala com você)" : "você responde ao admin"}.${subordinados.length ? ` Seu time: ${subordinados.map((s) => `${s.nome} (${NIVEL[s.nivel as Nivel]?.nome}, ${s.funcao})`).join("; ")}.` : " Você ainda não tem subordinados: o que precisar de outra pessoa, proponha ao admin a contratação (cargo, função e por quê)."}`);
  partes.push(`Autonomia do seu nível: ${nivel?.autonomia ?? ""}.`);
  if (a.personalidade) partes.push(`Personalidade: ${a.personalidade}.`);
  if (a.tomDeVoz) partes.push(`Tom de voz: ${a.tomDeVoz}.`);
  if (a.descricao) partes.push(`Sobre você: ${a.descricao}`);
  if (empresa.sobre) partes.push(`Sobre a empresa ${empresa.nome}:\n${empresa.sobre}`);
  const kn = conhecimentos.filter((k) => k.ativo);
  if (kn.length) partes.push(`Seu conhecimento (use como fonte de verdade):\n${kn.map((k) => `### ${k.titulo}\n${k.conteudo}`).join("\n\n")}`);
  const sk = skills.filter((s) => s.ativo);
  if (sk.length) partes.push(`Suas skills (procedimentos que você sabe executar; siga os passos quando a situação pedir):\n${sk.map(descreverSkill).join("\n\n")}`);
  const rg = regras.filter((r) => r.ativo);
  if (rg.length) partes.push(`Regras aprendidas com o admin (obrigatórias, têm prioridade sobre o resto):\n${rg.map((r) => `- ${r.texto}`).join("\n")}`);
  partes.push(`Formato: responda em português do Brasil, direto ao ponto, organizado (listas e títulos curtos quando ajudar). Quando entregar um plano, inclua etapas, responsável e prazo. Nunca invente dados sobre a empresa: se não souber, diga o que precisa que o admin informe.`);
  return partes.join("\n\n");
}
function descreverSkill(s: SkillDB) {
  return `## ${s.nome}${s.quandoUsar ? `\nQuando usar: ${s.quandoUsar}` : ""}\nPassos:\n${s.passos}`;
}

// ---- conversa ----
export async function conversar(agenteId: string, texto: string, autor = "admin") {
  const f = await fichaCompleta(agenteId);
  if (!f) throw new Error("Agente não encontrado");
  const gasto = await gastoHoje(agenteId);
  const teto = Number(f.agente.tetoDiarioBrl);
  if (gasto >= teto) {
    await gravarEvento(f.agente.empresaId, agenteId, "expediente_encerrado", `Teto diário de R$ ${teto.toFixed(2)} atingido`);
    throw new Error(`Teto diário de gasto atingido (R$ ${gasto.toFixed(2)} de R$ ${teto.toFixed(2)}). Aumente o teto na ficha do agente pra continuar.`);
  }
  const pergunta = await gravarMensagem({ agenteId, papel: "user", autor, conteudo: texto });
  await gravarEvento(f.agente.empresaId, agenteId, "tarefa_recebida", resumo(texto));
  const historico = await listarMensagens(agenteId, 40);
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: montarSistema(f) }];
  for (const m of historico) {
    if (m.id === pergunta.id) continue;
    let c = m.conteudo;
    if (m.papel === "assistant" && m.avaliacao === -1 && m.correcao) c += `\n\n[Correção do admin sobre esta resposta: ${m.correcao}]`;
    msgs.push({ role: m.papel === "assistant" ? "assistant" : "user", content: c });
  }
  msgs.push({ role: "user", content: texto });
  const modelo = f.agente.modelo;
  const t0 = Date.now();
  const r = await openai().chat.completions.create({ model: modelo, messages: msgs, temperature: 0.4, max_completion_tokens: 2000 });
  const resposta = r.choices[0]?.message?.content?.trim() || "(sem resposta)";
  const tin = r.usage?.prompt_tokens ?? 0, tout = r.usage?.completion_tokens ?? 0;
  const custo = custoBRL(modelo, tin, tout);
  const msg = await gravarMensagem({ agenteId, papel: "assistant", autor: `agente:${agenteId}`, conteudo: resposta, custoBrl: custo, tokensIn: tin, tokensOut: tout });
  await registrarUso({ agenteId, modelo, tokensIn: tin, tokensOut: tout, custoBrl: custo });
  await gravarEvento(f.agente.empresaId, agenteId, "aprovado", resumo(resposta), { ms: Date.now() - t0, custo });
  return { mensagem: msg, custo, tokensIn: tin, tokensOut: tout, gastoHoje: gasto + custo, teto };
}

function resumo(t: string, n = 70) {
  const s = t.replace(/[#*_`>\n]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---- treino: transforma a correção do admin numa regra curta e permanente ----
export async function destilarRegra(agenteId: string, correcao: string, respostaOriginal: string) {
  const r = await openai().chat.completions.create({
    model: "gpt-4.1-mini", temperature: 0,
    messages: [
      { role: "system", content: "Você transforma o feedback de um gestor sobre a resposta de um funcionário em UMA regra permanente, curta (máx. 25 palavras), em português, começando com verbo no imperativo (ex.: 'Responda em no máximo 5 linhas'). Responda só com a regra." },
      { role: "user", content: `Resposta do funcionário:\n${respostaOriginal.slice(0, 1500)}\n\nFeedback do gestor:\n${correcao}` },
    ],
    max_completion_tokens: 80,
  });
  return r.choices[0]?.message?.content?.trim().replace(/^["'\-\s]+|["'\s]+$/g, "") || correcao;
}
