// Página inicial do WorkEnd (workend.online), versão 2 de 11/11/2026: editorial em papel quente, tinta e azul.
// Abertura com tipografia líquida e a fita da cidade, galeria arrastável dos prédios, vitrine 3D ao vivo, passos em
// cartões que se empilham, a cidade em vídeo que cresce ao rolar, setores, rede, a esfera de vidro dos especialistas
// de IA, preço e perguntas. Dados reais: lotes livres agora.
import Link from "next/link";
import Image from "next/image";
import { usuarioAtual } from "@/server/usuarios";
import { sql, migrar, temBanco } from "@/server/db";
import { LOTES } from "@/office/data/mundo";
import { LAYOUTS, type LayoutId } from "@/office/data/escritorio";
import { ESPECIALISTAS_IA } from "@/office/data/especialistas";
import { AREAS } from "@/office/data/org";
import { Rodape, SETORES } from "./_partes";
import { TituloLiquido } from "./_inicio/TituloLiquido";
import { FitaCidade } from "./_inicio/FitaCidade";
import { GaleriaPredios } from "./_inicio/GaleriaPredios";
import { Configurador } from "./_inicio/Configurador";
import { SecaoEsfera } from "./_inicio/SecaoEsfera";
import { Setores, type SetorVitrine } from "./_inicio/Setores";
import { Revelar, Contador, Rolagem } from "./_inicio/efeitos";
import { CenaLote, CenaFachada, CenaEquipe } from "./_inicio/CenasPassos";
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

// Fotos do mapa (c00–c09) intercaladas com quadros do passeio em vídeo (c10–c17)
const FOTOS = [0, 10, 1, 11, 2, 12, 3, 13, 4, 14, 5, 15, 6, 16, 7, 17, 8, 9].map((n) => `/workend/cidade/c${String(n).padStart(2, "0")}.webp`);
const CORES_PREDIO: Record<LayoutId, [string, string]> = {
  vidro: ["#DCEBFF", "#8FBDF4"], moderno: ["#F6EBDD", "#DDB893"], sobrado: ["#E7F0DA", "#A6C98A"],
  loja: ["#FFE5DB", "#F1A487"], galpao: ["#E8E4F8", "#ADA4E6"], container: ["#D8F2EB", "#84CEBB"],
};

const PERGUNTAS: [string, string][] = [
  ["Preciso pagar para criar a conta?", "Não. A conta é grátis. Você só paga quando reserva um lote (R$ 99 por mês) ou quando ativa o seu personagem (R$ 5,90 por mês)."],
  ["Como funciona o pagamento?", "Por Pix, direto no mapa: o QR Code aparece no cartão do lote e a confirmação chega sozinha. A reserva segura o lote por 1 hora enquanto você paga."],
  ["E se eu não renovar?", "Depois do vencimento há 5 dias de tolerância. Sem renovação, o lote volta a ficar à venda, mas a sua marca e a sua equipe ficam guardadas na conta e voltam se você reservar outro lote."],
  ["Posso desistir da compra?", "Pode. Em até 7 dias depois da compra você recebe o valor de volta."],
  ["Quando chegam os agentes de IA?", "Os especialistas já estão em treinamento e chegam em breve. Por enquanto, a equipe do seu escritório é visual: você escolhe o prédio, monta as salas e dá nome a cada pessoa."],
  ["Funciona no celular?", "Funciona. O mapa abre no navegador do celular e do computador, sem instalar nada."],
];

function Cabecalho({ logado }: { logado: boolean }) {
  const links = [["#predios", "Prédios"], ["#como", "Como funciona"], ["#mapa", "A cidade"], ["#preco", "Preço"]];
  return (
    <header className="wi-topo">
      <div className="faixa wi-topo-linha">
        <Link href="/" aria-label="WorkEnd, início" className="wi-logo"><Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority /></Link>
        <nav className="wi-nav" aria-label="Seções da página">{links.map(([h, t]) => <a key={h} href={h}>{t}</a>)}</nav>
        <div className="wi-topo-acoes">
          {logado ? <Link href="/app" className="wi-btn wi-btn-tinta wi-btn-p">Meu escritório</Link> : <><Link href="/entrar" className="wi-entrar">Entrar</Link><Link href="/cadastro" className="wi-btn wi-btn-tinta wi-btn-p">Criar conta grátis</Link></>}
          <details className="wi-menu">
            <summary aria-label="Abrir o menu"><span /><span /></summary>
            <div>{links.map(([h, t]) => <a key={h} href={h}>{t}</a>)}{!logado && <Link href="/entrar">Entrar</Link>}</div>
          </details>
        </div>
      </div>
    </header>
  );
}

