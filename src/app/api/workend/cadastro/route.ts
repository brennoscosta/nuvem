// Cadastro de usuário do WorkEnd (e-mail + senha). Abre a sessão na hora.
import { criarUsuario, abrirSessao } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { enviarEmail } from "@/server/email";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const d = await corpo<{ email: string; senha: string; nome: string; empresaNome?: string }>(req);
    const u = await criarUsuario({ email: d.email ?? "", senha: d.senha ?? "", nome: d.nome ?? "", empresaNome: d.empresaNome });
    await abrirSessao(u.id);
    void enviarEmail("cadastro", u.email, { nome: u.nome, email: u.email, empresa: u.empresaNome, link_mapa: "https://workend.online/mundo" });
    return ok(u, 201);
  } catch (e) { return erro(e, 400); }
}
