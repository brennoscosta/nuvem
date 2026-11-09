// Limite de tentativas (entrar, senha do admin, cadastro, nova senha). Fica na memória do processo: o aplicativo roda em
// uma instância só e o limite pode zerar numa publicação sem problema.
declare global {
  var __workendLimites: Map<string, { n: number; ate: number }> | undefined;
}
const baldes = () => (globalThis.__workendLimites ??= new Map());

// O nginx do CapRover grava o IP real em X-Real-IP; o cliente não consegue forjar esse cabeçalho.
export function ipDe(req: Request) { return req.headers.get("x-real-ip")?.trim() || "sem-ip"; }

// Segundos que ainda faltam de bloqueio (0 = liberado)
export function bloqueio(chave: string, max: number) {
  const b = baldes().get(chave);
  if (!b || b.ate <= Date.now() || b.n < max) return 0;
  return Math.ceil((b.ate - Date.now()) / 1000);
}
export function contar(chave: string, minutos: number) {
  const m = baldes();
  if (m.size > 20000) for (const [k, v] of m) if (v.ate <= Date.now()) m.delete(k);
  const b = m.get(chave);
  if (!b || b.ate <= Date.now()) m.set(chave, { n: 1, ate: Date.now() + minutos * 60_000 });
  else b.n += 1;
}
export function zerar(chave: string) { baldes().delete(chave); }

export function demais(segundos: number) {
  const min = Math.max(1, Math.ceil(segundos / 60));
  return Response.json({ erro: `Muitas tentativas. Tente de novo em ${min} ${min === 1 ? "minuto" : "minutos"}.` }, { status: 429, headers: { "retry-after": String(segundos) } });
}

// Trava da senha única do admin: por IP e no total, porque um ataque pode vir de muitos endereços.
export function bloqueioAdmin(req: Request) { return Math.max(bloqueio(`admin:ip:${ipDe(req)}`, 5), bloqueio("admin:total", 20)); }
export function contarAdmin(req: Request) { contar(`admin:ip:${ipDe(req)}`, 15); contar("admin:total", 15); }
