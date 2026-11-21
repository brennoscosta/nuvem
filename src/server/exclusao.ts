// Excluir minha conta (21/11/2026, LGPD art. 18): o titular apaga a própria conta em Meu perfil (/app/perfil ›
// app/workend/app/perfil/_excluir.tsx). Confirma com a senha ou, se entra só pelo Google, digitando EXCLUIR. Tudo
// acontece numa transação só: ou exclui tudo, ou nada.
//  - APAGA os dados pessoais: a conta, o personagem, o perfil público, as mensagens, o passaporte, a rede, os avisos e a
//    loja inteira (lote, prédio, vitrine, cupons, agenda, pedidos, equipe de IA e conversas, conexões e chaves de API).
//    O lote volta a ficar à venda no mapa. O resto vai pelas chaves estrangeiras (ON DELETE CASCADE de usuario).
//  - GUARDA sem identificar (obrigação fiscal e contábil): os pagamentos passam para a conta técnica "Contas excluídas"
//    (migração 0053), com o bruto do Mercado Pago reduzido aos campos sem dado pessoal; os extratos de créditos e de
//    unidades de IA ficam com os mesmos valores. É a mesma ideia de sempre do extrato (src/server/creditos.ts): nada é
//    apagado nem muda de valor, o saldo é encerrado com um lançamento novo de ajuste, e só a identificação troca para o
//    código anônimo exc_<começo do hash>.
//  - ANONIMIZA o que é de outras pessoas e cita a conta: horários e pedidos feitos como cliente em outras lojas (os que
//    ainda estavam abertos são cancelados), carimbos que outras pessoas ganharam na loja, visitas e cliques contados nas
//    outras lojas, mensagens à equipe de uma loja em que era sócia e os agentes que comprou para ela.
//  - REGISTRA a exclusão em conta_excluida (0053), sem dado pessoal: hash do id antigo, data, motivo e contagens.
// Não excluem por aqui: contas de administrador e as contas das sedes (titulares ou sócias de uma sede). Pix gerado e
// ainda não pago também segura a exclusão até vencer (senão o pagamento chegaria depois, sem conta).
// TODO(dono): devolução de dias pagos e de créditos não usados. Hoje a tela avisa que eles se perdem e não devolve nada.
// TODO(dono): prazo para apagar de vez os pagamentos guardados (a tela diz "pelo prazo que a lei exige").
import { createHash } from "node:crypto";
import fs from "node:fs";
import { sql, id, migrar } from "./db";
import { autenticar, type Usuario } from "./usuarios";
import { ehAdmin } from "./terrenos";
import { saldoDe, lancar, fmtCreditos } from "./creditos";
import { registrar } from "./eventos";
import { SEDE_POR_CHAVE } from "@/office/data/sedes";
import { numeroDaLoja, rotuloLoja } from "@/office/data/numeroLoja";
import { MODELO, type IdModelo } from "@/office/data/modelos";

type Db = typeof sql;

export const CONTA_EXCLUIDAS = "usr_contas_excluidas"; // conta técnica que guarda os pagamentos (migração 0053)
export const PALAVRA_EXCLUIR = "EXCLUIR";
const MOTIVO = "pedido do titular";
const NO_LUGAR = "conta excluída"; // o que entra no lugar de um nome nos registros que ficam guardados
const CLIENTE_EXCLUIDO = "Cliente que excluiu a conta";
const LOJA_ENCERRADA = "Loja encerrada";

export const hashTitular = (uid: string) => createHash("sha256").update(`exclusao:${uid}`).digest("hex");
export const codigoAnonimo = (hash: string) => `exc_${hash.slice(0, 16)}`;
const soGoogle = (senhaHash: string) => senhaHash.startsWith("google:"); // conta do Google sem senha (google.ts)
const dataBR = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export class ErroExclusao extends Error {
  status: number;
  constructor(msg: string, status = 400) { super(msg); this.status = status; }
}

