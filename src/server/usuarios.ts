// Usuários do WorkEnd: cadastro (e-mail + senha), login e sessão por cookie assinado. Separado do admin do escritório (auth.ts).
import { cookies } from "next/headers";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql, id, migrar } from "./db";
import { segredoSessao } from "./segredo";
import { enviarEmail } from "./email";

export interface Usuario { id: string; email: string; nome: string; empresaNome: string; interesseEm: Date | null; criadoEm: Date; ultimoAcesso: Date | null; papel: "dono" | "admin"; banidoEm: Date | null; banidoMotivo: string | null }

const COOKIE = "workend_sessao";
const DIAS = 30;
const assinar = async (p: string) => createHmac("sha256", "workend:" + (await segredoSessao())).update(p).digest("base64url");
// scrypt assíncrono: o síncrono travava o servidor inteiro a cada tentativa de senha
const scryptA = promisify(scrypt) as (senha: string, salt: string, tamanho: number) => Promise<Buffer>;

async function hashSenha(senha: string) {
  const salt = randomBytes(16).toString("base64url");
  return `${salt}.${(await scryptA(senha, salt, 32)).toString("base64url")}`;
}
async function senhaOk(senha: string, hash: string) {
  const [salt, h] = hash.split(".");
  if (!salt || !h) return false;
  const a = await scryptA(senha, salt, 32), b = Buffer.from(h, "base64url");
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
  const [u] = await sql<Usuario[]>`INSERT INTO usuario (id, email, nome, empresa_nome, senha_hash) VALUES (${id("usr")}, ${email}, ${d.nome.trim().slice(0, 80)}, ${(d.empresaNome ?? "").trim().slice(0, 80)}, ${await hashSenha(d.senha)}) RETURNING id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, papel, banido_em, banido_motivo`;
  return u;
}

export async function autenticar(email: string, senha: string) {
  await migrar();
  const [r] = await sql<(Usuario & { senhaHash: string })[]>`SELECT id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, papel, banido_em, banido_motivo, senha_hash FROM usuario WHERE email = ${email.trim().toLowerCase()}`;
  if (!r || !(await senhaOk(senha, r.senhaHash))) return null;
  await sql`UPDATE usuario SET ultimo_acesso = now() WHERE id = ${r.id}`;
  const { senhaHash: _s, ...u } = r; void _s;
  return u as Usuario;
}

export async function abrirSessao(usuarioId: string) {
  const exp = Date.now() + DIAS * 86400_000;
  const payload = `${usuarioId}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${await assinar(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DIAS * 86400 });
}
export async function fecharSessao() { (await cookies()).delete(COOKIE); }

export async function usuarioAtual(): Promise<Usuario | null> {
  const tk = (await cookies()).get(COOKIE)?.value; if (!tk) return null;
  const i = tk.lastIndexOf("."); if (i < 0) return null;
  const payload = tk.slice(0, i), sig = tk.slice(i + 1), esperado = await assinar(payload);
  if (sig.length !== esperado.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  const [uid, exp] = payload.split(".");
  if (!uid || Number(exp) < Date.now()) return null;
  await migrar();
  const [r] = await sql<(Usuario & { senhaTrocadaEm: Date | null })[]>`SELECT id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, papel, banido_em, banido_motivo, senha_trocada_em FROM usuario WHERE id = ${uid}`;
  if (!r) return null;
  const { senhaTrocadaEm, ...u } = r;
  // sessão aberta antes de trocar a senha não vale mais (5 s de folga entre o relógio do banco e o do aplicativo)
  if (senhaTrocadaEm && Number(exp) - DIAS * 86400_000 < new Date(senhaTrocadaEm).getTime() - 5000) return null;
  return u as Usuario;
}

// ---------- nova senha por link ----------
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export async function criarLinkSenha(usuarioId: string, horas = 1) {
  await migrar();
  const token = randomBytes(32).toString("base64url");
  await sql`DELETE FROM redefinicao_senha WHERE usuario_id = ${usuarioId}`;
  await sql`INSERT INTO redefinicao_senha (token_hash, usuario_id, expira_em) VALUES (${hashToken(token)}, ${usuarioId}, now() + make_interval(hours => ${horas}))`;
  return `https://workend.online/redefinir?t=${token}`;
}
export async function pedirNovaSenha(email: string) {
  await migrar();
  const [u] = await sql<{ id: string; nome: string; email: string }[]>`SELECT id, nome, email FROM usuario WHERE email = ${email} AND banido_em IS NULL`;
  if (!u) return;
  await enviarEmail("senha", u.email, { nome: u.nome, link_senha: await criarLinkSenha(u.id) });
}
export async function trocarSenhaPorLink(token: string, senha: string) {
  await migrar();
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const hash = await hashSenha(senha);
  return sql.begin(async (tx) => {
    const [r] = await tx<{ usuarioId: string }[]>`UPDATE redefinicao_senha SET usada_em = now() WHERE token_hash = ${hashToken(token)} AND usada_em IS NULL AND expira_em > now() RETURNING usuario_id`;
    if (!r) throw new Error("Este link expirou ou já foi usado.");
    await tx`UPDATE usuario SET senha_hash = ${hash}, senha_trocada_em = now() WHERE id = ${r.usuarioId}`;
    return r.usuarioId;
  });
}

// Garante que a conta do dono tem papel admin e devolve ela (null se não existir)
export async function garantirAdmin(email: string): Promise<Usuario | null> {
  await migrar();
  const [u] = await sql<Usuario[]>`UPDATE usuario SET papel = 'admin', ultimo_acesso = now() WHERE email = ${email.toLowerCase()} RETURNING id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, papel, banido_em, banido_motivo`;
  return u ?? null;
}

export async function marcarInteresse(usuarioId: string) {
  await sql`UPDATE usuario SET interesse_em = COALESCE(interesse_em, now()) WHERE id = ${usuarioId}`;
}

// ---------- admin ----------
export interface UsuarioAdmin extends Usuario { lote: string | null; loteStatus: string | null }
export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  await migrar();
  return sql<UsuarioAdmin[]>`SELECT u.id, u.email, u.nome, u.empresa_nome, u.interesse_em, u.criado_em, u.ultimo_acesso, u.papel, u.banido_em, u.banido_motivo, t.chave AS lote, t.status AS lote_status
    FROM usuario u LEFT JOIN terreno t ON t.usuario_id = u.id ORDER BY u.criado_em DESC`;
}
