// Peças compartilhadas do site WorkEnd: topo, rodapé e dados do catálogo de setores/especialistas.
import Link from "next/link";
import Image from "next/image";
import { AREAS, AREAS_OPERACIONAIS, FUNCOES, type AreaId } from "@/office/data/org";
import { ESPECIALISTAS_IA } from "@/office/data/especialistas";

export const DEMO = "https://nuvem.nuvemhost.cloud/?vista=fora";

export function Topo({ logado, nome }: { logado?: boolean; nome?: string }) {
  return (
    <header className="faixa flex items-center justify-between py-4">
      <Link href="/" aria-label="WorkEnd — início" className="flex items-center">
        <Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority className="h-8 w-auto" />
      </Link>
      <nav className="flex items-center gap-3 text-[15px]">
        {logado ? (
          <>
            <span className="hidden text-[var(--tinta-2)] sm:inline">Olá, {nome?.split(" ")[0]}</span>
            <Link href="/app" className="btn btn-azul">Meu escritório</Link>
          </>
        ) : (
          <>
            <Link href="/entrar" className="px-2 py-2 font-medium hover:text-[var(--tinta-2)]">Entrar</Link>
            <Link href="/cadastro" className="btn btn-azul">Criar conta grátis</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="rodape">
      <div className="faixa grid gap-10 py-14 text-[15px] text-[var(--tinta-2)] md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} className="h-8 w-auto" />
          <p className="mt-4 max-w-[34ch]">O mapa 3D onde as empresas têm endereço e fazem contatos.</p>
        </div>
        <div>
          <div className="mb-3 font-semibold text-[var(--tinta)]">Produto</div>
          <ul className="space-y-2">
            <li><Link href="/cadastro">Criar conta</Link></li>
            <li><Link href="/entrar">Entrar</Link></li>
            <li><Link href="/mundo">Ver o mapa dos lotes</Link></li>
            <li><Link href="/politicas">Políticas de uso</Link></li>
            <li><a href={DEMO} target="_blank" rel="noreferrer">Ver um escritório de demonstração</a></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-semibold text-[var(--tinta)]">Empresa</div>
          <ul className="space-y-2">
            <li><a href="mailto:contato@workend.online">contato@workend.online</a></li>
            <li>© {new Date().getFullYear()} WorkEnd</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

// O que cada setor entrega, na linguagem do dono da empresa (não do sistema)
export const ENTREGA: Record<AreaId, string> = {
  planejamento: "metas viram planos com prazos e responsáveis",
  criacao: "roteiros, textos e vídeos prontos pra publicar",
  social: "posts programados e comentários respondidos",
  trafego: "campanhas no ar, otimizadas todo dia",
  webdesign: "landing pages e telas do seu produto",
  designgrafico: "artes, identidade visual e peças de campanha",
  desenvolvimento: "sites, automações e integrações",
  analise: "números do negócio em relatórios claros",
  atendimento: "clientes atendidos e dúvidas resolvidas",
  vendas: "leads prospectados e follow-up em dia",
  financeiro: "contas, faturamento e custos sob controle",
  rh: "recrutamento e cultura do time",
  juridico: "contratos, compliance e LGPD",
  diretoria: "direção da empresa",
  recepcao: "quem chega é bem recebido",
  criativos: "imagens e vídeos prontos pra campanha",
  consultoria: "diagnóstico e plano de ação pro seu negócio",
};

export const SETORES = AREAS_OPERACIONAIS.map((id) => ({ id, nome: AREAS[id].nome, cor: AREAS[id].cor, entrega: ENTREGA[id], funcoes: FUNCOES[id] }));

// Catálogo de especialistas: os 39 cargos, com treino e skills (src/office/data/especialistas.ts)
export const ESPECIALISTAS = ESPECIALISTAS_IA.map((e) => ({ setor: e.area, cor: AREAS[e.area].cor, cargo: e.cargo, faz: e.descricao, skills: e.skills.map((k) => k.nome) }));
