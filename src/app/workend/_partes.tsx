// Peças compartilhadas do site WorkEnd: topo, rodapé e dados do catálogo de setores/especialistas.
import Link from "next/link";
import { Logotipo } from "./_marca";
import { AREAS, AREAS_OPERACIONAIS, FUNCOES, type AreaId } from "@/office/data/org";
import { ESPECIALISTAS_IA } from "@/office/data/especialistas";

export const DEMO = "https://nuvem.nuvemhost.cloud/?vista=fora";

export function Topo({ logado, nome }: { logado?: boolean; nome?: string }) {
  return (
    <header className="faixa flex items-center justify-between py-4">
      <Link href="/" aria-label="WorkEnd, início" className="flex items-center py-2"><Logotipo altura={22} /></Link>
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
      <div className="faixa flex flex-wrap items-start gap-x-16 gap-y-7 pb-14 pt-10 text-[15px] text-[var(--muted)]">
        <div className="min-w-[260px] flex-[1_1_280px]">
          <div className="mb-3 py-1"><Logotipo altura={24} /></div>
          <p className="max-w-[40ch]">O endereço da sua empresa numa cidade 3D aberta 24 horas.</p>
        </div>
        <nav className="flex flex-col gap-[11px]" aria-label="Rodapé">
          <Link href="/cadastro">Criar conta</Link>
          <Link href="/entrar">Entrar</Link>
          <Link href="/mundo">Passear pelo mapa</Link>
          <a href={DEMO} target="_blank" rel="noreferrer">Escritório de demonstração</a>
          <Link href="/politicas">Políticas de uso</Link>
        </nav>
        <div className="flex flex-col gap-[11px]">
          <a href="mailto:contato@workend.online">contato@workend.online</a>
          <span>&copy; {new Date().getFullYear()} WorkEnd</span>
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
// foto de cada especialista: public/workend/agentes/<id>.webp (retratos 3D no estilo dos bonecos da cidade)
export const fotoEspecialista = (id: string) => `/workend/agentes/${id}.webp`;
export const ESPECIALISTAS = ESPECIALISTAS_IA.map((e) => ({ id: e.id, nome: e.nome, foto: fotoEspecialista(e.id), setor: e.area, cor: AREAS[e.area].cor, cargo: e.cargo, faz: e.descricao, skills: e.skills.map((k) => k.nome) }));
