// Dashboard do dono: seu escritório (compra em breve), catálogo de especialistas e um escritório de demonstração pra ver funcionando.
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { Rodape, SETORES, ESPECIALISTAS, DEMO } from "../_partes";
import { BotaoAvisar } from "../_conta";
import { CabecalhoApp } from "../_cabecalho";

import { meta } from "../seo";

export const metadata = meta({ titulo: "Meu escritório — WorkEnd", caminho: "/app", indexar: false });
export const dynamic = "force-dynamic";

const faltaMs = (d: Date | string) => new Date(d).getTime() - Date.now();

export default async function App() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar");
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  const empresa = chao?.empresaNome || u.empresaNome || `Empresa de ${u.nome.split(" ")[0]}`;
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />

      <section className="faixa pt-4">
        <h1 className="text-[2rem] lg:text-[2.6rem]">Olá, {u.nome.split(" ")[0]}. Este é o painel da {empresa}.</h1>
        <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">Daqui você acompanha seu lote e sua rede. Os especialistas de IA e os relatórios chegam em breve.</p>
      </section>

      {/* seu escritório: estado vazio com direção */}
      <section className="faixa mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl bg-[var(--cinza)] p-7">
          <h2 className="text-[1.5rem]">Seu chão no mundo</h2>
          {chao?.status === "ativo" && chao.pagoAte && faltaMs(chao.pagoAte) < 5 * 86400_000 && <p className="mt-2 rounded-xl bg-[#FFF4DB] px-3 py-2 text-sm text-[#7A5200]">{faltaMs(chao.pagoAte) > 0 ? "Seu lote vence em breve." : "Seu lote venceu e está na tolerância de 5 dias."} Renove pelo mapa para manter o endereço. Se ele sair do mapa, sua marca e sua equipe ficam guardadas na conta.</p>}
          {chao ? (
            <>
              <p className="mt-2 max-w-[50ch] text-[var(--tinta-2)]">{chao.status === "ativo" ? <>Seu lote de 20 × 20 m está <b>ativo até {chao.pagoAte ? new Date(chao.pagoAte).toLocaleDateString("pt-BR") : "—"}</b>, com a placa <b>{chao.empresaNome}</b> no mapa. Renove pelo mapa quando quiser.</> : <>Você reservou um lote de 20 × 20 m com a placa <b>{chao.empresaNome}</b>. A reserva vale 1 hora: pague o 1º mês (R$ 99) no mapa pra garantir.</>}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={`/mundo?lote=${encodeURIComponent(chao.chave)}`} className="btn btn-azul">Ver meu chão no mapa</Link>
                <BotaoAvisar marcado={!!u.interesseEm} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 max-w-[50ch] text-[var(--tinta-2)]">O WorkEnd é um mundo com lotes à venda: R$ 99 por lote, por mês. Escolha o seu no mapa, coloque o nome e a logomarca na placa, reserve por 1 hora e pague pelo Mercado Pago (Pix, direto no mapa).</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href="/mundo" className="btn btn-azul">Escolher meu chão no mapa</Link>
                <BotaoAvisar marcado={!!u.interesseEm} />
              </div>
            </>
          )}
        </div>
        <div className="vitrine">
          <div className="janela">
            <div className="barra" aria-hidden="true"><i /><i /><i /></div>
            <a href={DEMO} target="_blank" rel="noreferrer" aria-label="Abrir um escritório de demonstração funcionando ao vivo"><Image src="/workend/poster.jpg" alt="" width={1280} height={720} /></a>
          </div>
          <a href={DEMO} target="_blank" rel="noreferrer" className="btn btn-tinta absolute bottom-5 left-5 z-10">Ver um escritório funcionando ao vivo</a>
        </div>
      </section>

      {/* rede */}
      <section className="faixa mt-10 rounded-2xl border border-[var(--linha)] p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-[1.5rem]">Minha rede</h2><p className="mt-1 max-w-[60ch] text-[var(--tinta-2)]">O WorkEnd também é uma rede de network: com um personagem você anda pelo mundo, fala com a equipe das lojas, faz amigos, negocia e faz calls com quem está online.</p></div>
          <Link href="/app/rede" className="btn btn-azul">Abrir minha rede</Link>
        </div>
      </section>

      {/* catálogo */}
      <section className="faixa mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.6rem]">Especialistas que estão chegando</h2>
          <span className="text-sm text-[var(--tinta-2)]">Em breve</span>
        </div>
        <p className="mt-2 max-w-[60ch] text-[var(--tinta-2)]">Em breve, cada setor terá um gerente de IA, que recebe suas ordens e aprova o que sai, e uma equipe que executa.</p>
        {SETORES.map((s) => (
          <div key={s.id} className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="placa" style={{ ["--cor" as string]: s.cor }}><b />{s.nome}</span>
              <span className="text-[15px] text-[var(--tinta-2)]">{s.entrega}</span>
            </div>
            <ul className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {ESPECIALISTAS.filter((e) => e.setor === s.id).map((e) => (
                <li key={e.cargo} className="cracha" style={{ ["--cor" as string]: e.cor }}>
                  <div className="foto"><img src={e.foto} alt={`Foto de ${e.nome}`} width={100} height={100} loading="lazy" decoding="async" /></div>
                  <div>
                    <div className="font-semibold">{e.nome} <span className="font-normal text-[var(--tinta-2)]">· {e.cargo}</span></div>
                    <small>{e.faz}</small>
                    <small className="mt-1 block opacity-80">{e.skills.join(" · ")}</small>
                    <div className="mt-2"><span className="inline-block rounded-full border-[1.5px] border-[var(--linha)] px-3 py-1 text-xs font-semibold text-[var(--tinta-2)]">Contratar · em breve</span></div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <div className="h-16" />
      <Rodape />
    </>
  );
}