// A rede: duas lojas do mapa conversando, propondo um negócio e fazendo uma chamada
function CenaRede() {
  return (
    <div className="wi-chat" aria-hidden>
      <div className="wi-chat-topo"><span className="wi-avatar" style={{ ["--cor" as string]: "#F59E0B" }}>D</span><div><b>Diego</b><small>Studio Criativo · Lote 12 · online</small></div></div>
      <p className="eu" style={{ ["--k" as string]: 0 }}>Oi! Passei na frente da sua padaria no mapa.</p>
      <p style={{ ["--k" as string]: 1 }}>Que bom! Tô precisando de fotos dos doces pro Instagram.</p>
      <p className="eu" style={{ ["--k" as string]: 2 }}>Faço sim. Te mando uma proposta.</p>
      <div className="wi-proposta" style={{ ["--k" as string]: 3 }}><small>Proposta</small><b>Ensaio de fotos dos doces</b><span>R$ 450,00</span><em className="wi-status"><i>aberta</i><i>aceita</i></em></div>
      <div className="wi-chamada" style={{ ["--k" as string]: 4 }}><i /> Chamada de vídeo com Diego</div>
    </div>
  );
}

export default async function Inicio() {
  const u = await usuarioAtual().catch(() => null);
  const livres = await lotesLivres();
  const lote = livres.length ? LOTES.find((l) => l.chave === livres[0]) ?? null : null;
  const setores: SetorVitrine[] = SETORES.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, entrega: s.entrega, equipe: ESPECIALISTAS_IA.filter((e) => e.area === s.id).map((e) => ({ nome: e.nome, cargo: e.cargo, skills: e.skills.map((k) => k.nome) })) }));
  const crachas = ESPECIALISTAS_IA.map((e) => ({ nome: e.nome, cargo: e.cargo, cor: AREAS[e.area].cor, skill: e.skills[0]?.nome ?? "" }));
  const filas = [crachas.filter((_, i) => i % 2 === 0), crachas.filter((_, i) => i % 2 === 1)];
  const totalSkills = ESPECIALISTAS_IA.reduce((n, e) => n + e.skills.length, 0);
  const cta = u ? { href: "/app", texto: "Abrir meu escritório" } : { href: lote ? `/cadastro?lote=${encodeURIComponent(lote.chave)}` : "/cadastro", texto: "Criar conta grátis" };
  const predios = LAYOUTS.map((l) => ({ id: l.id, nome: l.nome, descricao: l.descricao, andares: l.andares, cores: CORES_PREDIO[l.id] }));
  const passos = [
    { cena: <CenaLote />, titulo: "Escolha o seu lote", texto: `São ${LOTES.length} lotes espalhados pela cidade. Clique num livre e ele fica reservado por 1 hora enquanto você paga no Pix.` },
    { cena: <CenaFachada />, titulo: "Ponha a sua marca na fachada", texto: "Nome, logomarca e cor no letreiro e na placa, à vista de todo mundo que passa pela rua." },
    { cena: <CenaEquipe />, titulo: "Monte a sua equipe", texto: "Escolha entre 6 prédios, crie a sala de cada setor e dê nome e rosto a cada pessoa." },
  ];
  return (
    <div className="wi">
      <Cabecalho logado={!!u} />
      <main>
        {/* ---------- abertura ---------- */}
        <section className="wh">
          <div className="wh-grade" aria-hidden />
          <div className="wh-pontos" aria-hidden>{[[8, 22], [91, 14], [74, 38], [16, 58], [56, 9], [97, 52]].map(([x, y], k) => <i key={k} style={{ ["--x" as string]: `${x}%`, ["--y" as string]: `${y}%`, ["--k" as string]: k }} />)}</div>
          <div className="faixa wh-texto">
            <TituloLiquido texto="Abra as portas" depois="da sua empresa." />
            <div className="wh-base">
              <p className="wh-lead">Escolha um lote numa cidade 3D, ponha a sua marca na fachada e monte uma sala para cada setor. Quem passeia pelo WorkEnd passa na sua porta.</p>
              <div className="wh-acoes">
                <Link href={cta.href} className="wi-btn wi-btn-tinta">{cta.texto}<span aria-hidden>→</span></Link>
                <Link href="/mundo" className="wi-seta">Passear pelo mapa<span aria-hidden>↗</span></Link>
              </div>
            </div>
            <p className="wh-vivo"><i className="wi-vivo" aria-hidden /><b><Contador valor={livres.length} /></b> de {LOTES.length} lotes livres agora <span>·</span> R$ 99 por mês <span>·</span> Pix direto no mapa</p>
          </div>
          <FitaCidade fotos={FOTOS} />
        </section>

        {/* ---------- prédios ---------- */}
        <section id="predios" className="ws ws-predios">
          <Revelar className="faixa ws-cab"><h2>Seis prédios. <em>Um deles é o seu.</em></h2><p>Arraste para o lado e conheça cada um. Todos têm o quadro do letreiro pronto para receber o nome da sua empresa.</p></Revelar>
          <Revelar className="faixa"><GaleriaPredios predios={predios} destino={cta.href} /></Revelar>
        </section>

        {/* ---------- vitrine ao vivo ---------- */}
        <section id="experimente" className="ws ws-vitrine">
          <Revelar className="faixa ws-cab"><h2>Escreva o nome. <em>A fachada acende.</em></h2><p>Este é o mundo de verdade, ao vivo. Digite o nome da sua empresa, troque o prédio e a cor e veja como fica na rua.</p></Revelar>
          <Revelar className="faixa"><Configurador lote={lote ? { chave: lote.chave, numero: lote.numero } : null} logado={!!u} /></Revelar>
        </section>

        {/* ---------- como funciona ---------- */}
        <section id="como" className="ws">
          <Revelar className="faixa ws-cab"><h2>Do lote vazio ao escritório aberto <em>em três passos.</em></h2><p>Sem obra, sem aluguel e sem instalar nada. Tudo acontece no mapa.</p></Revelar>
          <Rolagem className="faixa wp-pilha">
            {passos.map((p, i) => (
              <Revelar key={p.titulo} className="wp-cartao" style={{ ["--i" as string]: i }}>
                {p.cena}
                <div className="wp-texto"><span className="wp-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span><div><h3>{p.titulo}</h3><p>{p.texto}</p></div></div>
              </Revelar>
            ))}
          </Rolagem>
        </section>

        {/* ---------- a cidade ---------- */}
        <section id="mapa" className="wc">
          <Revelar className="faixa ws-cab ws-cab-claro"><h2>Uma cidade inteira de empresas, <em>aberta 24 horas.</em></h2><p>Veja em 1 minuto como funciona: escolher o lote, pôr a marca na fachada, montar a equipe e fazer negócio com quem está do lado.</p></Revelar>
          <Rolagem className="wc-zoom">
            <div className="wc-tela">
              <VideoExplica src="/workend/como-funciona.mp4" poster="/workend/como-funciona.jpg" />
              <Link href="/mundo" className="wi-btn wi-btn-vidro wc-btn">Passear pelo mapa agora<span aria-hidden>→</span></Link>
            </div>
          </Rolagem>
          <Revelar className="faixa wc-numeros">
            <div><b><Contador valor={livres.length} /></b><span>lotes livres agora</span></div>
            <div><b><Contador valor={LAYOUTS.length} /></b><span>tipos de prédio</span></div>
            <div><b><Contador valor={SETORES.length} /></b><span>setores para montar</span></div>
            <div><b><Contador valor={ESPECIALISTAS_IA.length} /></b><span>especialistas a caminho</span></div>
          </Revelar>
        </section>

        {/* ---------- setores ---------- */}
        <section id="setores" className="ws">
          <Revelar className="faixa ws-cab"><h2>Cada setor vira <em>uma sala do seu prédio.</em></h2><p>Escolha os setores que a sua empresa tem. Cada sala já sabe quem vai trabalhar nela.</p></Revelar>
          <Revelar className="faixa"><Setores setores={setores} /></Revelar>
        </section>

        {/* ---------- rede ---------- */}
        <section className="ws wr">
          <div className="faixa wi-rede">
            <Revelar className="wi-rede-cena"><CenaRede /></Revelar>
            <Revelar className="wi-rede-texto">
              <h2>Ande pelo mapa e faça negócio <em>com quem está do lado.</em></h2>
              <p className="wi-lead">Com um personagem, você caminha pela cidade, vê quem está online, faz amigos, troca mensagens, manda propostas e liga por vídeo, sem sair do WorkEnd.</p>
              <ul className="wi-lista">
                <li>Amizades que liberam as redes sociais um do outro</li>
                <li>Propostas de negócio com status: aberta, aceita, concluída</li>
                <li>Chamada de áudio e vídeo direto pelo navegador</li>
              </ul>
              <p className="wi-preco-mini">Personagem por <b>R$ 5,90 por mês</b> <s>R$ 19,90</s></p>
            </Revelar>
          </div>
        </section>

        {/* ---------- especialistas de IA ---------- */}
        <SecaoEsfera
          texto={<>
            <h2>{ESPECIALISTAS_IA.length} especialistas de IA <em>em treinamento.</em></h2>
            <p>Eles chegam em breve para trabalhar nas salas do seu prédio. Enquanto isso, treinam e avaliam o trabalho uns dos outros todos os dias.</p>
            <ul className="wa-fatos">
              <li><b>{SETORES.length}</b><span>setores, do atendimento ao jurídico</span></li>
              <li><b>{totalSkills}</b><span>habilidades escritas para o dia a dia de uma empresa</span></li>
              <li><b>1×</b><span>por dia eles treinam entre si, e só fica a versão que vence</span></li>
            </ul>
          </>}
          rodape={
            <div className="wi-filas" aria-label="Especialistas que estão chegando">
              {filas.map((f, k) => (
                <div key={k} className={`wi-fila ${k ? "volta" : ""}`}>
                  <div className="wi-trilho">{[...f, ...f].map((c, i) => (
                    <div key={i} className="wi-cracha" style={{ ["--cor" as string]: c.cor }} aria-hidden={i >= f.length}>
                      <span className="wi-avatar">{c.nome[0]}</span>
                      <div><b>{c.nome}</b><small>{c.cargo}</small><em>{c.skill}</em></div>
                    </div>
                  ))}</div>
                </div>
              ))}
            </div>
          }
        />

        {/* ---------- preço ---------- */}
        <section id="preco" className="ws">
          <Revelar className="faixa ws-cab"><h2>Preço simples, <em>sem letra miúda.</em></h2><p>Criar a conta é grátis. Você só paga pelo que usar.</p></Revelar>
          <div className="faixa">
            <div className="wi-planos">
              <Revelar className="wi-plano wi-plano-forte">
                <h3>Lote no mapa</h3>
                <p className="wi-valor"><b>R$ 99</b><span>por mês</span></p>
                <ul className="wi-lista">
                  <li>Seu endereço com placa, nome, logomarca e cor da marca</li>
                  <li>6 tipos de prédio e 3 trocas de prédio grátis</li>
                  <li>Escritório com os setores e a equipe que você montar</li>
                  <li>Pagamento por Pix, direto no mapa</li>
                  <li>Desistiu em até 7 dias? O valor volta para você</li>
                </ul>
                <Link href={cta.href} className="wi-btn wi-btn-azul">{u ? "Abrir meu escritório" : "Reservar meu lote"}<span aria-hidden>→</span></Link>
              </Revelar>
              <Revelar className="wi-plano">
                <h3>Personagem</h3>
                <p className="wi-valor"><b>R$ 5,90</b><span>por mês</span></p>
                <ul className="wi-lista">
                  <li>Seu boneco andando pela cidade</li>
                  <li>Amigos, mensagens e propostas de negócio</li>
                  <li>Chamadas de áudio e vídeo</li>
                </ul>
                <Link href={u ? "/app/rede" : "/cadastro"} className="wi-btn wi-btn-linha">{u ? "Ativar meu personagem" : "Criar conta grátis"}</Link>
              </Revelar>
            </div>
            <Revelar className="wi-perguntas">
              <h3>Perguntas frequentes</h3>
              {PERGUNTAS.map(([p, r]) => <details key={p}><summary>{p}</summary><p>{r}</p></details>)}
            </Revelar>
          </div>
        </section>

        {/* ---------- final ---------- */}
        <section className="wfim">
          <Revelar className="faixa wfim-texto">
            <h2>O seu endereço <em>está esperando.</em></h2>
            <p>{livres.length > 0 ? <>Ainda há <b>{livres.length} lotes livres</b> no mapa.</> : <>Todos os lotes estão ocupados agora. Crie a conta para saber quando abrir um novo.</>}</p>
            <div className="wh-acoes"><Link href={cta.href} className="wi-btn wi-btn-tinta">{cta.texto}<span aria-hidden>→</span></Link><Link href="/mundo" className="wi-seta">Passear pelo mapa<span aria-hidden>↗</span></Link></div>
          </Revelar>
          <TituloLiquido como="p" texto="WorkEnd" className="wfim-marca" oculto />
        </section>
      </main>
      <Rodape />
    </div>
  );
}
