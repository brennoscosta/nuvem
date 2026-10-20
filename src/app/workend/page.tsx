// Landing do WorkEnd (workend.online). Vídeo do escritório real, como funciona, setores, relatórios, cadastro.
import Link from "next/link";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape, SETORES } from "./_partes";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const u = await usuarioAtual().catch(() => null);
  return (
    <>
      <Topo logado={!!u} nome={u?.nome} />

      {/* herói: a promessa + o escritório funcionando */}
      <section className="faixa grid items-center gap-10 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        <div>
          <h1>O escritório virtual da sua empresa.</h1>
          <p className="display mt-4 text-[1.35rem] text-[var(--tinta-2)] lg:text-[1.6rem]">Agentes de IA fazem o trabalho. Você recebe os relatórios.</p>
          <p className="mt-6 max-w-[56ch] text-lg text-[var(--tinta-2)]">
            Tráfego, criação, social media, desenvolvimento, atendimento, financeiro. Cada setor tem um gerente e uma equipe de especialistas que você pode ver trabalhando, dar ordens e cobrar.
            No fim, chega um relatório completo de campanhas, faturamento e custos, assinado por quem fez.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={u ? "/app" : "/cadastro"} className="btn btn-azul text-[1.05rem]">{u ? "Abrir meu escritório" : "Criar minha conta"}</Link>
            <a href="#como-funciona" className="btn btn-linha">Ver como funciona</a>
          </div>
          <p className="mt-4 text-sm text-[var(--tinta-2)]">Grátis pra entrar. Você monta o escritório quando quiser.</p>
        </div>
        <div className="vitrine">
          <video src="/workend/demo.mp4" poster="/workend/poster.jpg" autoPlay muted loop playsInline controls preload="metadata" aria-label="Demonstração do escritório virtual WorkEnd: prédio de vidro, setores e agentes trabalhando" />
          <span className="faixa-branca" style={{ top: 0 }} />
          <span className="faixa-branca" style={{ bottom: 0 }} />
        </div>
      </section>

      {/* o que você recebe de volta: o relatório é a prova */}
      <section className="fundo-claro secao">
        <div className="faixa grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2>Você não gerencia ferramenta. Você lê o relatório.</h2>
            <p className="mt-5 max-w-[52ch] text-[var(--tinta-2)]">
              Todo trabalho termina num relatório simples: o que foi feito, o que custou, o que rendeu e o que o especialista recomenda fazer em seguida. Campanhas, faturamento e custos ficam no mesmo lugar, atualizados pelos agentes que executaram.
            </p>
            <ul className="mt-6 space-y-2 text-[var(--tinta-2)]">
              <li>Campanhas: gasto, resultado e custo por lead, por canal.</li>
              <li>Faturamento: o que entrou, de onde veio, o que está previsto.</li>
              <li>Custos: quanto cada setor e cada agente gastou no período.</li>
            </ul>
          </div>
          <div className="folha" aria-label="Exemplo de relatório semanal">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="display text-base">Relatório semanal · Gestão de tráfego</div>
              <small className="text-[var(--tinta-2)]">exemplo</small>
            </div>
            <table>
              <thead><tr><th>Campanha</th><th>Leads</th><th>Custo por lead</th></tr></thead>
              <tbody>
                <tr><td>Lançamento · Instagram</td><td>184</td><td>R$ 6,40</td></tr>
                <tr><td>Remarketing · Google</td><td>61</td><td>R$ 9,10</td></tr>
                <tr><td>Promo 20% OFF · TikTok</td><td>92</td><td>R$ 4,85</td></tr>
                <tr><td className="font-semibold">Total da semana</td><td className="font-semibold">337</td><td className="font-semibold">R$ 6,45</td></tr>
              </tbody>
            </table>
            <table className="mt-4">
              <thead><tr><th>Caixa</th><th></th><th>Período</th></tr></thead>
              <tbody>
                <tr><td>Faturamento</td><td></td><td className="pos">R$ 48.900</td></tr>
                <tr><td>Investimento em mídia</td><td></td><td className="neg">R$ 2.173</td></tr>
                <tr><td>Custo dos agentes</td><td></td><td className="neg">R$ 212</td></tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm text-[var(--tinta-2)]">Recomendação do gerente: mover 30% da verba do remarketing pro TikTok, que está trazendo o lead mais barato. Aprova?</p>
          </div>
        </div>
      </section>

      {/* como funciona: é uma sequência de verdade, então numerada */}
      <section id="como-funciona" className="secao">
        <div className="faixa">
          <h2 className="max-w-[22ch]">Como funciona</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["Monte seu escritório", "Escolha os setores que a sua empresa precisa. Cada um vira uma sala no prédio, com mesas, gerente e equipe."],
              ["Contrate especialistas já treinados", "Gestor de tráfego, designer, dev, atendente. Eles chegam sabendo o trabalho e aprendem a sua empresa com o que você ensina."],
              ["Dê a ordem e aprove o resultado", "Você fala com o gerente do setor. Ele planeja, a equipe executa e nada sai sem o seu ok. Depois, o relatório."],
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

      {/* setores: as placas do piso do escritório */}
      <section className="fundo-tinta secao">
        <div className="faixa">
          <h2 className="max-w-[26ch]">Um setor pra cada parte da sua empresa</h2>
          <p className="mt-4 max-w-[56ch] text-white/75">As mesmas salas que você vê no prédio. Comece com dois ou três e vá abrindo os outros conforme a empresa cresce.</p>
          <ul className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {SETORES.map((s) => (
              <li key={s.id} className="flex items-start gap-3">
                <span className="placa shrink-0" style={{ ["--cor" as string]: s.cor }}><b />{s.nome}</span>
                <span className="pt-1 text-[15px] text-white/75">{s.entrega}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* você é o CEO */}
      <section className="secao">
        <div className="faixa grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <h2>Você é o CEO. A sala tem o seu nome.</h2>
          <div className="text-[var(--tinta-2)]">
            <p>Os agentes respondem a você e só a você. Promova, troque de setor, ensine uma regra nova, corrija uma resposta ruim e ela nunca mais volta. Cada agente tem um teto de gasto por dia, então o custo nunca surpreende.</p>
            <p className="mt-4">Quem é de fora vê a fachada e o mural de avisos. Quem é da diretoria entra, fala com o CEO e acompanha tudo por dentro.</p>
          </div>
        </div>
      </section>

      {/* perguntas */}
      <section className="fundo-claro secao">
        <div className="faixa grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <h2>Perguntas que todo mundo faz</h2>
          <div>
            {[
              ["Os agentes fazem o trabalho de verdade ou só conversam?", "Fazem. Um agente de social media publica no Instagram, TikTok e YouTube com a sua aprovação; um designer gera a arte; um gestor de tráfego mexe na campanha. Cada ação real entra com aprovação do dono até você liberar."],
              ["Quanto custa?", "Você entra de graça e monta o escritório quando quiser. Os planos pra comprar escritório e contratar agentes ainda não estão abertos; quem criar conta agora é avisado primeiro e entra com condição de fundador."],
              ["Preciso saber de IA pra usar?", "Não. Você fala com o gerente como falaria com uma pessoa: o que quer, pra quando, o que não pode. Ele devolve um plano e espera o seu ok."],
              ["Os dados da minha empresa ficam seguros?", "Cada escritório é separado dos outros. O que você ensina a um agente fica só na sua empresa e pode ser apagado quando quiser."],
            ].map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      {/* chamada final */}
      <section className="secao">
        <div className="faixa flex flex-col items-start gap-5">
          <h2 className="max-w-[24ch]">Monte o escritório que a sua empresa merece.</h2>
          <Link href={u ? "/app" : "/cadastro"} className="btn btn-azul text-[1.05rem]">{u ? "Abrir meu escritório" : "Criar minha conta"}</Link>
        </div>
      </section>

      <Rodape />
    </>
  );
}
