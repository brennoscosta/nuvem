// Página pública de status (WE-23, 22/11/2026): workend.online/status (src/proxy.ts reescreve para cá). Mostra cada
// serviço agora e o histórico das últimas 24 horas ou dos últimos 7 dias (?periodo=7d), em 24 blocos, a partir das
// conferências que o próprio WorkEnd faz a cada 5 minutos (src/server/statusServicos.ts). Nada de JavaScript a mais no
// navegador: a troca de período é um link. Link discreto no rodapé (../_partes.tsx).
import Link from "next/link";
import type { CSSProperties } from "react";
import { Topo, Rodape } from "../_partes";
import { meta } from "../seo";
import { historicoStatus, MINUTOS_CICLO, type Bloco, type LinhaStatus, type Periodo } from "@/server/statusServicos";
import "./status.css";

export const metadata = meta({ titulo: "Status dos serviços — WorkEnd", descricao: "Se o site, o mapa, os pagamentos, os e-mails e a equipe de IA do WorkEnd estão funcionando agora, com o histórico das últimas 24 horas e dos últimos 7 dias.", caminho: "/status" });
export const dynamic = "force-dynamic";

const FUSO = "America/Sao_Paulo";
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const diaHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const AGORA: Record<LinhaStatus["agora"], string> = { ok: "Funcionando", falha: "Com problema", desligado: "Desligado", sem_registro: "Sem conferência recente" };
type EstadoBloco = "ok" | "parcial" | "falha" | "desligado" | "vazio";
const NO_BLOCO: Record<EstadoBloco, string> = { ok: "funcionando", parcial: "com falha em parte do tempo", falha: "com problema", desligado: "desligado", vazio: "sem registro" };
const LEGENDA: [EstadoBloco, string][] = [["ok", "Funcionando"], ["parcial", "Falha em parte do tempo"], ["falha", "Com problema"], ["desligado", "Desligado"], ["vazio", "Sem registro"]];

function estadoDo(b: Bloco): EstadoBloco {
  if (b.falha) return b.ok ? "parcial" : "falha";
  if (b.ok) return "ok";
  return b.desligado ? "desligado" : "vazio";
}
const porcento = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 99.995 ? 0 : 2, minimumFractionDigits: 0 });

function Servico({ s, periodo }: { s: LinhaStatus; periodo: Periodo }) {
  const estados = s.blocos.map(estadoDo);
  const quanto = s.noAr !== null ? `${porcento(s.noAr)}% funcionando` : estados.includes("desligado") ? "Desligado no período" : "Sem registro no período";
  const resumo = `${s.nome}: ${quanto} ${periodo === "7d" ? "nos últimos 7 dias" : "nas últimas 24 horas"}.`;
  return (
    <li className="st-item">
      <div className="st-cab">
        <div className="st-quem">
          <h2 className="st-nome">{s.nome}</h2>
          <p className="st-desc">{s.descricao}</p>
        </div>
        <p className="st-agora" data-estado={s.agora} title={s.conferidoEm ? `Conferido às ${hora.format(s.conferidoEm)}` : undefined}><i aria-hidden="true" />{AGORA[s.agora]}</p>
      </div>
      <div className="st-faixa" role="img" aria-label={resumo}>
        {s.blocos.map((b, k) => (
          <span key={k} className="st-bloco" data-estado={estados[k]} style={{ "--k": k } as CSSProperties} title={`${diaHora.format(b.inicio)} a ${hora.format(b.fim)}: ${NO_BLOCO[estados[k]]}`} />
        ))}
      </div>
      <div className="st-eixo" aria-hidden="true">
        <span>{periodo === "7d" ? "há 7 dias" : "há 24 horas"}</span>
        <span className="st-pct">{quanto}</span>
        <span>agora</span>
      </div>
    </li>
  );
}

export default async function Status({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo: pedido } = await searchParams;
  const periodo: Periodo = pedido === "7d" ? "7d" : "24h";
  const dados = await historicoStatus(periodo).catch(() => null);
  const servicos = dados?.servicos ?? [];
  const problemas = servicos.filter((s) => s.agora === "falha");
  const semAgora = servicos.length > 0 && servicos.every((s) => s.agora === "sem_registro");
  const geral = !dados ? "falha" : problemas.length ? "falha" : !dados.ultima || semAgora ? "sem_registro" : "ok";
  const titulo = !dados ? "Histórico fora do ar"
    : !dados.ultima ? "Ainda sem conferências"
    : semAgora ? "Sem conferência recente"
    : problemas.length === 1 ? `Problema em ${problemas[0].nome.toLowerCase()}`
    : problemas.length ? "Problema em alguns serviços"
    : "Tudo funcionando";
  const sub = !dados ? "O banco de dados não respondeu agora, então o histórico não pôde ser lido. Tente de novo em alguns minutos."
    : dados.ultima ? `Última conferência às ${hora.format(dados.ultima)} (horário de Brasília). O WorkEnd confere cada serviço a cada ${MINUTOS_CICLO} minutos.`
    : `A primeira conferência acontece até ${MINUTOS_CICLO} minutos depois de o servidor ligar.`;
  return (
    <>
      <Topo />
      <section className="faixa st">
        <header className="pg-claro st-topo">
          <p className="pg-rotulo">Status dos serviços</p>
          <h1 className="st-titulo" data-estado={geral}><span className="st-ponto" aria-hidden="true" />{titulo}</h1>
          <p className="st-sub">{sub}</p>
        </header>
        <nav className="st-periodo" aria-label="Período do histórico">
          <Link href="/status" prefetch={false} scroll={false} aria-current={periodo === "24h" ? "page" : undefined}>Últimas 24 horas</Link>
          <Link href="/status?periodo=7d" prefetch={false} scroll={false} aria-current={periodo === "7d" ? "page" : undefined}>Últimos 7 dias</Link>
        </nav>
        {dados && (
          <ol className="st-lista">
            {servicos.map((s) => <Servico key={s.id} s={s} periodo={periodo} />)}
          </ol>
        )}
        <div className="st-legenda" aria-hidden="true">
          {LEGENDA.map(([e, t]) => <span key={e} data-estado={e}><i />{t}</span>)}
        </div>
        <p className="st-nota">Cada bloco vale {periodo === "7d" ? "7 horas" : "1 hora"}. Os pagamentos e a equipe de IA são conferidos com uma consulta simples ao Mercado Pago e à OpenAI, sem gerar cobrança nem texto. Quando o próprio servidor reinicia ou cai, a conferência para junto e o intervalo fica sem registro.</p>
      </section>
      <Rodape />
    </>
  );
}
