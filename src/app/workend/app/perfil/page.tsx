// Meu perfil (20/11/2026, frente "cadastro"): o dono edita no painel tudo o que respondeu no formulário de cadastro e vê a
// prévia do perfil público (/perfil/<apelido>). O formulário fica em ./_form.tsx; as regras em src/server/perfis.ts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { meuPerfil, sugestaoInicial } from "@/server/perfis";
import { ETAPAS, PERFIL_VAZIO } from "@/office/data/cadastro";
import { Icone } from "@/office/ui/Icone";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { EditorPerfil, type Rascunho } from "./_form";
import { meta } from "../../seo";
import "../../perfil/perfil.css";

export const metadata = meta({ titulo: "Meu perfil — WorkEnd", caminho: "/app/perfil", indexar: false });
export const dynamic = "force-dynamic";

export default async function MeuPerfil() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect(`/entrar?destino=${encodeURIComponent("/app/perfil")}`);
  const perfil = await meuPerfil(u.id).catch(() => null);
  const inicial: Rascunho = perfil ?? { ...PERFIL_VAZIO, ...(await sugestaoInicial(u).catch(() => ({}))) };
  const feitas = inicial.etapas.length;
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      <main className="faixa">
        <section className="pg-topo cd-topo-painel">
          <span className="pg-rotulo"><Icone nome="perfil" tamanho={15} />Meu perfil</span>
          <h1>O que você mostra e o que você procura</h1>
          <p className="pg-sub">É o seu cartão no WorkEnd: aparece em <b>Encontrar</b>, na ficha do seu personagem no mapa e no seu endereço próprio. {feitas < ETAPAS.length ? `Você respondeu ${feitas} de ${ETAPAS.length} partes.` : "Está completo."}</p>
          <div className="pg-acoes mt-5">
            {perfil?.apelido && perfil.publico && <Link href={`/perfil/${perfil.apelido}`} className="btn btn-linha"><Icone nome="globo" tamanho={17} />workend.online/perfil/{perfil.apelido}</Link>}
            <Link href="/encontrar?tipo=perfis" className="btn btn-linha"><Icone nome="encontrar" tamanho={17} />Quem combina comigo</Link>
          </div>
        </section>
        <EditorPerfil inicial={inicial} nomeConta={u.empresaNome || u.nome} emailConta={u.email} />
      </main>
      <div className="h-16" />
      <Rodape />
    </>
  );
}
