// Peças compartilhadas do site WorkEnd: topo, rodapé e dados do catálogo de setores/especialistas.
import Link from "next/link";
import Image from "next/image";
import { AREAS, AREAS_OPERACIONAIS, FUNCOES, type AreaId } from "@/office/data/org";

export function Topo({ logado, nome }: { logado?: boolean; nome?: string }) {
  return (
    <header className="faixa flex items-center justify-between py-5">
      <Link href="/" aria-label="WorkEnd — início" className="flex items-center">
        <Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority className="h-9 w-auto" />
      </Link>
      <nav className="flex items-center gap-2 text-[15px]">
        {logado ? (
          <>
            <span className="hidden text-[var(--tinta-2)] sm:inline">Olá, {nome?.split(" ")[0]}</span>
            <Link href="/app" className="btn btn-azul">Meu escritório</Link>
          </>
        ) : (
          <>
            <Link href="/entrar" className="btn btn-linha">Entrar</Link>
            <Link href="/cadastro" className="btn btn-azul">Criar conta</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="fundo-tinta">
      <div className="faixa flex flex-col gap-6 py-10 text-[15px] text-white/75 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/workend/logo-branca.png" alt="WorkEnd" width={1259} height={355} className="h-8 w-auto" />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/cadastro" className="hover:text-white">Criar conta</Link>
          <Link href="/entrar" className="hover:text-white">Entrar</Link>
          <a href="mailto:contato@workend.online" className="hover:text-white">contato@workend.online</a>
        </div>
        <div>© {new Date().getFullYear()} WorkEnd · workend.online</div>
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
};

export const SETORES = AREAS_OPERACIONAIS.map((id) => ({ id, nome: AREAS[id].nome, cor: AREAS[id].cor, entrega: ENTREGA[id], funcoes: FUNCOES[id] }));

// Catálogo de especialistas já treinados (o gerente de cada setor + alguns papéis-chave)
export const ESPECIALISTAS = AREAS_OPERACIONAIS.flatMap((id) => {
  const a = AREAS[id];
  return [
    { setor: id, cor: a.cor, cargo: `Gerente de ${a.nome}`, faz: `Recebe suas ordens, distribui pro time e aprova o que sai. ${ENTREGA[id][0].toUpperCase()}${ENTREGA[id].slice(1)}.` },
    ...FUNCOES[id].slice(0, 2).map((f) => ({ setor: id, cor: a.cor, cargo: f, faz: `Especialista do setor de ${a.nome}, treinado pra executar e reportar ao gerente.` })),
  ];
});
