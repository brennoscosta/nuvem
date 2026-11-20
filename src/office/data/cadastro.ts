// Perfil de cadastro do WorkEnd (20/11/2026, frente "cadastro"): as opções do formulário que aparece logo depois de criar
// a conta, as etapas (o painel lembra as que faltam) e as sugestões de etiquetas. Usado pela tela e pelo servidor
// (src/server/perfis.ts). Sem nada de servidor aqui: o navegador importa este arquivo.

export const OBJETIVOS = [
  { id: "mostrar", nome: "Mostrar meu negócio", texto: "Quero que clientes e parceiros achem o que eu faço." },
  { id: "encontrar", nome: "Encontrar empresas e serviços", texto: "Estou procurando quem resolva alguma coisa para mim." },
  { id: "ambos", nome: "Os dois", texto: "Mostro o que faço e também procuro fornecedores e parceiros." },
] as const;
export type Objetivo = (typeof OBJETIVOS)[number]["id"];

export const TIPOS = [
  { id: "empresa", nome: "Empresa", texto: "Tem CNPJ, equipe ou ponto." },
  { id: "autonomo", nome: "Profissional autônomo", texto: "Trabalha por conta própria." },
  { id: "loja_online", nome: "Loja online", texto: "Vende pela internet." },
  { id: "criador", nome: "Criador de conteúdo", texto: "Vídeos, redes, publicidade." },
  { id: "prestador", nome: "Prestador de serviço", texto: "Atende sob encomenda." },
  { id: "outro", nome: "Estudante ou outro", texto: "Ainda começando ou outra situação." },
] as const;
export type TipoCadastro = (typeof TIPOS)[number]["id"];

export const ATENDIMENTOS = [
  { id: "online", nome: "Online" },
  { id: "presencial", nome: "Presencial" },
  { id: "ambos", nome: "Online e presencial" },
] as const;
export type Atendimento = (typeof ATENDIMENTOS)[number]["id"];

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

// as etapas do formulário, na ordem de quem quer mostrar; quem só quer encontrar vê "O que procura" antes (ordemEtapas)
export const ETAPAS = [
  { id: "objetivo", titulo: "O que você quer no WorkEnd?", curto: "Objetivo" },
  { id: "quem", titulo: "Quem é você?", curto: "Quem é você" },
  { id: "negocio", titulo: "Nome e área", curto: "Nome e área" },
  { id: "local", titulo: "Onde você atende", curto: "Onde atende" },
  { id: "oferece", titulo: "O que você oferece", curto: "O que oferece" },
  { id: "procura", titulo: "O que você procura", curto: "O que procura" },
  { id: "links", titulo: "Links e foto", curto: "Links e foto" },
  { id: "privacidade", titulo: "O que aparece no seu perfil", curto: "Privacidade" },
] as const;
export type EtapaId = (typeof ETAPAS)[number]["id"];
export const ehEtapa = (v: unknown): v is EtapaId => typeof v === "string" && ETAPAS.some((e) => e.id === v);
export function ordemEtapas(objetivo: Objetivo | null): EtapaId[] {
  const ids = ETAPAS.map((e) => e.id) as EtapaId[];
  if (objetivo !== "encontrar") return ids;
  return ["objetivo", "quem", "negocio", "local", "procura", "oferece", "links", "privacidade"];
}

export const MAX_ETIQUETAS = 12;
export const MAX_ETIQUETA = 40;
export const MAX_TEXTO = 400;
export const MAX_NICHOS = 3;

// o que aparece no perfil público além do nome, do tipo, da área e do que a pessoa oferece
export interface Mostrar { procura: boolean; cidade: boolean; links: boolean; cidade3d: boolean; whatsapp: boolean; email: boolean }
export const MOSTRAR_PADRAO: Mostrar = { procura: true, cidade: true, links: true, cidade3d: true, whatsapp: false, email: false };

