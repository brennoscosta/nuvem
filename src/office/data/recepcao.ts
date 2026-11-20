// Recepção que encaminha (20/11/2026, pedido do dono: "quero que quando a pessoa entre em uma das empresas e seja
// visitante tenha acesso apenas à recepcionista, e daí ela vai ser direcionada para outro setor após decidir o que quer
// falar"). Aqui ficam, sem three.js nem React (o servidor usa o mesmo arquivo):
//  - os assuntos que a recepcionista oferece, tirados dos setores que a empresa tem de verdade (só setor com alguém dentro);
//    cada um aponta para a sala e para o responsável dela (o chefe da área), e sempre há "Falar com o responsável" (o CEO);
//  - a classificação por palavras, usada quando a IA não está disponível (ou não decidiu);
//  - as falas de roteiro de cada setor, para quando não há IA.
// O caminho até a sala e a catraca ficam em data/plantaInterna.ts; a conversa, em ui/Recepcao.tsx e src/server/equipeCliente.ts.
import type { Escritorio, Membro, NivelMembro } from "./escritorio";
import { plantaCliente } from "./escritorio";
import { montarSalas } from "./plantaSede";

export type Assunto = "vendas" | "suporte" | "financeiro" | "parcerias" | "trabalhe" | "responsavel" | "setor";
export interface Destino {
  id: string; // "responsavel" ou o id do setor
  rotulo: string; // o texto do botão ("Comprar / Vendas", "Suporte", "Design"…)
  assunto: Assunto;
  salaId: string; // a sala da planta (data/plantaSede.ts › montarSalas ou data/escritorio.ts › plantaCliente)
  setorNome: string; // o nome que aparece na placa da sala
  membroId: string; nome: string; cargo: string; camisa: string; // quem atende ali
}

// assuntos conhecidos: o setor da empresa que casa com `setor` ganha o rótulo padrão; o texto do visitante que casa com
// `texto` vai para ele. A ordem é a dos botões.
const ASSUNTOS: { id: Exclude<Assunto, "responsavel" | "setor">; rotulo: string; setor: RegExp; texto: RegExp }[] = [
  { id: "vendas", rotulo: "Comprar / Vendas", setor: /vend|comercial|or[cç]ament|pedido|loja\b/i,
    texto: /compr|pre[cç]o|or[cç]ament|valor|quanto (custa|fica|sai)|vend|pedido|encomend|produto|card[aá]pio|contratar|plano|assinar|assinatura|entrega|estoque|tem dispon/i },
  { id: "suporte", rotulo: "Suporte", setor: /suporte|atendimento|\bsac\b|ajuda|sucesso do cliente/i,
    texto: /suporte|problema|erro|n[aã]o (funciona|consigo|abre|entra)|ajuda|d[uú]vida|login|senha|minha conta|bug|travou|travando|reclama|defeito|quebrou|cancelar/i },
  { id: "financeiro", rotulo: "Financeiro", setor: /financ|cobran|fiscal|cont[aá]b|tesour/i,
    texto: /pagamento|pagar|paguei|boleto|\bpix\b|nota fiscal|\bnf\b|cobran|cobrad|reembolso|estorno|fatura|financ|devolu[cç]|dinheiro de volta/i },
  { id: "parcerias", rotulo: "Parcerias", setor: /parceri|parceiro|marketing|crescimento|publicidade|comunica[cç]/i,
    texto: /parceri|parceiro|patroc|divulga|publicidade|colab|influenc|imprensa|m[ií]dia|anunciar|an[uú]ncio|permuta/i },
  { id: "trabalhe", rotulo: "Trabalhe conosco", setor: /\brh\b|recursos humanos|pessoas|recrut|talento|gente e/i,
    texto: /trabalhar|emprego|vaga|curr[ií]cul|est[aá]gio|freela|me candidat|processo seletivo/i },
];
const TEXTO_RESPONSAVEL = /respons[aá]vel|\bdono\b|\bdona\b|gerente|diretor|\bceo\b|chefe|propriet[aá]ri|s[oó]ci[oa]|gest(or|ora|[aã]o)|falar com algu[eé]m/i;
export const ROTULO_RESPONSAVEL = "Falar com o responsável";

