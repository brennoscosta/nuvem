// Unidades de IA da empresa de um lote: GET ?chave= → medidor (saldo, consumo do mês, estimativa em respostas, extrato
// por agente e por tipo); POST { chave, pacote, creditos, idem } → compra de unidades (créditos ou Pix).
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario } from "@/server/terrenos";
import { medidorIA, unidadesDoCusto } from "@/server/unidadesIA";
import { custoImagemBRL } from "@/server/imagens";
import { cobrar, opcoesDoCorpo, pagamentoLigado } from "@/server/mercadopago";
import { empresaDoLote, produtoUnidades, baseDe } from "@/server/cobrancaProdutos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
// custo de uma arte em unidades (WE-10, 21/11/2026): o mesmo preço da geração (imagens.ts, quadrado em alta qualidade)
const imagem = () => { const custoBrl = custoImagemBRL("quadrado"); return { custoBrl, unidades: unidadesDoCusto(custoBrl) }; };
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const chave = new URL(req.url).searchParams.get("chave") ?? (await terrenoDoUsuario(u.id))?.chave;
    if (!chave) return ok({ semLote: true, imagem: imagem() });
    const { t, empId } = await empresaDoLote(u, chave);
    return ok({ chave, empresa: t.empresaNome, ...(await medidorIA(empId)), imagem: imagem() });
  } catch (e) { return erro(e, 400); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const b = await corpo<{ chave?: string; pacote?: string; creditos?: boolean; idem?: string }>(req);
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    return ok(await cobrar(u, baseDe(req), await produtoUnidades(u, String(b.chave ?? ""), b.pacote), opcoesDoCorpo(b)));
  } catch (e) { return erro(e, 400); }
}
