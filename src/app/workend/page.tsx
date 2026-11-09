// Landing do WorkEnd (workend.online), no estilo pedido pelo Brenno (referência: notion.com):
// branco, título enorme centralizado com uma palavra em pílula, dois botões, produto numa janela, cartões cinza, "Comece hoje".
import Link from "next/link";
import Image from "next/image";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape, SETORES } from "./_partes";

export const dynamic = "force-dynamic";

const CARTOES = [
  { eyebrow: "Escolha seu lote", titulo: "Um endereço no mapa 3D, com a sua marca na placa.", img: "/workend/cenas/predio.jpg", alt: "Fachada de vidro do escritório virtual" },
  { eyebrow: "Monte o escritório", titulo: "Cada setor vira uma sala no seu prédio.", img: "/workend/cenas/setores.jpg", alt: "Salas dos setores do escritório virtual" },
  { eyebrow: "Conheça gente", titulo: "Com um personagem, ande pelo mapa, faça amigos, negocie e ligue para quem está online.", img: "/workend/cenas/aprovar.jpg", alt: "Personagem na mesa do escritório virtual" },
  { eyebrow: "Em breve", titulo: "Agentes de IA trabalhando de verdade na sua equipe.", img: "/workend/cenas/ordem.jpg", alt: "Painel de tarefas de um gerente do escritório" },
];

export default async function Landing() {
  const u = await usuarioAtual().catch(() => null);
  const cta = { href: u ? "/app" : "/cadastro", texto: u ? "Abrir meu escritório" : "Criar conta grátis" };
  return (
    <>
      <Topo logado={!!u} nome={u?.nome} />

      {/* herói centralizado */}
      <section className="faixa flex flex-col items-center pt-10 text-center lg:pt-20">
        <h1 className="max-w-[16ch]">O mapa 3D onde a sua empresa <span className="pilula">tem</span> endereço.</h1>
        <p className="mt-6 max-w-[52ch] text-lg text-[var(--tinta-2)] lg:text-xl">Escolha um lote, coloque sua marca na placa e monte o escritório da sua empresa. Os agentes de IA chegam em breve.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={cta.href} className="btn btn-azul btn-grande">{cta.texto}</Link>
          <Link href="/mundo" className="btn btn-claro btn-grande">Escolher meu chão no mapa</Link>
        </div>
        <div className="janela mt-14 w-full max-w-[1000px]">
          <div className="barra" aria-hidden="true"><i /><i /><i /></div>
          <video src="/workend/demo.mp4" poster="/workend/poster.jpg" autoPlay muted loop playsInline controls preload="metadata" aria-label="Demonstração do escritório virtual WorkEnd" />
        </div>
      </section>

      {/* faixa de setores (no lugar da faixa de logos) */}
      <section className="faixa py-14 text-center">
        <p className="text-[var(--tinta-2)]">Setores para montar no seu prédio.</p>
        <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
          {SETORES.map((s) => <li key={s.id}><span className="placa placa-cinza" style={{ ["--cor" as string]: s.cor }}><b />{s.nome}</span></li>)}
        </ul>
      </section>

      {/* cartões */}
      <section className="faixa secao">
        <h2 className="max-w-[20ch]">Sua empresa, à vista no mapa.</h2>
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
            ["Escolha seu lote", "R$ 99 por mês, com Pix direto no mapa."],
            ["Coloque sua marca", "Nome e logomarca na placa, à vista de quem passa."],
            ["Monte sua equipe", "Escolha o prédio, os setores e dê nome a cada pessoa."],
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
            <Link href="/mundo" className="btn btn-claro btn-grande">Escolher meu chão no mapa</Link>
          </div>
        </div>
      </section>

      <Rodape />
    </>
  );
}
