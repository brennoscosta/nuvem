// A rede do WorkEnd entre personagens: amizade (libera as redes sociais um do outro), negociações (propostas com
// status) e chamadas (áudio/vídeo direto entre navegadores por WebRTC; aqui só passam os sinais).
import { sql, id, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { SEGUNDOS_ONLINE, enviarMensagem, type Redes } from "./personagens";
import { registrar } from "./eventos";

export type StatusRelacao = "nenhuma" | "pedi" | "pediram" | "amigos" | "recusada";
export interface Relacao { status: StatusRelacao; id: string | null }
export interface Amigo { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; redes: Redes; online: boolean; desde: Date }
export interface Pedido { id: string; usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; criadoEm: Date; direcao: "recebido" | "enviado" }
export interface Negociacao { id: string; deId: string; paraId: string; titulo: string; texto: string; valor: number | null; status: string; criadoEm: Date; respondidoEm: Date | null }
export interface Chamada { id: string; deId: string; paraId: string; video: boolean; status: string; criadoEm: Date; atendidaEm: Date | null; encerradaEm: Date | null }

const existe = async (usuarioId: string) => { const [p] = await sql<{ usuarioId: string }[]>`SELECT usuario_id FROM personagem WHERE usuario_id = ${usuarioId}`; return !!p; };

// ---- amizade ----
export async function relacao(euId: string, outroId: string): Promise<Relacao> {
  await migrar();
  const [a] = await sql<{ id: string; deId: string; status: string }[]>`SELECT id, de_id, status FROM amizade WHERE LEAST(de_id, para_id) = LEAST(${euId}, ${outroId}) AND GREATEST(de_id, para_id) = GREATEST(${euId}, ${outroId})`;
  if (!a) return { status: "nenhuma", id: null };
  if (a.status === "aceita") return { status: "amigos", id: a.id };
  if (a.status === "recusada") return { status: a.deId === euId ? "recusada" : "nenhuma", id: a.id }; // quem recusou pode pedir de volta
  return { status: a.deId === euId ? "pedi" : "pediram", id: a.id };
}
export const saoAmigos = async (a: string, b: string) => (await relacao(a, b)).status === "amigos";

export async function pedirAmizade(u: Usuario, paraId: string): Promise<Relacao> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  if (u.id === paraId) throw new Error("Esse personagem é você.");
  if (!(await existe(paraId))) throw new Error("Esse personagem não existe mais.");
  const r = await relacao(u.id, paraId);
  if (r.status === "amigos") return r;
  if (r.status === "pedi") return r;
  if (r.status === "pediram" && r.id) return responderAmizade(u, r.id, true); // os dois pediram: vira amizade
  // sem registro, ou recusada por mim antes: (re)abre o pedido
  if (r.id) await sql`UPDATE amizade SET de_id = ${u.id}, para_id = ${paraId}, status = 'pendente', criado_em = now(), respondido_em = NULL WHERE id = ${r.id}`;
  else await sql`INSERT INTO amizade (id, de_id, para_id) VALUES (${id("amz")}, ${u.id}, ${paraId})`;
  await enviarMensagem(u, paraId, "amizade_pedido", "Quer ser meu amigo no WorkEnd?");
  return relacao(u.id, paraId);
}
export async function responderAmizade(u: Usuario, pedidoId: string, aceitar: boolean): Promise<Relacao> {
  await migrar();
  const [a] = await sql<{ id: string; deId: string; paraId: string; status: string }[]>`SELECT id, de_id, para_id, status FROM amizade WHERE id = ${pedidoId}`;
  if (!a || a.paraId !== u.id) throw new Error("Pedido não encontrado.");
  if (a.status !== "pendente") return relacao(u.id, a.deId);
  await sql`UPDATE amizade SET status = ${aceitar ? "aceita" : "recusada"}, respondido_em = now() WHERE id = ${pedidoId}`;
  if (aceitar) { await enviarMensagem(u, a.deId, "amizade_aceite", "Aceitei! Agora somos amigos: nossas redes estão liberadas um pro outro."); void registrar("amizade", `${u.nome} aceitou amizade`, { usuarioId: u.id, dados: { com: a.deId } }); }
  return relacao(u.id, a.deId);
}
export async function desfazerAmizade(u: Usuario, outroId: string) {
  await migrar();
  await sql`DELETE FROM amizade WHERE LEAST(de_id, para_id) = LEAST(${u.id}, ${outroId}) AND GREATEST(de_id, para_id) = GREATEST(${u.id}, ${outroId})`;
}
export async function listarAmigos(euId: string): Promise<Amigo[]> {
  await migrar();
  return sql<Amigo[]>`SELECT p.usuario_id, p.nome, p.boneco, p.roupa, p.bio, p.redes, (p.visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE})) AS online, a.respondido_em AS desde
    FROM amizade a JOIN personagem p ON p.usuario_id = CASE WHEN a.de_id = ${euId} THEN a.para_id ELSE a.de_id END
    WHERE (a.de_id = ${euId} OR a.para_id = ${euId}) AND a.status = 'aceita' ORDER BY online DESC, p.nome ASC LIMIT 500`;
}
export async function listarPedidos(euId: string): Promise<Pedido[]> {
  await migrar();
  return sql<Pedido[]>`SELECT a.id, p.usuario_id, p.nome, p.boneco, p.roupa, p.bio, a.criado_em, CASE WHEN a.para_id = ${euId} THEN 'recebido' ELSE 'enviado' END AS direcao
    FROM amizade a JOIN personagem p ON p.usuario_id = CASE WHEN a.de_id = ${euId} THEN a.para_id ELSE a.de_id END
    WHERE (a.de_id = ${euId} OR a.para_id = ${euId}) AND a.status = 'pendente' ORDER BY a.criado_em DESC LIMIT 200`;
}
export async function pedidosRecebidos(euId: string): Promise<number> {
  await migrar();
  const [r] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM amizade WHERE para_id = ${euId} AND status = 'pendente'`;
  return r?.n ?? 0;
}

// ---- negociações ----
export async function criarNegociacao(u: Usuario, paraId: string, d: { titulo?: string; texto?: string; valor?: number | string | null }): Promise<Negociacao> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  if (u.id === paraId) throw new Error("Esse personagem é você.");
  if (!(await existe(paraId))) throw new Error("Esse personagem não existe mais.");
  const titulo = (d.titulo ?? "").trim().slice(0, 80); if (titulo.length < 3) throw new Error("Diga em poucas palavras o que você propõe.");
  const texto = (d.texto ?? "").trim().slice(0, 1000);
  const v = d.valor === null || d.valor === undefined || d.valor === "" ? null : Number(String(d.valor).replace(",", "."));
  const valor = v !== null && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  const [n] = await sql<Negociacao[]>`INSERT INTO negociacao (id, de_id, para_id, titulo, texto, valor) VALUES (${id("neg")}, ${u.id}, ${paraId}, ${titulo}, ${texto}, ${valor}) RETURNING id, de_id, para_id, titulo, texto, valor, status, criado_em, respondido_em`;
  await enviarMensagem(u, paraId, "negocio", JSON.stringify({ negociacaoId: n.id, titulo, texto, valor, status: "aberta" }));
  void registrar("negociacao", `${u.nome} propôs "${titulo}"`, { usuarioId: u.id, dados: { para: paraId, valor } });
  return n;
}
// Etapas (11/11/2026): aberta → aceita (ou recusada/cancelada) → entregue (um lado marcou como concluída) → concluida
// (o outro confirmou). "Ainda não terminou" devolve de entregue para aceita. Só depois de concluída os dois se avaliam.
export type PedidoStatus = "aceita" | "recusada" | "cancelada" | "concluida";
export async function responderNegociacao(u: Usuario, negId: string, status: PedidoStatus): Promise<Negociacao> {
  await migrar();
  const [n] = await sql<(Negociacao & { concluidaPor: string | null })[]>`SELECT id, de_id, para_id, titulo, texto, valor, status, criado_em, respondido_em, concluida_por FROM negociacao WHERE id = ${negId}`;
  if (!n || (n.deId !== u.id && n.paraId !== u.id)) throw new Error("Negociação não encontrada.");
  const souQuemPropos = n.deId === u.id;
  const outro = souQuemPropos ? n.paraId : n.deId;
  let novo: string;
  if (status === "aceita" && n.status === "entregue") {
    if (n.concluidaPor === u.id) throw new Error("Espere a outra pessoa responder.");
    novo = "aceita"; // ainda não terminou: volta para o andamento
  } else if (status === "concluida") {
    if (n.status === "aceita") novo = "entregue";
    else if (n.status === "entregue" && n.concluidaPor !== u.id) novo = "concluida";
    else if (n.status === "entregue") throw new Error("Você já marcou como concluída. Falta a outra pessoa confirmar.");
    else throw new Error("Só uma negociação aceita pode ser concluída.");
  } else {
    if ((status === "aceita" || status === "recusada") && souQuemPropos) throw new Error("Quem propôs não pode aceitar a própria proposta.");
    if (status === "cancelada" && !souQuemPropos) throw new Error("Só quem propôs pode cancelar.");
    if (n.status !== "aberta") throw new Error("Essa negociação já foi respondida.");
    novo = status;
  }
  const [m] = await sql<Negociacao[]>`UPDATE negociacao SET status = ${novo}, respondido_em = COALESCE(respondido_em, now()),
      concluida_por = CASE WHEN ${novo} = 'entregue' THEN ${u.id} WHEN ${novo} = 'aceita' THEN NULL ELSE concluida_por END,
      concluida_em = CASE WHEN ${novo} = 'concluida' THEN now() ELSE concluida_em END
    WHERE id = ${negId} RETURNING id, de_id, para_id, titulo, texto, valor, status, criado_em, respondido_em`;
  await enviarMensagem(u, outro, "negocio_status", JSON.stringify({ negociacaoId: n.id, titulo: n.titulo, status: novo }));
  if (novo === "concluida") void registrar("negociacao", `Negócio concluído: "${n.titulo}"`, { usuarioId: u.id, dados: { com: outro, valor: n.valor } });
  return m;
}
export async function listarNegociacoes(euId: string) {
  await migrar();
  return sql<(Negociacao & { outroId: string; outroNome: string; outroBoneco: string; outroRoupa: string; concluidaPor: string | null; minhaNota: number | null })[]>`
    SELECT n.id, n.de_id, n.para_id, n.titulo, n.texto, n.valor, n.status, n.criado_em, n.respondido_em, n.concluida_por,
      (SELECT a.nota FROM avaliacao a WHERE a.negociacao_id = n.id AND a.de_id = ${euId}) AS minha_nota,
      p.usuario_id AS outro_id, p.nome AS outro_nome, p.boneco AS outro_boneco, p.roupa AS outro_roupa
    FROM negociacao n JOIN personagem p ON p.usuario_id = CASE WHEN n.de_id = ${euId} THEN n.para_id ELSE n.de_id END
    WHERE n.de_id = ${euId} OR n.para_id = ${euId} ORDER BY (n.status IN ('aberta', 'entregue')) DESC, n.criado_em DESC LIMIT 200`;
}

// ---- avaliações (11/11/2026) ----
export async function avaliarNegociacao(u: Usuario, negId: string, d: { nota?: unknown; texto?: unknown }) {
  await migrar();
  const [n] = await sql<Negociacao[]>`SELECT id, de_id, para_id, titulo, status FROM negociacao WHERE id = ${negId}`;
  if (!n || (n.deId !== u.id && n.paraId !== u.id)) throw new Error("Negociação não encontrada.");
  if (n.status !== "concluida") throw new Error("Dá para avaliar depois que os dois confirmam que o negócio foi concluído.");
  const nota = Math.round(Number(d.nota));
  if (!(nota >= 1 && nota <= 5)) throw new Error("Escolha de 1 a 5 estrelas.");
  const texto = typeof d.texto === "string" ? d.texto.trim().slice(0, 400) : "";
  const para = n.deId === u.id ? n.paraId : n.deId;
  const [a] = await sql<{ id: string }[]>`INSERT INTO avaliacao (id, negociacao_id, de_id, para_id, nota, texto) VALUES (${id("av")}, ${n.id}, ${u.id}, ${para}, ${nota}, ${texto})
    ON CONFLICT (negociacao_id, de_id) DO NOTHING RETURNING id`;
  if (!a) throw new Error("Você já avaliou este negócio.");
  await enviarMensagem(u, para, "negocio_status", JSON.stringify({ negociacaoId: n.id, titulo: n.titulo, status: "avaliada", nota }));
  return { id: a.id, nota, texto };
}
export async function avaliacoesRecebidas(usuarioId: string, limite = 20) {
  await migrar();
  return sql<{ id: string; nota: number; texto: string; criadoEm: Date; deNome: string; titulo: string }[]>`
    SELECT a.id, a.nota, a.texto, a.criado_em, COALESCE(p.nome, us.nome) AS de_nome, n.titulo
    FROM avaliacao a JOIN negociacao n ON n.id = a.negociacao_id LEFT JOIN personagem p ON p.usuario_id = a.de_id LEFT JOIN usuario us ON us.id = a.de_id
    WHERE a.para_id = ${usuarioId} ORDER BY a.criado_em DESC LIMIT ${limite}`;
}
// média e quantidade de avaliações de vários usuários de uma vez (busca, fichas)
export async function reputacao(ids: string[]): Promise<Record<string, { media: number; n: number }>> {
  if (!ids.length) return {};
  await migrar();
  const rows = await sql<{ paraId: string; media: number; n: number }[]>`SELECT para_id, AVG(nota)::float AS media, COUNT(*)::int AS n FROM avaliacao WHERE para_id = ANY(${sql.array(ids)}) GROUP BY para_id`;
  return Object.fromEntries(rows.map((r) => [r.paraId, { media: r.media, n: r.n }]));
}

// ---- chamadas ----
const CAMPOS_CH = () => sql`id, de_id, para_id, video, status, criado_em, atendida_em, encerrada_em`;
const TOCANDO_MAX_S = 45; // sem atender em 45 s = perdida
const SUMIU_S = 20; // um lado sem consultar por 20 s = caiu

// limpa chamadas abandonadas e devolve a minha chamada aberta (tocando ou ativa), se houver
export async function minhaChamada(euId: string): Promise<(Chamada & { outroNome: string; outroBoneco: string; outroRoupa: string }) | null> {
  await migrar();
  await sql`UPDATE chamada SET status = 'perdida', encerrada_em = now() WHERE status = 'tocando' AND criado_em < now() - make_interval(secs => ${TOCANDO_MAX_S})`;
  await sql`UPDATE chamada SET status = 'encerrada', encerrada_em = now() WHERE status = 'ativa' AND LEAST(visto_de, visto_para) < now() - make_interval(secs => ${SUMIU_S})`;
  const [c] = await sql<(Chamada & { outroNome: string; outroBoneco: string; outroRoupa: string })[]>`
    SELECT c.id, c.de_id, c.para_id, c.video, c.status, c.criado_em, c.atendida_em, c.encerrada_em, p.nome AS outro_nome, p.boneco AS outro_boneco, p.roupa AS outro_roupa
    FROM chamada c JOIN personagem p ON p.usuario_id = CASE WHEN c.de_id = ${euId} THEN c.para_id ELSE c.de_id END
    WHERE (c.de_id = ${euId} OR c.para_id = ${euId}) AND c.status IN ('tocando', 'ativa') ORDER BY c.criado_em DESC LIMIT 1`;
  return c ?? null;
}
export async function iniciarChamada(u: Usuario, paraId: string, video: boolean): Promise<Chamada> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  if (u.id === paraId) throw new Error("Esse personagem é você.");
  if (!(await existe(paraId))) throw new Error("Esse personagem não existe mais.");
  if (await minhaChamada(u.id)) throw new Error("Você já está numa chamada.");
  if (await minhaChamada(paraId)) throw new Error("Essa pessoa está em outra chamada agora.");
  const [on] = await sql<{ usuarioId: string }[]>`SELECT usuario_id FROM personagem WHERE usuario_id = ${paraId} AND visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE})`;
  if (!on) throw new Error("Essa pessoa não está online agora. Mande uma mensagem que ela recebe quando entrar.");
  const [c] = await sql<Chamada[]>`INSERT INTO chamada (id, de_id, para_id, video) VALUES (${id("cha")}, ${u.id}, ${paraId}, ${!!video}) RETURNING ${CAMPOS_CH()}`;
  return c;
}
async function carregarChamada(euId: string, chamadaId: string): Promise<Chamada> {
  const [c] = await sql<Chamada[]>`SELECT ${CAMPOS_CH()} FROM chamada WHERE id = ${chamadaId}`;
  if (!c || (c.deId !== euId && c.paraId !== euId)) throw new Error("Chamada não encontrada.");
  return c;
}
export async function atenderChamada(u: Usuario, chamadaId: string): Promise<Chamada> {
  await migrar();
  const c = await carregarChamada(u.id, chamadaId);
  if (c.paraId !== u.id) throw new Error("Só quem recebe pode atender.");
  if (c.status !== "tocando") throw new Error(c.status === "ativa" ? "Já atendida." : "Essa chamada já acabou.");
  const [m] = await sql<Chamada[]>`UPDATE chamada SET status = 'ativa', atendida_em = now(), visto_de = now(), visto_para = now() WHERE id = ${chamadaId} RETURNING ${CAMPOS_CH()}`;
  return m;
}
export async function encerrarChamada(u: Usuario, chamadaId: string): Promise<Chamada> {
  await migrar();
  const c = await carregarChamada(u.id, chamadaId);
  if (c.status !== "tocando" && c.status !== "ativa") return c;
  const status = c.status === "tocando" ? (c.paraId === u.id ? "recusada" : "perdida") : "encerrada";
  const [m] = await sql<Chamada[]>`UPDATE chamada SET status = ${status}, encerrada_em = now() WHERE id = ${chamadaId} RETURNING ${CAMPOS_CH()}`;
  return m;
}
// consulta da chamada: marca que este lado está vivo e devolve os sinais novos do outro lado
export async function consultarChamada(u: Usuario, chamadaId: string, desdeSeq: number) {
  await migrar();
  const c0 = await carregarChamada(u.id, chamadaId);
  if (c0.deId === u.id) await sql`UPDATE chamada SET visto_de = now() WHERE id = ${chamadaId}`; else await sql`UPDATE chamada SET visto_para = now() WHERE id = ${chamadaId}`;
  if (c0.status === "ativa") await sql`UPDATE chamada SET status = 'encerrada', encerrada_em = now() WHERE id = ${chamadaId} AND LEAST(visto_de, visto_para) < now() - make_interval(secs => ${SUMIU_S})`;
  if (c0.status === "tocando") await sql`UPDATE chamada SET status = 'perdida', encerrada_em = now() WHERE id = ${chamadaId} AND criado_em < now() - make_interval(secs => ${TOCANDO_MAX_S})`;
  const chamada = await carregarChamada(u.id, chamadaId);
  const sinais = await sql<{ seq: number; tipo: string; dados: unknown }[]>`SELECT seq, tipo, dados FROM sinal WHERE chamada_id = ${chamadaId} AND de_id <> ${u.id} AND seq > ${desdeSeq} ORDER BY seq ASC LIMIT 200`;
  return { chamada, sinais: sinais.map((s) => ({ ...s, seq: Number(s.seq) })) };
}
export async function enviarSinal(u: Usuario, chamadaId: string, tipo: string, dados: unknown) {
  await migrar();
  const c = await carregarChamada(u.id, chamadaId);
  if (c.status !== "ativa" && c.status !== "tocando") throw new Error("Chamada encerrada.");
  if (!["offer", "answer", "ice"].includes(tipo)) throw new Error("Sinal inválido.");
  await sql`INSERT INTO sinal (chamada_id, de_id, tipo, dados) VALUES (${chamadaId}, ${u.id}, ${tipo}, ${sql.json(dados as Parameters<typeof sql.json>[0])})`;
}