const ORDEM_NIVEL: Record<NivelMembro, number> = { ceo: 0, diretor: 1, gerente: 2, analista: 3, assistente: 4 };
const nivelDe = (m: Membro): NivelMembro => m.nivel ?? (m.papel === "ceo" ? "ceo" : m.papel === "atendente" ? "assistente" : "analista");
// o chefe da área: o de nível mais alto da sala; empate, o primeiro da equipe (é também quem senta na mesa maior)
function chefeDe(membros: Membro[]): Membro | null {
  let melhor: Membro | null = null;
  for (const m of membros) if (!melhor || ORDEM_NIVEL[nivelDe(m)] < ORDEM_NIVEL[nivelDe(melhor)]) melhor = m;
  return melhor;
}
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Os destinos da recepção, na ordem dos botões: os assuntos conhecidos, os outros setores pelo nome e, por último,
// "Falar com o responsável" (o CEO). Setor sem ninguém ou sem sala na planta fica de fora. Lista vazia = a empresa não tem
// para onde encaminhar e a recepcionista atende ali mesmo, como antes.
export function destinosDaRecepcao(e: Escritorio | null | undefined, sede: boolean): Destino[] {
  if (!e) return [];
  // salas que existem na planta (a sede monta 10 departamentos; a loja, até 4 setores)
  const salas = new Set(sede ? montarSalas(e.setores).filter((s) => s.tipo === "depto").map((s) => s.id) : [...plantaCliente(e).salas.filter((s) => s.tipo === "setor").map((s) => s.id), "ceo"]);
  const salaDe = (m: Membro) => (m.papel === "ceo" ? (sede ? m.setorId ?? "diretoria" : "ceo") : m.setorId);
  const ceo = e.equipe.find((m) => m.papel === "ceo") ?? null;
  const salaCeo = ceo ? salaDe(ceo) : null;
  const conhecidos: Destino[] = [], outros: Destino[] = [];
  const usados = new Set<string>();
  // todos os setores: quem não tem sala na planta (a sede monta 10 departamentos, a loja até 4) cai fora pelo `salas`
  for (const s of e.setores) {
    if (s.id === "recepcao" || s.id === salaCeo || !salas.has(s.id)) continue; // a sala do CEO vira "Falar com o responsável"
    const chefe = chefeDe(e.equipe.filter((m) => m.papel !== "atendente" && salaDe(m) === s.id));
    if (!chefe) continue;
    const a = ASSUNTOS.find((x) => !usados.has(x.id) && x.setor.test(`${s.nome} ${s.id}`));
    const base = { salaId: s.id, setorNome: s.nome, membroId: chefe.id, nome: chefe.nome, cargo: chefe.cargo, camisa: chefe.camisa };
    if (a) { usados.add(a.id); conhecidos.push({ id: s.id, rotulo: a.rotulo, assunto: a.id, ...base }); }
    else outros.push({ id: s.id, rotulo: s.nome, assunto: "setor", ...base });
  }
  conhecidos.sort((x, y) => ASSUNTOS.findIndex((a) => a.id === x.assunto) - ASSUNTOS.findIndex((a) => a.id === y.assunto));
  const lista = [...conhecidos, ...outros];
  if (ceo && salaCeo && salas.has(salaCeo)) lista.push({ id: "responsavel", rotulo: ROTULO_RESPONSAVEL, assunto: "responsavel", salaId: salaCeo, setorNome: sede ? e.setores.find((s) => s.id === salaCeo)?.nome ?? "Diretoria" : "Sala do CEO", membroId: ceo.id, nome: ceo.nome, cargo: ceo.cargo, camisa: ceo.camisa });
  return lista;
}

// Sem IA: a regra simples de palavras. Pontua cada destino pelo assunto e pelas palavras do nome do setor; nada casou
// = null (a recepcionista pede para escolher ou detalhar).
export function classificarPorPalavras(texto: string, destinos: Destino[]): Destino | null {
  const t = semAcento(texto);
  let melhor: Destino | null = null, nota = 0;
  for (const d of destinos) {
    let n = 0;
    const a = ASSUNTOS.find((x) => x.id === d.assunto);
    if (a && a.texto.test(texto)) n += 2;
    if (d.assunto === "responsavel" && TEXTO_RESPONSAVEL.test(texto)) n += 2;
    // palavras do nome do setor e do cargo de quem atende ("design", "produto", "qualidade"…), com 4 letras ou mais
    for (const p of semAcento(`${d.setorNome} ${d.assunto === "setor" ? d.cargo : ""}`).split(/[^a-z0-9]+/)) if (p.length >= 4 && !PALAVRAS_VAZIAS.has(p) && t.includes(p.slice(0, Math.max(4, p.length - 2)))) n += 1;
    if (n > nota) { nota = n; melhor = d; }
  }
  if (melhor) return melhor;
  // o pedido é claro, mas a empresa não tem esse setor ("quero comprar" onde não há vendas), ou ela só tem o responsável e
  // a pessoa disse alguma coisa além de um cumprimento: vai para o responsável
  const responsavel = destinos.find((d) => d.assunto === "responsavel") ?? null;
  if (responsavel && (ASSUNTOS.some((a) => a.texto.test(texto)) || (destinos.length === 1 && texto.trim().split(/\s+/).length >= 3))) return responsavel;
  return null;
}
const PALAVRAS_VAZIAS = new Set(["setor", "sala", "equipe", "gerente", "lider", "analista", "assistente", "diretor", "diretora", "especialista", "desenvolvedor", "desenvolvedora"]);

