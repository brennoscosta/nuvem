// Produtos da carteira (20/11/2026, frente "creditos"): pacote de créditos e pacote de unidades de IA, e a empresa
// (carteira de unidades) de um lote. Todos vão para a cobrança única: mercadopago.ts › cobrar().
import type { Usuario } from "./usuarios";
import { sql, migrar } from "./db";
import { ehAdmin, obterTerreno, ehDonoOuSocio } from "./terrenos";
import { empresaIdDe } from "./equipeCliente";
import { PACOTE_POR_ID, fmtCreditos } from "./creditos";
import { PACOTE_UNIDADES_POR_ID } from "./unidadesIA";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import type { ProdutoCobranca } from "./mercadopago";

// a conta admin paga 1/100 (teste real sem gastar), como no lote; recebe o pacote inteiro
const paraAdmin = (u: Usuario, v: number) => (ehAdmin(u) ? Math.max(0.01, Math.round(v) / 100) : v);
// endereço que o Mercado Pago chama de volta (o mesmo cálculo das rotas antigas)
export function baseDe(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "workend.online";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function produtoPacoteCreditos(u: Usuario, pacoteId: unknown): ProdutoCobranca {
  const p = PACOTE_POR_ID[String(pacoteId ?? "")];
  if (!p) throw new Error("Escolha um dos pacotes de créditos.");
  return { tipo: "creditos", chave: `creditos:${p.id}`, valor: paraAdmin(u, p.creditos), meses: 1, metadata: { pacote: p.id },
    descricao: `WorkEnd · pacote de ${p.creditos} créditos${p.bonus > 0 ? ` (+${fmtCreditos(p.bonus)} de bônus)` : ""}` };
}

// Empresa (carteira de unidades) do lote: só o titular, um sócio ou o admin; lote ativo e principal
export async function empresaDoLote(u: Usuario, chave: string) {
  await migrar();
  const t = await obterTerreno(chave);
  if (!t || (!ehDonoOuSocio(t, u.id) && !ehAdmin(u))) throw new Error("Esse lote não é seu.");
  if (t.anexoDe) throw new Error("As unidades de IA ficam no lote principal.");
  if (t.status !== "ativo") throw new Error("Pague o 1º mês do lote para ligar a equipe de IA.");
  const [dono] = await sql<{ papel: Usuario["papel"]; email: string }[]>`SELECT papel, email FROM usuario WHERE id = ${t.usuarioId}`;
  return { t, empId: empresaIdDe(t.usuarioId, chave, ehAdmin(dono as Usuario)) };
}
export async function produtoUnidades(u: Usuario, chave: string, pacoteId: unknown): Promise<ProdutoCobranca> {
  const p = PACOTE_UNIDADES_POR_ID[String(pacoteId ?? "")];
  if (!p) throw new Error("Escolha um dos pacotes de unidades de IA.");
  const { t } = await empresaDoLote(u, chave);
  return { tipo: "ia", chave: `ia:${chave}:${p.id}`, valor: paraAdmin(u, p.creditos), meses: 1, metadata: { terreno: chave, pacote: p.id },
    descricao: `WorkEnd · ${p.unidades.toLocaleString("pt-BR")} unidades de IA · Lote ${LOTE_POR_CHAVE[chave]?.numero ?? "?"} (${t.empresaNome})` };
}
