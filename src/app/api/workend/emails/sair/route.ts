// Descadastro de um clique (WE-17, 21/11/2026): o endereço do cabeçalho List-Unsubscribe dos e-mails de ciclo de vida.
//  - POST (RFC 8058, o botão "cancelar inscrição" do Gmail e do Apple Mail, com List-Unsubscribe-Post): para todos os
//    avisos de ciclo de vida na hora, sem pedir confirmação;
//  - GET (quem abre o endereço no navegador, ou um antivírus que só confere o link): não muda nada e leva para a página
//    de preferências, onde a pessoa escolhe.
import { usuarioDoToken, salvarPreferenciasEmail } from "@/server/email";
export const dynamic = "force-dynamic";
const token = (req: Request) => new URL(req.url).searchParams.get("t") ?? "";
export async function POST(req: Request) {
  try {
    const uid = await usuarioDoToken(token(req));
    if (!uid) return new Response("Link inválido.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    await salvarPreferenciasEmail(uid, { dicas: false, resumo: false, unidades: false });
    return new Response("Pronto: você não recebe mais os avisos de ciclo de vida do WorkEnd.", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (e) {
    console.error("[emails] sair", (e as Error).message);
    return new Response("Não deu para descadastrar agora. Tente de novo.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
export async function GET(req: Request) {
  return new Response(null, { status: 303, headers: { location: `/emails?t=${encodeURIComponent(token(req))}` } });
}
