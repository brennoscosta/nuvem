// Grade de planos (WE-19, 22/11/2026, decisão do dono "Escada 0 → 47 → 97"). Os preços do lote e do quiosque ficam em
// ./precosTerreno.ts (constantes únicas); aqui só o que é da página de planos.
//  - Vitrine grátis (WE-13), Quiosque R$ 47, Loja (o lote) R$ 97.
//  - Equipe R$ 297: o cartão SÓ aparece quando o WhatsApp da atendente (WE-18) estiver ligado (src/server/planos.ts ›
//    planoEquipeLigado). A cobrança do Equipe ainda NÃO existe: o botão grava o interesse (TODO do dono: produto e cobrança).
//  - Sede: sob consulta, com o formulário "Fale com a gente" (tabela plano_contato, aviso no sino do admin).
//  - Âncora do brief: agência de IA, de R$ 1.500 a R$ 3.500 por mês.
export const PRECO_EQUIPE = 297; // R$ por mês (WE-19). Ainda sem cobrança: só aparece com o WhatsApp ligado
export const ANCORA_AGENCIA = { de: 1500, ate: 3500 } as const; // R$ por mês, agência de IA (brief, WE-19)
export const EQUIPE_ITENS = { especialistas: 12, setores: 4, unidades: 5000 } as const; // o que o Equipe inclui, pelo brief

export type PlanoContato = "sede" | "equipe";
export const PLANOS_CONTATO: Record<PlanoContato, string> = { sede: "Sede", equipe: "Equipe" };
export const ehPlanoContato = (v: unknown): v is PlanoContato => v === "sede" || v === "equipe";
