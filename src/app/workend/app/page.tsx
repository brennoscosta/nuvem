// Dashboard do dono: seu escritório (compra em breve), catálogo de especialistas e um escritório de demonstração pra ver funcionando.
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { Rodape, SETORES, ESPECIALISTAS } from "../_partes";
import { BotaoSair, BotaoAvisar } from "../_conta";

export const dynamic = "force-dynamic";
const DEMO = "https://nuvem.nuvemhost.cloud/?vista=fora";

export default async function App() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar");
  const empresa = u.empresaNome || `Empresa de ${u.nome.split(" ")[0]}`;
  return (
    <>
      <header className="faixa flex items-center justify-between py-5">
        <Link href="/" aria-label="WorkEnd"><Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority className="h-9 w-auto" /></Link>
        <div className="flex items-center gap-3 text-[15px]"><span className="hidden text-[var(--tinta-2)] sm:inline">{u.email}</span><BotaoSair /></div>
      </header>

      <section className="faixa pt-4">
        <h1 className="text-[2rem] lg:text-[2.6rem]">Olá, {u.nome.split(" ")[0]}. Este é o painel da {empresa}.</h1>
        <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">Você é o CEO. Daqui você monta o escritório, contrata especialistas e lê os relatórios.</p>
      </section>

      {/* seu escritório: estado vazio com direção */}
      <section className="faixa mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border-[1.5px] border-dashed border-[var(--linha)] bg-white p-7">
          <h2 className="text-[1.5rem]">Seu escritório</h2>
          <p className="mt-2 max-w-[50ch] text-[var(--tinta-2)]">Ainda não tem prédio no seu terreno. A compra de escritório abre em breve: quem já tem conta entra primeiro, com condição de fundador.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="btn btn-azul" aria-disabled="true">Comprar escritório · em breve</span>
            <BotaoAvisar marcado={!!u.interesseEm} />
          </div>
        </div>
        <div className="vitrine">
          <a href={DEMO} target="_blank" rel="noreferrer" aria-label="Abrir um escritório de demonstração funcionando ao vivo">
            <Image src="/workend/poster.jpg" alt="" width={1280} height={720} />
          </a>
          <span className="faixa-branca" style={{ top: 0 }} />
          <span className="faixa-branca" style={{ bottom: 0 }} />
          <a href={DEMO} target="_blank" rel="noreferrer" className="btn btn-tinta absolute bottom-5 left-5 z-10">Ver um escritório funcionando ao vivo</a>
        </div>
      </section>

      {/* catálogo */}
      <section className="faixa mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.6rem]">Especialistas já treinados</h2>
          <span className="text-sm text-[var(--tinta-2)]">Contratação abre junto com o escritório</span>
        </div>
        <p className="mt-2 max-w-[60ch] text-[var(--tinta-2)]">Cada setor vem com um gerente, que recebe suas ordens e aprova o que sai, e uma equipe que executa. Você contrata um por um.</p>
        {SETORES.map((s) => (
          <div key={s.id} className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="placa" style={{ ["--cor" as string]: s.cor }}><b />{s.nome}</span>
              <span className="text-[15px] text-[var(--tinta-2)]">{s.entrega}</span>
            </div>
            <ul className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {ESPECIALISTAS.filter((e) => e.setor === s.id).map((e) => (
                <li key={e.cargo} className="cracha" style={{ ["--cor" as string]: e.cor }}>
                  <div className="foto">{e.cargo.replace("Gerente de ", "")[0]}</div>
                  <div>
                    <div className="font-semibold">{e.cargo}</div>
                    <small>{e.faz}</small>
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
