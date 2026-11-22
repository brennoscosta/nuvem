// WhatsApp da loja no painel (WE-18, 22/11/2026, src/server/whatsapp.ts).
//  - GET ?lote= → a conexão, o webhook e o custo; GET ?lote=&contato=anon_wa_... → a situação de uma conversa.
//  - POST { lote, acao }: manual, cadastro, modelo, desconectar (a conexão); assumir, devolver, responder, enviar_modelo e
//    apagar (uma conversa, com contato).
import { usuarioAtual } from "@/server/usuarios";
import { statusDe } from "@/server/equipeCliente";
import { ErroWhatsApp } from "@/server/whatsappMeta";
import { estadoWhatsApp, situacaoDoContato, conectarManual, conectarPeloCadastro, salvarModelo, desconectar, assumirConversa, devolverConversa, responderPeloPainel, modeloPeloPainel, apagarConversa } from "@/server/whatsapp";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const st = (e: unknown) => (e instanceof ErroWhatsApp ? e.status : statusDe(e));
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = new URL(req.url).searchParams;
    const contato = p.get("contato");
    return ok(contato ? await situacaoDoContato(u, p.get("lote"), contato) : await estadoWhatsApp(u, p.get("lote")));
  } catch (e) { return erro(e, st(e)); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const d = await corpo<Record<string, unknown>>(req);
    const lote = typeof d.lote === "string" ? d.lote : null;
    switch (d.acao) {
      case "manual": return ok(await conectarManual(u, lote, { phoneNumberId: d.phoneNumberId, wabaId: d.wabaId, token: d.token, segredoApp: d.segredoApp }));
      case "cadastro": return ok(await conectarPeloCadastro(u, lote, { code: d.code, phoneNumberId: d.phoneNumberId, wabaId: d.wabaId }));
      case "modelo": return ok(await salvarModelo(u, lote, { nome: d.nome, idioma: d.idioma }));
      case "desconectar": return ok(await desconectar(u, lote));
      case "assumir": return ok(await assumirConversa(u, lote, d.contato));
      case "devolver": return ok(await devolverConversa(u, lote, d.contato));
      case "responder": return ok(await responderPeloPainel(u, lote, d.contato, d.texto));
      case "enviar_modelo": return ok(await modeloPeloPainel(u, lote, d.contato));
      case "apagar": return ok(await apagarConversa(u, lote, d.contato));
      default: return erro("Ação desconhecida.", 400);
    }
  } catch (e) { return erro(e, st(e)); }
}
