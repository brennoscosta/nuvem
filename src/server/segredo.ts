// Segredo que assina as sessões. Vem de SESSAO_SEGREDO, se existir; senão é gerado uma vez e guardado no banco.
// Nunca deriva da senha do admin: assim, quem tem uma sessão válida não consegue usar a assinatura pra testar senhas fora do site.
import { randomBytes } from "node:crypto";
import { sql, migrar } from "./db";

declare global {
  var __workendSegredo: Promise<string> | undefined;
}

export function segredoSessao(): Promise<string> {
  const env = process.env.SESSAO_SEGREDO?.trim();
  if (env) return Promise.resolve(env);
  globalThis.__workendSegredo ??= (async () => {
    await migrar();
    await sql`INSERT INTO segredo_sistema (nome, valor) VALUES ('sessao', ${randomBytes(48).toString("base64url")}) ON CONFLICT (nome) DO NOTHING`;
    const [r] = await sql<{ valor: string }[]>`SELECT valor FROM segredo_sistema WHERE nome = 'sessao'`;
    return r.valor;
  })().catch((e) => { globalThis.__workendSegredo = undefined; throw e; });
  return globalThis.__workendSegredo;
}
