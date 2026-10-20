// Autenticação do admin: senha única (ADMIN_SENHA no CapRover) + cookie de sessão assinado (HMAC).
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "nuvem_admin";
const DIAS = 30;

function segredo() {
  // deriva do próprio ADMIN_SENHA (ou de um SESSAO_SEGREDO opcional) pra não precisar de mais uma variável
  return process.env.SESSAO_SEGREDO || ("nuvem:" + (process.env.ADMIN_SENHA ?? ""));
}
function assinar(payload: string) {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}
export function temSenhaConfigurada() { return !!process.env.ADMIN_SENHA; }

export function senhaConfere(senha: string) {
  const esperada = process.env.ADMIN_SENHA ?? "";
  if (!esperada) return false;
  const a = Buffer.from(senha), b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function gerarToken() {
  const exp = Date.now() + DIAS * 86400_000;
  const payload = `admin.${exp}`;
  return `${payload}.${assinar(payload)}`;
}
export function tokenValido(token: string | undefined) {
  if (!token) return false;
  const i = token.lastIndexOf("."); if (i < 0) return false;
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  const esperado = assinar(payload);
  if (sig.length !== esperado.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function ehAdmin() {
  const jar = await cookies();
  return tokenValido(jar.get(COOKIE)?.value);
}
export async function entrar(senha: string) {
  if (!senhaConfere(senha)) return false;
  const jar = await cookies();
  jar.set(COOKIE, gerarToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DIAS * 86400 });
  return true;
}
export async function sair() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// Resposta padrão pra rota protegida
export function naoAutorizado() {
  return Response.json({ erro: "Faça login como admin." }, { status: 401 });
}
