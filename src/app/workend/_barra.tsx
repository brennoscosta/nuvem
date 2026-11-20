"use client";
// Barra de cima das áreas logadas (refeita em 16/11/2026: "deixe mais profissional, bonito"). Vidro fosco fixo no topo,
// ícones próprios, um destaque que desliza até o item sob o mouse e volta para a página atual, menu da conta (e-mail,
// admin, sair) e, em telas menores, um menu que desce com os itens e uma linha explicando cada um.
// Sem estado do React para posição e rolagem: a barra mexe direto no elemento (regra do React compiler).
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarcaTopo } from "./_marca";
import { Sino } from "@/office/ui/Sino";
import { SaldoCreditos } from "@/office/ui/SaldoCreditos";
import { Icone, type NomeIcone } from "@/office/ui/Icone";

export type AtualApp = "app" | "equipe" | "encontrar" | "rede" | "admin" | "mapa" | "resultados";
const ITENS: { id: AtualApp; href: string; rotulo: string; icone: NomeIcone; desc: string; logado?: boolean }[] = [
  { id: "mapa", href: "/mundo", rotulo: "Mapa", icone: "mapa", desc: "A cidade 3D com as lojas" },
  { id: "app", href: "/app", rotulo: "Meu escritório", icone: "escritorio", desc: "Seu lote e as ferramentas da loja", logado: true },
  { id: "resultados", href: "/app/resultados", rotulo: "Resultados", icone: "resultados", desc: "Visitas, conversas e cliques", logado: true },
  { id: "equipe", href: "/app/equipe", rotulo: "Minha equipe", icone: "equipe", desc: "Sua equipe de IA trabalhando", logado: true },
  { id: "encontrar", href: "/encontrar", rotulo: "Encontrar", icone: "encontrar", desc: "Empresas, profissionais e vagas" },
  { id: "rede", href: "/app/rede", rotulo: "Minha rede", icone: "rede", desc: "Personagem, amigos e negócios", logado: true },
];

const sairDaConta = async () => { await fetch("/api/workend/sair", { method: "POST" }).catch(() => {}); window.location.href = "/"; };

