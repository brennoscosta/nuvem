// Entrar no admin do WorkEnd com a senha única (ADMIN_SENHA): abre a sessão da conta do dono (ADMIN_EMAIL).
// Se a conta ainda não existir no banco, cria com senha aleatória (o dono entra por aqui ou troca depois).
import { randomBytes } from "node:crypto";
import { senhaConfere, temSenhaConfigurada } from "@/server/auth";
import { abrirSessao, criarUsuario, garantirAdmin } from "@/server/usuarios";
import { ADMIN_EMAIL } from "@/server/terrenos";
import { ok, erro, corpo } from "@/server/http";
import { bloqueioAdmin, contarAdmin, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    if (!temSenhaConfigurada()) return erro("ADMIN_SENHA não configurada no CapRover.", 503);
    const { senha } = await corpo<{ senha?: string }>(req);
    const espera = bloqueioAdmin(req);
    if (espera) return demais(espera);
    if (!senhaConfere(senha ?? "")) { contarAdmin(req); return erro("Senha não confere.", 401); }
    let u = await garantirAdmin(ADMIN_EMAIL);
    if (!u) { await criarUsuario({ email: ADMIN_EMAIL, senha: randomBytes(18).toString("base64url"), nome: "Brenno", empresaNome: "WorkEnd" }); u = await garantirAdmin(ADMIN_EMAIL); }
    if (!u) return erro("Não consegui abrir a conta do admin.", 500);
    await abrirSessao(u.id);
    return ok(u);
  } catch (e) { return erro(e); }
}
