// Perfil público (20/11/2026, frente "cadastro"): workend.online/perfil/<apelido> mostra tudo o que a pessoa faz — o que
// oferece e o que procura, área, cidade, links, a loja no mapa e o personagem. Só o que ela marcou como público; WhatsApp e
// e-mail só se ela quiser. Aberto da ficha do personagem no mapa e da busca (/encontrar, aba Perfis). Editado em /app/perfil.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { perfilPublico } from "@/server/perfis";
import { linkInstagram, linkWhatsapp, linkSite, siteCurto } from "@/office/data/cadastro";
import { rotuloLoja } from "@/office/data/numeroLoja";
import { MiniAvatar } from "@/office/ui/MiniAvatar";
import { Icone } from "@/office/ui/Icone";
import { Topo, Rodape } from "../../_partes";
import { InsigniasCidade } from "../_insignias";
import { meta } from "../../seo";
import "../perfil.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ apelido: string }> };

const resumo = (p: { ofereceTexto: string; oferece: string[]; nome: string; tipo: string }) => {
  const t = (p.ofereceTexto || (p.oferece.length ? `Oferece: ${p.oferece.join(", ")}.` : `${p.nome} tem perfil no WorkEnd.`)).replace(/\s+/g, " ").trim();
  return t.length > 155 ? `${t.slice(0, 154).trimEnd()}…` : t;
};
const mesAno = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { apelido } = await params;
  const u = await usuarioAtual().catch(() => null);
  const p = await perfilPublico(apelido, u).catch(() => null);
  if (!p) return meta({ titulo: "Perfil não encontrado — WorkEnd", caminho: `/perfil/${apelido}`, indexar: false });
  return meta({ titulo: `${p.nome}${p.tipo ? ` · ${p.tipo}` : ""} — WorkEnd`, descricao: resumo(p), caminho: `/perfil/${p.apelido}`, indexar: !p.soVoce, ...(p.foto ? { imagem: { url: p.foto, alt: p.nome } } : {}) });
}

