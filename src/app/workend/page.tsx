// Landing do WorkEnd (workend.online), versão enxuta: herói com vídeo, relatórios (sem números), como funciona, setores, chamada.
import Link from "next/link";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape, SETORES } from "./_partes";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const u = await usuarioAtual().catch(() => null);
  const cta = { href: u ? "/app" : "/cadastro", texto: u ? "Abrir meu escritório" : "Criar minha conta" };
  return (
    <>
      <Topo logado={!!u} nome={u?.nome} />

      {/* herói */}
      <section className="faixa grid items-center gap-10 pb-20 pt-8 lg:grid-cols-[1fr_1.05fr] lg:pt-14">
        <div>
          <h1>O escritório virtual da sua empresa.</h1>
          <p className="mt-5 max-w-[40ch] text-xl text-[var(--tinta-2)]">Agentes de IA especialistas fazem o trabalho. Você dá as ordens e recebe os relatórios.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={cta.href} className="btn btn-azul text-[1.05rem]">{cta.texto}</Link>
            <a href="#como-funciona" className="btn btn-linha">Como funciona</a>
          </div>
        </div>
        <div className="vitrine">
          <video src="/workend/demo.mp4" poster="/workend/poster.jpg" autoPlay muted loop playsInline controls preload="metadata" aria-label="Demonstração do escritório virtual WorkEnd" />
          <span className="faixa-branca" style={{ top: 0 }} />
          <span className="faixa-branca" style={{ bottom: 0 }} />
        </div>
      </section>

      {/* relatórios, sem números */}
      <section className="fundo-claro secao">
        <div className="faixa grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
          <h2 className="max-w-[18ch]">Você não gerencia ferramenta. Você lê o relatório.</h2>
          <ul className="grid gap-5 text-lg text-[var(--tinta-2)]">
            <li><span className="font-semibold text-[var(--tinta)]">Campanhas</span> — o que está no ar, o que rendeu e o que o gestor recomenda.</li>
            <li><span className="font-semibold text-[var(--tinta)]">Faturamento</span> — o que entrou, de onde veio e o que vem pela frente.</li>
            <li><span className="font-semibold text-[var(--tinta)]">Custos</span> — quanto cada setor e cada agente gastou.</li>
          </ul>
        </div>
      </section>

      {/* como funciona */}
      <section id="como-funciona" className="secao">
        <div className="faixa">
          <h2>Como funciona</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["Monte seu escritório", "Escolha os setores que a sua empresa precisa. Cada um vira uma sala no prédio."],
              ["Contrate especialistas", "Gestor de tráfego, designer, dev, atendente. Chegam treinados e aprendem a sua empresa."],
              ["Dê a ordem e aprove", "Fale com o gerente do setor. A equipe executa, nada sai sem o seu ok, e o relatório chega."],
            ].map(([t, d], i) => (
              <li key={t} className="border-t-2 border-[var(--tinta)] pt-5">
                <div className="display text-sm text-[var(--azul)]">{i + 1}</div>
                <h3 className="mt-2">{t}</h3>
                <p className="mt-2 text-[var(--tinta-2)]">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* setores: só as placas */}
      <section className="fundo-tinta secao">
        <div className="faixa">
          <h2 className="max-w-[26ch]">Um setor pra cada parte da sua empresa</h2>
          <ul className="mt-8 flex flex-wrap gap-3">
            {SETORES.map((s) => (
              <li key={s.id}><span className="placa" style={{ ["--cor" as string]: s.cor }}><b />{s.nome}</span></li>
            ))}
          </ul>
        </div>
      </section>

      {/* chamada final */}
      <section className="secao">
        <div className="faixa flex flex-col items-start gap-5">
          <h2 className="max-w-[24ch]">Você é o CEO. A sala tem o seu nome.</h2>
          <Link href={cta.href} className="btn btn-azul text-[1.05rem]">{cta.texto}</Link>
        </div>
      </section>

      <Rodape />
    </>
  );
}
