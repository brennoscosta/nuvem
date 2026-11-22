// Página de planos (WE-19, 22/11/2026): quando o Equipe aparece e o formulário "Fale com a gente" (Sede sob consulta e o
// interesse no Equipe). O contato fica na tabela plano_contato (migração 0061), avisa o admin no sino e aparece em
// /app/admin. Nada de e-mail nem WhatsApp fixo do WorkEnd: o dono ainda não definiu (TODO do dono).
import { sql, id, migrar } from "./db";
import { avisar } from "./avisos";
import { ADMIN_EMAIL } from "./terrenos";
import type { Usuario } from "./usuarios";
import { whatsappLigado } from "./whatsappMeta";
import { ehPlanoContato, PLANOS_CONTATO, type PlanoContato } from "@/office/data/planos";

// O Equipe (R$ 297) só aparece quando o WhatsApp da atendente (WE-18) estiver ligado: a mesma condição da WE-18
// (whatsappMeta.ts › whatsappLigado, pela WHATSAPP_CHAVE; junção v101) ou a chave PLANO_EQUIPE=1. PLANO_EQUIPE=0 esconde
// mesmo com o WhatsApp ligado.
export function planoEquipeLigado() {
  const chave = process.env.PLANO_EQUIPE?.trim();
  if (chave === "0") return false;
  if (chave === "1") return true;
  return whatsappLigado();
}

const limpa = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/\s+/g, " ").trim().slice(0, max);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
// WhatsApp ou telefone com DDD (10 a 13 algarismos, com ou sem 55) ou e-mail
export function contatoValido(c: string) {
  if (EMAIL.test(c)) return true;
  const d = c.replace(/\D/g, "");
  return /^[\d\s()+.-]+$/.test(c) && d.length >= 10 && d.length <= 13;
}

export interface ContatoPlano { id: string; plano: PlanoContato; nome: string; empresa: string; contato: string; mensagem: string; usuarioId: string | null; email: string | null; origem: string; criadoEm: Date }

export async function registrarContatoPlano(b: Record<string, unknown>, u: Usuario | null) {
  await migrar();
  if (!ehPlanoContato(b.plano)) throw new Error("Escolha o plano.");
  if (b.plano === "equipe" && !planoEquipeLigado()) throw new Error("Este plano ainda não está disponível.");
  const nome = limpa(b.nome, 80), empresa = limpa(b.empresa, 80), contato = limpa(b.contato, 120), mensagem = limpa(b.mensagem, 600);
  const origem = limpa(b.origem, 40);
  if (nome.length < 2) throw new Error("Escreva o seu nome.");
  if (!contatoValido(contato)) throw new Error("Deixe um WhatsApp com DDD ou um e-mail para a gente responder.");
  const cid = id("pc");
  await sql`INSERT INTO plano_contato (id, plano, nome, empresa, contato, mensagem, usuario_id, origem)
    VALUES (${cid}, ${b.plano}, ${nome}, ${empresa}, ${contato}, ${mensagem}, ${u?.id ?? null}, ${origem})`;
  // aviso no sino de cada admin (a conta do dono e quem ele promoveu)
  const admins = await sql<{ id: string }[]>`SELECT id FROM usuario WHERE (papel = 'admin' OR email = ${ADMIN_EMAIL}) AND banido_em IS NULL`;
  const quem = empresa ? `${nome}, da ${empresa}` : nome;
  for (const a of admins) void avisar(a.id, { tipo: "sistema", ref: `plano-contato:${cid}`, titulo: `Contato pelo plano ${PLANOS_CONTATO[b.plano]}: ${quem}`, texto: mensagem || "Pediu para a equipe entrar em contato.", link: "/app/admin#contatos-planos" });
  return { ok: true, id: cid };
}

export async function listarContatosPlano(limite = 200): Promise<ContatoPlano[]> {
  await migrar();
  return sql<ContatoPlano[]>`SELECT c.id, c.plano, c.nome, c.empresa, c.contato, c.mensagem, c.usuario_id, u.email, c.origem, c.criado_em
    FROM plano_contato c LEFT JOIN usuario u ON u.id = c.usuario_id ORDER BY c.criado_em DESC LIMIT ${limite}`;
}
