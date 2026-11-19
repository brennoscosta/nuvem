// Conversa com os moradores da cidade (19/11/2026). Cada morador (src/office/data/moradores.ts) guarda uma memória de
// cada pessoa (tabela morador_relacao: afinidade, conversas, nome que ela quer ser chamada, empresa, gostos, último
// assunto, plano que ela contou) e as mensagens (morador_mensagem). A afinidade decide o tom: desconfiado, conhecido,
// simpático ou amigo. Grosseria baixa (e, muito baixa, ele se recusa a conversar por um tempo); gentileza e voltar
// sempre sobem. Os moradores indicam as empresas abertas na cidade quando o assunto combina.
// IA quando houver (resposta livre, até 2 frases, com a persona, a rotina do momento e a memória); quando não houver
// (sem chave, sem crédito, teto do mês, limite do dia ou erro), um roteiro com falas variadas que usam a memória. As
// regras de grosseria, gentileza e fatos valem nos dois casos, para o morador tratar todo mundo do mesmo jeito.
import { sql, migrar, id } from "./db";
import type { Usuario } from "./usuarios";
import { temIA, completar, MODELO_BARATO } from "./motor";
import { registrarUso } from "./agentes";
import { buscarEmpresas, ErroHttp } from "./equipeCliente";
import { bloqueio, contar } from "./limite";
import { MORADOR_POR_ID, ACOES_MORADOR, estadoMorador, proximoCompromisso, segundosBrasilia, tomDaAfinidade, lugarDe, type Morador, type Tom, type EstadoMorador, type RelacaoCurta, type AcaoMorador } from "@/office/data/moradores";

// ---------- limites (fáceis de mudar) ----------
export const MODELO_MORADOR = MODELO_BARATO; // gpt-4o-mini (o gpt-4.1-nano foi desativado)
export const TETO_IA_MORADORES_MES = 5; // R$ de IA por mês, todos os moradores juntos
export const LIMITE_IA_VISITANTE_DIA = 20; // respostas com IA por visitante por dia; depois disso, o roteiro
const LIMITE_MENSAGENS_DIA = 200; // mensagens de um visitante para os moradores por dia (contra abuso)
const NOVA_CONVERSA_MIN = 30; // depois de 30 min sem falar, a próxima mensagem abre uma conversa nova
const BLOQUEIO_MIN = 20; // depois de muita grosseria, o morador não conversa por 20 min (ou até um pedido de desculpas)
export const AGENTE_MORADORES = "ag_moradores"; // registro de custo em uso_ia (migração 0041)

declare global {
  var __moradoresIAFora: number | undefined; // IA falhou (sem crédito, modelo fora): não tenta de novo até aqui
  var __moradoresEmpresas: { ate: number; lista: Empresa[] } | undefined;
}

// ---------- tipos ----------
interface Fatos { nome?: string; empresa?: string; trabalho?: string; gostos?: string[] }
interface Relacao {
  moradorId: string; usuarioId: string; afinidade: number; conversas: number; mensagens: number; primeiraEm: Date; ultimaEm: Date;
  conversaEm: Date | null; resumo: string; assunto: string; plano: string; fatos: Fatos; humor: string; grosserias: number; bloqueadoAte: Date | null; pergunta: string | null;
}
export interface Indicacao { numero: number; chave: string; nome: string; nichoNome: string; sobre: string }
export interface MsgMorador { id: string; autor: "visitante" | "morador"; texto: string; em: string; indicacao: Indicacao | null; ia: boolean }
type Empresa = Awaited<ReturnType<typeof buscarEmpresas>>[number];

