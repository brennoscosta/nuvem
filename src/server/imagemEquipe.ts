// Imagens da equipe do cliente (21/11/2026, pedido do dono: "pedindo uma foto a um agente designer da equipe, ele sabe
// fazer?"). A geração (src/server/imagens.ts, gpt-image-2) só existia no escritório interno da Nuvem. Agora:
//  - o dono pede na conversa da Minha equipe ("faz uma foto do nosso pão de queijo para o Instagram"). ehPedidoDeImagem
//    reconhece o pedido pelas palavras, sem IA: o custo tem de aparecer antes e a OpenAI pode estar fora;
//  - quem gera é quem tem imagem no cargo: os especialistas com "chatgpt_imagem" (data/especialistas.ts: design gráfico,
//    social media, criação, motion e web designer) ou um profissional sob medida com cargo de design, arte ou social media.
//    Pedido feito a outra pessoa (o CEO, a atendente) passa ao designer por uma conversa interna, como na delegação;
//  - a resposta é um cartão com o custo (custoImagemUnidades: custoImagemBRL convertido por unidadesDoCusto) e o saldo do
//    mês; só depois de o dono confirmar a imagem é gerada, em segundo plano, e entregue na mesma conversa. Sem saldo, o
//    cartão mostra os pacotes de unidades que já existem (/app/creditos). Sem ninguém de imagem, indica a vitrine de agentes;
//  - as unidades saem só depois da imagem pronta e gravada (registrarUso → debitarUsoIA): falha da OpenAI não desconta;
//  - a imagem fica no banco (imagem_equipe, migração 0052) em WebP, como a logomarca e as fotos da vitrine: /app/uploads é
//    apagado a cada publicação. Referências opcionais: a logomarca do lote e a foto de um produto da vitrine;
//  - limites: o saldo de unidades (teto da empresa), IMAGENS_POR_HORA por empresa e uma imagem por vez.
import { sql, migrar, id } from "./db";
import { gravarMensagem, gravarEvento, registrarUso } from "./agentes";
import { temIA } from "./motor";
import { FORMATOS, MODELO_IMAGEM, custoImagemBRL, custoImagemUnidades, gerarImagemBytes, type Formato } from "./imagens";
import { PACOTES_UNIDADES, VALOR_UNIDADE_BRL, saldoIA, unidadesDoCusto } from "./unidadesIA";
import { logoDoTerreno, type Terreno } from "./terrenos";
import { MAX_FOTO, MAX_PRODUTOS } from "./vitrine";
import type { Usuario } from "./usuarios";
import { ESPECIALISTA_POR_ID } from "@/office/data/especialistas";
import { ehSede } from "@/office/data/sedes";
import { ehQuiosque } from "@/office/data/quiosques";
import { nomeNicho } from "@/office/data/mundo";

export const IMAGENS_POR_HORA = 5; // por empresa: evita uma sequência de imagens por engano (cada uma é ~1/8 do mês)
const MINUTOS_GERANDO = 5; // "gerando" mais antigo que isso (o servidor reiniciou no meio) pode ser tentado de novo
const QUALIDADE_WEBP = 86;
export const MSG_IMAGEM_INDISPONIVEL = "A geração de imagens está indisponível no momento.";

export class ErroImagem extends Error { constructor(msg: string, public status = 400) { super(msg); } }

type Status = "proposta" | "gerando" | "pronta" | "falhou" | "cancelada" | "sem_designer";
interface Linha {
  id: string; empresaId: string; usuarioId: string; pedidoAgenteId: string; agenteId: string | null; donoMensagemId: string | null; mensagemId: string | null;
  entregaId: string | null; conversaInternaId: string | null; pedido: string; prompt: string; formato: Formato; refLogo: boolean; refProduto: string | null;
  status: Status; unidades: number; mime: string | null; largura: number | null; altura: number | null; tamanho: number | null; produtoVitrine: string | null;
  erro: string | null; atualizadoEm: Date; geradaEm: Date | null;
}
const COLUNAS = () => sql`id, empresa_id, usuario_id, pedido_agente_id, agente_id, dono_mensagem_id, mensagem_id, entrega_id, conversa_interna_id, pedido, prompt,
  formato, ref_logo, ref_produto, status, unidades, mime, largura, altura, tamanho, produto_vitrine, erro, atualizado_em, gerada_em`;
type AgenteCfg = { id: string; nome: string; funcao: string; config: { membroId?: string; papel?: string; especialista?: string | null } | null };

