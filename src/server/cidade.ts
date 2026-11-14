// Cidade viva (12/11/2026): vagas e candidaturas, visitas e missões (selos), eventos da praça, feira de sábado e roupas
// do personagem. Tudo que cobra passa pelo Pix de src/server/mercadopago.ts (tipos "barraca" e "item").
import { sql, migrar, id } from "./db";
import type { Usuario } from "./usuarios";
import { ehAdmin, terrenoDoUsuario } from "./terrenos";
import { criarCobrancaGenerica, type CobrancaPix } from "./mercadopago";
import { avisarSeguidores } from "./seguir";
import { avisar } from "./avisos";
import { LOTE_POR_CHAVE, nomeNicho, NICHOS } from "@/office/data/mundo";
import { MISSOES } from "@/office/data/missoes";
import { ACESSORIO_POR_ID, limparEquipados } from "@/office/data/acessorios";
import { PRACA_CHAVE, PRECO_BARRACA, VAGAS_FEIRA, MAX_EVENTOS_FUTUROS, DURACOES_EVENTO, TIPOS_BARRACA, CORES_BARRACA, proximaFeira } from "@/office/data/praca";

const texto = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/[<>{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const urlSegura = (t: unknown) => { const s = texto(t, 200); if (!s) return ""; try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.toString() : ""; } catch { return ""; } };
async function loteAtivoDe(u: Usuario) {
  const t = await terrenoDoUsuario(u.id);
  if (!t || t.status !== "ativo") throw new Error("Isso é para empresas com lote ativo no mapa.");
  return t;
}

// ================= vagas ("Estamos contratando") =================
export const MAX_VAGAS = 5;
export const MODELOS_VAGA = ["presencial", "remoto", "hibrido"] as const;
export interface VagaPublica { id: string; cargo: string; descricao: string; modelo: string; local: string; salario: string; criadoEm: Date; empresa: { nome: string; cor: string; nicho: string; numero: number | null; chave: string; logo: string | null } }

export async function vagasDoDono(u: Usuario) {
  await migrar();
  const vagas = await sql<{ id: string; cargo: string; descricao: string; modelo: string; local: string; salario: string; aberta: boolean; criadoEm: Date; candidatos: number }[]>`
    SELECT v.*, (SELECT count(*)::int FROM candidatura c WHERE c.vaga_id = v.id) AS candidatos FROM vaga v WHERE v.usuario_id = ${u.id} ORDER BY v.aberta DESC, v.criado_em DESC`;
  const cand = await sql<{ id: string; vagaId: string; mensagem: string; contato: string; criadoEm: Date; nome: string | null; profissao: string | null; usuarioId: string }[]>`
    SELECT c.id, c.vaga_id, c.mensagem, c.contato, c.criado_em, c.usuario_id, COALESCE(p.nome, us.nome) AS nome, p.profissao
    FROM candidatura c JOIN vaga v ON v.id = c.vaga_id LEFT JOIN personagem p ON p.usuario_id = c.usuario_id LEFT JOIN usuario us ON us.id = c.usuario_id
    WHERE v.usuario_id = ${u.id} ORDER BY c.criado_em DESC LIMIT 200`;
  return vagas.map((v) => ({ ...v, candidaturas: cand.filter((c) => c.vagaId === v.id) }));
}
export async function salvarVaga(u: Usuario, d: { id?: string; cargo?: unknown; descricao?: unknown; modelo?: unknown; local?: unknown; salario?: unknown; aberta?: unknown }) {
  await migrar(); await loteAtivoDe(u);
  const cargo = texto(d.cargo, 60); if (cargo.length < 3) throw new Error("Diga o cargo da vaga.");
  const modelo = MODELOS_VAGA.includes(d.modelo as never) ? String(d.modelo) : "presencial";
  const campos = { cargo, descricao: texto(d.descricao, 600), modelo, local: texto(d.local, 60), salario: texto(d.salario, 60) };
  if (d.id) {
    if (d.aberta !== false) {
      const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM vaga WHERE usuario_id = ${u.id} AND aberta AND id <> ${String(d.id)}`;
      if (n >= MAX_VAGAS) throw new Error(`Cada empresa pode ter até ${MAX_VAGAS} vagas abertas. Feche uma antes de reabrir esta.`);
    }
    const [v] = await sql`UPDATE vaga SET cargo = ${campos.cargo}, descricao = ${campos.descricao}, modelo = ${campos.modelo}, local = ${campos.local}, salario = ${campos.salario}, aberta = ${d.aberta !== false}, atualizado_em = now() WHERE id = ${String(d.id)} AND usuario_id = ${u.id} RETURNING id`;
    if (!v) throw new Error("Vaga não encontrada.");
    return v;
  }
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM vaga WHERE usuario_id = ${u.id} AND aberta`;
  if (n >= MAX_VAGAS) throw new Error(`Cada empresa pode ter até ${MAX_VAGAS} vagas abertas.`);
  const [v] = await sql`INSERT INTO vaga (id, usuario_id, cargo, descricao, modelo, local, salario) VALUES (${id("vg")}, ${u.id}, ${campos.cargo}, ${campos.descricao}, ${campos.modelo}, ${campos.local}, ${campos.salario}) RETURNING id`;
  return v;
}
// vagas abertas com a empresa (busca, página da loja, cartão do mapa). Só de quem está com lote ativo.
export async function vagasAbertas(f: { q?: string | null; nicho?: string | null; donoId?: string | null } = {}): Promise<VagaPublica[]> {
  await migrar();
  const q = (f.q ?? "").trim().slice(0, 60), like = `%${q.replace(/[%_\\]/g, "")}%`;
  const nicho = f.nicho && NICHOS.some((n) => n.id === f.nicho) ? f.nicho : null;
  const rows = await sql<{ id: string; cargo: string; descricao: string; modelo: string; local: string; salario: string; criadoEm: Date; empresaNome: string; cor: string; nicho: string; chave: string; temLogo: boolean }[]>`
    SELECT v.id, v.cargo, v.descricao, v.modelo, v.local, v.salario, v.criado_em, t.empresa_nome, t.cor, t.nicho, t.chave, (t.logo IS NOT NULL) AS tem_logo
    FROM vaga v JOIN LATERAL (SELECT * FROM terreno x WHERE x.usuario_id = v.usuario_id AND x.status = 'ativo' AND x.anexo_de IS NULL ORDER BY x.reservado_em LIMIT 1) t ON true
    JOIN usuario us ON us.id = v.usuario_id AND us.banido_em IS NULL
    WHERE v.aberta AND (${f.donoId ?? null}::text IS NULL OR v.usuario_id = ${f.donoId ?? null})
      AND (${q} = '' OR v.cargo ILIKE ${like} OR v.descricao ILIKE ${like} OR v.local ILIKE ${like} OR t.empresa_nome ILIKE ${like})
      AND (${nicho}::text IS NULL OR t.nicho = ${nicho})
    ORDER BY v.criado_em DESC LIMIT 60`;
  return rows.map((r) => ({ id: r.id, cargo: r.cargo, descricao: r.descricao, modelo: r.modelo, local: r.local, salario: r.salario, criadoEm: r.criadoEm,
    empresa: { nome: r.empresaNome, cor: r.cor, nicho: nomeNicho(r.nicho), numero: LOTE_POR_CHAVE[r.chave]?.numero ?? null, chave: r.chave, logo: r.temLogo ? `/api/terrenos/${encodeURIComponent(r.chave)}/logo` : null } }));
}
export async function vagasPorLote(): Promise<Record<string, number>> {
  await migrar();
  const rows = await sql<{ chave: string; n: number }[]>`SELECT t.chave, count(v.id)::int AS n FROM vaga v JOIN terreno t ON t.usuario_id = v.usuario_id AND t.status = 'ativo' AND t.anexo_de IS NULL WHERE v.aberta GROUP BY t.chave`;
  return Object.fromEntries(rows.map((r) => [r.chave, r.n]));
}
export async function candidatar(u: Usuario, vagaId: string, d: { mensagem?: unknown; contato?: unknown }) {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const [v] = await sql<{ usuarioId: string; aberta: boolean; cargo: string }[]>`SELECT usuario_id, aberta, cargo FROM vaga WHERE id = ${vagaId}`;
  if (!v || !v.aberta) throw new Error("Essa vaga não está mais aberta.");
  if (v.usuarioId === u.id) throw new Error("Essa vaga é da sua empresa.");
  const mensagem = texto(d.mensagem, 600), contato = texto(d.contato, 80);
  if (mensagem.length < 10) throw new Error("Conte em poucas linhas por que você é a pessoa certa.");
  if (contato.length < 6) throw new Error("Deixe um WhatsApp ou e-mail para a empresa responder.");
  const r = await sql`INSERT INTO candidatura (id, vaga_id, usuario_id, mensagem, contato) VALUES (${id("cd")}, ${vagaId}, ${u.id}, ${mensagem}, ${contato}) ON CONFLICT (vaga_id, usuario_id) DO NOTHING`;
  if (!r.count) throw new Error("Você já se candidatou a essa vaga.");
  // sino do dono da vaga: um aviso por vaga, que volta para o topo a cada candidatura nova
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM candidatura WHERE vaga_id = ${vagaId}`;
  const [p] = await sql<{ nome: string }[]>`SELECT COALESCE((SELECT nome FROM personagem WHERE usuario_id = ${u.id}), split_part(${u.nome}, ' ', 1)) AS nome`;
  void avisar(v.usuarioId, { tipo: "candidatura", ref: `cand:${vagaId}`, renovar: true, titulo: `Nova candidatura: ${v.cargo}`, texto: `${p?.nome ?? "Alguém"} se candidatou${n > 1 ? ` · ${n} candidaturas nesta vaga` : ""}.`, link: "/app/equipe?aba=vagas" });
  return { ok: true };
}

// ================= visitas, missões e selos =================
export async function registrarVisita(usuarioId: string, chave: string) {
  await sql`INSERT INTO visita_loja (usuario_id, terreno_chave) VALUES (${usuarioId}, ${chave}) ON CONFLICT DO NOTHING`.catch(() => {});
}
// progresso de cada missão para vários usuários de uma vez
export async function progressoMissoes(ids: string[]): Promise<Record<string, Record<string, number>>> {
  if (!ids.length) return {};
  await migrar();
  const arr = sql.array(ids);
  const [vis, papo, amigos, neg, aval, cand, feira] = await Promise.all([
    sql<{ u: string; n: number }[]>`SELECT usuario_id AS u, count(*)::int AS n FROM visita_loja WHERE usuario_id = ANY(${arr}) GROUP BY 1`,
    sql<{ u: string; n: number }[]>`SELECT m.visitante_id AS u, count(DISTINCT a.empresa_id)::int AS n FROM mensagem m JOIN agente a ON a.id = m.agente_id WHERE m.visitante_id = ANY(${arr}) AND m.papel = 'user' GROUP BY 1`,
    sql<{ u: string; n: number }[]>`SELECT x.u, count(*)::int AS n FROM (SELECT de_id AS u FROM amizade WHERE status = 'aceita' UNION ALL SELECT para_id FROM amizade WHERE status = 'aceita') x WHERE x.u = ANY(${arr}) GROUP BY 1`,
    sql<{ u: string; n: number }[]>`SELECT x.u, count(*)::int AS n FROM (SELECT de_id AS u FROM negociacao WHERE status = 'concluida' UNION ALL SELECT para_id FROM negociacao WHERE status = 'concluida') x WHERE x.u = ANY(${arr}) GROUP BY 1`,
    sql<{ u: string; n: number }[]>`SELECT de_id AS u, count(*)::int AS n FROM avaliacao WHERE de_id = ANY(${arr}) GROUP BY 1`,
    sql<{ u: string; n: number }[]>`SELECT usuario_id AS u, count(*)::int AS n FROM candidatura WHERE usuario_id = ANY(${arr}) GROUP BY 1`,
    sql<{ u: string; n: number }[]>`SELECT usuario_id AS u, count(*)::int AS n FROM barraca WHERE usuario_id = ANY(${arr}) AND status = 'paga' GROUP BY 1`,
  ]);
  const r: Record<string, Record<string, number>> = Object.fromEntries(ids.map((i) => [i, {}]));
  const por = (lista: { u: string; n: number }[], m: string) => { for (const x of lista) if (r[x.u]) r[x.u][m] = x.n; };
  por(vis, "explorador"); por(papo, "papo"); por(amigos, "amigos"); por(neg, "negociante"); por(aval, "avaliador"); por(cand, "candidato"); por(feira, "feirante");
  return r;
}
export async function selosDe(ids: string[]): Promise<Record<string, string[]>> {
  const p = await progressoMissoes(ids);
  return Object.fromEntries(ids.map((i) => [i, MISSOES.filter((m) => (p[i]?.[m.id] ?? 0) >= m.meta).map((m) => m.id)]));
}
export async function minhasMissoes(u: Usuario) {
  const p = (await progressoMissoes([u.id]))[u.id] ?? {};
  return MISSOES.map((m) => ({ ...m, feito: Math.min(m.meta, p[m.id] ?? 0), completa: (p[m.id] ?? 0) >= m.meta }));
}

// ================= eventos na praça =================
export interface EventoPublico { id: string; titulo: string; descricao: string; link: string; inicio: Date; fim: Date; meu: boolean; empresa: { nome: string; cor: string; numero: number | null; chave: string | null; logo: string | null } }
export async function agendaPraca(euId: string | null): Promise<EventoPublico[]> {
  await migrar();
  const rows = await sql<{ id: string; titulo: string; descricao: string; link: string; inicio: Date; fim: Date; usuarioId: string; empresaNome: string | null; cor: string | null; chave: string | null; temLogo: boolean | null }[]>`
    SELECT e.id, e.titulo, e.descricao, e.link, e.inicio, e.fim, e.usuario_id, t.empresa_nome, t.cor, t.chave, (t.logo IS NOT NULL) AS tem_logo
    FROM evento_praca e LEFT JOIN LATERAL (SELECT * FROM terreno x WHERE x.usuario_id = e.usuario_id AND x.status = 'ativo' AND x.anexo_de IS NULL LIMIT 1) t ON true
    WHERE NOT e.cancelado AND e.fim > now() AND e.inicio < now() + interval '30 days' ORDER BY e.inicio LIMIT 40`;
  return rows.map((r) => ({ id: r.id, titulo: r.titulo, descricao: r.descricao, link: r.link, inicio: r.inicio, fim: r.fim, meu: r.usuarioId === euId,
    empresa: { nome: r.empresaNome ?? "Empresa do WorkEnd", cor: r.cor ?? "#1D4ED8", numero: r.chave ? LOTE_POR_CHAVE[r.chave]?.numero ?? null : null, chave: r.chave, logo: r.temLogo && r.chave ? `/api/terrenos/${encodeURIComponent(r.chave)}/logo` : null } }));
}
export async function marcarEvento(u: Usuario, d: { titulo?: unknown; descricao?: unknown; link?: unknown; inicio?: unknown; duracao?: unknown }) {
  await migrar();
  const t = await loteAtivoDe(u);
  const titulo = texto(d.titulo, 60); if (titulo.length < 4) throw new Error("Dê um nome ao evento.");
  const inicio = new Date(String(d.inicio ?? ""));
  if (Number.isNaN(inicio.getTime())) throw new Error("Escolha o dia e a hora do evento.");
  if (inicio.getTime() < Date.now() - 60_000) throw new Error("O evento precisa ser no futuro.");
  if (inicio.getTime() > Date.now() + 30 * 86400_000) throw new Error("Marque eventos para os próximos 30 dias.");
  const dur = DURACOES_EVENTO.includes(Number(d.duracao)) ? Number(d.duracao) : 60;
  const fim = new Date(inicio.getTime() + dur * 60_000);
  const ev = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    await db`SELECT pg_advisory_xact_lock(hashtext('evento_praca'))`;
    const [{ n }] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM evento_praca WHERE usuario_id = ${u.id} AND NOT cancelado AND fim > now()`;
    if (n >= MAX_EVENTOS_FUTUROS && !ehAdmin(u)) throw new Error(`Cada empresa pode ter até ${MAX_EVENTOS_FUTUROS} eventos marcados por vez.`);
    const [choque] = await db<{ titulo: string }[]>`SELECT titulo FROM evento_praca WHERE NOT cancelado AND inicio < ${fim} AND fim > ${inicio} LIMIT 1`;
    if (choque) throw new Error(`O palco já está ocupado nesse horário ("${choque.titulo}"). Escolha outro.`);
    const [e] = await db`INSERT INTO evento_praca (id, usuario_id, terreno_chave, titulo, descricao, link, inicio, fim) VALUES (${id("evp")}, ${u.id}, ${t.chave}, ${titulo}, ${texto(d.descricao, 300)}, ${urlSegura(d.link)}, ${inicio}, ${fim}) RETURNING id`;
    return e;
  });
  void avisarSeguidores(u.id, "evento", { texto: `${titulo} · ${inicio.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`, ref: String((ev as { id?: string }).id ?? titulo) }); // quem segue a loja
  return ev;
}
export async function cancelarEvento(u: Usuario, eventoId: string) {
  await migrar();
  const r = await sql`UPDATE evento_praca SET cancelado = true WHERE id = ${eventoId} AND (usuario_id = ${u.id} OR ${ehAdmin(u)})`;
  if (!r.count) throw new Error("Evento não encontrado.");
}

// ================= feira de sábado =================
export interface BarracaPublica { vaga: number; status: "livre" | "reservada" | "paga"; meu: boolean; nome: string; descricao: string; cor: string; tipo: string; contato: { whatsapp?: string; instagram?: string } }
export async function feira(euId: string | null, dia = proximaFeira()) {
  await migrar();
  const rows = await sql<{ vaga: number; status: string; usuarioId: string; nome: string; descricao: string; cor: string; tipo: string; contato: BarracaPublica["contato"]; reservadoAte: Date | null }[]>`
    SELECT vaga, status, usuario_id, nome, descricao, cor, tipo, contato, reservado_ate FROM barraca WHERE dia = ${dia} AND (status = 'paga' OR (status = 'reservada' AND reservado_ate > now()))`;
  const barracas: BarracaPublica[] = Array.from({ length: VAGAS_FEIRA }, (_, i) => {
    const b = rows.find((r) => r.vaga === i + 1);
    if (!b) return { vaga: i + 1, status: "livre", meu: false, nome: "", descricao: "", cor: "", tipo: "", contato: {} };
    const pub = b.status === "paga";
    return { vaga: i + 1, status: b.status as "reservada" | "paga", meu: b.usuarioId === euId, nome: pub || b.usuarioId === euId ? b.nome : "", descricao: pub ? b.descricao : "", cor: b.cor, tipo: b.tipo, contato: pub ? b.contato : {} };
  });
  return { dia, barracas, preco: PRECO_BARRACA };
}
export async function alugarBarraca(u: Usuario, d: { vaga?: unknown; nome?: unknown; descricao?: unknown; cor?: unknown; tipo?: unknown; whatsapp?: unknown; instagram?: unknown }, base: string): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const lote = await terrenoDoUsuario(u.id);
  if (lote?.status === "ativo" && !ehAdmin(u)) throw new Error("A feira é para quem ainda não tem lote: a sua empresa já tem endereço no mapa.");
  const vaga = Math.round(Number(d.vaga)); if (!(vaga >= 1 && vaga <= VAGAS_FEIRA)) throw new Error("Escolha uma das barracas.");
  const nome = texto(d.nome, 28); if (nome.length < 2) throw new Error("Dê um nome à sua barraca.");
  const cor = CORES_BARRACA.includes(String(d.cor)) ? String(d.cor) : CORES_BARRACA[0];
  const tipo = TIPOS_BARRACA.some((t) => t.id === d.tipo) ? String(d.tipo) : "artesanato";
  const zap = texto(d.whatsapp, 20).replace(/\D/g, ""), insta = texto(d.instagram, 40).replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  const contato = { ...(zap.length >= 10 && zap.length <= 13 ? { whatsapp: zap } : {}), ...(insta ? { instagram: insta.slice(0, 30) } : {}) };
  const dia = proximaFeira();
  const bid = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    await db`DELETE FROM barraca WHERE dia = ${dia} AND vaga = ${vaga} AND status = 'reservada' AND reservado_ate < now()`;
    const [minha] = await db<{ id: string }[]>`SELECT id FROM barraca WHERE dia = ${dia} AND usuario_id = ${u.id} AND vaga <> ${vaga} AND (status = 'paga' OR reservado_ate > now())`;
    if (minha) throw new Error("Você já tem uma barraca neste sábado.");
    const [ocupada] = await db<{ usuarioId: string; id: string }[]>`SELECT usuario_id, id FROM barraca WHERE dia = ${dia} AND vaga = ${vaga}`;
    if (ocupada && ocupada.usuarioId !== u.id) throw new Error("Essa barraca acabou de ser reservada. Escolha outra.");
    if (ocupada) { await db`UPDATE barraca SET nome = ${nome}, descricao = ${texto(d.descricao, 120)}, cor = ${cor}, tipo = ${tipo}, contato = ${sql.json(contato)}, reservado_ate = CASE WHEN status = 'paga' THEN reservado_ate ELSE now() + interval '70 minutes' END WHERE id = ${ocupada.id}`; return ocupada.id; }
    const novo = id("bar");
    await db`INSERT INTO barraca (id, usuario_id, dia, vaga, nome, descricao, cor, tipo, contato, reservado_ate) VALUES (${novo}, ${u.id}, ${dia}, ${vaga}, ${nome}, ${texto(d.descricao, 120)}, ${cor}, ${tipo}, ${sql.json(contato)}, now() + interval '70 minutes')`;
    return novo;
  });
  const [b] = await sql<{ status: string }[]>`SELECT status FROM barraca WHERE id = ${bid}`;
  if (b?.status === "paga") throw new Error("Sua barraca já está paga para este sábado. Os dados foram atualizados.");
  const valor = ehAdmin(u) ? Math.round(PRECO_BARRACA * 100) / 10000 : PRECO_BARRACA;
  return criarCobrancaGenerica(u, base, { tipo: "barraca", chave: `barraca:${bid}`, valor, descricao: `WorkEnd · barraca na feira de ${dia.split("-").reverse().join("/")} (${nome})`, metadata: { barraca: bid } });
}
type Db = typeof sql;
export async function ativarBarraca(chave: string, usuarioId: string, db: Db = sql) {
  const r = await db`UPDATE barraca SET status = 'paga', reservado_ate = NULL WHERE id = ${chave.replace(/^barraca:/, "")} AND usuario_id = ${usuarioId}`;
  return r.count > 0;
}
export async function reverterBarraca(chave: string, usuarioId: string, db: Db = sql) {
  await db`UPDATE barraca SET status = 'cancelada' WHERE id = ${chave.replace(/^barraca:/, "")} AND usuario_id = ${usuarioId}`;
}