// o que segura a exclusão por este botão (null = pode excluir)
async function bloqueioDe(u: Usuario, db: Db = sql): Promise<string | null> {
  if (ehAdmin(u)) return "Esta é uma conta de administrador do WorkEnd e não pode ser excluída por este botão.";
  const meus = await db<{ chave: string }[]>`SELECT chave FROM terreno WHERE usuario_id = ${u.id} OR ${u.id} = ANY(socios)`;
  const sede = meus.map((t) => SEDE_POR_CHAVE[t.chave]).find(Boolean);
  if (sede) return `Esta conta cuida da sede da ${sede.nome} na cidade e não pode ser excluída por este botão.`;
  // o QR do Pix vale 60 min e a reserva com créditos é devolvida aos 75 (mercadopago.ts › liberarReservasVencidas)
  const [pix] = await db`SELECT 1 FROM pagamento WHERE usuario_id = ${u.id} AND status = 'pendente' AND criado_em > now() - interval '75 minutes' LIMIT 1`;
  if (pix) return "Você tem um Pix gerado há pouco e ainda não pago. Espere ele vencer (em até 1 hora e 15 minutos) ou conclua o pagamento, e depois volte aqui.";
  return null;
}

function rotuloDoLote(chave: string, anexoDe: string | null) {
  const r = rotuloLoja(numeroDaLoja({ chave, anexoDe }));
  return anexoDe ? `Ampliação do ${r || "lote"}` : r || "Lote";
}

// ---------- o que a pessoa perde (mostrado antes de confirmar) ----------
export interface LoteExclusao { rotulo: string; nome: string; ativo: boolean; dias: number; ate: string | null }
export interface ResumoExclusao {
  bloqueio: string | null;
  confirmar: "senha" | "palavra";
  lotes: LoteExclusao[];
  socios: number; // pessoas que perdem o acesso às lojas desta conta
  sociedades: string[]; // lojas de outras pessoas em que a conta é sócia (continuam com o titular)
  creditos: { comprado: number; bonus: number; texto: string };
  unidades: number;
  agentes: string[];
  modelos: string[];
  itens: number;
  outros: string[];
  pagamentos: number; // registros de pagamento que ficam guardados sem identificação
}

export async function resumoExclusao(u: Usuario): Promise<ResumoExclusao> {
  await migrar();
  const uid = u.id, agora = Date.now();
  const [c] = await sql<{ senhaHash: string }[]>`SELECT senha_hash FROM usuario WHERE id = ${uid}`;
  const lotes = await sql<{ chave: string; status: string; empresaNome: string; pagoAte: Date | null; anexoDe: string | null; socios: string[] | null; escritorio: { modelosComprados?: string[] } | null }[]>`
    SELECT chave, status, empresa_nome, pago_ate, anexo_de, socios, escritorio FROM terreno WHERE usuario_id = ${uid} ORDER BY anexo_de NULLS FIRST, reservado_em`;
  const chaves = lotes.map((t) => t.chave);
  const [x] = await sql<{ unidades: number; itens: number; pagamentos: number; barracas: number; anuncios: number }[]>`SELECT
      (SELECT COALESCE(sum(inclusa + comprada), 0)::int FROM ia_carteira WHERE empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid})) AS unidades,
      (SELECT count(*)::int FROM item_comprado WHERE usuario_id = ${uid}) AS itens,
      (SELECT count(*)::int FROM pagamento WHERE usuario_id = ${uid}) AS pagamentos,
      (SELECT count(*)::int FROM barraca WHERE usuario_id = ${uid} AND status = 'paga' AND dia >= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS barracas,
      (SELECT count(*)::int FROM anuncio_praca WHERE usuario_id = ${uid} AND status IN ('em_analise', 'aprovado') AND inicio + dias > (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS anuncios`;
  const agentes = await sql<{ nome: string; cargo: string }[]>`SELECT nome, cargo FROM agente_contratado WHERE terreno_chave = ANY(${sql.array(chaves)}::text[]) AND status = 'ativo' ORDER BY criado_em`;
  const sociedades = await sql<{ empresaNome: string }[]>`SELECT empresa_nome FROM terreno WHERE ${uid} = ANY(socios) AND usuario_id <> ${uid} AND anexo_de IS NULL ORDER BY reservado_em`;
  const outros: string[] = [];
  const [od] = await sql<{ pagoAte: Date }[]>`SELECT pago_ate FROM outdoor WHERE usuario_id = ${uid} AND pago_ate > now() ORDER BY pago_ate DESC LIMIT 1`;
  if (od) outros.push(`O outdoor alugado, que ficaria no ar até ${dataBR(od.pagoAte)}`);
  if (x.barracas) outros.push(x.barracas === 1 ? "A barraca paga na feira" : `As ${x.barracas} barracas pagas na feira`);
  if (x.anuncios) outros.push(x.anuncios === 1 ? "O anúncio pago na Praça de Eventos" : `Os ${x.anuncios} anúncios pagos na Praça de Eventos`);
  const [rua] = await sql<{ nome: string }[]>`SELECT nome FROM rua_nome WHERE usuario_id = ${uid}`;
  if (rua) outros.push(`O nome que você deu à rua (${rua.nome}), que volta ao nome de antes`);
  const [pe] = await sql<{ pagoAte: Date | null }[]>`SELECT pago_ate FROM personagem WHERE usuario_id = ${uid}`;
  if (pe?.pagoAte && new Date(pe.pagoAte).getTime() > agora) outros.push(`O personagem pago até ${dataBR(pe.pagoAte)}`);
  const s = await saldoDe(uid);
  return {
    bloqueio: await bloqueioDe(u),
    confirmar: c && soGoogle(c.senhaHash) ? "palavra" : "senha",
    lotes: lotes.map((t) => {
      const ate = t.status === "ativo" && t.pagoAte ? new Date(t.pagoAte) : null;
      return { rotulo: rotuloDoLote(t.chave, t.anexoDe), nome: t.empresaNome, ativo: t.status === "ativo", dias: ate ? Math.max(0, Math.ceil((ate.getTime() - agora) / 86400_000)) : 0, ate: ate ? dataBR(ate) : null };
    }),
    socios: new Set(lotes.flatMap((t) => (t.socios ?? []).filter((p) => p !== uid))).size,
    sociedades: sociedades.map((t) => t.empresaNome),
    creditos: { comprado: s.comprado, bonus: s.bonus, texto: fmtCreditos(s.total) },
    unidades: x.unidades,
    agentes: agentes.map((a) => `${a.nome} (${a.cargo})`),
    modelos: [...new Set(lotes.flatMap((t) => t.escritorio?.modelosComprados ?? []))].map((m) => MODELO[m as IdModelo]?.nome ?? m),
    itens: x.itens,
    outros,
    pagamentos: x.pagamentos,
  };
}

