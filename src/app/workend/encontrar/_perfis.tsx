"use client";
// Perfis na busca (20/11/2026, frente "cadastro"): a aba Perfis de /encontrar mostra os perfis públicos do cadastro e, para
// quem tem perfil, "Quem procura o que você oferece" e "Quem oferece o que você procura" (src/server/perfis.ts: combinar).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icone } from "@/office/ui/Icone";
import { rotuloLoja } from "@/office/data/numeroLoja";
import type { CartaoPerfil, Combina } from "@/server/perfis";

function Foto({ p, tamanho = 46 }: { p: CartaoPerfil; tamanho?: number }) {
  return <span className="cd-mini-foto" style={{ width: tamanho, height: tamanho }}>{p.foto ? <img src={p.foto} alt="" loading="lazy" decoding="async" /> : p.nome.slice(0, 1).toUpperCase()}</span>;
}

export function CartoesPerfil({ perfis }: { perfis: CartaoPerfil[] }) {
  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-teste="perfis">
      {perfis.map((p, i) => (
        <li key={p.apelido} className="busca-cartao min-w-0" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <Link href={`/perfil/${p.apelido}`} className="cd-cartao h-full" data-apelido={p.apelido}>
            <span className="cd-cartao-topo"><Foto p={p} /><span className="min-w-0"><b>{p.nome}</b><small>{[p.tipo, ...p.nichos].filter(Boolean).join(" · ") || "Perfil"}</small></span></span>
            {p.oferece.length > 0 && <><span className="cd-cartao-linha">Oferece</span><span className="cd-cartao-tags">{p.oferece.slice(0, 5).map((t) => <span key={t}>{t}</span>)}</span></>}
            {p.procura.length > 0 && <><span className="cd-cartao-linha">Procura</span><span className="cd-cartao-tags cd-cartao-tags-proc">{p.procura.slice(0, 4).map((t) => <span key={t}>{t}</span>)}</span></>}
            {(p.ofereceTexto || (!p.oferece.length && p.procuraTexto)) && <span className="cd-cartao-texto">{p.ofereceTexto || p.procuraTexto}</span>}
            <span className="cd-cartao-pe">
              {p.local && <span><Icone nome="pino" tamanho={14} />{p.local}</span>}
              {p.atendimento && <span>{p.atendimento}</span>}
              {p.loja != null && <span><Icone nome="escritorio" tamanho={14} />{rotuloLoja(p.loja)} no mapa</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Coluna({ titulo, texto, lista, rotulo, vazio, icone }: { titulo: string; texto: string; lista: CartaoPerfil[]; rotulo: string; vazio: string; icone: "sacola" | "encontrar" }) {
  return (
    <div className="cd-combina-col">
      <h2><Icone nome={icone} tamanho={20} />{titulo}</h2>
      <p>{texto}</p>
      {lista.length ? (
        <div className="cd-combina-lista">
          {lista.map((p) => (
            <Link key={p.apelido} href={`/perfil/${p.apelido}`} className="cd-combina-item" data-apelido={p.apelido}>
              <Foto p={p} tamanho={42} />
              <span className="min-w-0"><b className="block truncate text-[15.5px]">{p.nome}</b><small>{rotulo} <b>{(p.motivos ?? []).join(", ")}</b>{p.local ? ` · ${p.local}` : ""}</small></span>
            </Link>
          ))}
        </div>
      ) : <p className="cd-combina-vazio">{vazio}</p>}
    </div>
  );
}

// os dois lados do casamento (só para quem está logado)
export function QuemCombina({ logado }: { logado: boolean }) {
  const [c, setC] = useState<(Combina & { logado: boolean }) | null>(null);
  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    fetch("/api/workend/perfis?combina=1", { cache: "no-store" }).then((r) => r.json()).then((j) => vivo && setC(j)).catch(() => {});
    return () => { vivo = false; };
  }, [logado]);
  if (!logado) return (
    <div className="cd-convite">
      <div><b>Mostre o que você faz e diga o que procura</b><p>Crie a conta grátis e o WorkEnd mostra quem combina com você.</p></div>
      <Link href="/cadastro" className="btn btn-azul">Criar meu perfil</Link>
    </div>
  );
  if (!c) return <div className="cd-combina" aria-busy="true"><div className="cd-combina-col"><p className="text-sm text-[var(--muted)]">Procurando quem combina com você…</p></div></div>;
  if (!c.temPerfil || (!c.ofereco && !c.procuro)) return (
    <div className="cd-convite">
      <div><b>Conte o que você oferece e o que procura</b><p>Com isso, aparece aqui quem procura o seu trabalho e quem oferece o que você precisa.</p></div>
      <Link href={c.temPerfil ? "/app/perfil#secao-oferece" : "/app/perfil/comecar"} className="btn btn-azul">{c.temPerfil ? "Completar meu perfil" : "Montar meu perfil"}</Link>
    </div>
  );
  return (
    <section className="cd-combina" aria-label="Quem combina com você" data-teste="combina">
      {c.ofereco && <Coluna icone="sacola" titulo="Quem procura o que você oferece" texto="Pessoas e empresas que disseram procurar o que está no seu perfil." lista={c.procuramOQueOfereco} rotulo="Procura:" vazio="Ninguém pediu o que você oferece ainda. Etiquetas simples (ex.: Fotografia, Bolos, Sites) ajudam a casar." />}
      {c.procuro && <Coluna icone="encontrar" titulo="Quem oferece o que você procura" texto="Perfis que oferecem o que você disse procurar." lista={c.oferecemOQueProcuro} rotulo="Oferece:" vazio="Ainda não há quem ofereça o que você procura. Tente outras palavras no seu perfil." />}
      {(!c.ofereco || !c.procuro) && (
        <div className="cd-combina-col">
          <h2><Icone nome="editar" tamanho={20} />{c.ofereco ? "E o que você procura?" : "E o que você oferece?"}</h2>
          <p>{c.ofereco ? "Diga o que procura e veja quem oferece." : "Diga o que você faz e veja quem procura."}</p>
          <Link href={`/app/perfil#secao-${c.ofereco ? "procura" : "oferece"}`} className="btn btn-linha mt-3">Completar meu perfil</Link>
        </div>
      )}
    </section>
  );
}