// ---------- falas de roteiro (sem IA) ----------
const primeiro = (n: string) => n.trim().split(/\s+/)[0] ?? "";
const minuscula = (c: string) => (/^[A-ZÀ-Ú]{2,}/.test(c) ? c : c.charAt(0).toLowerCase() + c.slice(1));
// o que a recepcionista diz ao encaminhar
export function falaDoEncaminhamento(d: Destino): string {
  if (d.assunto === "responsavel") return `Certo! Vou te levar até ${d.nome}, ${minuscula(d.cargo)}. É por aqui, a catraca já está liberada.`;
  return `Certo! Vou te levar até ${d.setorNome === d.rotulo ? `o setor ${d.setorNome}` : `${d.rotulo.toLowerCase()} (${d.setorNome})`}. ${d.nome}, ${minuscula(d.cargo)}, vai te atender. A catraca já está liberada.`;
}
export const FALA_SEM_DESTINO = "Para eu te levar ao lugar certo, escolha um dos assuntos abaixo ou me conte com um pouco mais de detalhe o que você precisa.";
// o primeiro "oi" de quem atende no setor (fica gravado na conversa dele, com o que foi dito na recepção)
export function saudacaoDoSetor(d: Destino, visitante: string, pedido: string): string {
  const oi = `Oi${visitante ? `, ${primeiro(visitante)}` : ""}! Sou ${d.nome}, ${minuscula(d.cargo)}.`;
  const recado = pedido ? ` A recepção me passou o seu pedido: “${pedido.length > 140 ? `${pedido.slice(0, 137)}…` : pedido}”.` : "";
  const resto: Record<Assunto, string> = {
    vendas: " Me diga o que você procura que eu te passo as opções.",
    suporte: " Me conte o que está acontecendo que eu vejo como resolver.",
    financeiro: " Posso ajudar com pagamentos, cobranças e notas. O que você precisa?",
    parcerias: " Que bom que você quer fazer uma parceria! Me conte a sua proposta.",
    trabalhe: " Que bom que você quer trabalhar com a gente! Me conte o que você faz.",
    responsavel: " A recepção disse que você quer falar comigo. Pode contar.",
    setor: ` Aqui é o setor ${d.setorNome}. Em que posso ajudar?`,
  };
  return oi + recado + resto[d.assunto];
}
// a resposta de quem atende no setor quando não há IA (ou o teto do mês acabou): o recado fica guardado para o dono
export function recadoDoSetor(d: Pick<Destino, "assunto" | "setorNome">, empresa: string): string {
  const contato = "Se ainda não deixou, mande um WhatsApp ou e-mail para o retorno.";
  switch (d.assunto) {
    case "vendas": return `Anotei o seu pedido para a equipe de vendas da ${empresa}. O dono confirma preço e disponibilidade e te responde. ${contato}`;
    case "suporte": return `Registrei o seu chamado no suporte. O dono acompanha e te responde por aqui. ${contato}`;
    case "financeiro": return "Anotei para o financeiro. O dono confere e te responde por aqui. Não mande senha nem dados de cartão nesta conversa.";
    case "parcerias": return `Recebi a sua proposta e passei para o dono da ${empresa}. ${contato}`;
    case "trabalhe": return "Guardei o seu interesse para as vagas. Deixe um WhatsApp ou e-mail e, se tiver, o link do seu portfólio ou currículo.";
    case "responsavel": return `Seu recado ficou anotado para o dono da ${empresa}, que responde assim que puder. ${contato}`;
    default: return `Anotei o seu recado para o setor ${d.setorNome}. O dono acompanha e te responde. ${contato}`;
  }
}