// ---------- o pedido ----------
const sem = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const OBJETO = /\b(fotos?|fotografias?|imagem|imagens|artes?|ilustrac(ao|oes)|desenhos?|banners?|posts?|postagem|postagens|stor(y|ies)|capas?|flyers?|panfletos?|cartaz(es)?|criativos?|thumbnails?|logos?|logotipos?|logomarcas?|mockups?|estampas?)\b/;
const VERBO = /\b(faz|faca|fazer|faria|cria|crie|criar|gera|gere|gerar|desenha|desenhe|desenhar|monta|monte|montar|produz|produza|produzir|elabora|elabore|ilustra|ilustre|quero|queria|preciso|precisava|precisamos|manda|mande)\b/;
// conversa sobre imagem que não é pedido de gerar: dicas, legenda, texto, planejamento, vídeo, perguntas sobre o que já existe
const NAO = /\b(como (eu )?(faco|fazer|tiro|tirar|crio|criar|edito|editar)|dicas?|tirar|tirei|legendas?|copy|escrev\w*|redij\w*|redig\w*|roteiros?|calendario|cronograma|planejamento|plano de|estrategias?|ideias?|relatorio|planilha|e-?mails?|resumo|analis\w*|quantas?|quanto|curtidas|seguidores|hashtags?|engajamento|alcance|apag\w*|exclu\w*|remov\w*|videos?)\b/;
export function ehPedidoDeImagem(texto: string) {
  const t = sem(texto).replace(/\s+/g, " ").trim();
  if (!t || t.length > 1500 || NAO.test(t) || !OBJETO.test(t)) return false;
  return VERBO.test(t) || (t.length <= 160 && /^(uma?|o|a)?\s*(foto|imagem|arte|banner|post|flyer|panfleto|cartaz|capa|story)\b/.test(t));
}
export function formatoDoPedido(texto: string): Formato {
  const t = sem(texto);
  if (/\b(stor(y|ies)|reels?|vertical|status|tiktok|9 ?[:x] ?16|retrato)\b/.test(t)) return "vertical";
  if (/\b(banners?|capas?|horizontal|youtube|site|paisagem|16 ?[:x] ?9|cabecalho|thumbnails?)\b/.test(t)) return "horizontal";
  return "quadrado";
}
const ehFoto = (pedido: string) => /\bfoto|fotograf/.test(sem(pedido)) || !ehArte(pedido);
const ehArte = (pedido: string) => /\b(artes?|banners?|posts?|postagem|postagens|stor(y|ies)|capas?|flyers?|panfletos?|cartaz(es)?|criativos?|logos?|logotipos?|logomarcas?|estampas?|ilustrac(ao|oes)|desenhos?|thumbnails?|mockups?)\b/.test(sem(pedido));
const oQue = (pedido: string) => (/\bfoto|fotograf/.test(sem(pedido)) ? "a foto" : ehArte(pedido) ? "a arte" : "a imagem");

// ---------- quem gera ----------
// a ordem de quem recebe o pedido quando o dono pediu a outra pessoa (o primeiro que a empresa tiver)
const ORDEM = ["designgrafico-designer", "designgrafico-gerente", "social-media", "social-gerente", "criacao-gerente", "designgrafico-motion", "webdesign-designer"];
const CARGO_IMAGEM = /design|arte|ilustr|fotograf|social ?media|criativ|criacao/;
export function fazImagem(a: Pick<AgenteCfg, "funcao" | "config">) {
  const c = a.config ?? {};
  if (c.papel === "ceo" || c.papel === "atendente") return false;
  const esp = c.especialista ? ESPECIALISTA_POR_ID[c.especialista] : null;
  return esp ? esp.apis.includes("chatgpt_imagem") : CARGO_IMAGEM.test(sem(a.funcao));
}
const pesoImagem = (a: AgenteCfg) => { const i = ORDEM.indexOf(a.config?.especialista ?? ""); return i < 0 ? ORDEM.length : i; };
async function quemFazImagem(empId: string, falouCom: string) {
  const ags = await sql<AgenteCfg[]>`SELECT id, nome, funcao, config FROM agente WHERE empresa_id = ${empId} AND ativo ORDER BY criado_em`;
  const eu = ags.find((a) => a.id === falouCom);
  if (eu && fazImagem(eu)) return eu;
  return ags.filter(fazImagem).sort((a, b) => pesoImagem(a) - pesoImagem(b))[0] ?? null;
}
async function agentesPorId(ids: string[]) {
  const lista = ids.length ? await sql<AgenteCfg[]>`SELECT id, nome, funcao, config FROM agente WHERE id = ANY(${sql.array(ids)})` : [];
  return new Map(lista.map((a) => [a.id, a]));
}

