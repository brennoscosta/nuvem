// Cadastro de usuário do WorkEnd (e-mail + senha). Abre a sessão na hora.
import { criarUsuario, abrirSessao } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { enviarEmail } from "@/server/email";
import { registrar } from "@/server/eventos";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
import { registrarIndicacao } from "@/server/ofertas";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const chave = `cadastro:ip:${ipDe(req)}`;
    const espera = bloqueio(chave, 5);
    if (espera) return demais(espera);
    contar(chave, 60);
    const d = await corpo<{ email: string; senha: string; nome: string; empresaNome?: string }>(req);
    const u = await criarUsuario({ email: d.email ?? "", senha: d.senha ?? "", nome: d.nome ?? "", empresaNome: d.empresaNome });
    await abrirSessao(u.id);
    // chegou pelo link de indicação de uma empresa do mapa (cookie we_ind, do src/proxy.ts)
    const ind = (await cookies()).get("we_ind")?.value; if (ind) await registrarIndicacao(u.id, ind).catch(() => null);
    void registrar("cadastro", `${u.nome} criou conta (${u.empresaNome || "sem empresa"})`, { usuarioId: u.id });
    void enviarEmail("cadastro", u.email, { nome: u.nome, email: u.email, empresa: u.empresaNome, link_mapa: "https://workend.online/mundo" });
    return ok(u, 201);
  } catch (e) { return erro(e, 400); }
}
