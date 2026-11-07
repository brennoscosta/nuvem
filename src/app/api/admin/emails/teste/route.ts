// Manda um e-mail de teste do modelo (com as variáveis de exemplo) pro próprio admin, ou devolve a prévia em HTML.
import { enviarEmail, obterModelo, preencher, moldura, EXEMPLO, type ChaveEmail } from "@/server/email";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../../_guarda";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const admin = await exigirAdmin();
    const { chave, assunto, html, enviar } = await corpo<{ chave: ChaveEmail; assunto?: string; html?: string; enviar?: boolean }>(req);
    if (enviar) return ok(await enviarEmail(chave, admin.email, EXEMPLO));
    const m = await obterModelo(chave);
    return ok({ assunto: preencher(assunto ?? m.assunto, EXEMPLO), html: moldura(preencher(html ?? m.html, EXEMPLO)) });
  } catch (e) { return erro(e, statusDe(e)); }
}
