"use client";
// Personagem do visitante: o meu (montar, pagar, andar) e os outros que estão online (ver, clicar, conversar).
// Presença por batida: a cada 3 s mando minha posição e recebo quem está por perto. Chat por consulta a cada 2,5 s.
import { create } from "zustand";
import { useMundo } from "./mundoStore";
import { novoIdem } from "./creditosStore";
import type { TipoAvatar, Visual } from "./data/bonecos";
import { pontoNaCalcada } from "./data/mundo";
import { useChamada, type ChamadaInfo } from "./chamadaStore";
import { rota, livre, pontoLivre, type Ponto } from "./data/caminhos";
import { corDaBicicleta, ehVeiculo, COR_BICICLETA_PADRAO, type IdVeiculo, type VeiculoPublico } from "./data/veiculos";
import type { Entrada } from "./data/entradas";
import { useSede } from "./sedeStore";
import { plantaPorChave, rotaDentro, dentroDoPredio, areaDaEquipe, portaDentroMundo, podeEntrarEm, liberarCaminho, pontoDeAtendimento, paraMundo, type Acesso, type AcessoLiberado } from "./data/plantaInterna";
import type { Destino } from "./data/recepcao";

// Dentro de um prédio (17/11/2026, pedido do dono: "preciso que possa entrar, e que apareça uma porta ou se direcione para a
// recepção onde será atendido"): o personagem vai pela rua até a calçada da porta (indo), passa pela porta e anda até o
// balcão (entrando; a vista vira "por dentro"), fica na recepção (o dono é reconhecido; o visitante espera a vez e é
// atendido pela atendente) e sai pelo mesmo caminho (saindo). Quem anda é scene/Personagens.tsx; o balcão é ui/Recepcao.tsx.
// "dentro": andando livre por dentro (17/11/2026, data/plantaInterna.ts): dono e sócio por todo o prédio; visitante na
// recepção, no hall e no corredor/café
export type FasePredio = "indo" | "entrando" | "recepcao" | "dentro" | "saindo";
// 20/11/2026 (pedido do dono: o visitante só tem acesso à recepcionista, que o encaminha para o setor): `liberado` é o
// setor para onde a recepção mandou o visitante, com o caminho que a catraca liberou (data/plantaInterna.ts ›
// liberarCaminho), onde ele para (ponto) e quem atende (agente). `atendido`: a recepção já falou com ele nesta visita.
export type Liberado = Destino & { acesso: AcessoLiberado; ponto: [number, number]; agente: [number, number]; chegou: boolean };
// trilha (21/11/2026, modo "Editar posição"): o caminho pelo lote da frente da porta até a calçada (data/entradas.ts)
// balcao e estrutura (21/11/2026, lote em quartos): no quiosque do lote não há interior; a pessoa fica no balcão
export type PredioAtual = Pick<Entrada, "chave" | "nome" | "numero" | "fora" | "porta" | "espera" | "olhar" | "centro" | "trilha" | "balcao" | "estrutura"> & { fase: FasePredio; visita: number; fila: number; esperaMs: number; atendido?: boolean; liberado?: Liberado | null };
// o que o meu personagem pode usar por dentro deste prédio: dono e sócio, tudo; visitante, a recepção ou o caminho liberado
export function acessoNoPredio(p: Pick<PredioAtual, "chave" | "liberado">): Acesso {
  if (useMundo.getState().meus.includes(p.chave)) return false;
  return p.liberado ? p.liberado.acesso : true;
}

