// Página inicial do WorkEnd — redesign de 11/11/2026 (docs/redesign-2026-11/BRIEF.md + index.html do designer).
// Sete seções: hero, salas, prédios, cidade, preço, dúvidas, fechamento. Textos do designer, sem invenção:
// descrições dos prédios e resposta sobre não renovar vêm do próprio produto; números vêm do banco.
import Link from "next/link";
import { usuarioAtual } from "@/server/usuarios";
import { sql, migrar, temBanco } from "@/server/db";
import { LOTES } from "@/office/data/mundo";
import { LAYOUTS, type LayoutId } from "@/office/data/escritorio";
import { Rodape, SETORES } from "./_partes";
import { Logotipo } from "./_marca";
import { Hero } from "./_inicio/Hero";
import { Predios } from "./_inicio/Predios";
import { VideoExplica } from "./_inicio/VideoExplica";
import "./inicio.css";

export const dynamic = "force-dynamic";

declare global {
  var __workendLivres: { em: number; chaves: string[] } | undefined;
}
// Lotes sem dono agora (cache de 1 minuto: a página inicial não precisa ir ao banco a cada visita)
async function lotesLivres() {
  const c = globalThis.__workendLivres;
  if (c && Date.now() - c.em < 60_000) return c.chaves;
  let ocupados = new Set<string>();
  if (temBanco()) { try { await migrar(); ocupados = new Set((await sql<{ chave: string }[]>`SELECT chave FROM terreno`).map((r) => r.chave)); } catch { /* sem banco: mostra todos */ } }
  const chaves = LOTES.filter((l) => !ocupados.has(l.chave)).map((l) => l.chave);
  globalThis.__workendLivres = { em: Date.now(), chaves };
  return chaves;
}

// Nomes curtos do designer; a descrição do Cubo de vidro é a dele, as outras são as do produto (src/office/data/escritorio.ts)
const NOME: Record<LayoutId, string> = { vidro: "Cubo de vidro", moderno: "Térreo moderno", sobrado: "Sobrado", loja: "Loja de rua", galpao: "Galpão", container: "Contêineres" };
const DESC_DESIGNER: Partial<Record<LayoutId, string>> = { vidro: "Dois andares todos de vidro, com jardim no terraço. Dá para ver a equipe trabalhando de fora." };

const PERGUNTAS: [string, string][] = [
  ["Quanto custa, afinal?", "R$ 99 por mês pelo lote no mapa, com a fachada e as salas incluídas. O personagem andando pela cidade é opcional, R$ 5,90 por mês."],
  ["Dá para pagar no Pix?", "Sim, direto no mapa, sem sair para outra tela."],
  ["E se eu desistir?", "Reembolso em até 7 dias."],
  ["Posso trocar de prédio depois?", "As três primeiras trocas são de graça."],
  ["Os especialistas de IA já funcionam?", "Ainda não. Estão em treinamento e entram depois. O que você contrata hoje é o endereço, a fachada e as salas."],
  ["E se eu não quiser renovar?", "Depois do vencimento há 5 dias de tolerância. Sem renovação, o lote volta a ficar à venda, mas a sua marca e a sua equipe ficam guardadas na conta e voltam se você reservar outro lote."],
];

