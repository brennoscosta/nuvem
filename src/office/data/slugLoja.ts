// Endereço próprio da loja (WE-11, 21/11/2026): workend.online/<slug>. O slug sai do nome da empresa com a mesma regra do
// apelido do perfil público (data/cadastro.ts › paraApelido: sem acento, minúsculas e hífens), tem de 3 a 40 letras e
// sempre leva uma letra (um endereço só de números se confundiria com /loja/N). Fica reservado no cadastro ou na reserva
// do lote e não muda depois que a loja aparece para o público; se um dia mudar, o antigo leva para o novo (src/server/enderecoLoja.ts).
// Sem dependências pesadas: o src/proxy.ts também usa este arquivo.
import { paraApelido, APELIDO_VALIDO } from "./cadastro";

// rotas do site no primeiro nível do endereço: o proxy nunca trata estas como loja
export const ROTAS_DO_SITE = new Set([
  "mundo", "app", "cadastro", "entrar", "encontrar", "loja", "politicas", "perfil", "api", "admin", "esqueci", "redefinir", "workend",
  "emails", // preferências dos avisos por e-mail (WE-17)
  "planos", // a escada de planos (WE-19); já era palavra reservada
  "status", // a página pública de status dos serviços (WE-23); já era palavra reservada
]);
// sedes (data/sedes.ts › id): o endereço delas é o id, o mesmo de /mundo?sede=<id>
export const ENDERECO_SEDES = new Set(["socialrp", "appzone", "bday", "nuvcam"]);
// palavras que nenhuma loja recebe: as rotas, as sedes, as páginas que o site pode ganhar e as pastas de arquivos públicos
export const PALAVRAS_RESERVADAS = new Set([
  ...ROTAS_DO_SITE, ...ENDERECO_SEDES,
  "sobre", "lojas", "perfis", "sair", "conta", "minha-conta", "contato", "contatos", "ajuda", "suporte", "termos", "privacidade", "politica",
  "precos", "preco", "planos", "plano", "gratis", "vitrine", "blog", "busca", "buscar", "login", "logout", "painel", "checkout",
  "pagamento", "pagamentos", "pagar", "pix", "creditos", "cupons", "cupom", "agenda", "equipe", "rede", "vendas", "resultados",
  "divulgar", "sede", "sedes", "quiosque", "quiosques", "lote", "lotes", "cidade", "mapa", "praca", "eventos", "evento", "novidades",
  "imprensa", "carreiras", "vagas", "empresa", "empresas", "convite", "indicacao", "missoes", "passaporte", "personagem", "guia",
  "tutorial", "natal", "inicio", "home", "index", "www", "mail", "email", "cdn", "static", "assets", "public", "publico", "img",
  "imagens", "fotos", "modelos", "fonts", "escritorios", "brand", "lanchonete", "nuvem", "sitemap", "robots", "favicon", "manifest",
  "status", "teste", "demo", "null", "undefined", "cookies",
]);

export const slugValido = (s: string) => APELIDO_VALIDO.test(s) && /[a-z]/.test(s);
export const ehReservado = (s: string) => PALAVRAS_RESERVADAS.has(s);
// base do endereço a partir do nome: "Padaria do Zé" → "padaria-do-ze"; nome curto ou só de números ganha "loja"
export function baseDoSlug(nome: string): string {
  const b = paraApelido(nome ?? "");
  if (!b) return "loja";
  if (!/[a-z]/.test(b)) return `loja-${b}`.slice(0, 30);
  return b.length < 3 ? `${b}-loja` : b;
}
