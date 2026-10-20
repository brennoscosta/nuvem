// Conexão com o Postgres + migrações automáticas (rodam uma vez por processo, na primeira consulta).
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __nuvemSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __nuvemMigrado: Promise<void> | undefined;
}

export function temBanco() {
  return !!process.env.DATABASE_URL;
}

function conectar() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
  return postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 30, connect_timeout: 10, transform: postgres.camel, onnotice: () => {} });
}

// Conexão preguiçosa: só abre na primeira consulta (no build do Next não existe DATABASE_URL).
type Sql = ReturnType<typeof postgres>;
function obter(): Sql { return (globalThis.__nuvemSql ??= conectar()); }
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args) => (obter() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => { const real = obter() as unknown as Record<string | symbol, unknown>; const v = real[prop]; return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v; },
});

export async function migrar() {
  if (!globalThis.__nuvemMigrado) {
    globalThis.__nuvemMigrado = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS _migracao (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())`;
      const dir = path.join(process.cwd(), "db", "migrations");
      const arquivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort() : [];
      const feitas = new Set((await sql<{ nome: string }[]>`SELECT nome FROM _migracao`).map((r) => r.nome));
      for (const f of arquivos) {
        if (feitas.has(f)) continue;
        const conteudo = fs.readFileSync(path.join(dir, f), "utf8");
        await sql.begin(async (tx) => {
          await tx.unsafe(conteudo);
          await tx`INSERT INTO _migracao (nome) VALUES (${f})`;
        });
        console.log(`[db] migração aplicada: ${f}`);
      }
    })().catch((e) => { globalThis.__nuvemMigrado = undefined; throw e; });
  }
  return globalThis.__nuvemMigrado;
}

export function id(prefixo = "") {
  const r = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return prefixo ? `${prefixo}_${r}` : r;
}