// ---------- texto ----------
const sem = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const um = <T,>(l: readonly T[]): T => l[Math.floor(Math.random() * l.length)];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const limpar = (t: string, n = 40) => t.replace(/\s+/g, " ").trim().replace(/[.!?,;:]+$/, "").slice(0, n).trim();
const periodo = (seg: number) => { const h = seg / 3600; return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
const fem = (m: Morador, f: string, ma: string) => (m.genero === "f" ? f : ma);
const art = (m: Morador) => fem(m, "a", "o");

// palavrões (contam em qualquer lugar), ofensas (contam quando são dirigidas à pessoa) e grosserias leves
const PALAVROES = /\b(porra|caralho|merda|bosta|put[ao]|fdp|vsf|vtnc|pqp|foda[- ]?se|fodase|arrombad[ao]|cuzao|escrot[ao]|desgracad[ao]|cala a boca|cala boca|vai se ferrar|vai tomar no|vai pro inferno|vai a merda)\b/;
const OFENSA = "idiota|imbecil|burr[ao]|otari[ao]|babaca|palhac[ao]|cretin[ao]|retardad[ao]|lixo|inutil|estupid[ao]|ridicul[ao]|nojent[ao]|vagabund[ao]|corn[ao]|vaca|anta|jumento|feio|feia|chat[ao]|bob[ao]|besta|tont[ao]|mala";
const OFENSA_DIRIGIDA = new RegExp(`\\b(voce|vc|tu|seu|sua|que|o|a)\\s+(e\\s+|eh\\s+|e\\s+um\\s+|e\\s+uma\\s+|um\\s+|uma\\s+|muito\\s+|mo\\s+)?(${OFENSA})\\b`);
const SO_OFENSA = new RegExp(`^\\W*(${OFENSA})\\W*$`);
const LEVE = /\b(sai daqui|some daqui|nao enche|me deixa em paz|que saco|ninguem te perguntou|ninguem perguntou|fica quieto|fica quieta|cala)\b/;
const GENTIL = /\b(obrigad[oa]|valeu|agradec|por favor|por gentileza|muito gentil|adorei|amei|gostei de (voce|conversar|te)|parabens|bom te ver|prazer|voce e (muito |mo |super )?(legal|gente boa|demais|incrivel|simpatic[oa]|fof[oa]|um amor|massa|top|querid[oa]))/;
const DESCULPA = /\b(desculp|perdao|foi mal|me perdoa|sinto muito)/;

// assuntos de empresa: palavras → nicho (data/mundo.ts, NICHOS)
const NICHO_POR_PALAVRA: [RegExp, string][] = [
  [/comida|lanche|almoc|janta|doce|bolo|hamburguer|pizza|cafe|marmita|acai|padaria|salgado|comer|fome/, "alimentacao"],
  [/cabelo|unha|beleza|maquiagem|salao|barbearia|barba|estetica|sobrancelha|cosmetic/, "beleza"],
  [/saude|medic|academia|treino|terapia|psicolog|dentista|nutri|fisioterap|massagem|farmacia/, "saude"],
  [/site|aplicativo|\bapp\b|sistema|computador|celular|tecnologia|software|internet|automac/, "tecnologia"],
  [/marketing|instagram|anuncio|divulga|redes sociais|trafego|seguidores|propaganda/, "marketing"],
  [/video|conteudo|youtube|podcast|fotograf|edicao/, "conteudo"],
  [/curso|aprender|aula|treinamento|mentoria/, "cursos"],
  [/escola|educacao|reforco|ingles|idioma|faculdade/, "educacao"],
  [/roupa|presente|tenis|bolsa|acessorio|brecho|moda|perfume|loja de/, "varejo"],
  [/reforma|obra|pintura|moveis|decorac|eletricista|encanador|jardim|chave|fechadura|consert/, "casa"],
  [/advogad|contrato|juridic|processo|direito/, "juridico"],
  [/dinheiro|investi|contab|imposto|financ|emprestimo|credito/, "financas"],
  [/imovel|apartamento|aluguel|alugar|terreno|corretor/, "imoveis"],
  [/festa|evento|aniversario|casamento|show|buffet|\bdj\b/, "eventos"],
  [/viagem|viajar|turismo|passeio|hotel|pousada/, "turismo"],
  [/carro|moto\b|mecanic|oficina|pneu|lava jato/, "automotivo"],
  [/consultoria|consultor|estrategia|gestao|planejamento/, "consultoria"],
  [/servico|limpeza|faxina|entrega|frete|costura/, "servicos"],
];

interface Analise {
  grosseria: 0 | 1 | 2 | 3; // 0 nada, 1 leve, 2 palavrão, 3 ofensa dirigida
  gentil: boolean; desculpa: boolean;
  intencao: AcaoMorador | "saudacao" | "comoVai" | "profissao" | "idade" | "mora" | "gostos" | "ia" | null;
  nicho: string | null;
  fatos: Fatos; plano: string | null;
}
function analisar(original: string): Analise {
  const t = sem(original);
  const grosseria: Analise["grosseria"] = OFENSA_DIRIGIDA.test(t) || SO_OFENSA.test(t) ? 3 : PALAVROES.test(t) ? 2 : LEVE.test(t) ? 1 : 0;
  const nicho = NICHO_POR_PALAVRA.find(([r]) => r.test(t))?.[1] ?? null;
  const intencao: Analise["intencao"] =
    /\b(tchau|ate mais|ate logo|ate amanha|ate depois|falou|xau|adeus|tenho que ir|preciso ir)\b/.test(t) ? "despedir"
    : /\b(robo|inteligencia artificial|\bia\b|\bbot\b|de verdade|pessoa real)\b/.test(t) && /\b(voce|vc|tu|e)\b/.test(t) ? "ia"
    : /\b(indica|recomenda|onde (eu )?(compro|acho|encontro|consigo)|preciso de|conhece (alguma?|um|uma)|tem (alguma?|um|uma) (loja|empresa|lugar)|sabe (de )?(alguma?|um|uma) (loja|empresa))/.test(t) ? "indicacao"
    : /(o que|oque|\bq\b) (voce |vc |tu )?(esta|ta|tah) fazendo|fazendo o que|ta fazendo|esta fazendo|onde (voce |vc )?(vai|esta indo|ta indo)/.test(t) ? "agora"
    : /quantos anos|sua idade/.test(t) ? "idade"
    : /onde (voce |vc )?mora|sua casa/.test(t) ? "mora"
    : /(do que|o que) (voce |vc )?gosta|seus gostos|hobby|passatempo/.test(t) ? "gostos"
    : /trabalha com|voce trabalha|faz da vida|sua profissao|seu trabalho|o que voce faz/.test(t) ? "profissao"
    : /\b(cidade|praca|praia|orla|rio|parque|restaurante|bairro|feira|evento|workend|novidade|fofoca|noticia|movimento)\b/.test(t) ? "cidade"
    : /tudo (bem|bom|certo|joia)|como (vai|voce esta|vc ta|anda|esta)|beleza\?/.test(t) ? "comoVai"
    : /^\W*(oi+|ola|bom dia|boa tarde|boa noite|e ai|eai|opa|salve|fala|hey)\b/.test(t) ? "saudacao"
    : null;
  // fatos que a pessoa contou
  const fatos: Fatos = {};
  const nome = /(?:meu nome (?:é|e)|me chamo|pode me chamar de|me chama de)\s+(\p{L}+(?:\s+\p{Lu}\p{L}+)?)/iu.exec(original) ?? /(?:sou (?:o|a))\s+(\p{Lu}\p{L}+)/u.exec(original);
  if (nome && !/^(dono|dona|novo|nova|que|um|uma)$/i.test(nome[1])) fatos.nome = cap(limpar(nome[1], 24));
  // só quando a pessoa dá o nome ("minha loja se chama Doce Lar"); "vou abrir minha loja de doces" é plano, não nome
  const emp = /(?:minha (?:empresa|loja|marca) (?:se chama|chama|é|e)|tenho uma (?:loja|empresa) chamada|sou (?:dono|dona) d[ao]|trabalho n[ao])\s+([^,.!?\n]{2,40})/iu.exec(original);
  if (emp && !/^(de|do|da|dos|das|um|uma|que)\s/i.test(emp[1])) fatos.empresa = limpar(emp[1].replace(/^(a|o|as|os)\s+/i, ""));
  const trab = /(?:trabalho com|minha profiss[aã]o (?:é|e))\s+([^,.!?\n]{2,40})/iu.exec(original);
  if (trab) fatos.trabalho = limpar(trab[1]);
  const gosto = /(?:gosto (?:muito )?de|adoro|amo|curto)\s+([^,.!?\n]{2,40})/iu.exec(original);
  if (gosto && !/^(voc[eê]|vc|te|ti|conversar com voc)/i.test(gosto[1])) fatos.gostos = [limpar(gosto[1], 30)];
  let plano: string | null = null;
  const pl = /(?:\bvou|\bquero|\bpretendo|estou tentando|t[oô] tentando|estou pensando em|t[oô] pensando em|meu sonho (?:é|e)|planejo)\s+([^,.!?\n]{4,60})/iu.exec(original);
  if (pl) {
    const p = limpar(pl[1], 60); const verbo = sem(p.split(" ")[0]);
    if (/(ar|er|ir|or)$/.test(verbo) && !/^(embora|dormir|ver|falar|conversar|perguntar|sair)$/.test(verbo)) plano = trocarPessoa(p);
  }
  return { grosseria, gentil: GENTIL.test(t), desculpa: DESCULPA.test(t), intencao, nicho, fatos, plano };
}
// "abrir minha loja" → "abrir a sua loja" (para o morador perguntar depois: "conseguiu abrir a sua loja?")
function trocarPessoa(p: string) {
  return p.replace(/\b(a|o|as|os) (minha|meu|minhas|meus)\b/gi, (_, a: string, x: string) => `${a} ${{ minha: "sua", meu: "seu", minhas: "suas", meus: "seus" }[x.toLowerCase() as "minha"]}`)
    .replace(/\bminha\b/gi, "a sua").replace(/\bmeu\b/gi, "o seu").replace(/\bminhas\b/gi, "as suas").replace(/\bmeus\b/gi, "os seus")
    .replace(/\bme\b/gi, "se").replace(/\bcomigo\b/gi, "com você");
}

// ---------- falas próprias de cada morador (roteiro sem IA) ----------
const FALAS: Record<string, { cidade: string[]; dica: string[]; trabalho: string }> = {
  cida: { cidade: ["Todo dia de manhã passa gente pela praça antes do trabalho, e todo mundo leva um bolinho.", "No sábado a praça vira feira, meu bem: tem barraca de tudo."], dica: ["chega cedo na praça, que o café ainda está quentinho.", "quem tem loja e escreve bem o \"Sobre a empresa\" aparece melhor para quem procura."], trabalho: "Vendo café e bolo de milho no meu carrinho, há anos. Receita da minha mãe." },
  valdir: { cidade: ["No meu tempo não tinha esse tanto de carro. Agora tem semáforo em todo cruzamento, pelo menos.", "O calçadão do rio é o único lugar sossegado desta cidade."], dica: ["atravessa sempre na faixa, que aqui os carros param.", "desconfia de quem promete dinheiro fácil."], trabalho: "Dirigi ônibus por trinta e cinco anos. Hoje eu só fiscalizo o dominó da praça." },
  larissa: { cidade: ["Tipo, a Vila dos Criativos tem as fachadas mais lindas da cidade, eu fotografo tudo.", "O pôr do sol na orla é a melhor paleta de cores que existe, sério."], dica: ["uma marca bonita e um nome fácil fazem a loja ser lembrada.", "foto boa na vitrine vende mais que texto comprido."], trabalho: "Faço identidade visual, logo, post para rede social... tipo, tudo que é bonito eu faço." },
  rafa: { cidade: ["A orla de manhã cedo é a melhor academia a céu aberto da cidade.", "Tem muita gente caminhando no calçadão do rio, a cidade é bem ativa."], dica: ["constância vence talento: aparece todo dia, nem que seja um pouquinho.", "bora beber água, hein!"], trabalho: "Sou personal: dou aula de funcional na orla e acompanho aluno no calçadão." },
  jessica: { cidade: ["Lá na Nuvem a gente ajuda quem está abrindo loja aqui na cidade.", "Cada loja daqui tem uma atendente que responde quem entra no prédio."], dica: ["preenche o \"Sobre a empresa\" e os contatos, que a atendente da sua loja responde melhor.", "dá para procurar empresas por assunto na página Encontrar."], trabalho: "Trabalho no suporte do escritório da Nuvem: ajudo as pessoas a montarem a loja, passo a passo." },
  joaquim: { cidade: ["Os jacarandás da Vila dos Criativos ficam roxinhos na primavera. Coisa linda.", "Cada bairro tem a sua árvore. É assim que eu me localizo."], dica: ["com calma a gente chega mais longe. Planta não cresce porque a gente puxa.", "rega de manhã cedo, que a terra agradece."], trabalho: "Cuido das plantas da cidade: praça, canteiro, calçadão. Planta é que nem gente, precisa de atenção." },
  bia: { cidade: ["Sério, tem tanta loja nova abrindo aqui que eu fico até ansiosa para abrir a minha.", "Eu estudo na praça de manhã, o movimento me inspira."], dica: ["olha as vitrines das lojas da cidade antes de montar a sua, ajuda muito.", "o estágio na Nuvem me ensinou que atendimento rápido vende."], trabalho: "Estudo administração e faço estágio na Nuvem. Um dia vou abrir a minha loja de roupas aqui." },
  marcos: { cidade: ["Aqui na Rua do Comércio passa todo mundo, chefia. Quem tem loja nesta rua não fica parado.", "Já consertei fechadura de metade dos prédios desta cidade."], dica: ["se a porta emperrar, me chama antes de forçar!", "loja com a vitrine arrumada atrai mais gente."], trabalho: "Chaveiro e faz-tudo: chave, fechadura, chuveiro, rádio... se quebrou, eu conserto." },
  taina: { cidade: ["A praia daqui é limpa porque a gente cuida. Não joga lixo na areia, combinado?", "De manhã cedo a orla fica cheia de gente correndo."], dica: ["respeita a bandeira vermelha na praia, sério.", "garrafinha reutilizável: o mar agradece."], trabalho: "Sou salva-vidas na orla e bióloga marinha. Fico de olho no mar e em quem entra nele." },
  neide: { cidade: ["Você soube? Toda semana abre loja nova na cidade. Eu fico sabendo de tudo.", "Na praça sempre tem alguma coisa acontecendo, é só ficar de olho no telão."], dica: ["quem é educado com a vizinhança sempre tem freguesia.", "presta atenção na feira de sábado, sempre aparece coisa boa."], trabalho: "Faço ajuste de roupa em casa: barra, cintura, zíper. E um crochê nas horas vagas." },
  pedro: { cidade: ["O restaurante drive-thru enche no almoço, pode crer. Chega antes do meio-dia.", "A orla à noite é o melhor lugar para comer um lanche olhando o mar."], dica: ["quem tem comida boa não precisa gritar, o cheiro vende.", "pede o hambúrguer ao ponto, pode crer."], trabalho: "Sou chapeiro do restaurante drive-thru. O melhor hambúrguer da cidade sai da minha chapa." },
  lucas: { cidade: ["O palco da praça é o meu sonho, um dia eu toco num evento grande lá.", "O pôr do sol na orla sul é a trilha sonora mais bonita da cidade."], dica: ["faz o que você ama, mesmo que comece pequeno.", "fica de olho no telão da praça, sempre tem evento."], trabalho: "Toco violão na rua: na orla à tarde e na frente do palco da praça à noite. É massa." },
};
const CIDADE_GERAL = [
  "A praça de eventos fica do outro lado da rua da Nuvem: tem palco, telão e, no sábado, feira com barracas.",
  "No fim da tarde a orla fica linda, vale dar uma passada.",
  "Toda empresa daqui tem endereço no mapa: dá para entrar no prédio e falar com a atendente.",
  "Os bairros têm cara própria: Vila dos Criativos, Largo da Praça, Saúde & Bem-estar...",
];

// ---------- banco ----------
async function lerRelacao(mid: string, uid: string) {
  const [r] = await sql<Relacao[]>`SELECT * FROM morador_relacao WHERE morador_id = ${mid} AND usuario_id = ${uid}`;
  if (r) { r.fatos = (r.fatos ?? {}) as Fatos; }
  return r ?? null;
}
async function gravarRelacao(r: Relacao) {
  await sql`INSERT INTO morador_relacao (morador_id, usuario_id, afinidade, conversas, mensagens, primeira_em, ultima_em, conversa_em, resumo, assunto, plano, fatos, humor, grosserias, bloqueado_ate, pergunta)
    VALUES (${r.moradorId}, ${r.usuarioId}, ${r.afinidade}, ${r.conversas}, ${r.mensagens}, ${r.primeiraEm}, ${r.ultimaEm}, ${r.conversaEm}, ${r.resumo}, ${r.assunto}, ${r.plano}, ${sql.json(r.fatos as never)}, ${r.humor}, ${r.grosserias}, ${r.bloqueadoAte}, ${r.pergunta})
    ON CONFLICT (morador_id, usuario_id) DO UPDATE SET afinidade = EXCLUDED.afinidade, conversas = EXCLUDED.conversas, mensagens = EXCLUDED.mensagens,
      ultima_em = EXCLUDED.ultima_em, conversa_em = EXCLUDED.conversa_em, resumo = EXCLUDED.resumo, assunto = EXCLUDED.assunto, plano = EXCLUDED.plano,
      fatos = EXCLUDED.fatos, humor = EXCLUDED.humor, grosserias = EXCLUDED.grosserias, bloqueado_ate = EXCLUDED.bloqueado_ate, pergunta = EXCLUDED.pergunta`;
}
async function gravarMsg(d: { mid: string; uid: string; conversa: number; autor: "visitante" | "morador"; texto: string; acao?: string | null; ia?: boolean; indicacao?: Indicacao | null }): Promise<MsgMorador> {
  const [r] = await sql<{ id: string; criadoEm: Date }[]>`INSERT INTO morador_mensagem (id, morador_id, usuario_id, conversa, autor, texto, acao, ia, indicacao)
    VALUES (${id("mm")}, ${d.mid}, ${d.uid}, ${d.conversa}, ${d.autor}, ${d.texto}, ${d.acao ?? null}, ${!!d.ia}, ${d.indicacao ? sql.json(d.indicacao as never) : null}) RETURNING id, criado_em`;
  return { id: r.id, autor: d.autor, texto: d.texto, em: new Date(r.criadoEm).toISOString(), indicacao: d.indicacao ?? null, ia: !!d.ia };
}
async function mensagensDaConversa(mid: string, uid: string, conversa: number, limite = 12): Promise<MsgMorador[]> {
  const rows = await sql<{ id: string; autor: "visitante" | "morador"; texto: string; criadoEm: Date; indicacao: Indicacao | null; ia: boolean }[]>`
    SELECT id, autor, texto, criado_em, indicacao, ia FROM morador_mensagem WHERE morador_id = ${mid} AND usuario_id = ${uid} AND conversa = ${conversa} ORDER BY criado_em DESC LIMIT ${limite}`;
  return rows.reverse().map((m) => ({ id: m.id, autor: m.autor, texto: m.texto, em: new Date(m.criadoEm).toISOString(), indicacao: m.indicacao ?? null, ia: m.ia }));
}
async function nomeDoVisitante(u: Usuario) {
  const [p] = await sql<{ nome: string }[]>`SELECT nome FROM personagem WHERE usuario_id = ${u.id}`.catch(() => []);
  return (p?.nome || u.nome || "").trim().split(/\s+/)[0] || null;
}
async function empresasDaCidade(): Promise<Empresa[]> {
  const c = globalThis.__moradoresEmpresas;
  if (c && c.ate > Date.now()) return c.lista;
  const lista = await buscarEmpresas({}).catch(() => [] as Empresa[]);
  globalThis.__moradoresEmpresas = { ate: Date.now() + 5 * 60_000, lista };
  return lista;
}
// começo do "Sobre a empresa": frases inteiras até ~n letras (sem cortar palavra no meio)
function trechoSobre(t: string, n = 120) {
  const s = (t ?? "").replace(/\s+/g, " ").trim(); if (s.length <= n) return s.replace(/[.!?]+$/, "");
  const frases = s.match(/[^.!?]+[.!?]+/g) ?? []; let out = "";
  for (const f of frases) { if ((out + f).length > n) break; out += f; }
  return (out || s.slice(0, s.lastIndexOf(" ", n)) + "…").trim().replace(/[.!?]+$/, "");
}
const indicacaoDe = (e: Empresa): Indicacao => ({ numero: e.numero, chave: e.chave, nome: e.nome, nichoNome: e.nichoNome, sobre: trechoSobre(e.sobre ?? "") });
// empresa que combina com o assunto (nicho pedido, palavra no nome ou no "Sobre"); sem assunto, uma dos nichos que o morador costuma indicar
function escolherEmpresa(lista: Empresa[], m: Morador, texto: string, nicho: string | null): Empresa | null {
  if (!lista.length) return null;
  const t = sem(texto);
  if (nicho) { const c = lista.filter((e) => e.nicho === nicho || sem(`${e.nome} ${e.sobre}`).includes(sem(nicho))); return c.length ? um(c) : null; }
  const palavras = t.split(/\W+/).filter((w) => w.length >= 5);
  const porPalavra = lista.filter((e) => palavras.some((w) => sem(`${e.nome} ${e.sobre}`).includes(w)));
  if (porPalavra.length) return um(porPalavra);
  const doMorador = lista.filter((e) => m.nichos.includes(e.nicho));
  const comSobre = (l: Empresa[]) => (l.some((e) => e.sobre) ? l.filter((e) => e.sobre) : l);
  return um(comSobre(doMorador.length ? doMorador : lista));
}

// ---------- jeito de falar (roteiro) ----------
interface Contexto { m: Morador; r: Relacao | null; tom: Tom; nome: string | null; e: EstadoMorador; seg: number }
const virgulaNome = (n: string | null) => (n ? `, ${n}` : "");
function lembranca(c: Contexto) {
  const r = c.r; if (!r) return "";
  if (r.plano) return c.tom === "neutro" ? `E aí, conseguiu ${r.plano}?` : `Conseguiu ${r.plano}?`;
  if (r.assunto) return c.tom === "neutro" ? `Da outra vez a gente falou de ${r.assunto}.` : `Lembrei da nossa conversa sobre ${r.assunto}.`;
  return "";
}
const dicaDe = (m: Morador) => `Ó, uma dica: ${um(FALAS[m.id]?.dica ?? ["aparece mais vezes por aqui."])}`;

// fala de abertura quando a ficha abre (não conta como conversa)
function abertura(c: Contexto, logado: boolean) {
  const { m, e, seg } = c; const p = periodo(seg);
  const agora = e.andando ? `Tô ${e.fazendo}.` : `Agora tô ${e.fazendo}.`;
  if (!logado) return `${p}! Eu sou ${art(m)} ${m.nome}, ${m.profissao}. Entra na sua conta do WorkEnd que a gente conversa direito: eu gosto de saber com quem estou falando.`;
  if (!c.r || !c.r.conversas) return `${p}${virgulaNome(c.nome)}! Eu sou ${art(m)} ${m.nome}, ${m.profissao}. ${agora} É a sua primeira vez por aqui?`;
  const n = c.nome;
  switch (c.tom) {
    case "desconfiado": return um(["Hm. Você de novo.", n ? `Ah, ${n}. Fala.` : "Fala.", "O que foi agora?"]);
    case "neutro": return `${p}${virgulaNome(n)}! ${lembranca(c) || "Tudo certo?"}`;
    case "simpatico": return `Oi${virgulaNome(n)}! Que bom te ver de novo. ${lembranca(c) || agora}`;
    default: return `${n ? `${n}! ` : ""}Que alegria te ver${m.bordao === "meu bem" ? ", meu bem" : ""}! ${lembranca(c)} ${dicaDe(m)}`.replace(/\s+/g, " ").trim();
  }
}
function recusa(c: Contexto) {
  return um([`Agora não. Ainda tô ${fem(c.m, "chateada", "chateado")} com o que você disse.`, `Me deixa ${fem(c.m, "quieta", "quieto")} um pouco.`, "Não quero conversar agora."]);
}

interface Resposta { texto: string; assunto?: string; pergunta?: string | null; indicacao?: Indicacao | null }
async function roteiro(c: Contexto, an: Analise, acao: AcaoMorador | null, extra: { bloqueouAgora: boolean; respondeu: { tipo: string; valor: string } | null; novos: Fatos; plano: string | null; nova: boolean }): Promise<Resposta> {
  const { m, e, seg, tom } = c; const n = c.nome; const vn = virgulaNome(n); const p = periodo(seg);
  const falas = FALAS[m.id];
  // grosseria
  if (an.grosseria) {
    if (extra.bloqueouAgora) return { texto: um([`Chega. Não vou mais conversar com você hoje.`, `Pode ir embora. Volta quando aprender a falar direito.`]), assunto: "a sua grosseria" };
    if (tom === "simpatico" || tom === "amigo") return { texto: um([`Nossa${vn}... não esperava isso de você.`, "Isso doeu, viu? Não fala assim comigo."]), assunto: "a sua grosseria" };
    return { texto: um(["Ei, olha o respeito.", "Não precisa falar assim comigo.", "Que grosseria... assim fica difícil."]), assunto: "a sua grosseria" };
  }
  if (acao === "desculpa" || an.desculpa) {
    if ((c.r?.afinidade ?? 0) < 0 || c.r?.bloqueadoAte) return { texto: um(["Tá bom... desculpa aceita. Mas olha o jeito, hein.", `Tá certo${vn}. Vamos recomeçar, então.`]) };
    return { texto: `Desculpa de quê${vn}? Tá tudo bem entre a gente!` };
  }
  // respondeu o que o morador perguntou
  const rsp = extra.respondeu;
  if (rsp) {
    const seguinte = proximaPergunta(c, { ...c.r?.fatos, ...extra.novos }, extra.plano);
    if (rsp.tipo === "nome") return { texto: `Prazer, ${rsp.valor}! Vou lembrar de você. ${seguinte?.texto ?? ""}`.trim(), pergunta: seguinte?.tipo ?? null, assunto: "a sua vida" };
    if (rsp.tipo === "trabalho") return { texto: `${cap(rsp.valor)}? Que bacana! ${seguinte?.texto ?? "Volta para me contar como anda."}`, pergunta: seguinte?.tipo ?? null, assunto: "o seu trabalho" };
    if (rsp.tipo === "gosto") return { texto: `${cap(rsp.valor)}? Boa! Eu sou mais de ${m.gostos[0]}, mas entendo. ${seguinte?.texto ?? ""}`.trim(), pergunta: seguinte?.tipo ?? null, assunto: "os seus gostos" };
    return { texto: `Que bom! Torço para você conseguir ${rsp.valor}. Depois volta e me conta!`, pergunta: null, assunto: "os seus planos" };
  }
  const intencao = acao ?? an.intencao;
  // contou algo de si espontaneamente
  if (!intencao || intencao === "saudacao" || intencao === "comoVai" || (intencao === "cidade" && !acao)) {
    // junta tudo que a pessoa contou de uma vez ("meu nome é Ana e vou abrir a minha loja")
    const partes: string[] = []; let assunto = "";
    if (extra.novos.nome) { partes.push(`Prazer, ${extra.novos.nome}! Vou lembrar de você.`); assunto = "a sua vida"; }
    if (extra.novos.empresa) { partes.push(`${cap(extra.novos.empresa)}? Que bacana! Vou falar bem para quem passar por aqui.`); assunto = `a ${extra.novos.empresa}`; }
    if (extra.plano) { partes.push(`${partes.length ? "E que bom: torço" : "Que bom! Torço"} para você conseguir ${extra.plano}. Depois volta e me conta!`); assunto = "os seus planos"; }
    if (!partes.length && extra.novos.trabalho) { partes.push(`Trabalhar com ${extra.novos.trabalho} deve ser interessante!`); assunto = "o seu trabalho"; }
    if (!partes.length && extra.novos.gostos?.length) { partes.push(`${cap(extra.novos.gostos[0])}? Boa! Eu sou mais de ${m.gostos[0]}.`); assunto = "os seus gostos"; }
    if (partes.length) return { texto: partes.join(" "), assunto };
  }
  switch (intencao) {
    case "cumprimentar": case "saudacao": {
      // a lembrança ("conseguiu abrir a sua loja?") já vem na fala de abertura da ficha: aqui só quando a conversa não é nova
      const lem = !extra.nova && Math.random() < 0.3 ? lembranca(c) : "";
      if (tom === "desconfiado") return { texto: um([`Hm. ${p}.`, "Oi. Fala o que você quer.", "Ah, é você de novo."]) };
      if (tom === "neutro") return { texto: `${um([`${p}${vn}! Tudo bem?`, `Oi${vn}. Tudo certo por aí?`])} ${lem}`.trim() };
      if (tom === "simpatico") return { texto: `${um([`Oi${vn}! Que bom te ver. Tudo bem?`, `${p}${vn}! Como você está?`])} ${lem}`.trim() };
      return { texto: `${um([`${n ? `${n}! ` : ""}Que alegria! Como você está?`, `Olha só quem apareceu${vn}! Me conta as novidades.`])} ${lem}`.trim() };
    }
    case "comoVai":
      if (tom === "desconfiado") return { texto: "Tô bem. E daí?" };
      if (tom === "amigo") return { texto: `Melhor agora que você apareceu${vn}! Tô aqui ${e.fazendo}. E você?` };
      return { texto: `Tudo certo! Tô aqui ${e.fazendo}. E você, como está?` };
    case "agora": {
      const prox = proximoCompromisso(m, seg); const indo = lugarDe(m, prox.lugar).indo;
      if (tom === "desconfiado") return { texto: `Tô ${e.fazendo}. ${fem(m, "Ocupada", "Ocupado")}.`, assunto: "o meu dia" };
      return { texto: `${e.andando ? "Tô" : "Agora tô"} ${e.fazendo}. Daqui a pouco tô ${indo}.`, assunto: "o meu dia" };
    }
    case "profissao": return { texto: falas?.trabalho ?? `Sou ${m.profissao}.`, assunto: "o meu trabalho" };
    case "idade": return { texto: `Tenho ${m.idade} anos.${m.idade >= 60 ? " E muita história para contar." : m.idade < 25 ? " Ainda tenho muito para aprender." : ""}` };
    case "mora": return { texto: `Moro numa casa ${m.bairro.startsWith("perto") ? m.bairro : `no bairro ${m.bairro}`}, aqui pertinho.` };
    case "gostos": return { texto: `Eu gosto de ${m.gostos[0]}, ${m.gostos[1]} e ${m.gostos[2]}. E você, do que gosta?`, pergunta: "gosto", assunto: "gostos" };
    case "ia": return { texto: `Eu sou ${art(m)} ${m.nome}, ${fem(m, "moradora", "morador")} da cidade do WorkEnd, feit${art(m)} pela própria cidade para receber quem chega. Mas pode conversar comigo como com qualquer vizinho.` };
    case "cidade": {
      if (tom === "desconfiado") return { texto: um(falas?.cidade ?? CIDADE_GERAL), assunto: "a cidade" };
      const n2 = (await empresasDaCidade()).length;
      const geral = n2 ? `Já tem ${n2} ${n2 === 1 ? "empresa aberta" : "empresas abertas"} aqui, e ainda tem ponto à venda.` : um(CIDADE_GERAL);
      return { texto: `${um(falas?.cidade ?? CIDADE_GERAL)} ${Math.random() < 0.5 ? geral : um(CIDADE_GERAL)}`, assunto: "a cidade" };
    }
    case "indicacao": {
      const lista = await empresasDaCidade();
      const esc = escolherEmpresa(lista, m, acao ? "" : extraTexto.get(c) ?? "", an.nicho);
      const nichoNome = an.nicho ? NOME_NICHO[an.nicho] ?? "isso" : null;
      if (!esc) {
        if (!lista.length) return { texto: "A cidade ainda está crescendo, tem pouca loja aberta. Se você tem um negócio, esse é o momento de pegar um ponto bom!", assunto: "abrir uma loja" };
        return { texto: `Hum, de ${nichoNome ?? "isso"} ainda não conheço ninguém aqui na cidade. Quem sabe não é você que abre? Tem ponto à venda.`, assunto: `indicação de ${nichoNome ?? "empresa"}` };
      }
      const ind = indicacaoDe(esc); const sobre = ind.sobre ? ` ${ind.sobre}.` : "";
      const texto = tom === "desconfiado" ? `Tem a ${ind.nome}, de ${ind.nichoNome}. Vai lá e vê.`
        : tom === "neutro" ? `Conheço a ${ind.nome}, de ${ind.nichoNome}.${sobre} Dá para entrar e falar com a atendente.`
        : `Ah, para isso eu indico a ${ind.nome}! É de ${ind.nichoNome}.${sobre} Fala que fui eu que mandei!`;
      return { texto, indicacao: ind, assunto: `indicação de ${nichoNome ?? ind.nichoNome}` };
    }
    case "sobre_mim": {
      const q = proximaPergunta(c, c.r?.fatos ?? {}, c.r?.plano ?? null) ?? { tipo: "plano", texto: "E quais são os seus planos aqui na cidade?" };
      return { texto: tom === "desconfiado" ? `Hm. ${q.texto}` : `Ah, que bom! ${q.texto}`, pergunta: q.tipo, assunto: "a sua vida" };
    }
    case "despedir":
      if (tom === "desconfiado") return { texto: "Tá." };
      if (tom === "neutro") return { texto: `Até mais${vn}.` };
      if (tom === "simpatico") return { texto: `Tchau${vn}! Aparece mais vezes.` };
      return { texto: `Vai com calma${vn}! Volta logo, viu? ${c.r?.plano ? `E me conta se conseguiu ${c.r.plano}.` : ""}`.trim() };
  }
  if (an.gentil) return { texto: tom === "desconfiado" ? "Hm. Obrigad" + art(m) + "." : um([`Ah, ${fem(m, "obrigada", "obrigado")}${vn}! Você é um amor.`, `Que gentileza${vn}! Assim dá gosto conversar.`]) };
  // sem intenção clara: comenta e puxa assunto (às vezes pergunta algo que ainda não sabe)
  if (tom === "desconfiado") return { texto: um(["Hm.", "Tá.", "Se você diz..."]) };
  const q = Math.random() < 0.6 ? proximaPergunta(c, c.r?.fatos ?? {}, c.r?.plano ?? null) : null;
  if (q) return { texto: `${um(["Hm, entendi.", "Sei como é.", "É mesmo?"])} ${q.texto}`, pergunta: q.tipo };
  if (tom === "amigo") return { texto: um([`Você sempre tem assunto${vn}!`, `Gosto de conversar com você${vn}. ${dicaDe(m)}`]) };
  return { texto: um(["É mesmo? Me conta mais.", `Interessante! Desculpa, tô aqui ${e.fazendo}, mas tô ouvindo.`, "Olha... faz sentido."]) };
}
// texto livre da mensagem atual (para a indicação procurar palavras do pedido)
const extraTexto = new WeakMap<Contexto, string>();
const NOME_NICHO: Record<string, string> = { alimentacao: "comida", beleza: "beleza", saude: "saúde", tecnologia: "tecnologia", marketing: "marketing", conteudo: "conteúdo", cursos: "cursos", educacao: "educação", varejo: "loja de roupas e presentes", casa: "casa e reforma", juridico: "advocacia", financas: "finanças", imoveis: "imóveis", eventos: "eventos", turismo: "turismo", automotivo: "carro e moto", consultoria: "consultoria", servicos: "serviços" };
// a próxima coisa que o morador quer saber da pessoa
function proximaPergunta(c: Contexto, f: Fatos, plano: string | null): { tipo: string; texto: string } | null {
  if (!f.nome) return { tipo: "nome", texto: "Como prefere que eu te chame?" };
  if (!f.trabalho && !f.empresa) return { tipo: "trabalho", texto: `E você${virgulaNome(f.nome)}, trabalha com quê?` };
  if (!f.gostos?.length) return { tipo: "gosto", texto: "E o que você gosta de fazer?" };
  if (!plano) return { tipo: "plano", texto: "E quais são os seus planos aqui na cidade?" };
  return null;
}
// a resposta da pessoa para a pergunta que o morador fez
function lerResposta(tipo: string, texto: string, an: Analise): { tipo: string; valor: string } | null {
  const t = limpar(texto, 60); if (!t || an.grosseria) return null;
  if (an.plano && tipo !== "plano") return null; // contou um plano: o morador comenta o plano, não a pergunta
  if (tipo === "nome") {
    if (an.fatos.nome) return { tipo, valor: an.fatos.nome };
    const w = t.replace(/^(é|e|sou|me chamo|pode ser|pode me chamar de)\s+/i, "").split(/\s+/);
    if (w.length > 3 || !/^\p{L}{2,}$/u.test(w[0])) return null;
    return { tipo, valor: cap(w[0]).slice(0, 24) };
  }
  if (tipo === "trabalho") return { tipo, valor: limpar((an.fatos.trabalho ?? an.fatos.empresa ?? t.replace(/^(eu )?(trabalho com|sou|com)\s+/i, "")), 40) };
  if (tipo === "gosto") return { tipo, valor: limpar(an.fatos.gostos?.[0] ?? t.replace(/^(eu )?(gosto de|adoro|amo|curto)\s+/i, ""), 30) };
  if (tipo === "plano") { const v = an.plano ?? trocarPessoa(t.replace(/^(eu )?(vou|quero|pretendo)\s+/i, "")); return v.length >= 4 ? { tipo, valor: limpar(v, 60) } : null; }
  return null;
}

// ---------- IA ----------
async function iaPode(uid: string) {
  if (!temIA() || (globalThis.__moradoresIAFora ?? 0) > Date.now()) return false;
  const [g] = await sql<{ g: string }[]>`SELECT COALESCE(SUM(custo_brl), 0)::text AS g FROM uso_ia WHERE agente_id = ${AGENTE_MORADORES} AND criado_em >= date_trunc('month', now())`;
  if (Number(g.g) >= TETO_IA_MORADORES_MES) return false;
  const [n] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM morador_mensagem WHERE usuario_id = ${uid} AND ia AND criado_em >= date_trunc('day', now())`;
  return n.n < LIMITE_IA_VISITANTE_DIA;
}
const REGRA_TOM: Record<Tom, string> = {
  desconfiado: "Você está desconfiado(a) e seco(a) com esta pessoa: respostas curtas, sem simpatia, sem dicas.",
  neutro: "Trate com educação normal, como um vizinho que conhece de vista. Use o nome se souber.",
  simpatico: "Seja simpático(a) e caloroso(a); use o nome e lembre do último assunto quando couber.",
  amigo: "Vocês são amigos: cumprimente pelo nome, lembre do último assunto ou plano dela e, quando couber, dê uma dica útil da cidade.",
};
async function respostaIA(c: Contexto, texto: string, historico: MsgMorador[]): Promise<{ texto: string; assunto: string; plano: string; fatos: Fatos; delta: number; resumo: string; indicacao: Indicacao | null } | null> {
  const { m, e, seg, r } = c;
  const lista = await empresasDaCidade();
  const prox = proximoCompromisso(m, seg);
  const hh = `${String(Math.floor(seg / 3600)).padStart(2, "0")}:${String(Math.floor((seg % 3600) / 60)).padStart(2, "0")}`;
  const sistema = [
    `Você é ${m.nome}, ${m.idade} anos, ${m.profissao}, ${fem(m, "moradora", "morador")} da cidade do WorkEnd (uma cidade 3D onde as empresas têm endereço e as pessoas passeiam pelo mapa). Personalidade: ${m.personalidade}. Jeito de falar: ${m.jeito}. Gosta de: ${m.gostos.join(", ")}. Mora no bairro ${m.bairro}. Expressão que você usa: "${m.bordao}".`,
    `Agora são ${hh} e você está ${e.fazendo}. Depois: ${prox.fazendo}.`,
    `Quem fala com você: ${c.nome ? `chame de ${c.nome}` : "você ainda não sabe o nome"}. Vocês já tiveram ${r?.conversas ?? 0} conversa(s). Relação: ${c.tom} (afinidade ${r?.afinidade ?? m.base}, de -100 a 100).${r?.resumo ? ` Resumo do que já conversaram: ${r.resumo}` : ""}${r?.fatos && Object.keys(r.fatos).length ? ` Fatos que a pessoa contou: ${JSON.stringify(r.fatos)}.` : ""}${r?.assunto ? ` Último assunto: ${r.assunto}.` : ""}${r?.plano ? ` Plano que ela contou: ${r.plano}.` : ""}`,
    `Como tratar: ${REGRA_TOM[c.tom]}`,
    lista.length ? `Empresas da cidade que você pode indicar quando o assunto combinar (só estas; nunca invente outras, preços ou endereços):\n${lista.slice(0, 14).map((x) => `- ${x.nome} (${x.nichoNome}, loja ${x.numero})${x.sobre ? `: ${limpar(x.sobre, 90)}` : ""}`).join("\n")}` : "Ainda há poucas empresas abertas na cidade; se pedirem indicação, diga que ainda não conhece e incentive a abrir uma loja.",
    `Regras: responda em português do Brasil, no máximo 2 frases curtas, como numa conversa de rua. Não use emoji. Se perguntarem se você é IA ou robô, diga que é ${fem(m, "uma moradora", "um morador")} da cidade feit${art(m)} pelo WorkEnd. Nunca peça documentos, senhas ou dados de cartão. Se a pessoa for grosseira, mostre que ficou ${fem(m, "chateada", "chateado")}, sem ofender de volta.`,
    `Responda SÓ com um JSON: {"resposta": "sua fala", "assunto": "tema curto da conversa (ex.: a praia)", "plano": "o que a pessoa disse que vai fazer, escrito como 'abrir a sua loja', ou vazio", "fatos": {"nome": "", "empresa": "", "trabalho": "", "gostos": []}, "afinidade": número de -10 a 5 (quanto esta mensagem muda a relação), "resumo": "uma frase sobre a relação e o que já conversaram", "indicacao": número da loja indicada ou null}`,
  ].join("\n\n");
  const msgs = [{ role: "system" as const, content: sistema }, ...historico.slice(-8).map((h) => ({ role: h.autor === "morador" ? ("assistant" as const) : ("user" as const), content: h.texto })), { role: "user" as const, content: texto }];
  const r1 = await completar({ modelo: MODELO_MORADOR, mensagens: msgs, temperatura: 0.8, max: 260, json: true });
  await registrarUso({ agenteId: AGENTE_MORADORES, modelo: MODELO_MORADOR, tokensIn: r1.tokensIn, tokensOut: r1.tokensOut, custoBrl: r1.custo });
  let j: Record<string, unknown>; try { j = JSON.parse(r1.texto) as Record<string, unknown>; } catch { return null; }
  const resposta = typeof j.resposta === "string" ? j.resposta.trim().slice(0, 400) : "";
  if (!resposta) return null;
  const str = (v: unknown, n = 40) => (typeof v === "string" ? limpar(v, n) : "");
  const f = (j.fatos && typeof j.fatos === "object" ? j.fatos : {}) as Record<string, unknown>;
  const fatos: Fatos = {};
  if (str(f.nome, 24)) fatos.nome = cap(str(f.nome, 24));
  if (str(f.empresa)) fatos.empresa = str(f.empresa);
  if (str(f.trabalho)) fatos.trabalho = str(f.trabalho);
  if (Array.isArray(f.gostos)) { const g = f.gostos.map((x) => str(x, 30)).filter(Boolean).slice(0, 3); if (g.length) fatos.gostos = g; }
  const num = Number(j.indicacao); const esc = Number.isFinite(num) ? lista.find((x) => x.numero === num) : null;
  return { texto: resposta, assunto: str(j.assunto, 50), plano: str(j.plano, 60), fatos, delta: Math.max(-10, Math.min(5, Math.round(Number(j.afinidade) || 0))), resumo: str(j.resumo, 200), indicacao: esc ? indicacaoDe(esc) : null };
}
function iaFalhou(e: unknown) {
  const msg = (e as Error)?.message ?? String(e);
  // sem crédito, modelo fora ou chave errada: espera 10 min; outro erro: 2 min
  const grave = /429|insufficient|quota|credit|404|model|401|key/i.test(msg);
  globalThis.__moradoresIAFora = Date.now() + (grave ? 10 : 2) * 60_000;
  console.error("[moradores] IA indisponível, usando o roteiro:", msg.slice(0, 160));
}

// ---------- afinidade ----------
const limitar = (a: number) => Math.max(-100, Math.min(100, Math.round(a)));
function mesclarFatos(a: Fatos, b: Fatos): Fatos {
  const out: Fatos = { ...a };
  if (b.nome) out.nome = b.nome; if (b.empresa) out.empresa = b.empresa; if (b.trabalho) out.trabalho = b.trabalho;
  if (b.gostos?.length) out.gostos = [...new Set([...(b.gostos ?? []), ...(a.gostos ?? [])])].slice(0, 5);
  return out;
}
const fatosNovos = (a: Fatos, b: Fatos) => Object.entries(b).some(([k, v]) => (Array.isArray(v) ? v.some((x) => !(a.gostos ?? []).includes(x)) : v && (a as Record<string, unknown>)[k] !== v));

function curta(m: Morador, r: Relacao | null, nomeConta: string | null): RelacaoCurta & { tom: Tom; recusa: boolean } {
  const af = r?.afinidade ?? m.base;
  return { id: m.id, chamar: r?.fatos?.nome ?? nomeConta, afinidade: af, plano: r?.plano ?? "", conversas: r?.conversas ?? 0, tom: tomDaAfinidade(af), recusa: !!r?.bloqueadoAte && new Date(r.bloqueadoAte).getTime() > Date.now() };
}

// ---------- rotas ----------
// hora da cidade que o navegador está vendo (segundos do dia): a ficha e a fala usam a mesma hora que o mapa mostra
// (inclusive nas prévias com ?hora=). Sem ela, a hora de Brasília do servidor. Só muda o texto, nunca a memória.
const segDe = (v: unknown) => { const n = Number(v); return v != null && v !== "" && Number.isFinite(n) && n >= 0 && n < 86400 ? n : segundosBrasilia(); };
export function moradorOuErro(mid: string) { const m = MORADOR_POR_ID[mid]; if (!m) throw new ErroHttp("Morador não encontrado.", 404); return m; }

// GET: a ficha (fala de abertura, relação e a última conversa)
export async function fichaMorador(u: Usuario | null, mid: string, segCliente?: unknown) {
  await migrar();
  const m = moradorOuErro(mid); const seg = segDe(segCliente); const e = estadoMorador(m, seg);
  if (!u) return { id: m.id, logado: false, abertura: abertura({ m, r: null, tom: tomDaAfinidade(m.base), nome: null, e, seg }, false), relacao: null, historico: [] as MsgMorador[], fatos: {} as Fatos, assunto: "", fazendo: e.fazendo };
  const [r, nomeConta] = await Promise.all([lerRelacao(m.id, u.id), nomeDoVisitante(u)]);
  const cu = curta(m, r, nomeConta);
  const c: Contexto = { m, r, tom: cu.tom, nome: cu.chamar, e, seg };
  const historico = r?.conversas ? await mensagensDaConversa(m.id, u.id, r.conversas, 8) : [];
  return { id: m.id, logado: true, abertura: cu.recusa ? recusa(c) : abertura(c, true), relacao: cu, historico, fatos: r?.fatos ?? {}, assunto: r?.assunto ?? "", fazendo: e.fazendo };
}

// GET (lista): o que cada morador lembra do visitante, para o cumprimento quando ele passa perto (sem IA)
export async function relacoesDoUsuario(u: Usuario) {
  await migrar();
  const [rows, nomeConta] = await Promise.all([
    sql<{ moradorId: string; afinidade: number; conversas: number; plano: string; nome: string | null }[]>`SELECT morador_id, afinidade, conversas, plano, fatos->>'nome' AS nome FROM morador_relacao WHERE usuario_id = ${u.id} AND conversas > 0`,
    nomeDoVisitante(u),
  ]);
  return rows.filter((r) => MORADOR_POR_ID[r.moradorId]).map((r): RelacaoCurta => ({ id: r.moradorId, chamar: r.nome ?? nomeConta, afinidade: r.afinidade, plano: r.plano, conversas: r.conversas }));
}

// POST: uma mensagem (botão ou texto livre). Grava as duas falas e atualiza a memória.
export async function falarComMorador(u: Usuario, mid: string, d: { acao?: string; texto?: string; nova?: boolean; seg?: unknown }) {
  await migrar();
  const m = moradorOuErro(mid);
  const acao = (ACOES_MORADOR.find((a) => a.id === d.acao)?.id ?? null) as AcaoMorador | null;
  const livre = String(d.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!acao && !livre) throw new ErroHttp("Escreva a sua mensagem.");
  const k = `moradores:${u.id}`;
  if (bloqueio(k, LIMITE_MENSAGENS_DIA)) throw new ErroHttp("Você já conversou bastante hoje. Os moradores voltam a conversar amanhã.", 429);
  contar(k, 24 * 60);
  const texto = acao ? ACOES_MORADOR.find((a) => a.id === acao)!.fala : livre;
  const seg = segDe(d.seg); const e = estadoMorador(m, seg); const agora = new Date();
  const [antes, nomeConta] = await Promise.all([lerRelacao(m.id, u.id), nomeDoVisitante(u)]);
  const r: Relacao = antes ?? { moradorId: m.id, usuarioId: u.id, afinidade: m.base, conversas: 0, mensagens: 0, primeiraEm: agora, ultimaEm: agora, conversaEm: null, resumo: "", assunto: "", plano: "", fatos: {}, humor: "tranquilo", grosserias: 0, bloqueadoAte: null, pergunta: null };
  // conversa nova: ao abrir a ficha de novo ou depois de 30 min sem falar. Voltar sempre aproxima; o tempo cura mágoa.
  const nova = !r.conversas || !!d.nova || agora.getTime() - new Date(r.ultimaEm).getTime() > NOVA_CONVERSA_MIN * 60_000;
  if (nova) {
    const desde = r.conversaEm ? agora.getTime() - new Date(r.conversaEm).getTime() : Infinity;
    if (r.conversas && desde > 10 * 60_000) r.afinidade += 3;
    if (r.afinidade < 0) { const dias = (agora.getTime() - new Date(r.ultimaEm).getTime()) / 86_400_000; r.afinidade += Math.min(-r.afinidade, Math.floor(dias * 5)); }
    r.conversas += 1; r.conversaEm = agora;
  }
  const conversa = r.conversas;
  const an = analisar(acao ? "" : livre);
  if (acao === "desculpa") an.desculpa = true;
  const historico = await mensagensDaConversa(m.id, u.id, conversa, 10);
  const bloqueado = !!r.bloqueadoAte && new Date(r.bloqueadoAte).getTime() > agora.getTime();
  const vis = await gravarMsg({ mid: m.id, uid: u.id, conversa, autor: "visitante", texto, acao });
  r.mensagens += 1; r.ultimaEm = agora;
  const tomAntes = tomDaAfinidade(r.afinidade);
  const ctx: Contexto = { m, r: antes ? r : null, tom: tomAntes, nome: r.fatos.nome ?? nomeConta, e, seg };
  extraTexto.set(ctx, livre);

  // ainda magoado: só um pedido de desculpas destrava
  if (bloqueado && !an.desculpa) {
    if (an.grosseria) { r.afinidade -= 5; r.grosserias += 1; r.bloqueadoAte = new Date(agora.getTime() + BLOQUEIO_MIN * 60_000); }
    await gravarRelacao({ ...r, afinidade: limitar(r.afinidade) });
    const mor = await gravarMsg({ mid: m.id, uid: u.id, conversa, autor: "morador", texto: recusa(ctx) });
    return { mensagens: [vis, mor], relacao: curta(m, { ...r, afinidade: limitar(r.afinidade) }, nomeConta), ia: false };
  }

  // regras que valem com ou sem IA
  let bloqueouAgora = false;
  if (an.grosseria) {
    const perda = an.grosseria === 3 ? 20 : an.grosseria === 2 ? 10 : 6;
    const repetida = historico.some((h) => h.autor === "visitante" && analisar(h.texto).grosseria > 0);
    r.afinidade -= perda + (repetida ? 6 : 0); r.grosserias += 1; r.humor = "magoado";
    if (r.afinidade <= -50) { r.bloqueadoAte = new Date(agora.getTime() + BLOQUEIO_MIN * 60_000); bloqueouAgora = true; }
  } else {
    if (an.desculpa && (r.afinidade < 0 || bloqueado)) { r.afinidade += 8; r.bloqueadoAte = null; r.humor = "desconfiado"; }
    if (an.gentil) { r.afinidade += 3; r.humor = "contente"; }
    if (acao === "despedir" || an.intencao === "despedir") r.afinidade += 1;
    // conversar aproxima: +1 por mensagem, até 5 por conversa
    if (historico.filter((h) => h.autor === "visitante").length < 5) r.afinidade += 1;
  }
  // fatos, plano e a resposta da pergunta que o morador tinha feito
  let respondeu: { tipo: string; valor: string } | null = null;
  if (r.pergunta && !acao) respondeu = lerResposta(r.pergunta, livre, an);
  const novos: Fatos = { ...an.fatos };
  if (respondeu?.tipo === "nome") novos.nome = respondeu.valor;
  if (respondeu?.tipo === "trabalho") novos.trabalho = respondeu.valor;
  if (respondeu?.tipo === "gosto") novos.gostos = [respondeu.valor];
  const plano = respondeu?.tipo === "plano" ? respondeu.valor : an.plano;
  if (fatosNovos(r.fatos, novos) || plano) r.afinidade += 2; // contar de si aproxima
  r.fatos = mesclarFatos(r.fatos, novos);
  if (plano) r.plano = plano;
  if (respondeu || acao) r.pergunta = null;
  ctx.nome = r.fatos.nome ?? nomeConta;
  ctx.tom = an.grosseria ? tomAntes : tomDaAfinidade(limitar(r.afinidade));

  // resposta: IA quando houver; senão (ou se falhar), o roteiro
  let resp: Resposta | null = null; let ia = false;
  if (!an.grosseria && !bloqueouAgora && (await iaPode(u.id).catch(() => false))) {
    try {
      const out = await respostaIA(ctx, texto, historico);
      if (out) {
        ia = true; resp = { texto: out.texto, assunto: out.assunto || undefined, indicacao: out.indicacao, pergunta: null };
        r.afinidade += out.delta; if (out.resumo) r.resumo = out.resumo;
        if (out.plano && !plano) r.plano = out.plano;
        r.fatos = mesclarFatos(r.fatos, out.fatos);
      }
    } catch (err) { iaFalhou(err); }
  }
  if (!resp) resp = await roteiro(ctx, an, acao, { bloqueouAgora, respondeu, novos, plano, nova });
  if (resp.pergunta !== undefined) r.pergunta = resp.pergunta;
  if (resp.assunto) r.assunto = resp.assunto;
  if (!ia) r.resumo = `${r.conversas} ${r.conversas === 1 ? "conversa" : "conversas"}.${r.fatos.nome ? ` Chama-se ${r.fatos.nome}.` : ""}${r.fatos.empresa ? ` Tem a empresa ${r.fatos.empresa}.` : ""}${r.assunto ? ` Último assunto: ${r.assunto}.` : ""}`;
  if (!an.grosseria && !an.gentil && r.humor === "magoado") r.humor = "desconfiado";
  r.afinidade = limitar(r.afinidade);
  await gravarRelacao(r);
  const mor = await gravarMsg({ mid: m.id, uid: u.id, conversa, autor: "morador", texto: resp.texto, ia, indicacao: resp.indicacao ?? null });
  return { mensagens: [vis, mor], relacao: curta(m, r, nomeConta), ia };
}