export interface Redes { instagram?: string; linkedin?: string; whatsapp?: string; site?: string }
// perfil profissional (11/11/2026): aparece na ficha e na busca de profissionais
export interface Perfil { profissao: string; nicho: string; servicos: string; preco: string; local: string; portfolio: { titulo: string; url: string }[]; disponivel: boolean }
export interface MeuPersonagem extends Partial<Perfil> { usuarioId: string; nome: string; tipo: string; boneco: string; roupa: string; bio: string; redes: Redes; mostrarRedes: boolean; pagoAte: string | null; x: number; z: number; rot: number; acessorios?: string[]; visual?: Visual & { veiculo?: { cor?: string; em?: string | null } } }
export type StatusRelacao = "nenhuma" | "pedi" | "pediram" | "amigos" | "recusada";
export interface Outro { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; x: number; z: number; rot: number; destino?: [number, number] | null; vel?: number; redes?: Redes; online: boolean; relacao?: { status: StatusRelacao; id: string | null }; perfil?: Perfil | null; reputacao?: { media: number | null; n: number }; acessorios?: string[]; selos?: string[]; veiculo?: VeiculoPublico | null }
export interface Amigo { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; redes: Redes; online: boolean; desde: string }
export interface Pedido { id: string; usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; criadoEm: string; direcao: "recebido" | "enviado" }
export interface Negociacao { id: string; deId: string; paraId: string; titulo: string; texto: string; valor: number | null; status: string; criadoEm: string; respondidoEm: string | null; outroId: string; outroNome: string; outroBoneco: string; outroRoupa: string; concluidaPor?: string | null; minhaNota?: number | null }
export interface Mensagem { id: string; deId: string; paraId: string; tipo: string; texto: string; criadoEm: string }
export interface Conversa { outroId: string; nome: string; boneco: string; roupa: string; ultimo: string; tipo: string; quando: string; naoLidas: number; online: boolean }

// Bicicleta (19/11/2026, data/veiculos.ts): onde ela ficou parada (na vaga da porta de um prédio, com paraciclo, ou onde
// a pessoa desceu) e o que fazer num ponto do caminho (descer na vaga ao chegar num prédio; subir ao voltar até ela)
export interface BicicletaParada { x: number; z: number; rot: number; de?: [number, number, number]; chave: string | null } // de: de onde ela desliza até a vaga
export interface AcaoNoPonto { ponto: Ponto; acao: "descer" | "subir"; parada?: BicicletaParada }

interface Estado {
  carregado: boolean;
  veiculo: IdVeiculo | null; // em que estou andando agora (null = a pé)
  corBicicleta: string;
  bicicletaParada: BicicletaParada | null;
  acaoNoPonto: AcaoNoPonto | null;
  avisoVeiculo: { texto: string; n: number } | null; // aviso curto da bicicleta (ui/BotaoBicicleta.tsx)
  alternarBicicleta: () => void; // botão "Bicicleta" e tecla B
  escolherCorBicicleta: (cor: string) => Promise<string | null>;
  avisarVeiculo: (texto: string) => void;
  meu: MeuPersonagem | null;
  ativo: boolean;
  preco: number; precoCheio: number; pagamentoLigado: boolean;
  outros: Outro[];
  naoLidas: number;
  pedidos: number; // pedidos de amizade recebidos
  amigos: Amigo[]; listaPedidos: Pedido[]; negociacoes: Negociacao[];
  destino: [number, number] | null; // pra onde meu boneco está andando (o próximo ponto do caminho)
  rota: [number, number][]; // os pontos do caminho depois do destino (data/caminhos.ts): contorna os quarteirões
  passeio: boolean; // o destino atual é um passeio automático pela calçada (não um clique)
  posicao: [number, number, number]; // x, z, rot atuais (atualizados pela cena)
  painel: "montar" | "ficha" | "chat" | "caixa" | null;
  outroSelecionado: Outro | null;
  mensagens: Mensagem[];
  conversas: Conversa[];
  erro: string | null;
  // roupas e acessórios (12/11/2026): o que comprei e o que estou usando (um por lugar)
  itens: { comprados: string[]; usando: string[] } | null;
  carregarItens: () => Promise<void>;
  vestir: (usando: string[]) => Promise<string | null>;
  comprarItem: (id: string, creditos?: boolean) => Promise<string | null>;
  carregar: () => Promise<void>;
  salvar: (d: { nome: string; tipo: string; bio: string; redes: Redes; mostrarRedes: boolean; perfil?: Perfil; visual?: Visual; acessorios?: string[] }) => Promise<string | null>;
  pagar: (meses?: number, creditos?: boolean) => Promise<string | null>;
  abrir: (painel: Estado["painel"]) => void;
  predio: PredioAtual | null; // em que prédio estou entrando, estou ou estou saindo
  falaRecepcao: { chave: string; texto: string; membroId?: string } | null; // o que a atendente (ou, com membroId, quem atende no setor) está dizendo (balão na cena)
  encaminhar: (d: Destino) => string | null; // a recepção mandou para um setor: libera a catraca e leva o personagem (null = foi)
  entrarNoPredio: (e: Entrada) => void;
  sairDoPredio: () => void;
  andarNoPredio: (x: number, z: number) => void; // tocar no chão estando dentro (ou fora: sai pela porta e segue na rua)
  voltarRecepcao: () => void;
  avisoPredio: { texto: string; n: number } | null; // "Área só da equipe" e afins (ui/Recepcao.tsx mostra por uns segundos)
  fechar: () => void;
  irPara: (x: number, z: number) => void;
  setPosicao: (x: number, z: number, rot: number) => void;
  avisarMovimento: () => void;
  batida: () => Promise<void>;
  selecionarOutro: (o: Outro | null) => void;
  abrirChat: (o: Outro) => Promise<void>;
  atualizarChat: () => Promise<void>;
  enviar: (tipo: string, texto: string) => Promise<string | null>;
  carregarCaixa: () => Promise<void>;
  carregarRede: () => Promise<void>;
  pedirAmizade: (paraId: string) => Promise<string | null>;
  responderAmizade: (pedidoId: string, aceitar: boolean) => Promise<string | null>;
  desfazerAmizade: (outroId: string) => Promise<void>;
  negociar: (paraId: string, d: { titulo: string; texto: string; valor: string }) => Promise<string | null>;
  responderNegociacao: (id: string, status: "aceita" | "recusada" | "cancelada" | "concluida") => Promise<string | null>;
  avaliarNegociacao: (id: string, nota: number, texto: string) => Promise<string | null>;
  ligar: (o: Outro | { usuarioId: string; nome: string; boneco: string; roupa: string }, video: boolean) => Promise<string | null>;
}

