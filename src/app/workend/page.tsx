// Landing do WorkEnd (workend.online), no estilo pedido pelo Brenno (referência: notion.com):
// branco, título enorme centralizado com uma palavra em pílula, dois botões, produto numa janela, cartões cinza, "Comece hoje".
import Link from "next/link";
import Image from "next/image";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape, SETORES, DEMO } from "./_partes";

export const dynamic = "force-dynamic";

const CARTOES = [
  { eyebrow: "Dê a ordem", titulo: "Fale com o gerente do setor como falaria com uma pessoa.", img: "/workend/cenas/ordem.jpg", alt: "Painel de tarefas de um gerente do escritório" },
  { eyebrow: "Veja acontecer", titulo: "Cada setor é uma sala. Os agentes trabalham à vista.", img: "/workend/cenas/setores.jpg", alt: "Salas dos setores do escritório virtual" },
  { eyebrow: "Aprove antes de sair", titulo: "Nada é publicado, gasto ou enviado sem o seu ok.", img: "/workend/cenas/aprovar.jpg", alt: "Gerente de design gráfico na mesa dele" },
  { eyebrow: "Receba o relatório", titulo: "Campanhas, faturamento e custos, explicados por quem fez.", img: "/workend/cenas/predio.jpg", alt: "Fachada de vidro do escritório virtual" },
];

export default async function Landing() {
  const u = await usuarioAtual().catch(() => null);
  const cta = { href: u ? "/app" : "/cadastro", texto: u ? "Abrir meu escritório" : "Criar conta grátis" };
  return (
    <>
      <Topo logado={!!u} nome={u?.nome} />

      {/* herói centralizado */}
      <section className="faixa flex flex-col items-center pt-10 text-center lg:pt-20">
        <h1 className="max-w-[16ch]">O escritório onde agentes de IA <span className="pilula">trabalham</span> por você.</h1>
        <p className="mt-6 max-w-[52ch] text-lg text-[var(--tinta-2)] lg:text-xl">Monte os setores da sua empresa, contrate especialistas já treinados e receba os relatórios. Você é o CEO.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={cta.href} className="btn btn-azul btn-grande">{cta.texto}</Link>
          <a href={DEMO} target="_blank" rel="noreferrer" className="btn btn-claro btn-grande">Ver um escritório funcionando</a>
        </div>
        <div className="janela mt-14 w-full max-w-[1000px]">
          <div className="barra" aria-hidden="true"><i /><i /><i /></div>
          <video src="/workend/demo.mp4" poster="/workend/poster.jpg" autoPlay muted loop playsInline controls preload="metadata" aria-label="Demonstração do escritório virtual WorkEnd" />
        </div>
      </section>

      {/* faixa de setores (no lugar da faixa de logos) */}
      <section className="faixa py-14 text-center">
        <p className="text-[var(--tinta-2)]">Setores que já funcionam no WorkEnd.</p>
        <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
          {SETORES.map((s) => <li key={s.id}><span className="placa placa-cinza" style={{ ["--cor" as string]: s.cor }}><b />{s.nome}</span></li>)}
        </ul>
      </section>

      {/* cartões */}
      <section className="faixa secao">
        <h2 className="max-w-[20ch]">Agentes onde a sua empresa trabalha.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {CARTOES.map((c) => (
            <Link key={c.eyebrow} href={cta.href} className="cartao group">
              <div className="topo">
                <div><small>{c.eyebrow}</small><h3>{c.titulo}</h3></div>
                <span className="seta" aria-hidden="true">→</span>
              </div>
              <div className="janela janela-10">
                <div className="barra" aria-hidden="true"><i /><i /><i /></div>
                <Image src={c.img} alt={c.alt} width={1200} height={750} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* como funciona, em três linhas */}
      <section className="faixa secao pt-0">
        <h2 className="max-w-[20ch]">Simples assim.</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["Monte seu escritório", "Escolha os setores. Cada um vira uma sala no prédio."],
            ["Contrate especialistas", "Gestor de tráfego, designer, dev, atendente. Chegam treinados."],
            ["Dê a ordem e aprove", "A equipe executa, você aprova, o relatório chega."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-[var(--cinza)] p-6">
              <div className="text-sm font-semibold text-[var(--tinta-2)]">{i + 1}</div>
              <h3 className="mt-2">{t}</h3>
              <p className="mt-2 text-[var(--tinta-2)]">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* comece hoje */}
      <section className="fundo-cinza secao">
        <div className="faixa flex flex-col items-center text-center">
          <h2>Comece hoje mesmo.</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={cta.href} className="btn btn-azul btn-grande">{cta.texto}</Link>
            <a href={DEMO} target="_blank" rel="noreferrer" className="btn btn-claro btn-grande">Ver um escritório funcionando</a>
          </div>
        </div>
      </section>

      <Rodape />
    </>
  );
}