// ---------- referências e prompt ----------
const STOP = new Set(["de", "da", "do", "das", "dos", "com", "sem", "para", "pra", "e", "o", "a", "os", "as", "um", "uma", "no", "na"]);
const palavrasDe = (s: string) => sem(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
async function produtosComFoto(usuarioId: string) {
  return sql<{ id: string; nome: string }[]>`SELECT id, nome FROM produto WHERE usuario_id = ${usuarioId} AND foto IS NOT NULL ORDER BY ordem, criado_em LIMIT ${MAX_PRODUTOS}`;
}
// o produto da vitrine citado no pedido ("pão de queijo"): todas as palavras do nome aparecem no pedido
function produtoNoPedido(pedido: string, produtos: { id: string; nome: string }[]) {
  const p = ` ${palavrasDe(pedido).join(" ")} `;
  let melhor: { id: string; nome: string } | null = null, nota = 0;
  for (const x of produtos) {
    const ws = palavrasDe(x.nome); if (!ws.length) continue;
    const bate = ws.filter((w) => p.includes(` ${w} `) || p.includes(` ${w}s `)).length;
    if (bate === ws.length && bate > nota) { melhor = x; nota = bate; }
  }
  return melhor;
}
async function dadosDaEmpresa(t: Terreno, empId: string) {
  const [e] = await sql<{ sobre: string }[]>`SELECT sobre FROM empresa WHERE id = ${empId}`;
  return { empresa: t.empresaNome, nicho: nomeNicho(t.nicho), cor: t.cor, sobre: (e?.sobre ?? "").replace(/\s+/g, " ").trim() };
}
function montarPrompt(d: { pedido: string; empresa: string; nicho: string; cor: string; sobre: string; formato: Formato; produto: string | null; logo: boolean }) {
  const foto = ehFoto(d.pedido);
  const textoExato = d.pedido.match(/["“”]([^"“”]{2,80})["“”]/)?.[1];
  return [
    `${foto ? "Fotografia" : "Arte"} para a empresa "${d.empresa}" (${d.nicho}).`,
    `Pedido do dono: "${d.pedido.replace(/\s+/g, " ").slice(0, 600)}".`,
    `Formato: ${FORMATOS[d.formato].nome.toLowerCase()}.`,
    d.sobre ? `Sobre a empresa: ${d.sobre.slice(0, 400)}` : "",
    d.produto ? `A ${d.logo ? "primeira " : ""}imagem de referência é a foto real do produto "${d.produto}": mantenha o produto fiel a ela (forma, cor, textura e embalagem).` : "",
    d.logo ? `A ${d.produto ? "segunda " : ""}imagem de referência é a logomarca da empresa: aplique-a pequena, legível e sem distorcer, num canto.` : "",
    foto ? "Estilo: fotografia profissional, luz natural suave, foco nítido no assunto, fundo limpo e cores fiéis, pronta para postar."
      : `Estilo: arte gráfica limpa e moderna, com a cor da marca (${d.cor}) em destaque, hierarquia clara e acabamento profissional.`,
    textoExato ? `Escreva exatamente o texto "${textoExato}", legível e sem erros de ortografia, e nenhum outro texto.` : "Sem texto escrito na imagem.",
    "Não use marcas de terceiros, marca d'água nem pessoas reconhecíveis.",
  ].filter(Boolean).join("\n");
}
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// ---------- textos ----------
function textoSemDesigner(t: Terreno) {
  if (ehQuiosque(t.chave)) return "Imagem pronta é trabalho de designer, e no quiosque a equipe é só a atendente do balcão. Num lote dá para contratar um designer gráfico ou um social media: aí é só pedir aqui que a imagem sai em cerca de um minuto, no formato certo e com a sua logomarca. O custo aparece antes, em unidades de IA, e você confirma.";
  if (ehSede(t.chave)) return "Imagem pronta é trabalho de designer, e esta sede ainda não tem ninguém de design na equipe. Com um designer gráfico ou um social media na equipe, é só pedir aqui que a imagem sai pronta, com o custo mostrado antes.";
  return `Imagem pronta é trabalho de designer, e a ${t.empresaNome} ainda não tem ninguém de design na equipe. Contratando um designer gráfico ou um social media na vitrine de agentes, é só pedir aqui que a imagem sai em cerca de um minuto, no formato certo para o Instagram, com a sua logomarca e as fotos dos seus produtos como referência. Você paga uma vez e a pessoa fica na equipe enquanto o lote estiver ativo; o custo de cada imagem aparece antes, em unidades de IA, e você confirma.`;
}
function textoProposta(d: { direto: boolean; quem: AgenteCfg; pedido: string; formato: Formato; produto: string | null; disponivel: boolean }) {
  const oq = oQue(d.pedido), fmt = FORMATOS[d.formato].nome.toLowerCase();
  if (!d.disponivel) return `${MSG_IMAGEM_INDISPONIVEL} ${d.direto ? "Assim que voltar, faço" : `Assim que voltar, ${d.quem.nome} (${d.quem.funcao}) faz`} ${oq} no formato ${fmt}. Nada foi descontado: quando quiser, toque em Tentar de novo aqui embaixo. O custo aparece antes de gerar.`;
  if (d.direto) return `Faço, sim! Vou criar ${oq} no formato ${fmt}${d.produto ? `, com a foto de "${d.produto}" da vitrine como referência` : ""}. Antes de começar, confira o custo aqui embaixo e confirme.`;
  return `Imagem é com ${d.quem.nome} (${d.quem.funcao}), aqui da equipe. Confira o custo aqui embaixo: confirmando, eu passo o pedido e ${d.quem.nome} faz ${oq} no formato ${fmt}${d.produto ? `, com a foto de "${d.produto}" da vitrine como referência` : ""}.`;
}

// ---------- o cartão que a tela mostra ----------
export interface CartaoImagem {
  id: string; tipo: "proposta" | "entrega"; status: Status; atualizadoEm: string;
  quem: { membroId: string; nome: string; cargo: string } | null; passou: boolean; // outra pessoa passou o pedido ao designer
  pedido: string; formato: Formato; formatos: { id: Formato; nome: string; unidades: number }[]; unidades: number;
  saldo: number | null; // unidades da empresa agora (null: empresa fora da cobrança)
  logo: string | null; usarLogo: boolean; produtos: { id: string; nome: string; foto: string }[]; produto: string | null;
  pacotes: { id: string; unidades: number; creditos: number }[] | null; // pedido aberto: a tela mostra se o saldo não paga o formato escolhido
  imagem: { url: string; baixar: string; largura: number | null; altura: number | null; tamanho: number | null } | null;
  vitrine: { produtos: { id: string; nome: string }[]; usadaEm: string | null } | null; // usar como foto de produto (só o titular)
  contratar: { url: string; rotulo: string } | null; // empresa sem ninguém de imagem
  aviso: string | null; // por que não saiu
}
type CtxLeitura = { u: Usuario; t: Terreno; empId: string };
export interface CtxImagem extends CtxLeitura { teto: () => Promise<{ gasto: number; teto: number }> }
const FORMATOS_LISTA = () => (Object.keys(FORMATOS) as Formato[]).map((f) => ({ id: f, nome: FORMATOS[f].nome, unidades: custoImagemUnidades(f) }));
const velho = (l: Pick<Linha, "status" | "atualizadoEm">) => l.status === "gerando" && Date.now() - new Date(l.atualizadoEm).getTime() > MINUTOS_GERANDO * 60_000;

async function montarCartoes(c: CtxLeitura, linhas: Linha[]) {
  const mapa = new Map<string, CartaoImagem>();
  if (!linhas.length) return mapa;
  const s = await saldoIA(c.empId);
  const saldo = s.cobrada ? s.total : null;
  const abertas = linhas.some((l) => l.status === "proposta" || l.status === "falhou" || velho(l));
  const comFoto = abertas ? await produtosComFoto(c.t.usuarioId) : [];
  const titular = c.u.id === c.t.usuarioId;
  const todos = titular && linhas.some((l) => l.status === "pronta") ? await sql<{ id: string; nome: string }[]>`SELECT id, nome FROM produto WHERE usuario_id = ${c.t.usuarioId} ORDER BY ordem, criado_em` : [];
  const ags = await agentesPorId([...new Set(linhas.map((l) => l.agenteId).filter((x): x is string => !!x))]);
  const lote = encodeURIComponent(c.t.chave);
  for (const l of linhas) {
    const ag = l.agenteId ? ags.get(l.agenteId) : null;
    const status: Status = velho(l) ? "falhou" : l.status;
    const unidades = status === "pronta" ? l.unidades : custoImagemUnidades(l.formato);
    const v = l.geradaEm ? Math.floor(new Date(l.geradaEm).getTime() / 1000) : 0;
    const base: CartaoImagem = {
      id: l.id, tipo: "proposta", status, atualizadoEm: new Date(l.atualizadoEm).toISOString(),
      quem: ag ? { membroId: ag.config?.membroId ?? "", nome: ag.nome, cargo: ag.funcao } : null, passou: !!l.agenteId && l.agenteId !== l.pedidoAgenteId,
      pedido: l.pedido, formato: l.formato, formatos: FORMATOS_LISTA(), unidades, saldo,
      logo: c.t.temLogo ? `/api/terrenos/${lote}/logo` : null, usarLogo: l.refLogo,
      produtos: comFoto.map((p) => ({ id: p.id, nome: p.nome, foto: `/api/workend/vitrine/foto/${p.id}` })), produto: l.refProduto,
      pacotes: (status === "proposta" || status === "falhou") && saldo !== null ? PACOTES_UNIDADES.map((p) => ({ id: p.id, unidades: p.unidades, creditos: p.creditos })) : null,
      imagem: status === "pronta" ? { url: `/api/workend/equipe/imagem/${l.id}?lote=${lote}&v=${v}`, baixar: `/api/workend/equipe/imagem/${l.id}?lote=${lote}&v=${v}&baixar=1`, largura: l.largura, altura: l.altura, tamanho: l.tamanho } : null,
      vitrine: null,
      contratar: status !== "sem_designer" ? null : ehQuiosque(c.t.chave) ? { url: "/mundo", rotulo: "Ver lotes no mapa" } : ehSede(c.t.chave) ? null : { url: `/mundo?lote=${lote}&montar=contratar`, rotulo: "Contratar designer na vitrine" },
      aviso: status === "falhou" ? (l.erro ?? `${MSG_IMAGEM_INDISPONIVEL} Nada foi descontado.`) : null,
    };
    if (l.mensagemId) mapa.set(l.mensagemId, base);
    if (l.entregaId && status === "pronta") mapa.set(l.entregaId, { ...base, tipo: "entrega", pacotes: null, vitrine: titular ? { produtos: todos, usadaEm: todos.find((p) => p.id === l.produtoVitrine)?.nome ?? null } : null });
  }
  return mapa;
}
async function linha(empId: string, iid: string) {
  const [l] = await sql<Linha[]>`SELECT ${COLUNAS()} FROM imagem_equipe WHERE id = ${iid} AND empresa_id = ${empId}`;
  return l ?? null;
}
async function cartaoDe(c: CtxLeitura, iid: string, tipo: "proposta" | "entrega") {
  const l = await linha(c.empId, iid); if (!l) return null;
  const m = await montarCartoes(c, [l]);
  return (tipo === "entrega" && l.entregaId ? m.get(l.entregaId) : null) ?? (l.mensagemId ? m.get(l.mensagemId) : null) ?? null;
}
const comCartao = (m: { id: string; conteudo: string; criadoEm: Date }, imagem: CartaoImagem | null) => ({ id: m.id, papel: "assistant", autor: "agente", deNome: null, conteudo: m.conteudo, avaliacao: null, correcao: null, em: m.criadoEm, imagem });

// cartões presos às mensagens de uma conversa (src/server/equipeCliente.ts › conversaDoDono)
export async function cartoesDaConversa(c: CtxLeitura, agenteId: string, ids: string[]) {
  if (!ids.length) return new Map<string, CartaoImagem>();
  const linhas = await sql<Linha[]>`SELECT ${COLUNAS()} FROM imagem_equipe WHERE empresa_id = ${c.empId} AND pedido_agente_id = ${agenteId}
    AND (mensagem_id = ANY(${sql.array(ids)}) OR entrega_id = ANY(${sql.array(ids)}))`;
  return montarCartoes(c, linhas);
}
export async function gerandoImagem(agenteId: string) {
  const [r] = await sql`SELECT 1 FROM imagem_equipe WHERE pedido_agente_id = ${agenteId} AND status = 'gerando' AND atualizado_em > now() - make_interval(mins => ${MINUTOS_GERANDO}) LIMIT 1`;
  return !!r;
}

// ---------- 1) o dono pediu: cartão com o custo (nada é gerado nem descontado aqui) ----------
export async function pedirImagem(c: CtxLeitura, falouCom: { id: string }, pedido: string) {
  await migrar();
  const dono = await gravarMensagem({ agenteId: falouCom.id, papel: "user", autor: `dono:${c.u.id}`, conteudo: pedido });
  const quem = await quemFazImagem(c.empId, falouCom.id);
  const iid = id("img");
  const formato = formatoDoPedido(pedido);
  if (!quem) {
    const msg = await gravarMensagem({ agenteId: falouCom.id, papel: "assistant", autor: `agente:${falouCom.id}`, conteudo: textoSemDesigner(c.t) });
    await sql`INSERT INTO imagem_equipe (id, empresa_id, usuario_id, pedido_agente_id, dono_mensagem_id, mensagem_id, pedido, formato, status)
      VALUES (${iid}, ${c.empId}, ${c.u.id}, ${falouCom.id}, ${dono.id}, ${msg.id}, ${pedido}, ${formato}, 'sem_designer')`;
    return { mensagem: comCartao(msg, await cartaoDe(c, iid, "proposta")) };
  }
  const comFoto = await produtosComFoto(c.t.usuarioId);
  const produto = produtoNoPedido(pedido, comFoto);
  const logo = c.t.temLogo && (/\b(logo\w*|marca)\b/.test(sem(pedido)) || (ehArte(pedido) && !/\bfoto|fotograf/.test(sem(pedido))));
  const disponivel = temIA();
  const texto = textoProposta({ direto: quem.id === falouCom.id, quem, pedido, formato, produto: produto?.nome ?? null, disponivel });
  const msg = await gravarMensagem({ agenteId: falouCom.id, papel: "assistant", autor: `agente:${falouCom.id}`, conteudo: texto });
  await sql`INSERT INTO imagem_equipe (id, empresa_id, usuario_id, pedido_agente_id, agente_id, dono_mensagem_id, mensagem_id, pedido, formato, ref_logo, ref_produto, status, unidades, erro)
    VALUES (${iid}, ${c.empId}, ${c.u.id}, ${falouCom.id}, ${quem.id}, ${dono.id}, ${msg.id}, ${pedido}, ${formato}, ${logo}, ${produto?.id ?? null},
            ${disponivel ? "proposta" : "falhou"}, ${custoImagemUnidades(formato)}, ${disponivel ? null : `${MSG_IMAGEM_INDISPONIVEL} Nada foi descontado.`})`;
  return { mensagem: comCartao(msg, await cartaoDe(c, iid, "proposta")) };
}

// ---------- 2) o dono confirmou: confere saldo e limites, marca "gerando" e gera em segundo plano ----------
export interface AcaoImagem { id?: string; acao?: string; formato?: string; logo?: boolean; produto?: string | null; vitrine?: { produto?: string | null; nome?: string } }
async function confirmar(c: CtxImagem, l: Linha, d: AcaoImagem) {
  if (!temIA()) throw new ErroImagem(`${MSG_IMAGEM_INDISPONIVEL} Nada foi descontado.`, 503);
  if (!l.agenteId) throw new ErroImagem("A empresa ainda não tem ninguém de imagem na equipe.", 409);
  const formato = d.formato && d.formato in FORMATOS ? (d.formato as Formato) : l.formato;
  const comFoto = await produtosComFoto(c.t.usuarioId);
  const refProduto = d.produto === undefined ? l.refProduto : d.produto && comFoto.some((p) => p.id === d.produto) ? d.produto : null;
  const refLogo = c.t.temLogo && (d.logo === undefined ? l.refLogo : !!d.logo);
  const unidades = custoImagemUnidades(formato);
  const prompt = montarPrompt({ pedido: l.pedido, ...(await dadosDaEmpresa(c.t, c.empId)), formato, produto: comFoto.find((p) => p.id === refProduto)?.nome ?? null, logo: refLogo });
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"imagem:" + c.empId}))`;
    const [atual] = await tx<Pick<Linha, "status" | "atualizadoEm">[]>`SELECT status, atualizado_em FROM imagem_equipe WHERE id = ${l.id} FOR UPDATE`;
    if (!atual || (atual.status !== "proposta" && atual.status !== "falhou" && !velho(atual)))
      throw new ErroImagem(atual?.status === "pronta" ? "Esta imagem já está pronta." : atual?.status === "gerando" ? "Esta imagem já está sendo feita." : "Este pedido foi cancelado. Peça de novo na conversa.", 409);
    const [outra] = await tx`SELECT 1 FROM imagem_equipe WHERE empresa_id = ${c.empId} AND id <> ${l.id} AND status = 'gerando' AND atualizado_em > now() - make_interval(mins => ${MINUTOS_GERANDO}) LIMIT 1`;
    if (outra) throw new ErroImagem("A equipe ainda está terminando a imagem anterior. Espere ela chegar na conversa e confirme esta em seguida.", 409);
    const hora = await tx<{ em: Date }[]>`SELECT COALESCE(gerada_em, atualizado_em) AS em FROM imagem_equipe WHERE empresa_id = ${c.empId} AND status IN ('pronta', 'gerando')
      AND COALESCE(gerada_em, atualizado_em) > now() - interval '1 hour' ORDER BY 1`;
    if (hora.length >= IMAGENS_POR_HORA) {
      const libera = new Date(new Date(hora[0].em).getTime() + 3600_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      throw new ErroImagem(`Já saíram ${IMAGENS_POR_HORA} imagens na última hora. Para evitar gasto por engano, a próxima libera às ${libera}.`, 429);
    }
    // o teto de IA da empresa (equipeCliente.ts › tetoIA: gasto do mês + saldo de unidades em R$)
    const x = await c.teto();
    const saldo = Number.isFinite(x.teto) ? Math.round((x.teto - x.gasto) / VALOR_UNIDADE_BRL) : Number.POSITIVE_INFINITY;
    if (saldo < unidades) throw new ErroImagem(`Faltam unidades: esta imagem custa ${unidades.toLocaleString("pt-BR")} e restam ${Math.max(0, saldo).toLocaleString("pt-BR")}. Compre um pacote em Créditos para gerar agora.`, 402);
    await tx`UPDATE imagem_equipe SET status = 'gerando', formato = ${formato}, ref_logo = ${refLogo}, ref_produto = ${refProduto}, prompt = ${prompt},
      unidades = ${unidades}, custo_brl = ${custoImagemBRL(formato)}, erro = NULL, atualizado_em = now() WHERE id = ${l.id}`;
  });
  const ags = await agentesPorId([l.pedidoAgenteId, l.agenteId]);
  const falou = ags.get(l.pedidoAgenteId), quem = ags.get(l.agenteId);
  // outra pessoa passou o pedido ao designer: conversa interna, como na delegação (Conversas internas e a cena 3D)
  let cid = l.conversaInternaId;
  if (l.agenteId !== l.pedidoAgenteId) {
    const resumo = `Imagem para o dono: ${l.pedido}`.slice(0, 1500);
    if (!cid) {
      cid = id("ci");
      await sql`INSERT INTO conversa_interna (id, empresa_id, de_agente, para_agente, origem_agente, origem_mensagem, pedido)
        VALUES (${cid}, ${c.empId}, ${l.pedidoAgenteId}, ${l.agenteId}, ${l.pedidoAgenteId}, ${l.donoMensagemId ?? ""}, ${resumo})`;
      await sql`UPDATE imagem_equipe SET conversa_interna_id = ${cid} WHERE id = ${l.id}`;
    } else await sql`UPDATE conversa_interna SET status = 'pedido', resposta = NULL, respondido_em = NULL, criado_em = now() WHERE id = ${cid}`;
    await gravarEvento(c.empId, l.pedidoAgenteId, "delegou", resumo.slice(0, 120), { de: falou?.config?.membroId ?? "", para: quem?.config?.membroId ?? "", resumo: resumo.slice(0, 120) }).catch(() => {});
  }
  void gerar(c, { ...l, formato, refLogo, refProduto, prompt, conversaInternaId: cid }, falou ?? null, quem ?? null);
}

async function comprimir(png: Buffer) {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(png).webp({ quality: QUALIDADE_WEBP }).toBuffer({ resolveWithObject: true });
    return { dados: data, mime: "image/webp", largura: info.width, altura: info.height };
  } catch (e) {
    console.warn("[imagem] sem o sharp, fica o PNG:", (e as Error).message);
    const ehPng = png.length > 24 && png.readUInt32BE(12) === 0x49484452; // IHDR: largura e altura logo depois
    return { dados: png, mime: "image/png", largura: ehPng ? png.readUInt32BE(16) : null, altura: ehPng ? png.readUInt32BE(20) : null };
  }
}

async function gerar(c: CtxImagem, l: Linha, falou: AgenteCfg | null, quem: AgenteCfg | null) {
  const direto = l.agenteId === l.pedidoAgenteId, nome = quem?.nome ?? "A equipe", oq = oQue(l.pedido);
  const conversa = (conteudo: string) => gravarMensagem({ agenteId: l.pedidoAgenteId, papel: "assistant", autor: `agente:${l.pedidoAgenteId}`, conteudo });
  // não saiu: nada é descontado, o cartão fica com "Tentar de novo" e a conversa recebe uma resposta educada
  const falhou = async (aviso: string, fala: string) => {
    await sql`UPDATE imagem_equipe SET status = 'falhou', erro = ${aviso}, atualizado_em = now() WHERE id = ${l.id}`.catch(() => {});
    await conversa(fala).catch(() => null);
    if (l.conversaInternaId) await sql`UPDATE conversa_interna SET resposta = ${aviso}, status = 'erro', respondido_em = now() WHERE id = ${l.conversaInternaId}`.catch(() => {});
  };
  let g: Awaited<ReturnType<typeof gerarImagemBytes>>, z: Awaited<ReturnType<typeof comprimir>>;
  try {
    const refs: { dados: Buffer; nome: string; mime: string }[] = [];
    if (l.refProduto) {
      const [p] = await sql<{ foto: Uint8Array | null; fotoTipo: string | null }[]>`SELECT foto, foto_tipo FROM produto WHERE id = ${l.refProduto} AND usuario_id = ${c.t.usuarioId}`;
      if (p?.foto && p.fotoTipo && EXT[p.fotoTipo]) refs.push({ dados: Buffer.from(p.foto), nome: `produto.${EXT[p.fotoTipo]}`, mime: p.fotoTipo });
    }
    if (l.refLogo) { const lg = await logoDoTerreno(c.t.chave); if (lg && EXT[lg.tipo]) refs.push({ dados: lg.dados, nome: `logomarca.${EXT[lg.tipo]}`, mime: lg.tipo }); }
    g = await gerarImagemBytes({ prompt: l.prompt, formato: l.formato, referencias: refs });
    z = await comprimir(g.png);
  } catch (e) {
    // sem crédito na OpenAI (429), fora do ar ou recusada
    const m = (e as Error).message ?? "";
    console.error("[imagem] a geração falhou:", m.slice(0, 200));
    if (/moderation|safety|content.?policy/i.test(m)) return falhou("A OpenAI recusou gerar esta imagem pelas regras de conteúdo dela. Nada foi descontado: tente descrever o pedido de outro jeito.",
      `${direto ? "Não consegui fazer" : `${nome} não conseguiu fazer`} ${oq}: a OpenAI recusou o pedido pelas regras de conteúdo dela. Nada foi descontado das suas unidades. Me descreva de outro jeito que eu tento de novo.`);
    return falhou(`${MSG_IMAGEM_INDISPONIVEL} Nada foi descontado.`,
      `${MSG_IMAGEM_INDISPONIVEL.replace(/\.$/, "")}, então ${direto ? "não consegui fazer" : `${nome} não conseguiu fazer`} ${oq} agora. Nada foi descontado das suas unidades. Quando voltar, é só tocar em Tentar de novo no cartão acima.`);
  }
  // a entrega e o "pronta" entram juntos: a conversa nunca vê a imagem pronta sem a mensagem da entrega
  let entrega: { id: string } | null = null;
  try {
    entrega = await conversa(direto ? `Pronto! Aqui está ${oq}. Toque na imagem para ver grande ou baixar.` : `${nome} terminou ${oq}. Está aqui embaixo: toque na imagem para ver grande ou baixar.`);
    const [ok] = await sql`UPDATE imagem_equipe SET status = 'pronta', dados = ${z.dados}, mime = ${z.mime}, largura = ${z.largura}, altura = ${z.altura}, tamanho = ${z.dados.length},
      unidades = ${unidadesDoCusto(g.custoBrl)}, custo_brl = ${g.custoBrl}, entrega_id = ${entrega.id}, erro = NULL, gerada_em = now(), atualizado_em = now() WHERE id = ${l.id} AND status = 'gerando' RETURNING id`;
    if (!ok) { await sql`DELETE FROM mensagem WHERE id = ${entrega.id}`; return; }
  } catch (e) {
    console.error("[imagem] guardar:", (e as Error).message);
    if (entrega) await sql`DELETE FROM mensagem WHERE id = ${entrega.id}`.catch(() => {});
    return falhou("Não consegui guardar a imagem agora. Nada foi descontado: toque em Tentar de novo.", `${direto ? "Fiz" : `${nome} fez`} ${oq}, mas não consegui guardar agora. Nada foi descontado das suas unidades: toque em Tentar de novo no cartão acima.`);
  }
  // só agora, com a imagem no banco, o custo sai da carteira (o mesmo número do cartão)
  try { await registrarUso({ agenteId: l.agenteId!, modelo: MODELO_IMAGEM, tokensIn: g.tokensIn, tokensOut: g.tokensOut, custoBrl: g.custoBrl, categoria: "imagem" }); }
  catch (e) { console.error("[imagem] registrar uso:", (e as Error).message); }
  if (l.conversaInternaId) {
    const resposta = `Imagem pronta (${FORMATOS[l.formato].nome.toLowerCase()}) e entregue ao dono na conversa com ${falou?.nome ?? "a equipe"}.`;
    await sql`UPDATE conversa_interna SET resposta = ${resposta}, status = 'respondido', respondido_em = now() WHERE id = ${l.conversaInternaId}`.catch(() => {});
    await gravarEvento(c.empId, l.agenteId, "respondeu", resposta.slice(0, 120), { de: quem?.config?.membroId ?? "", para: falou?.config?.membroId ?? "", resumo: resposta.slice(0, 120) }).catch(() => {});
  }
}

// ---------- 3) usar como foto de produto da vitrine (até 200 KB, como as fotos enviadas pela Vitrine) ----------
const textoLimpo = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/[<>{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
async function paraVitrine(dados: Buffer, mime: string) {
  try {
    const sharp = (await import("sharp")).default;
    for (const [lado, q] of [[1000, 82], [900, 76], [760, 70], [640, 64]] as const) {
      const b = await sharp(dados).resize(lado, lado, { fit: "inside", withoutEnlargement: true }).webp({ quality: q }).toBuffer();
      if (b.length <= MAX_FOTO) return { dados: b, tipo: "image/webp" };
    }
  } catch (e) { console.warn("[imagem] vitrine sem o sharp:", (e as Error).message); }
  if (dados.length <= MAX_FOTO) return { dados, tipo: mime };
  throw new ErroImagem("Não consegui reduzir a imagem para a vitrine agora. Baixe a imagem e envie pela Vitrine.", 500);
}
async function usarNaVitrine(c: CtxLeitura, l: Linha, d: { produto?: string | null; nome?: string }) {
  if (c.u.id !== c.t.usuarioId) throw new ErroImagem("Só quem é titular da loja muda a vitrine.", 403);
  if (l.status !== "pronta") throw new ErroImagem("A imagem ainda não está pronta.", 409);
  const [r] = await sql<{ dados: Uint8Array; mime: string }[]>`SELECT dados, mime FROM imagem_equipe WHERE id = ${l.id}`;
  const foto = await paraVitrine(Buffer.from(r.dados), r.mime);
  const uid = c.t.usuarioId;
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"vitrine:" + uid}))`; // a mesma trava de vitrine.ts › salvarProduto
    if (d.produto) {
      const [p] = await tx<{ nome: string }[]>`UPDATE produto SET foto = ${foto.dados}, foto_tipo = ${foto.tipo}, atualizado_em = now() WHERE id = ${d.produto} AND usuario_id = ${uid} RETURNING nome`;
      if (!p) throw new ErroImagem("Produto não encontrado na vitrine.", 404);
      await tx`UPDATE imagem_equipe SET produto_vitrine = ${d.produto} WHERE id = ${l.id}`;
      return `Pronto: a foto de "${p.nome}" na vitrine agora é esta imagem.`;
    }
    const nome = textoLimpo(d.nome, 60);
    if (nome.length < 2) throw new ErroImagem("Dê um nome ao produto.");
    const [{ n, maior }] = await tx<{ n: number; maior: number }[]>`SELECT count(*)::int AS n, COALESCE(max(ordem), -1)::int AS maior FROM produto WHERE usuario_id = ${uid}`;
    if (n >= MAX_PRODUTOS) throw new ErroImagem(`A vitrine cabe ${MAX_PRODUTOS} produtos. Escolha um para trocar a foto.`);
    const pid = id("prd");
    // nasce escondido: sem preço, o dono confere e mostra na loja pela Vitrine
    await tx`INSERT INTO produto (id, usuario_id, nome, preco_centavos, descricao, foto, foto_tipo, ordem, ativo) VALUES (${pid}, ${uid}, ${nome}, NULL, '', ${foto.dados}, ${foto.tipo}, ${maior + 1}, false)`;
    await tx`UPDATE imagem_equipe SET produto_vitrine = ${pid} WHERE id = ${l.id}`;
    return `Criei "${nome}" na vitrine, ainda escondido: ponha o preço e mostre na loja pela Vitrine.`;
  });
}