// Posição viva do meu boneco, escrita pela cena a cada quadro (fora do estado reativo pra não re-renderizar nada)
// prev (21/11/2026): andando direto pelo teclado ou joystick (sem destino), o ponto aonde ele chega em ~1,8 s na direção em
// que vai, até a primeira parede (scene/Personagens.tsx › Meu). Vai na batida no lugar do destino: quem olha de fora vê o
// boneco andando sem parar, em vez de andar 2,6 m, esperar a próxima batida e pular
export const minhaPos = { x: 0, z: 21.3, rot: 0, vel: 0, prev: null as [number, number] | null };
let batidaPendente: ReturnType<typeof setTimeout> | null = null;
// vaga da bicicleta na porta de um prédio: 1,1 m para o lado do ponto da calçada, de frente para a porta
function vagaNaPorta(chave: string, fora: Ponto, porta: Ponto): BicicletaParada {
  let dx = porta[0] - fora[0], dz = porta[1] - fora[1]; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  const rot = Math.atan2(dx, dz);
  for (const s of [1, -1]) { const x = fora[0] - dz * 1.1 * s, z = fora[1] + dx * 1.1 * s; if (livre(x, z)) { const [px, pz] = pontoLivre(x, z); if (Math.hypot(px - fora[0], pz - fora[1]) < 2.2) return { x: px, z: pz, rot, chave }; } }
  return { x: fora[0], z: fora[1], rot, chave };
}
// a bicicleta ficou na vaga deste prédio: na saída, o caminho passa por ela e o personagem sobe de novo
const subirNaSaida = (p: { chave: string }, b: BicicletaParada | null): { pts: Ponto[]; acao: AcaoNoPonto | null } =>
  b && b.chave === p.chave ? { pts: [[b.x, b.z]], acao: { ponto: [b.x, b.z], acao: "subir" } } : { pts: [], acao: null };