export default async function PerfilPublicoPagina({ params }: Props) {
  const { apelido } = await params;
  const u = await usuarioAtual().catch(() => null);
  const p = await perfilPublico(apelido, u).catch(() => null);
  if (!p) notFound();
  const entrar = (destino: string) => (u ? destino : `/entrar?destino=${encodeURIComponent(destino)}`);
  const conversa = p.personagem && !p.dono ? entrar(`/app/rede?com=${encodeURIComponent(p.usuarioId)}`) : null;
  const temContato = !!(conversa || p.whatsapp || p.instagram || p.site || p.email);
  const busca = (q: string) => `/encontrar?tipo=perfis&q=${encodeURIComponent(q)}`;

  return (
    <>
      <Topo logado={!!u} nome={u?.nome} />
      <main className="faixa mt-4">
        {p.soVoce && (
          <p className="cd-pub-aviso"><Icone nome="ajustes" tamanho={16} />Só você vê esta página: o seu perfil está fechado. <Link href="/app/perfil#secao-privacidade">Abrir para todos</Link></p>
        )}
        <section className="pg-topo cd-pub-topo" aria-label={p.nome}>
          <div className="cd-pub-id">
            <span className="cd-pub-foto">{p.foto ? <img src={p.foto} alt={`Foto de ${p.nome}`} /> : <b aria-hidden="true">{p.nome.slice(0, 1).toUpperCase()}</b>}</span>
            <div className="min-w-0">
              <span className="pg-rotulo">{[p.tipo, ...p.nichos.map((n) => n.nome)].filter(Boolean).join(" · ") || "Perfil no WorkEnd"}</span>
              <h1>{p.nome}</h1>
              {(p.local || p.atendimento) && <p className="cd-pub-onde"><Icone nome="pino" tamanho={16} />{[p.local, p.atendimento && `Atende ${p.atendimento.toLowerCase()}`].filter(Boolean).join(" · ")}</p>}
            </div>
          </div>
          {p.objetivoNome && <p className="cd-pub-objetivo">{p.objetivo === "encontrar" ? "Está procurando empresas e serviços" : p.objetivo === "ambos" ? "Mostra o próprio negócio e procura parceiros" : "Mostra o próprio negócio"}</p>}
          <div className="pg-acoes mt-5">
            {conversa && <Link href={conversa} className="btn cd-btn-branco"><Icone nome="conversar" tamanho={17} />Conversar</Link>}
            {p.whatsapp && <a href={linkWhatsapp(p.whatsapp)} target="_blank" rel="noopener nofollow" className="btn btn-linha"><Icone nome="telefone" tamanho={17} />WhatsApp</a>}
            {p.instagram && <a href={linkInstagram(p.instagram)} target="_blank" rel="noopener nofollow" className="btn btn-linha"><Icone nome="instagram" tamanho={17} /><span className="min-w-0 truncate">@{p.instagram}</span></a>}
            {p.site && <a href={linkSite(p.site)} target="_blank" rel="noopener nofollow" className="btn btn-linha"><Icone nome="globo" tamanho={17} /><span className="min-w-0 truncate">{siteCurto(p.site)}</span></a>}
            {p.email && <a href={`mailto:${p.email}`} className="btn btn-linha"><Icone nome="enviar" tamanho={17} />E-mail</a>}
            {p.dono && <Link href="/app/perfil" className="btn btn-linha"><Icone nome="editar" tamanho={17} />Editar meu perfil</Link>}
          </div>
          {!temContato && !p.dono && <p className="cd-pub-semcontato">Ainda sem contato público. {p.loja ? "Fale com a equipe da loja no mapa." : ""}</p>}
        </section>

        <div className="cd-pub-grade">
          <div className="cd-pub-principal">
            <section className="pg-cartao cd-pub-bloco">
              <h2>O que oferece</h2>
              {p.oferece.length > 0 && <ul className="cd-pub-tags">{p.oferece.map((t) => <li key={t}><Link href={busca(t)}>{t}</Link></li>)}</ul>}
              {p.ofereceTexto ? <p className="cd-pub-texto">{p.ofereceTexto}</p> : !p.oferece.length && <p className="cd-pub-vazio">{p.objetivo === "encontrar" ? "Por enquanto, está no WorkEnd para encontrar quem resolva." : "Ainda não contou o que oferece."}</p>}
            </section>
            {(p.procura.length > 0 || p.procuraTexto) && (
              <section className="pg-cartao cd-pub-bloco cd-pub-procura">
                <h2>O que procura</h2>
                {p.procura.length > 0 && <ul className="cd-pub-tags">{p.procura.map((t) => <li key={t}><Link href={busca(t)}>{t}</Link></li>)}</ul>}
                {p.procuraTexto && <p className="cd-pub-texto">{p.procuraTexto}</p>}
                {!p.dono && <p className="cd-pub-dica">Você oferece isso? {conversa ? <Link href={conversa}>Mande uma mensagem</Link> : u ? <Link href="/app/perfil">Conte no seu perfil</Link> : <Link href="/cadastro">Crie seu perfil grátis</Link>} e apareça para quem procura.</p>}
              </section>
            )}
          </div>

          <aside className="cd-pub-lado">
            {(p.loja || p.personagem) && (
              <section className="pg-cartao cd-pub-bloco">
                <h2 className="cd-pub-h3">Na cidade do WorkEnd</h2>
                {p.loja && (
                  <div className="cd-pub-item">
                    <span className="cd-pub-item-ico"><Icone nome="escritorio" tamanho={22} /></span>
                    <span className="min-w-0"><b className="block truncate">{p.loja.nome}</b><small>{rotuloLoja(p.loja.numero)} no mapa 3D</small></span>
                    <span className="cd-pub-item-acoes">
                      <Link href={`/loja/${p.loja.numero}`} className="pn-passo-btn">Abrir a loja</Link>
                      <Link prefetch={false} href={`/mundo?lote=${encodeURIComponent(p.loja.chave)}`} className="pn-passo-btn">Ver no mapa</Link>
                    </span>
                  </div>
                )}
                {p.personagem && (
                  <div className="cd-pub-item">
                    <MiniAvatar boneco={p.personagem.boneco} roupa={p.personagem.roupa} acessorios={p.personagem.acessorios} tamanho={44} />
                    <span className="min-w-0"><b className="block truncate">{p.personagem.nome}</b><small>{p.personagem.profissao || "Personagem na cidade"}</small></span>
                    {conversa && <span className="cd-pub-item-acoes"><Link href={conversa} className="pn-passo-btn">Conversar</Link></span>}
                  </div>
                )}
              </section>
            )}
            <InsigniasCidade usuarioId={p.usuarioId} />
            <section className="pg-cartao cd-pub-bloco cd-pub-rodape">
              <p><Icone nome="perfil" tamanho={16} />No WorkEnd desde {mesAno(p.desde)}</p>
              {p.nichos.length > 0 && <p className="cd-pub-nichos">Mais em {p.nichos.map((n, i) => <span key={n.id}>{i > 0 && ", "}<Link href={`/encontrar?tipo=perfis&nicho=${n.id}`}>{n.nome}</Link></span>)}</p>}
              {!u && <Link href="/cadastro" className="btn btn-azul mt-3 w-full">Criar o meu perfil grátis</Link>}
            </section>
          </aside>
        </div>
      </main>
      <div className="h-16" />
      <Rodape />
    </>
  );
}