// ---------- ações do cartão (rota /api/workend/equipe/imagem) ----------
export async function acaoImagem(c: CtxImagem, d: AcaoImagem) {
  await migrar();
  const l = await linha(c.empId, String(d.id ?? ""));
  if (!l) throw new ErroImagem("Pedido de imagem não encontrado.", 404);
  if (d.acao === "gerar") await confirmar(c, l, d);
  else if (d.acao === "cancelar") {
    const [ok] = await sql`UPDATE imagem_equipe SET status = 'cancelada', atualizado_em = now() WHERE id = ${l.id} AND status IN ('proposta', 'falhou') RETURNING id`;
    if (!ok) throw new ErroImagem("Este pedido já não pode ser cancelado.", 409);
  } else if (d.acao === "vitrine") {
    const aviso = await usarNaVitrine(c, l, d.vitrine ?? {});
    return { imagem: await cartaoDe(c, l.id, "entrega"), aviso };
  } else throw new ErroImagem("Ação desconhecida.");
  return { imagem: await cartaoDe(c, l.id, "proposta"), aviso: null };
}
// os bytes para a tela (rota /api/workend/equipe/imagem/<id>)
export async function bytesDaImagem(empId: string, iid: string) {
  await migrar();
  const [r] = await sql<{ dados: Uint8Array | null; mime: string | null; pedido: string }[]>`SELECT dados, mime, pedido FROM imagem_equipe WHERE id = ${iid} AND empresa_id = ${empId} AND status = 'pronta'`;
  if (!r?.dados || !r.mime) return null;
  const base = sem(r.pedido).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "imagem";
  return { dados: Buffer.from(r.dados), mime: r.mime, nome: `${base}.${EXT[r.mime] ?? "png"}` };
}