export function BarraApp({ atual, email, admin }: { atual: AtualApp; email?: string | null; admin?: boolean }) {
  const itens = ITENS.filter((i) => email || !i.logado);
  const barra = useRef<HTMLElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const luz = useRef<HTMLSpanElement>(null);
  const [conta, setConta] = useState(false);
  const [menu, setMenu] = useState(false);
  const inicial = (email ?? "?").slice(0, 1).toUpperCase();

  // o destaque desliza até um item (ou volta para o da página atual)
  const levar = (el: Element | null | undefined, instantaneo = false) => {
    const l = luz.current; if (!l) return;
    if (!el) { l.style.opacity = "0"; return; }
    const e = el as HTMLElement;
    if (instantaneo) l.style.transition = "none";
    l.style.opacity = "1"; l.style.width = `${e.offsetWidth}px`; l.style.transform = `translateX(${e.offsetLeft}px)`;
    if (instantaneo) { void l.offsetWidth; l.style.transition = ""; }
  };
  const voltar = () => levar(trilho.current?.querySelector('[aria-current="page"]'));
  useLayoutEffect(() => {
    levar(trilho.current?.querySelector('[aria-current="page"]'), true);
    const t = trilho.current; if (!t) return;
    const ro = new ResizeObserver(() => levar(t.querySelector('[aria-current="page"]'), true));
    ro.observe(t); return () => ro.disconnect();
  }, [atual]);

  // vidro ganha borda e sombra quando a página rola
  useEffect(() => {
    const b = barra.current; if (!b) return;
    const ver = () => b.toggleAttribute("data-rolou", window.scrollY > 8);
    ver(); window.addEventListener("scroll", ver, { passive: true });
    return () => window.removeEventListener("scroll", ver);
  }, []);

  // fecha os menus com Esc ou clicando fora
  useEffect(() => {
    if (!conta && !menu) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setConta(false); setMenu(false); } };
    const fora = (e: MouseEvent) => { if (!barra.current?.contains(e.target as Node)) { setConta(false); setMenu(false); } };
    window.addEventListener("keydown", tecla); document.addEventListener("mousedown", fora);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fora); };
  }, [conta, menu]);

  return (
    <header ref={barra} className="cab" data-menu={menu ? "" : undefined}>
      <div className="faixa cab-linha">
        <Link href="/" aria-label="WorkEnd, início" className="cab-logo"><MarcaTopo altura={22} /></Link>

        <nav className="cab-nav" aria-label="Áreas do WorkEnd">
          <div ref={trilho} className="cab-trilho" onMouseLeave={voltar}>
            <span ref={luz} className="cab-luz" aria-hidden="true" />
            {itens.map((i) => (
              <Link key={i.id} href={i.href} prefetch={i.href.startsWith("/mundo") ? false : undefined} className="cab-item" aria-current={atual === i.id ? "page" : undefined} onMouseEnter={(e) => levar(e.currentTarget)} onFocus={(e) => levar(e.currentTarget)} onBlur={voltar}>
                <Icone nome={i.icone} tamanho={18} />{i.rotulo}
              </Link>
            ))}
          </div>
        </nav>

        <div className="cab-direita">
          {email && <SaldoCreditos tema="claro" />}
          {email && <Sino tema="claro" />}
          {email ? (
            <div className="cab-conta-caixa relative">
              <button type="button" className="cab-conta" aria-expanded={conta} aria-haspopup="menu" onClick={() => { setConta(!conta); setMenu(false); }}>
                <span className="cab-avatar" aria-hidden="true">{inicial}</span>
                <span className="sr-only">Minha conta</span>
                <Icone nome="baixo" tamanho={16} className="cab-seta" />
              </button>
              {conta && (
                <div className="cab-pop" role="menu">
                  <div className="cab-pop-topo"><span className="cab-avatar cab-avatar-g" aria-hidden="true">{inicial}</span><div className="min-w-0"><b>Minha conta</b><span>{email}</span></div></div>
                  <Link role="menuitem" href="/app" className="cab-pop-item"><Icone nome="escritorio" tamanho={18} />Meu escritório</Link>
                  <Link role="menuitem" href="/app/vendas" className="cab-pop-item"><Icone nome="recibo" tamanho={18} />Vendas e pedidos</Link>
                  <Link role="menuitem" href="/app/rede" className="cab-pop-item"><Icone nome="rede" tamanho={18} />Minha rede e personagem</Link>
                  <Link role="menuitem" href="/app/perfil" className="cab-pop-item"><Icone nome="perfil" tamanho={18} />Meu perfil</Link>
                  {admin && <Link role="menuitem" href="/app/admin" className="cab-pop-item"><Icone nome="admin" tamanho={18} />Administração</Link>}
                  <button role="menuitem" type="button" onClick={() => void sairDaConta()} className="cab-pop-item cab-pop-sair"><Icone nome="sair" tamanho={18} />Sair da conta</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/entrar" className="btn btn-azul !py-2.5 text-sm cab-entrar">Entrar</Link>
          )}
          <button type="button" className="cab-hamburguer" aria-expanded={menu} aria-controls="cab-folha" onClick={() => { setMenu(!menu); setConta(false); }}>
            <span className="sr-only">{menu ? "Fechar o menu" : "Abrir o menu"}</span>
            <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* telas menores: o menu desce com cada área e o que ela faz */}
      <div id="cab-folha" className="cab-folha" hidden={!menu}>
        <div className="faixa">
          <ul className="cab-folha-lista">
            {itens.map((i, n) => (
              <li key={i.id} style={{ ["--i" as string]: n }}>
                <Link href={i.href} prefetch={i.href.startsWith("/mundo") ? false : undefined} className="cab-folha-item" aria-current={atual === i.id ? "page" : undefined} onClick={() => setMenu(false)}>
                  <span className="cab-folha-ico"><Icone nome={i.icone} tamanho={22} /></span>
                  <span className="min-w-0"><b>{i.rotulo}</b><small>{i.desc}</small></span>
                </Link>
              </li>
            ))}
          </ul>
          {email && (
            <div className="cab-folha-conta">
              <span className="cab-avatar" aria-hidden="true">{inicial}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{email}</span>
              <Link href="/app/vendas" className="cab-folha-mini" onClick={() => setMenu(false)}><Icone nome="recibo" tamanho={16} />Vendas</Link>
              <Link href="/app/perfil" className="cab-folha-mini" onClick={() => setMenu(false)}><Icone nome="perfil" tamanho={16} />Perfil</Link>
              {admin && <Link href="/app/admin" className="cab-folha-mini" onClick={() => setMenu(false)}><Icone nome="admin" tamanho={16} />Admin</Link>}
              <button type="button" onClick={() => void sairDaConta()} className="cab-folha-mini"><Icone nome="sair" tamanho={16} />Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