export interface PerfilCadastro {
  apelido: string | null; objetivo: Objetivo | null; tipo: TipoCadastro | null; nome: string; nichos: string[];
  cidade: string; uf: string; atendimento: Atendimento | null;
  oferece: string[]; ofereceTexto: string; procura: string[]; procuraTexto: string;
  site: string; instagram: string; whatsapp: string; foto: string | null;
  publico: boolean; mostrar: Mostrar; etapas: EtapaId[]; pulouEm: string | null; concluidoEm: string | null;
}
export const PERFIL_VAZIO: PerfilCadastro = {
  apelido: null, objetivo: null, tipo: null, nome: "", nichos: [], cidade: "", uf: "", atendimento: null,
  oferece: [], ofereceTexto: "", procura: [], procuraTexto: "", site: "", instagram: "", whatsapp: "", foto: null,
  publico: true, mostrar: MOSTRAR_PADRAO, etapas: [], pulouEm: null, concluidoEm: null,
};

export const nomeObjetivo = (id: string | null | undefined) => OBJETIVOS.find((o) => o.id === id)?.nome ?? "";
export const nomeTipo = (id: string | null | undefined) => TIPOS.find((o) => o.id === id)?.nome ?? "";
export const nomeAtendimento = (id: string | null | undefined) => ATENDIMENTOS.find((o) => o.id === id)?.nome ?? "";

// sem acento e em minúsculas (busca e comparação de etiquetas)
export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// endereço amigável: "Padaria do Bairro" → "padaria-do-bairro"
export const paraApelido = (s: string) => normalizar(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/g, "");
export const APELIDO_VALIDO = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export const linkInstagram = (u: string) => `https://instagram.com/${u}`;
export const linkWhatsapp = (n: string) => `https://wa.me/55${n}`;
export const linkSite = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
export const siteCurto = (s: string) => s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

// sugestões de etiquetas: o vocabulário parecido ajuda a casar quem oferece com quem procura
export const SUGESTOES_OFERECE: Record<string, string[]> = {
  negocios: ["Consultoria empresarial", "Gestão", "Abertura de empresa", "Plano de negócios"],
  tecnologia: ["Criação de sites", "Aplicativos", "Suporte técnico", "Automação", "Sistemas"],
  conteudo: ["Vídeos", "Edição de vídeo", "Fotografia", "Roteiro", "Publicidade"],
  cursos: ["Curso online", "Mentoria", "Aulas particulares"],
  treinamentos: ["Treinamento de equipe", "Palestras", "Workshop"],
  marketing: ["Social media", "Tráfego pago", "Identidade visual", "Design", "Gestão de redes"],
  consultoria: ["Consultoria", "Diagnóstico", "Planejamento"],
  servicos: ["Manutenção", "Entregas", "Limpeza", "Instalação"],
  varejo: ["Roupas", "Acessórios", "Eletrônicos", "Presentes", "Revenda"],
  alimentacao: ["Pães e bolos", "Marmitas", "Doces", "Encomendas", "Delivery"],
  saude: ["Psicologia", "Nutrição", "Fisioterapia", "Personal trainer"],
  beleza: ["Cabelo", "Unhas", "Maquiagem", "Estética", "Barbearia"],
  educacao: ["Reforço escolar", "Idiomas", "Aulas de música"],
  financas: ["Contabilidade", "Imposto de renda", "Crédito", "Investimentos"],
  juridico: ["Advocacia", "Contratos", "Direito trabalhista"],
  imoveis: ["Venda de imóveis", "Aluguel", "Avaliação de imóvel"],
  casa: ["Reforma", "Pintura", "Elétrica", "Móveis planejados", "Jardinagem"],
  eventos: ["Buffet", "Decoração", "Fotografia de eventos", "Som e luz"],
  turismo: ["Passeios", "Hospedagem", "Pacotes de viagem", "Transfer"],
  automotivo: ["Mecânica", "Lavagem", "Peças", "Funilaria"],
};
export const SUGESTOES_PROCURA = ["Fornecedor", "Clientes", "Parceria", "Criação de sites", "Social media", "Design", "Fotografia", "Contabilidade", "Advocacia", "Funcionário", "Investidor", "Ponto comercial"];
