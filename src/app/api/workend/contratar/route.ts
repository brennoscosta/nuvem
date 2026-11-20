// Vitrine "Contratar agente": GET ?chave= → agentes à venda (setor, cargo, nível, o que faz, preço) e os contratados que
// estão fora da equipe; POST { chave, catalogoId, creditos, idem } → compra do agente (créditos ou Pix).
import { usuarioAtual } from "@/server/usuarios";
import { vitrineAgentes, produtoAgente, produtoPersonalidade } from "@/server/agentesVenda";
import { cobrar, opcoesDoCorpo, pagamentoLigado } from "@/server/mercadopago";
import { baseDe } from "@/server/cobrancaProdutos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    return ok(await vitrineAgentes(u, String(new URL(req.url).searchParams.get("chave") ?? "")));
  } catch (e) { return erro(e, 400); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const b = await corpo<{ acao?: string; chave?: string; catalogoId?: string; personalidadeId?: string; membroId?: string; creditos?: boolean; idem?: string }>(req);
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    // { acao: "personalidade", chave, membroId, personalidadeId } troca a personalidade de quem já está na equipe
    const produto = b.acao === "personalidade"
      ? await produtoPersonalidade(u, String(b.chave ?? ""), String(b.membroId ?? ""), String(b.personalidadeId ?? ""))
      : await produtoAgente(u, String(b.chave ?? ""), String(b.catalogoId ?? ""), b.personalidadeId ?? null);
    return ok(await cobrar(u, baseDe(req), produto, opcoesDoCorpo(b)));
  } catch (e) { return erro(e, 400); }
}