// número por extenso (lotes são no máximo algumas dezenas)
const UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const extenso = (n: number) => (n < 20 ? UN[n] : n < 100 ? DZ[Math.floor(n / 10)] + (n % 10 ? " e " + UN[n % 10] : "") : String(n));
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Inicio() {
  const u = await usuarioAtual().catch(() => null);
  const livres = await lotesLivres();
  const lote = livres.length ? LOTES.find((l) => l.chave === livres[0]) ?? null : null;
  const cadastro = lote ? `/cadastro?lote=${encodeURIComponent(lote.chave)}` : "/cadastro";
  const predios = LAYOUTS.map((l) => ({ id: l.id, nome: NOME[l.id], descricao: DESC_DESIGNER[l.id] ?? l.descricao }));
  const nomesSetores = SETORES.map((s) => s.nome);
  const n = livres.length;
  return (
    <div className="lp">
      <header>
        <div className="bar">
          <a href="#inicio" aria-label="WorkEnd, início" className="logo-link"><Logotipo altura={22} /></a>
          <nav aria-label="Seções da página">
            <a href="#salas">Salas</a><a href="#predios">Prédios</a><a href="#cidade">A cidade</a><a href="#preco">Preço</a>
          </nav>
          {u ? <Link href="/app" className="lp-btn">Meu escritório</Link> : <><Link href="/entrar" className="lp-btn-quiet">Entrar</Link><Link href={cadastro} className="lp-btn">Criar conta grátis</Link></>}
        </div>
      </header>

      <main id="inicio">
        <Hero lote={lote ? { chave: lote.chave, numero: lote.numero } : null} logado={!!u} />

        <section className="wrap" id="salas">
          <h2 style={{ maxWidth: "18ch" }}>Cada setor da sua equipe vira uma sala.</h2>
          <p className="lede" style={{ marginTop: 16, maxWidth: "60ch" }}>A parede da frente cai e o prédio inteiro fica à vista. Quem chega vê onde cada pessoa trabalha e bate na porta certa, sem perguntar com quem falar.</p>
          <div className="cut" data-asset="dollhouse">
            <img src="/workend/render/dollhouse-1600.webp" srcSet="/workend/render/dollhouse-1000.webp 1000w, /workend/render/dollhouse-1600.webp 1600w, /workend/render/dollhouse-2000.webp 2000w" sizes="(min-width: 1180px) 1132px, calc(100vw - 48px)" width={2000} height={1120} loading="lazy" decoding="async"
              alt="O escritório por dentro, com a parede da frente removida: recepção, sala do CEO e as salas de Atendimento, Vendas, Social media e Financeiro, com a equipe nas mesas" />
          </div>
          <p className="setores-lista">Os {nomesSetores.length} setores do WorkEnd: {nomesSetores.slice(0, -1).join(", ")} e {nomesSetores.at(-1)}.</p>
        </section>

        <section className="wrap" id="predios">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px 48px", alignItems: "flex-end", marginBottom: 32 }}>
            <h2 style={{ flex: "1 1 320px" }}>Seis prédios. Um deles é o seu.</h2>
            <p className="lede" style={{ flex: "1 1 340px", maxWidth: "50ch", fontSize: 17 }}>Todos já vêm com o quadro do letreiro pronto para receber o nome. Trocar de prédio não custa nada nas três primeiras vezes.</p>
          </div>
          <Predios predios={predios} />
        </section>

        <section className="wrap" id="cidade">
          <div className="dark-card">
            <h2 style={{ maxWidth: "20ch" }}>Ande pelo mapa e faça negócio com quem está do lado.</h2>
            <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>A rua tem vizinho. Dá para entrar, conversar por áudio ou vídeo e mandar proposta com status, tudo sem sair do mapa.</p>
            <VideoExplica src="/workend/como-funciona.mp4" poster="/workend/como-funciona.jpg" />
            <div className="nums">
              <div><div className="num">{n}</div><div className="num-rot">{n === 1 ? "lote ainda livre" : "lotes ainda livres"}</div></div>
              <div><div className="num">{LAYOUTS.length}</div><div className="num-rot">tipos de prédio</div></div>
              <div><div className="num">{nomesSetores.length}</div><div className="num-rot">setores para montar</div></div>
              <div><div className="num">24h</div><div className="num-rot">a cidade não fecha</div></div>
            </div>
          </div>
        </section>

        <section className="wrap" id="preco">
          <h2>Preço simples, sem letra miúda.</h2>
          <div className="precos">
            <div className="plano">
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span className="valor">R$ 99</span><span style={{ fontSize: 19, color: "var(--muted)" }}>por mês</span></div>
              <p style={{ margin: "4px 0 24px", fontSize: 17, color: "var(--muted)" }}>O lote no mapa, com tudo que fica em pé nele.</p>
              <ul className="inclui">
                <li>Fachada com o nome da sua empresa</li>
                <li>Uma sala para cada setor da equipe</li>
                <li>Três trocas de prédio sem custo</li>
                <li>Pix direto no mapa</li>
                <li>Reembolso em até 7 dias</li>
              </ul>
              <Link href={u ? "/app" : cadastro} className="lp-btn lp-btn-g">{u ? "Abrir meu escritório" : "Criar conta grátis"}</Link>
            </div>
            <div className="aside">
              <div className="box">
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 32, lineHeight: 1, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>R$ 5,90</span><span style={{ fontSize: 16, color: "var(--muted)" }}>por mês</span></div>
                <p style={{ marginTop: 4, fontSize: 16, color: "var(--muted)" }}>Opcional: um personagem seu andando pela cidade, para entrar nos prédios dos outros.</p>
              </div>
              <div className="box-dim">
                <p style={{ fontSize: 16, color: "var(--ink)" }}>Os 39 especialistas de IA ainda estão em treinamento e entram depois. O que você contrata hoje é o endereço, a fachada e as salas.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="wrap">
          <h2 style={{ marginBottom: 24 }}>Antes de reservar.</h2>
          <div style={{ maxWidth: 820 }}>
            {PERGUNTAS.map(([p, r]) => <details key={p} className="faq"><summary>{p}</summary><p>{r}</p></details>)}
          </div>
        </section>

        <section className="wrap">
          <div className="dark-card fecho">
            <div>
              <h2 style={{ maxWidth: "14ch", fontSize: "clamp(30px, 4vw, 52px)" }}>O seu endereço está esperando.</h2>
              <p>{n === 0 ? "Todos os lotes estão ocupados agora. Crie a conta para saber quando abrir um novo." : n === 1 ? "Um lote continua livre na cidade." : `${maiuscula(extenso(n))} lotes continuam livres na cidade.`}</p>
            </div>
            <Link href={n === 0 ? cadastro : "/mundo"} className="lp-btn" style={{ fontSize: 18, padding: "18px 32px" }}>{n === 0 ? "Criar conta grátis" : "Escolher o meu lote"}</Link>
          </div>
        </section>
      </main>

      <div className="rodape-lp"><Rodape /></div>
    </div>
  );
}
