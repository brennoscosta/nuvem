// IDs das ferramentas de medição (WE-01, 21/11/2026), lidos no servidor a CADA requisição.
// O CapRover compila dentro do Docker sem as variáveis do app, e o Next embute na compilação toda leitura literal de
// process.env.NEXT_PUBLIC_*. Por isso a leitura é pelo nome numa variável (process.env[nome]), que o Next não troca:
// basta criar ou mudar a variável no CapRover e reiniciar o app, sem compilar de novo.
// Sem nenhum ID: o aviso de cookies não aparece e nenhum script de fora carrega.
import { connection } from "next/server";

export interface ConfigMedicao { ga: string | null; gtm: string | null; meta: string | null }

const FORMATO: Record<keyof ConfigMedicao, [string, RegExp]> = {
  ga: ["NEXT_PUBLIC_GA_ID", /^G-[A-Z0-9]{4,16}$/],
  gtm: ["NEXT_PUBLIC_GTM_ID", /^GTM-[A-Z0-9]{4,12}$/],
  meta: ["NEXT_PUBLIC_META_PIXEL_ID", /^\d{6,20}$/],
};

function ler(nome: string, formato: RegExp): string | null {
  const v = (process.env[nome] ?? "").trim();
  return formato.test(v) ? v : null; // ID fora do formato fica desligado (e não vai para dentro de um script)
}

export async function configMedicao(): Promise<ConfigMedicao> {
  await connection(); // garante a leitura na hora da requisição, nunca na compilação
  return { ga: ler(...FORMATO.ga), gtm: ler(...FORMATO.gtm), meta: ler(...FORMATO.meta) };
}

export const algumaMedicao = (c: ConfigMedicao) => !!(c.ga || c.gtm || c.meta);
