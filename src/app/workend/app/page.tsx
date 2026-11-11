// Painel do dono: o lote, a equipe de IA (Minha equipe, desde 11/11/2026), a rede e o catálogo de especialistas para contratar.
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { Rodape, SETORES, ESPECIALISTAS, DEMO } from "../_partes";
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
        <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">Daqui você acompanha seu lote, sua equipe de IA e sua rede.</p>
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
                {chao.status === "ativo" && <Link href="/app/equipe" className="btn btn-tinta">Falar com a minha equipe</Link>}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 max-w-[50ch] text-[var(--tinta-2)]">O WorkEnd é um mundo com lotes à venda: R$ 99 por lote, por mês. Escolha o seu no mapa, coloque o nome e a logomarca na placa, reserve por 1 hora e pague pelo Mercado Pago (Pix, direto no mapa).</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href="/mundo" className="btn btn-azul">Escolher meu chão no mapa</Link>
                <Link href="/encontrar" className="btn btn-linha">Encontrar profissionais</Link>
              </div>
            </>
          )}
        </div>
        {chao?.status === "ativo" ? <CartaoEquipe equipe={chao.escritorio?.equipe ?? []} /> : <div className="vitrine">
          <div className="janela">
            <div className="barra" aria-hidden="true"><i /><i /><i /></div>
            <a href={DEMO} target="_blank" rel="noreferrer" aria-label="Abrir um escritório de demonstração funcionando ao vivo"><Image src="/workend/poster.jpg" alt="" width={1280} height={720} /></a>
          </div>
          <a href={DEMO} target="_blank" rel="noreferrer" className="btn btn-tinta absolute bottom-5 left-5 z-10">Ver um escritório funcionando ao vivo</a>
        </div>}
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
          <h2 className="text-[1.6rem]">Especialistas para contratar</h2>
          <span className="text-sm text-[var(--tinta-2)]">{ESPECIALISTAS.length} prontos · incluídos no lote</span>
        </div>
        <p className="mt-2 max-w-[60ch] text-[var(--tinta-2)]">Cada setor tem um gerente de IA, que recebe suas ordens e aprova o que sai, e uma equipe que executa. Contrate no mapa, em Contratar agentes: eles chegam com as habilidades prontas e você conversa com eles em Minha equipe.</p>
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
                    <div className="mt-2"><Link href={chao?.status === "ativo" ? `/mundo?lote=${encodeURIComponent(chao.chave)}` : "/mundo"} className="inline-block rounded-full bg-[var(--azul)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--azul-escuro)]">{chao?.status === "ativo" ? "Contratar no mapa" : "Escolher lote para contratar"}</Link></div>
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

// a equipe do lote no painel: quem já está lá e o atalho para conversar
function CartaoEquipe({ equipe }: { equipe: { id: string; nome: string; cargo: string; papel: string; camisa: string }[] }) {
  const especialistas = equipe.filter((m) => m.papel === "profissional").length;
  return (
    <div className="rounded-2xl bg-[var(--night)] p-7 text-white">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--blue-lit)]">Equipe de IA · trabalhando</span>
      <h2 className="mt-1 text-[1.5rem]" style={{ color: "#fff" }}>Sua equipe está no escritório</h2>
      <p className="mt-2 text-white/75">CEO, atendente{especialistas ? ` e ${especialistas} ${especialistas === 1 ? "especialista" : "especialistas"}` : ""}. Peça tarefas, aprove o que entregam e leia o que os visitantes perguntaram na loja.</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {equipe.slice(0, 8).map((m) => <li key={m.id} className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm"><span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold" style={{ background: m.camisa }}>{m.nome.slice(0, 1)}</span>{m.nome}<span className="text-white/60">· {m.cargo.slice(0, 18)}</span></li>)}
      </ul>
      <Link href="/app/equipe" className="btn btn-azul mt-5">Abrir Minha equipe</Link>
    </div>
  );
}
