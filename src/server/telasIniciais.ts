// Dados com que as telas do aplicativo já saem do servidor (WE-16, 22/11/2026). Antes cada tela abria em "Carregando…" e
// só pedia a API depois de baixar e ligar o JavaScript: de 2 a 2,8 s em 4G. Aqui fica a resposta do
// GET das APIs que juntam mais de uma consulta, para a página e a rota usarem a mesma conta. A tela continua pedindo a API
// ao abrir: os dados do servidor aparecem na hora e a busca do navegador atualiza em segundo plano.
import type { Usuario } from "./usuarios";
import { saldoDe, extratoDe, pacotesDevolviveis, PACOTES_CREDITOS, REGRAS_CREDITOS, DIAS_DEVOLUCAO } from "./creditos";
import { pagamentoLigado } from "./mercadopago";
import { ehAdmin, terrenoDoUsuario } from "./terrenos";
import { medidorIA } from "./unidadesIA";
import { custoImagemBRL, custoImagemUnidades } from "./imagens";
import { empresaDoLote } from "./cobrancaProdutos";
import { cuponsDoDono, meusCupons } from "./cupons";
import { meusAnuncios } from "./praca";

// GET /api/workend/creditos (sem liberarReservasVencidas, que a rota faz antes: pode consultar o Mercado Pago)
export async function dadosCreditos(u: Usuario) {
  const [saldo, extrato, devolviveis] = await Promise.all([saldoDe(u.id), extratoDe(u.id, 80), pacotesDevolviveis(u.id)]);
  return { saldo, extrato, devolviveis, pacotes: PACOTES_CREDITOS, regras: REGRAS_CREDITOS, diasDevolucao: DIAS_DEVOLUCAO, pagamento: pagamentoLigado(), admin: ehAdmin(u) };
}

// GET /api/workend/unidades?chave=
// custo de uma arte em unidades (WE-10, 21/11/2026): o mesmo preço da geração (imagens.ts, quadrado em alta qualidade),
// em unidades pela conta única de imagens.ts › custoImagemUnidades (a mesma do designer da equipe)
const imagem = () => ({ custoBrl: custoImagemBRL("quadrado"), unidades: custoImagemUnidades("quadrado") });
export async function dadosUnidades(u: Usuario, chavePedida: string | null) {
  const chave = chavePedida ?? (await terrenoDoUsuario(u.id))?.chave;
  if (!chave) return { semLote: true, imagem: imagem() };
  const { t, empId } = await empresaDoLote(u, chave);
  return { chave, empresa: t.empresaNome, ...(await medidorIA(empId)), imagem: imagem() };
}

// GET /api/workend/cupons
export async function dadosCupons(u: Usuario) {
  const t = await terrenoDoUsuario(u.id);
  return { temLoja: t?.status === "ativo", daLoja: t?.status === "ativo" ? await cuponsDoDono(u) : [], meus: await meusCupons(u) };
}

// GET /api/workend/telao/meus
export async function dadosAnuncios(u: Usuario) {
  return { ...(await meusAnuncios(u)), pagamento: pagamentoLigado() };
}