export const usePersonagem = create<Estado>((set, get) => ({
  carregado: false, meu: null, ativo: false, preco: 5.9, precoCheio: 19.9, pagamentoLigado: false, outros: [], naoLidas: 0, pedidos: 0, amigos: [], listaPedidos: [], negociacoes: [], destino: null, rota: [], predio: null, falaRecepcao: null, avisoPredio: null,
  veiculo: null, corBicicleta: COR_BICICLETA_PADRAO, bicicletaParada: null, acaoNoPonto: null, avisoVeiculo: null, passeio: false, posicao: [0, 21.3, 0], painel: null, outroSelecionado: null, mensagens: [], conversas: [], erro: null, itens: null,

  carregarItens: async () => {
    const r = await fetch("/api/workend/itens", { cache: "no-store" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j) set({ itens: { comprados: j.comprados ?? [], usando: j.usando ?? [] } });
  },
  vestir: async (usando) => {
    const r = await fetch("/api/workend/itens", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ usando }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    const lista: string[] = j.usando ?? [];
    const { meu, itens } = get();
    set({ meu: meu ? { ...meu, acessorios: lista } : meu, itens: { comprados: itens?.comprados ?? [], usando: lista } });
    return null;
  },
  // Pix da roupa: reaproveita o painel de Pix do mapa (chave "item:<id>"); aprovado, o servidor já veste o item.
  // É a única função do cliente que cobra um item do personagem (acessórios pagos e roupas premium, 20/11/2026).
  comprarItem: async (id, creditos = false) => {
    const r = await fetch("/api/workend/itens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comprar: id, creditos, idem: novoIdem() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    await useMundo.getState().abrirCobranca(j, `item:${id}`, "item");
    return null;
  },

  carregar: async () => {
    try {
      const j = await fetch("/api/personagem").then((r) => r.json());
      const meu: MeuPersonagem | null = j.personagem ?? null;
      const pos: [number, number, number] = meu ? [...pontoNaCalcada(meu.x, meu.z), meu.rot] : get().posicao;
      const vs = meu?.visual?.veiculo, em = vs?.em;
      // na primeira carga: volta de bicicleta se estava pedalando (a vaga de um prédio não volta: ele reaparece na rua)
      if (meu && !get().meu) { minhaPos.x = pos[0]; minhaPos.z = pos[1]; minhaPos.rot = pos[2]; if (ehVeiculo(em) && j.ativo) set({ veiculo: em }); }
      set({ corBicicleta: corDaBicicleta(vs?.cor) });
      set({ meu, ativo: !!j.ativo, preco: j.preco ?? 5.9, precoCheio: j.precoCheio ?? 19.9, pagamentoLigado: !!j.pagamento, carregado: true, posicao: pos });
    } catch { set({ carregado: true }); }
  },
  salvar: async (d) => {
    const r = await fetch("/api/personagem", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    // editor completo (20/11/2026): os acessórios em uso vão no mesmo salvar
    const itens = get().itens;
    set({ meu: j.personagem, ativo: !!j.ativo, itens: itens && j.personagem ? { comprados: itens.comprados, usando: j.personagem.acessorios ?? [] } : itens });
    return null;
  },
  // Pix do personagem: reaproveita o painel de Pix do mapa (chave "personagem")
  pagar: async (meses = 1, creditos = false) => {
    const r = await fetch("/api/personagem/pagar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ meses, creditos, idem: novoIdem() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    await useMundo.getState().abrirCobranca(j, "personagem", "personagem");
    return null;
  },
  abrir: (painel) => set({ painel }),
  fechar: () => set({ painel: null, outroSelecionado: null }),
  // tocar no chão: caminho pelas ruas e calçadas, sem atravessar prédio (17/11/2026)
  irPara: (x, z) => {
    const st = get(); if (!st.ativo) return;
    // dentro do prédio anda pelo caminho interno (paredes e portas, data/plantaInterna.ts); entrando ou saindo, espera
    // chegar; a caminho da porta, um toque cancela a entrada
    if (st.predio && (st.predio.fase === "entrando" || st.predio.fase === "saindo")) return;
    if (st.predio && (st.predio.fase === "recepcao" || st.predio.fase === "dentro")) { st.andarNoPredio(x, z); return; }
    const [primeiro, ...resto] = rota([minhaPos.x, minhaPos.z], [x, z]);
    set({ destino: primeiro ?? null, rota: resto, passeio: false, predio: null, acaoNoPonto: null }); get().avisarMovimento();
  },
  entrarNoPredio: (e) => {
    const st = get(); if (!st.ativo) return;
    // lote em quartos: cada estrutura (o prédio e cada quiosque) é um lugar; primeiro sai do lugar em que está
    const mesmo = !!st.predio && st.predio.chave === e.chave && (st.predio.estrutura ?? null) === (e.estrutura ?? null);
    if (st.predio && st.predio.fase !== "indo" && !mesmo) return; // primeiro sai do prédio em que está
    if (mesmo && st.predio!.fase !== "indo") return;
    const pl = e.balcao ? null : plantaPorChave(e.chave, useMundo.getState().terrenos);
    const porDentro = pl ? [portaDentroMundo(pl), ...(rotaDentro(pl, portaDentroMundo(pl), e.espera, false) ?? [e.espera])] : [e.espera];
    const pelaTrilha = [...(e.trilha ?? [])].reverse(); // da calçada até a frente da porta, por dentro do lote
    const vaga = st.veiculo ? vagaNaPorta(e.chave, e.fora, pelaTrilha[0] ?? e.porta) : null;
    const ate = vaga ? [...rota([minhaPos.x, minhaPos.z], [vaga.x, vaga.z]), e.fora] : rota([minhaPos.x, minhaPos.z], e.fora);
    if (vaga) { const fim = ate[ate.length - 2]; vaga.x = fim[0]; vaga.z = fim[1]; }
    const [primeiro, ...resto] = [...ate, ...pelaTrilha, e.porta, ...porDentro];
    set({ destino: primeiro, rota: resto, passeio: false, falaRecepcao: null, acaoNoPonto: vaga ? { ponto: [vaga.x, vaga.z], acao: "descer", parada: vaga } : null,
      predio: { chave: e.chave, nome: e.nome, numero: e.numero, fora: e.fora, porta: e.porta, espera: e.espera, olhar: e.olhar, centro: e.centro, trilha: e.trilha ?? [], ...(e.balcao ? { balcao: true } : {}), ...(e.estrutura ? { estrutura: e.estrutura } : {}), fase: "indo", visita: (st.predio?.visita ?? 0) + 1, fila: 0, esperaMs: 0 } });
    useMundo.setState({ loteSelecionado: null, alvoCamera: [e.fora[0], 0.5, e.fora[1]] });
    useSede.setState({ aberto: false });
    get().avisarMovimento();
  },
  sairDoPredio: () => {
    const p = get().predio; if (!p) return;
    if (p.fase === "indo") { set({ predio: null, destino: null, rota: [], falaRecepcao: null }); return; }
    // de onde estiver por dentro até a porta, pelo caminho interno, e então para a calçada (no balcão do quiosque, direto)
    const pl = p.balcao ? null : plantaPorChave(p.chave, useMundo.getState().terrenos);
    const ate = pl ? rotaDentro(pl, [minhaPos.x, minhaPos.z], portaDentroMundo(pl), acessoNoPredio(p)) ?? [portaDentroMundo(pl)] : [];
    const sb = subirNaSaida(p, get().bicicletaParada);
    const [primeiro, ...resto] = [...ate, p.porta, ...(p.trilha ?? []), p.fora, ...sb.pts];
    set({ destino: primeiro, rota: resto, passeio: false, predio: { ...p, fase: "saindo" }, falaRecepcao: null, acaoNoPonto: sb.acao }); get().avisarMovimento();
  },
  andarNoPredio: (x, z) => {
    const st = get(), p = st.predio; if (!p) return;
    const mundo = useMundo.getState();
    // no balcão de um quiosque do lote (sem interior): tocar no chão sai pelo caminho do lote e segue até o ponto tocado
    if (p.balcao) {
      const sb = subirNaSaida(p, st.bicicletaParada);
      const [primeiro, ...resto] = [p.porta, ...(p.trilha ?? []), p.fora, ...sb.pts, ...rota(sb.pts[0] ?? p.fora, [x, z])];
      set({ destino: primeiro, rota: resto, passeio: false, predio: { ...p, fase: "saindo" }, falaRecepcao: null, acaoNoPonto: sb.acao });
      get().avisarMovimento(); return;
    }
    const pl = plantaPorChave(p.chave, mundo.terrenos); if (!pl) return;
    const publico = acessoNoPredio(p);
    const de: [number, number] = [minhaPos.x, minhaPos.z];
    const avisar = (texto: string) => set({ avisoPredio: { texto, n: (st.avisoPredio?.n ?? 0) + 1 } });
    if (dentroDoPredio(pl, x, z)) {
      // visitante (20/11/2026): sem ser encaminhado, só a recepção; encaminhado, só o caminho até o setor. Um aviso gentil
      // explica a catraca em vez de só barrar
      if (publico !== false && !podeEntrarEm(pl, x, z, publico)) {
        avisar(p.liberado ? `A catraca liberou só o caminho até ${p.liberado.setorNome}.` : areaDaEquipe(pl, x, z) ? "Área só da equipe: a recepção te leva ao setor certo." : "Para passar da catraca, fale com a recepção: ela te leva ao setor certo.");
        return;
      }
      const r = rotaDentro(pl, de, [x, z], publico);
      if (!r || !r.length) { avisar("Não dá para chegar aí por dentro"); return; }
      const [primeiro, ...resto] = r;
      set({ destino: primeiro, rota: resto, passeio: false, predio: { ...p, fase: "dentro", liberado: p.liberado ? { ...p.liberado, chegou: false } : p.liberado }, falaRecepcao: null });
      // a câmera vai de leve até onde o personagem vai (quem arrasta continua mandando)
      useMundo.setState({ alvoCamera: [x, 0.5, z] });
      get().avisarMovimento(); return;
    }
    // tocou fora do prédio: sai pela porta e segue pela rua até o ponto tocado
    const ate = rotaDentro(pl, de, portaDentroMundo(pl), publico) ?? [portaDentroMundo(pl)];
    const sb = subirNaSaida(p, st.bicicletaParada);
    const [primeiro, ...resto] = [...ate, p.porta, ...(p.trilha ?? []), p.fora, ...sb.pts, ...rota(sb.pts[0] ?? p.fora, [x, z])];
    set({ destino: primeiro, rota: resto, passeio: false, predio: { ...p, fase: "saindo" }, falaRecepcao: null, acaoNoPonto: sb.acao });
    get().avisarMovimento();
  },
  voltarRecepcao: () => {
    const p = get().predio; if (!p || p.fase !== "dentro") return;
    const mundo = useMundo.getState();
    const pl = plantaPorChave(p.chave, mundo.terrenos);
    // volta pelo mesmo caminho liberado; ao chegar no balcão a catraca fecha de novo (Personagens.tsx › chegouNoBalcao)
    const r = pl ? rotaDentro(pl, [minhaPos.x, minhaPos.z], p.espera, acessoNoPredio(p)) : null;
    const [primeiro, ...resto] = r && r.length ? r : [p.espera];
    // "entrando": ao chegar no balcão a recepção atende de novo (scene/Personagens.tsx › chegouNoBalcao)
    set({ destino: primeiro, rota: resto, passeio: false, falaRecepcao: null, predio: { ...p, fase: "entrando", liberado: p.liberado ? { ...p.liberado, chegou: false } : p.liberado } }); get().avisarMovimento();
  },
  // a recepção encaminhou para um setor (ui/Recepcao.tsx): libera só o caminho até a sala, leva o personagem até a frente
  // de quem atende e, ao chegar, a conversa passa para essa pessoa (Personagens.tsx › chegouNoSetor)
  encaminhar: (d) => {
    const st = get(), p = st.predio; if (!p) return "Você não está dentro de um prédio.";
    const mundo = useMundo.getState(), t = mundo.terrenos[p.chave];
    const pl = plantaPorChave(p.chave, mundo.terrenos); if (!pl || !t?.escritorio) return "Não achei a planta deste prédio.";
    const pa = pontoDeAtendimento(pl, t.escritorio, d.membroId);
    const sala = pl.zonas.find((z) => z.id === d.salaId);
    const alvo = pa?.ponto ?? (sala ? paraMundo(pl, (sala.x0 + sala.x1) / 2, (sala.z0 + sala.z1) / 2) : null);
    if (!alvo) return "Esse setor não tem sala neste prédio.";
    const lib = liberarCaminho(pl, [minhaPos.x, minhaPos.z], alvo, d.salaId);
    if (!lib) return `Não achei o caminho até ${d.setorNome}.`;
    const fim = lib.rota[lib.rota.length - 1];
    const [primeiro, ...resto] = lib.rota;
    set({ destino: primeiro, rota: resto, passeio: false, predio: { ...p, fase: "dentro", atendido: true, liberado: { ...d, acesso: lib.acesso, ponto: [fim[0], fim[1]], agente: pa?.agente ?? [fim[0], fim[1]], chegou: false } } });
    useMundo.setState({ alvoCamera: [fim[0], 0.5, fim[1]] });
    get().avisarMovimento(); return null;
  },
  setPosicao: (x, z, rot) => { minhaPos.x = x; minhaPos.z = z; minhaPos.rot = rot; set({ posicao: [x, z, rot] }); },
  // mudou o destino (clique, passeio ou chegada): manda a batida logo, pra quem olha de fora acompanhar sem atraso
  avisarMovimento: () => { if (batidaPendente) clearTimeout(batidaPendente); batidaPendente = setTimeout(() => { batidaPendente = null; void get().batida(); }, 120); },
  batida: async () => {
    try {
      const { x, z, rot, vel } = minhaPos; const { veiculo, bicicletaParada: bp } = get(); const destino = get().destino ?? minhaPos.prev;
      const parada = bp ? [bp.x, bp.z, bp.rot, bp.chave ? 1 : 0] : null;
      const j = await fetch("/api/personagem/presenca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x, z, rot, destino, vel: destino ? vel : 0, veiculo, parada }) }).then((r) => r.json());
      const outros: Outro[] = j.outros ?? [];
      const sel = get().outroSelecionado;
      set({ outros, naoLidas: j.naoLidas ?? 0, pedidos: j.pedidos ?? 0, outroSelecionado: sel ? { ...sel, ...(outros.find((o) => o.usuarioId === sel.usuarioId) ?? { online: false }), relacao: sel.relacao } : null });
      // chamada tocando pra mim: avisa a janela de chamada
      const c = j.chamada as (ChamadaInfo & { outroNome: string }) | null; const meu = get().meu;
      if (c && meu && c.paraId === meu.usuarioId && c.status === "tocando") useChamada.getState().receber(c, meu.usuarioId);
    } catch { /* offline: tenta na próxima */ }
  },
  avisarVeiculo: (texto) => set({ avisoVeiculo: { texto, n: (get().avisoVeiculo?.n ?? 0) + 1 } }),
  // Subir: grátis para quem tem personagem. Perto da bicicleta parada (até 20 m), vai a pé até ela e sobe; longe, ou sem
  // bicicleta parada, ela aparece com ele. Descer: a bicicleta fica parada ali e ele segue a pé.
  // Dentro de um prédio não tem bicicleta (ela espera na vaga da porta).
  alternarBicicleta: () => {
    const st = get(); if (!st.ativo || !st.meu) { st.avisarVeiculo("Crie o seu personagem para andar de bicicleta."); return; }
    const p = st.predio;
    if (st.veiculo) {
      // ela fica de pé uns 45 cm à direita dele
      const { x, z, rot } = minhaPos;
      set({ veiculo: null, bicicletaParada: { x: x - Math.cos(rot) * 0.45, z: z + Math.sin(rot) * 0.45, rot, de: [x, z, rot], chave: null }, acaoNoPonto: null });
      get().avisarMovimento(); return;
    }
    if (p && p.fase !== "indo") { st.avisarVeiculo("Dentro do prédio não tem bicicleta: ela espera você na porta."); return; }
    const b = st.bicicletaParada, longe = b ? Math.hypot(b.x - minhaPos.x, b.z - minhaPos.z) : 0;
    if (b && longe > 1 && longe < 20 && !p) {
      const r = rota([minhaPos.x, minhaPos.z], [b.x, b.z]); const fim = r[r.length - 1] ?? [b.x, b.z];
      set({ destino: r[0] ?? null, rota: r.slice(1), passeio: false, acaoNoPonto: { ponto: fim, acao: "subir" } });
      get().avisarMovimento(); return;
    }
    set({ veiculo: "bicicleta", bicicletaParada: null, acaoNoPonto: null, passeio: false });
    // a caminho da porta de um prédio: refaz o caminho para parar na vaga
    if (p?.fase === "indo") get().entrarNoPredio({ ...p, rot: 0 });
    get().avisarMovimento();
  },
  escolherCorBicicleta: async (cor) => {
    const antes = get().corBicicleta; set({ corBicicleta: corDaBicicleta(cor) });
    const r = await fetch("/api/personagem/veiculo", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cor }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { set({ corBicicleta: antes }); return j.erro ?? "Não consegui salvar a cor agora."; }
    set({ corBicicleta: corDaBicicleta(j.cor) }); return null;
  },
  selecionarOutro: (o) => set({ outroSelecionado: o, painel: o ? "ficha" : get().painel === "ficha" ? null : get().painel }),
  abrirChat: async (o) => { set({ outroSelecionado: o, painel: "chat", mensagens: [] }); await get().atualizarChat(); },
  atualizarChat: async () => {
    const o = get().outroSelecionado; if (!o) return;
    const atuais = get().mensagens;
    const desde = atuais.length ? atuais[atuais.length - 1].criadoEm : null;
    const r = await fetch(`/api/mensagens/${encodeURIComponent(o.usuarioId)}${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`);
    if (!r.ok) return;
    const novas: Mensagem[] = await r.json();
    if (!novas.length) return;
    const ids = new Set(atuais.map((m) => m.id));
    set({ mensagens: [...atuais, ...novas.filter((m) => !ids.has(m.id))] });
  },
  enviar: async (tipo, texto) => {
    const o = get().outroSelecionado; if (!o) return "Escolha com quem falar.";
    const r = await fetch(`/api/mensagens/${encodeURIComponent(o.usuarioId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo, texto }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ mensagens: [...get().mensagens, j] });
    return null;
  },
  carregarCaixa: async () => { const r = await fetch("/api/mensagens"); if (r.ok) set({ conversas: await r.json() }); },
  carregarRede: async () => {
    const r = await fetch("/api/rede"); if (!r.ok) return; const j = await r.json();
    set({ amigos: j.amigos ?? [], listaPedidos: j.pedidos ?? [], negociacoes: j.negociacoes ?? [], conversas: j.conversas ?? get().conversas, pedidos: (j.pedidos ?? []).filter((p: Pedido) => p.direcao === "recebido").length });
    if (j.personagem !== undefined) set({ meu: j.personagem, ativo: !!j.ativo, preco: j.preco ?? get().preco, precoCheio: j.precoCheio ?? get().precoCheio, carregado: true });
  },
  pedirAmizade: async (paraId) => {
    const r = await fetch("/api/amigos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paraId }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    const sel = get().outroSelecionado; if (sel && sel.usuarioId === paraId) set({ outroSelecionado: { ...sel, relacao: j } });
    return null;
  },
  responderAmizade: async (pedidoId, aceitar) => {
    const r = await fetch(`/api/amigos/${encodeURIComponent(pedidoId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ aceitar }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    const sel = get().outroSelecionado; if (sel && sel.relacao?.id === pedidoId) set({ outroSelecionado: { ...sel, relacao: j } });
    void get().carregarRede(); return null;
  },
  desfazerAmizade: async (outroId) => { await fetch(`/api/amigos/${encodeURIComponent(outroId)}`, { method: "DELETE" }); void get().carregarRede(); },
  negociar: async (paraId, d) => {
    const r = await fetch("/api/negociacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paraId, ...d }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    if (get().painel === "chat") void get().atualizarChat(); void get().carregarRede(); return null;
  },
  responderNegociacao: async (id, status) => {
    const r = await fetch(`/api/negociacoes/${encodeURIComponent(id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    // o servidor decide a etapa seguinte (concluir pede a confirmação do outro lado): usa o status que voltou
    set({ negociacoes: get().negociacoes.map((n) => (n.id === id ? { ...n, status: (j as { status?: string }).status ?? status, concluidaPor: (j as { status?: string }).status === "entregue" ? get().meu?.usuarioId ?? null : n.concluidaPor } : n)) });
    if (get().painel === "chat") void get().atualizarChat(); void get().carregarRede(); return null;
  },
  avaliarNegociacao: async (id, nota, texto) => {
    const r = await fetch(`/api/negociacoes/${encodeURIComponent(id)}/avaliacao`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nota, texto }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ negociacoes: get().negociacoes.map((n) => (n.id === id ? { ...n, minhaNota: nota } : n)) }); return null;
  },
  ligar: async (o, video) => { const meu = get().meu; if (!meu) return "Monte seu personagem primeiro."; return useChamada.getState().ligar(o.usuarioId, video, meu.usuarioId, { nome: o.nome, boneco: o.boneco, roupa: o.roupa }); },
}));

export type { TipoAvatar };
if (typeof window !== "undefined") {
  (window as unknown as { __personagem: typeof usePersonagem }).__personagem = usePersonagem;
  // Pix de roupa aprovado (em qualquer tela do mapa): recarrega o personagem, que já vem vestido com o item novo
  useMundo.subscribe((s, antes) => {
    const p = s.pix;
    if (p?.tipo === "item" && p.status === "aprovado" && !(antes.pix?.id === p.id && antes.pix.status === "aprovado")) { void usePersonagem.getState().carregar(); void usePersonagem.getState().carregarItens(); }
  });
}
