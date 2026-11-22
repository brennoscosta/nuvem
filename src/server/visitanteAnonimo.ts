// Visitante sem conta (WE-14, 21/11/2026, decisão do dono em três níveis): sem conta, a pessoa entra na loja, vê a vitrine
// e fala com a recepcionista (e com o setor para onde ela encaminha), com limite por visitante. A conta grátis traz o
// personagem, o passaporte, os cupons e as missões; o pago, os itens de visual e o personagem profissional.
//  - quem é: um cookie próprio, assinado (HMAC com o segredo das sessões), com um código aleatório (anon_...). Sem nome,
//    e-mail, IP nem qualquer dado pessoal. Vale 30 dias.
//  - onde fica a conversa: tabela mensagem, em nome da conta técnica "Visitante sem conta" (migração 0057), com o código
//    em visitante_anonimo (agentes.ts › gravarMensagem e listarMensagens). O dono lê na lista de visitantes.
//  - limites: por cookie e por IP (para quem apaga o cookie), na memória do processo como os outros (limite.ts).
//  - passaporte, carimbo, cupom, agenda e pedido pela atendente continuam exigindo conta.
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { segredoSessao } from "./segredo";
import { bloqueio, contar } from "./limite";

export const CONTA_SEM_CONTA = "usr_visitante_sem_conta"; // conta técnica (migração 0057)
export const NOME_SEM_CONTA = "Visitante sem conta";
export const PREFIXO_ANONIMO = "anon_";
const COOKIE = "we_visitante";
const DIAS = 30;

// Limites do visitante sem conta, em 24 horas. Quem tem conta segue com os de equipeCliente.ts (30 por loja, 120 no total).
export const SEM_CONTA_LOJA_DIA = 10; // mensagens de um visitante sem conta (o cookie) numa loja
export const SEM_CONTA_DIA = 30; // do mesmo visitante sem conta, somando todas as lojas
export const SEM_CONTA_IP_LOJA_DIA = 20; // do mesmo IP, sem conta, numa loja (quem apaga o cookie). O dobro: muita gente divide o IP (rede do celular, Wi-Fi)
export const SEM_CONTA_IP_DIA = 60; // do mesmo IP, sem conta, somando todas as lojas
export const MSG_LIMITE_SEM_CONTA = "Você chegou ao limite de mensagens sem conta por hoje. Crie a sua conta grátis para continuar a conversa, ou fale com a loja pelo WhatsApp.";

// canal "whatsapp" (WE-18, src/server/whatsapp.ts): quem escreve pelo WhatsApp da loja também é um visitante sem conta,
// com o código anon_wa_... (HMAC do número com a empresa) e um limite próprio por conversa (limiteWhatsApp)
export interface VisitanteAnonimo { anonimo: true; id: string; nome: string; canal?: "whatsapp" }
export const ehAnonimo = (id: string | null | undefined): boolean => !!id && id.startsWith(PREFIXO_ANONIMO);
export const ehVisitanteAnonimo = (v: unknown): v is VisitanteAnonimo => !!v && typeof v === "object" && (v as VisitanteAnonimo).anonimo === true;

async function assinar(vid: string) { return createHmac("sha256", "visitante:" + (await segredoSessao())).update(vid).digest("base64url").slice(0, 32); }
async function lerCookie(valor: string | undefined): Promise<string | null> {
  if (!valor) return null;
  const i = valor.lastIndexOf("."); if (i < 0) return null;
  const vid = valor.slice(0, i), sig = valor.slice(i + 1);
  if (!/^anon_[A-Za-z0-9_-]{16}$/.test(vid)) return null;
  let esperado: string;
  try { esperado = await assinar(vid); } catch { return null; } // sem banco não há como conferir
  return sig.length === esperado.length && timingSafeEqual(Buffer.from(sig), Buffer.from(esperado)) ? vid : null;
}

// o visitante sem conta deste navegador; criar = true (rotas que gravam a conversa) cria o cookie quando ainda não existe
export async function visitanteAnonimo(criar = false): Promise<VisitanteAnonimo | null> {
  const jar = await cookies();
  let vid = await lerCookie(jar.get(COOKIE)?.value);
  if (!vid) {
    if (!criar) return null;
    vid = PREFIXO_ANONIMO + randomBytes(12).toString("base64url"); // 16 letras
    jar.set(COOKIE, `${vid}.${await assinar(vid)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DIAS * 86400 });
  }
  return { anonimo: true, id: vid, nome: NOME_SEM_CONTA };
}

// WhatsApp (WE-18): o limite é por conversa (o número), não por cookie nem IP (a mensagem chega da Meta). Protege as
// unidades de IA da loja de um robô respondendo outro robô.
export const WHATS_CONVERSA_DIA = 60; // mensagens de um número numa loja em 24 h
export const WHATS_CONVERSA_MIN = 8; // do mesmo número em 1 minuto
export function limiteWhatsApp(numero: number, vid: string): boolean {
  const chaves: [string, number, number][] = [[`whats:dia:${numero}:${vid}`, WHATS_CONVERSA_DIA, 24 * 60], [`whats:min:${numero}:${vid}`, WHATS_CONVERSA_MIN, 1]];
  if (chaves.some(([k, max]) => bloqueio(k, max))) return true;
  for (const [k, , minutos] of chaves) contar(k, minutos);
  return false;
}

// confere e conta uma mensagem do visitante sem conta numa loja: true = passou do limite (nada é contado)
export function limiteSemConta(numero: number, vid: string, ip: string | null | undefined): boolean {
  const i = ip || "sem-ip";
  const chaves: [string, number][] = [[`semconta:loja:${numero}:${vid}`, SEM_CONTA_LOJA_DIA], [`semconta:${vid}`, SEM_CONTA_DIA], [`semconta:ip:loja:${numero}:${i}`, SEM_CONTA_IP_LOJA_DIA], [`semconta:ip:${i}`, SEM_CONTA_IP_DIA]];
  if (chaves.some(([k, max]) => bloqueio(k, max))) return true;
  for (const [k] of chaves) contar(k, 24 * 60);
  return false;
}