// ---------- a exclusão ----------
// conf: { senha } para quem tem senha; { palavra: "EXCLUIR" } para a conta só do Google
export async function excluirConta(u: Usuario, conf: { senha?: unknown; palavra?: unknown }) {
  await migrar();
  const [c] = await sql<{ senhaHash: string }[]>`SELECT senha_hash FROM usuario WHERE id = ${u.id}`;
  if (!c) throw new ErroExclusao("Esta conta não existe mais.", 404);
  const antes = await bloqueioDe(u); // admin e sede ficam sabendo antes de digitar a senha
  if (antes) throw new ErroExclusao(antes, 409);
  if (soGoogle(c.senhaHash)) {
    if (String(conf.palavra ?? "").trim() !== PALAVRA_EXCLUIR) throw new ErroExclusao(`Para confirmar, digite ${PALAVRA_EXCLUIR} em letras maiúsculas.`, 403);
  } else if (!(await autenticar(u.email, String(conf.senha ?? "")))) throw new ErroExclusao("A senha não confere.", 403);

  const uid = u.id, hash = hashTitular(uid), anon = codigoAnonimo(hash);
  const arquivos: string[] = [];
  const resumo = await sql.begin(async (tx) => {
    const db = tx as unknown as Db;
    // só nesta transação: a trava dos extratos aceita trocar a identificação (migração 0053)
    await db`SELECT set_config('workend.anonimizar', 'sim', true)`;
    const [eu] = await db<{ email: string; nome: string; empresaNome: string }[]>`SELECT email, nome, empresa_nome FROM usuario WHERE id = ${uid} FOR UPDATE`;
    if (!eu) throw new ErroExclusao("Esta conta não existe mais.", 404);
    const agora = await bloqueioDe(u, db); // de novo, com a conta travada (um Pix pode ter nascido no meio)
    if (agora) throw new ErroExclusao(agora, 409);
    const lotes = (await db<{ chave: string }[]>`SELECT chave FROM terreno WHERE usuario_id = ${uid}`).map((r) => r.chave);
    const empresas = (await db<{ id: string }[]>`SELECT id FROM empresa WHERE usuario_id = ${uid}`).map((r) => r.id);
    const L = sql.array(lotes), E = sql.array(empresas);

    // nomes desta conta: os da pessoa (para achar avisos e e-mails de outras pessoas que a citam) e todos, com os da
    // empresa e dos agentes (para limpar as descrições do que fica guardado)
    const nomes = await db<{ n: string; pessoa: boolean }[]>`SELECT DISTINCT btrim(n) AS n, pessoa FROM (
        SELECT ${eu.nome}::text AS n, true AS pessoa
        UNION ALL SELECT nome, true FROM personagem WHERE usuario_id = ${uid}
        UNION ALL SELECT nome, true FROM perfil_cadastro WHERE usuario_id = ${uid}
        UNION ALL SELECT ${eu.empresaNome}::text, false
        UNION ALL SELECT empresa_nome, false FROM terreno WHERE usuario_id = ${uid}
        UNION ALL SELECT empresa_nome, false FROM terreno_arquivo WHERE usuario_id = ${uid}
        UNION ALL SELECT nome, false FROM empresa WHERE usuario_id = ${uid}
        UNION ALL SELECT nome, false FROM agente WHERE empresa_id = ANY(${E}::text[])
      ) x WHERE length(btrim(n)) >= 3`;
    const daPessoa = [...new Set(nomes.filter((x) => x.pessoa && x.n.length >= 5).map((x) => x.n))];
    const todos = [...new Set(nomes.map((x) => x.n))].sort((a, b) => b.length - a.length);
    const emJson = todos.filter((n) => !/["\\]/.test(n)); // dentro de JSON só nomes sem aspas nem barra
    const empresasDaConta = [...new Set(nomes.filter((x) => !x.pessoa).map((x) => x.n))];

    // registros de outras pessoas que levam a algo desta conta (o ref e o link dos avisos)
    const ligados = [uid, ...(await db<{ id: string }[]>`
        SELECT id FROM agendamento WHERE cliente_id = ${uid} OR dono_id = ${uid}
        UNION SELECT id FROM pedido WHERE cliente_usuario_id = ${uid} OR usuario_id = ${uid}
        UNION SELECT id FROM negociacao WHERE de_id = ${uid} OR para_id = ${uid}
        UNION SELECT id FROM evento_praca WHERE usuario_id = ${uid}`).map((r) => r.id)];

    // ===== 1) o que fica guardado sem identificação =====
    // créditos: o saldo é encerrado com um ajuste (perdido, sem devolução) e o extrato troca o titular pelo código anônimo
    const s = await saldoDe(uid, db);
    if (s.comprado > 0 || s.bonus > 0) await lancar(db, uid, { tipo: "ajuste", comprado: -Math.round(s.comprado * 100), bonus: -Math.round(s.bonus * 100), descricao: "Conta excluída a pedido do titular: saldo encerrado", motivo: MOTIVO, chave: `exclusao:${anon}` });
    const creditos = await db`UPDATE credito_lancamento SET usuario_id = ${anon}, chave = replace(chave, ${uid}, ${anon}) WHERE usuario_id = ${uid}`;
    await db`UPDATE credito_lancamento SET chave = replace(chave, ${uid}, ${anon}) WHERE position(${uid} in chave) > 0`; // indicação no extrato de quem indicou
    await db`DELETE FROM credito_carteira WHERE usuario_id = ${uid}`;
    // unidades de IA: o mesmo, por empresa
    for (const emp of empresas) {
      const [cart] = await db<{ inclusa: number; comprada: number }[]>`SELECT inclusa, comprada FROM ia_carteira WHERE empresa_id = ${emp} FOR UPDATE`;
      if (cart && (cart.inclusa > 0 || cart.comprada > 0)) await db`INSERT INTO ia_lancamento (id, empresa_id, tipo, inclusa, comprada, saldo_inclusa, saldo_comprada, descricao, chave)
        VALUES (${id("il")}, ${emp}, 'ajuste', ${-cart.inclusa}, ${-cart.comprada}, 0, 0, 'Conta excluída a pedido do titular: saldo encerrado', ${`exclusao:${emp.split(uid).join(anon)}`})`;
    }
    const unidades = await db`UPDATE ia_lancamento SET empresa_id = replace(empresa_id, ${uid}, ${anon}), agente_id = replace(agente_id, ${uid}, ${anon}), chave = replace(chave, ${uid}, ${anon})
      WHERE empresa_id = ANY(${E}::text[]) OR position(${uid} in COALESCE(chave, '')) > 0 OR position(${uid} in COALESCE(agente_id, '')) > 0`;
    await db`DELETE FROM ia_carteira WHERE empresa_id = ANY(${E}::text[])`;
    for (const n of todos) {
      await db`UPDATE credito_lancamento SET descricao = replace(descricao, ${n}, ${NO_LUGAR}) WHERE usuario_id = ${anon} AND position(${n} in descricao) > 0`;
      await db`UPDATE ia_lancamento SET descricao = replace(descricao, ${n}, ${NO_LUGAR}) WHERE position(${anon} in empresa_id) > 0 AND position(${n} in descricao) > 0`;
    }
    // pagamentos: vão para a conta técnica; do bruto do Mercado Pago ficam só os campos sem dado pessoal (sai o pagador)
    const pagamentos = await db`UPDATE pagamento SET usuario_id = ${CONTA_EXCLUIDAS}, titular_excluido = ${anon}, idem = NULL, terreno_chave = replace(terreno_chave, ${uid}, ${anon}),
      bruto = CASE WHEN bruto IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
        'id', bruto->'id', 'status', bruto->'status', 'status_detail', bruto->'status_detail',
        'transaction_amount', bruto->'transaction_amount', 'currency_id', bruto->'currency_id',
        'date_created', bruto->'date_created', 'date_approved', bruto->'date_approved', 'date_last_updated', bruto->'date_last_updated', 'money_release_date', bruto->'money_release_date',
        'payment_method_id', bruto->'payment_method_id', 'payment_type_id', bruto->'payment_type_id', 'external_reference', bruto->'external_reference',
        'total_paid_amount', bruto->'transaction_details'->'total_paid_amount', 'net_received_amount', bruto->'transaction_details'->'net_received_amount',
        'anonimizado', true)) END
      WHERE usuario_id = ${uid}`;
    // atividade de pagamento (o admin acompanha devoluções por ela): fica, sem o titular
    for (const n of emJson) await db`UPDATE atividade SET titulo = replace(titulo, ${n}, ${NO_LUGAR}), dados = replace(dados::text, ${n}, ${NO_LUGAR})::jsonb WHERE tipo = 'pagamento' AND usuario_id = ${uid} AND (position(${n} in titulo) > 0 OR position(${n} in COALESCE(dados::text, '')) > 0)`;
    await db`UPDATE atividade SET usuario_id = NULL, titulo = replace(titulo, ${uid}, ${anon}), dados = replace(dados::text, ${uid}, ${anon})::jsonb
      WHERE tipo = 'pagamento' AND (usuario_id = ${uid} OR position(${uid} in COALESCE(dados::text, '')) > 0)`;

    // ===== 2) o que é de outras pessoas e cita esta conta: fica, sem identificar =====
    await db`UPDATE terreno SET socios = array_remove(socios, ${uid}), atualizado_em = now() WHERE ${uid} = ANY(socios)`; // sócia: só sai da sociedade
    await db`UPDATE agente_contratado SET usuario_id = ${anon} WHERE usuario_id = ${uid} AND NOT (terreno_chave = ANY(${L}::text[]))`; // agente comprado para a loja de outra pessoa continua nela
    await db`UPDATE mensagem SET autor = replace(autor, ${uid}, ${anon}) WHERE visitante_id IS NULL AND position(${uid} in autor) > 0`; // o que disse à equipe da loja de outra pessoa
    await db`UPDATE agendamento SET cliente_id = NULL, nome = ${CLIENTE_EXCLUIDO}, contato = '', obs = '',
        status = CASE WHEN status = 'marcado' AND inicio > now() THEN 'cancelado' ELSE status END,
        cancelado_por = CASE WHEN status = 'marcado' AND inicio > now() THEN 'cliente' ELSE cancelado_por END, atualizado_em = now()
      WHERE cliente_id = ${uid} AND dono_id <> ${uid}`;
    await db`UPDATE pedido SET cliente_usuario_id = NULL, cliente_nome = ${CLIENTE_EXCLUIDO}, cliente_contato = '',
        status = CASE WHEN status = 'aguardando' THEN 'cancelado' ELSE status END,
        cancelado_por = CASE WHEN status = 'aguardando' THEN 'cliente' ELSE cancelado_por END, atualizado_em = now()
      WHERE cliente_usuario_id = ${uid} AND usuario_id <> ${uid}`;
    await db`UPDATE passaporte_carimbo SET dono_id = ${anon}, empresa_nome = ${LOJA_ENCERRADA} WHERE dono_id = ${uid} AND usuario_id <> ${uid}`;
    await db`UPDATE morador_pedido SET empresa_nome = ${LOJA_ENCERRADA} WHERE usuario_id <> ${uid} AND loja_chave = ANY(${L}::text[]) AND empresa_nome = ANY(${sql.array(empresasDaConta)}::text[])`;
    await db`DELETE FROM visita_dia WHERE dono_id = ${uid}`;
    await db`DELETE FROM clique_loja WHERE dono_id = ${uid}`;
    await db`UPDATE visita_dia SET visitante = ${anon} WHERE visitante = ${uid}`; // a visita continua contando na outra loja
    await db`UPDATE clique_loja SET visitante = ${anon} WHERE visitante = ${uid}`;

    // ===== 3) o que é apagado =====
    const avisos = await db`DELETE FROM aviso a WHERE a.usuario_id = ${uid}
      OR EXISTS (SELECT 1 FROM unnest(${sql.array(ligados)}::text[]) i WHERE position(i in a.ref) > 0 OR position(i in COALESCE(a.link, '')) > 0)
      OR EXISTS (SELECT 1 FROM unnest(${sql.array(daPessoa)}::text[]) n WHERE position(n in a.titulo) > 0 OR position(n in COALESCE(a.texto, '')) > 0)`;
    await db`DELETE FROM atividade WHERE usuario_id = ${uid} OR position(${uid} in titulo) > 0 OR position(${uid} in COALESCE(dados::text, '')) > 0`;
    await db`DELETE FROM email_enviado e WHERE lower(e.para) = ${eu.email.toLowerCase()}
      OR EXISTS (SELECT 1 FROM unnest(${sql.array(daPessoa)}::text[]) n WHERE position(n in e.assunto) > 0)`;
    await db`DELETE FROM outdoor WHERE usuario_id = ${uid}`;
    await db`DELETE FROM rua_nome WHERE usuario_id = ${uid}`;
    await db`DELETE FROM chave_api WHERE usuario_id = ${uid}`;
    await db`DELETE FROM agente_contratado WHERE terreno_chave = ANY(${L}::text[])`; // senão iria para quem comprar o lote depois
    await db`DELETE FROM seguidor_envio WHERE dono_id = ${uid}`;
    arquivos.push(...(await db<{ caminho: string }[]>`SELECT caminho FROM arquivo WHERE empresa_id = ANY(${E}::text[])`).map((r) => r.caminho));
    await db`DELETE FROM mural WHERE empresa_id = ANY(${E}::text[])`;
    await db`DELETE FROM empresa WHERE usuario_id = ${uid}`; // agentes, conversas, conexões, conectores, chaves e tarefas (cascata)
    const terrenos = await db`DELETE FROM terreno WHERE usuario_id = ${uid}`; // lote, ampliação e quiosque voltam a ficar à venda
    const [fim] = await db`DELETE FROM usuario WHERE id = ${uid} RETURNING id`; // o resto vai em cascata
    if (!fim) throw new ErroExclusao("Esta conta não existe mais.", 404);

    // ===== 4) o registro, sem dado pessoal =====
    const r = { lotes: terrenos.count, empresas: empresas.length, pagamentos: pagamentos.count, extratoCreditos: creditos.count, extratoUnidades: unidades.count, avisos: avisos.count };
    await db`INSERT INTO conta_excluida (titular_hash, motivo, resumo) VALUES (${hash}, ${MOTIVO}, ${sql.json(r)}) ON CONFLICT (titular_hash) DO NOTHING`;
    return r;
  });
  for (const f of arquivos) fs.promises.unlink(f).catch(() => {}); // arquivos enviados pela empresa, se houver
  void registrar("admin", "Conta excluída a pedido do titular", { dados: { detalhes: `Registro ${hash.slice(0, 12)} em conta_excluida. ${resumo.pagamentos} pagamento(s) guardado(s) sem identificação.` } });
  return { hash, codigo: anon, ...resumo };
}