// ================= roupas e acessórios =================
export async function meusItens(u: Usuario) {
  await migrar();
  const rows = await sql<{ item: string }[]>`SELECT item FROM item_comprado WHERE usuario_id = ${u.id}`;
  const [p] = await sql<{ acessorios: string[] }[]>`SELECT acessorios FROM personagem WHERE usuario_id = ${u.id}`;
  return { comprados: rows.map((r) => r.item), usando: limparEquipados(p?.acessorios ?? []) };
}
export async function comprarItem(u: Usuario, itemId: string, base: string): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const a = ACESSORIO_POR_ID[itemId]; if (!a) throw new Error("Item não encontrado.");
  const [ja] = await sql`SELECT 1 FROM item_comprado WHERE usuario_id = ${u.id} AND item = ${itemId}`;
  if (ja) throw new Error("Você já tem esse item.");
  const valor = ehAdmin(u) ? Math.round(a.preco * 100) / 10000 : a.preco;
  return criarCobrancaGenerica(u, base, { tipo: "item", chave: `item:${itemId}`, valor, descricao: `WorkEnd · ${a.nome} para o personagem`, metadata: { item: itemId } });
}
export async function ativarItem(chave: string, usuarioId: string, db: Db = sql) {
  const item = chave.replace(/^item:/, ""); if (!ACESSORIO_POR_ID[item]) return false;
  await db`INSERT INTO item_comprado (usuario_id, item) VALUES (${usuarioId}, ${item}) ON CONFLICT DO NOTHING`;
  // já veste o item novo (troca o do mesmo lugar)
  const [p] = await db<{ acessorios: string[] }[]>`SELECT acessorios FROM personagem WHERE usuario_id = ${usuarioId}`;
  if (p) { const lugar = ACESSORIO_POR_ID[item].lugar; const novos = limparEquipados([item, ...(p.acessorios ?? []).filter((i) => ACESSORIO_POR_ID[i]?.lugar !== lugar)]); await db`UPDATE personagem SET acessorios = ${sql.json(novos)} WHERE usuario_id = ${usuarioId}`; }
  return true;
}
export async function reverterItem(chave: string, usuarioId: string, db: Db = sql) {
  const item = chave.replace(/^item:/, "");
  await db`DELETE FROM item_comprado WHERE usuario_id = ${usuarioId} AND item = ${item}`;
  await db`UPDATE personagem SET acessorios = COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(acessorios) x WHERE x <> ${item}), '[]'::jsonb) WHERE usuario_id = ${usuarioId}`;
}
export async function vestir(u: Usuario, itens: unknown) {
  await migrar();
  const { comprados } = await meusItens(u);
  const lista = limparEquipados((Array.isArray(itens) ? itens : []).filter((i) => comprados.includes(String(i))));
  const r = await sql`UPDATE personagem SET acessorios = ${sql.json(lista)}, atualizado_em = now() WHERE usuario_id = ${u.id}`;
  if (!r.count) throw new Error("Monte seu personagem primeiro.");
  return lista;
}
export { PRACA_CHAVE };
