// Usuários do WorkEnd: cadastro (e-mail + senha), login e sessão por cookie assinado. Separado do admin do escritório (auth.ts).
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql, id, migrar } from "./db";

export interface Usuario { id: string; email: string; nome: string; empresaNome: string; interesseEm: Date | null; criadoEm: Date; ultimoAcesso: Date | null }

const COOKIE = "workend_sessao";
const DIAS = 30;
const segredo = () => process.env.SESSAO_SEGREDO || ("workend:" + (process.env.ADMIN_SENHA ?? ""));
const assinar = (p: string) => createHmac("sha256", segredo()).update(p).digest("base64url");

function hashSenha(senha: string) {
  const salt = randomBytes(16).toString("base64url");
  return `${salt}.${scryptSync(senha, salt, 32).toString("base64url")}`;
}
function senhaOk(senha: string, hash: string) {
  const [salt, h] = hash.split(".");
  if (!salt || !h) return false;
  const a = scryptSync(senha, salt, 32), b = Buffer.from(h, "base64url");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function emailValido(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }



export async function criarUsuario(d: { email: string; senha: string; nome: string; empresaNome?: string }) {
  await migrar();
  const email = d.email.trim().toLowerCase();
  if (!emailValido(email)) throw new Error("E-mail inválido.");
  if (d.senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  if (!d.nome.trim()) throw new Error("Diga seu nome.");
  const [existe] = await sql`SELECT 1 FROM usuario WHERE email = ${email}`;
  if (existe) throw new Error("Já existe uma conta com esse e-mail. Entre com ela.");
  const [u] = await sql<Usuario[]>`INSERT INTO usuario (id, email, nome, empresa_nome, senha_hash) VALUES (${id("usr")}, ${email}, ${d.nome.trim().slice(0, 80)}, ${(d.empresaNome ?? "").trim().slice(0, 80)}, ${hashSenha(d.senha)}) RETURNING id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso`;
  return u;
}

export async function autenticar(email: string, senha: string) {
  await migrar();
  const [r] = await sql<(Usuario & { senhaHash: string })[]>`SELECT id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, senha_hash FROM usuario WHERE email = ${email.trim().toLowerCase()}`;
  if (!r || !senhaOk(senha, r.senhaHash)) return null;
  await sql`UPDATE usuario SET ultimo_acesso = now() WHERE id = ${r.id}`;
  const { senhaHash: _s, ...u } = r; void _s;
  return u as Usuario;
}

export async function abrirSessao(usuarioId: string) {
  const exp = Date.now() + DIAS * 86400_000;
  const payload = `${usuarioId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${assinar(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DIAS * 86400 });
}
export async function fecharSessao() { (await cookies()).delete(COOKIE); }

export async function usuarioAtual(): Promise<Usuario | null> {
  const tk = (await cookies()).get(COOKIE)?.value; if (!tk) return null;
  const i = tk.lastIndexOf("."); if (i < 0) return null;
  const payload = tk.slice(0, i), sig = tk.slice(i + 1), esperado = assinar(payload);
  if (sig.length !== esperado.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  const [uid, exp] = payload.split(".");
  if (!uid || Number(exp) < Date.now()) return null;
  await migrar();
  const [u] = await sql<Usuario[]>`SELECT id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso FROM usuario WHERE id = ${uid}`;
  return u ?? null;
}

export async function marcarInteresse(usuarioId: string) {
  await sql`UPDATE usuario SET interesse_em = COALESCE(interesse_em, now()) WHERE id = ${usuarioId}`;
}
