// Quem está por trás do WorkEnd (WE-06, 21/11/2026): os dados da empresa que oferece o serviço, usados no rodapé de todas
// as páginas públicas (./_partes.tsx) e nas Políticas de uso (./politicas/page.tsx). Preencha aqui, uma vez só.
// Decisão do dono (21/11/2026): Nuvem Inc., CNPJ 32.598.953/0001-90, os mesmos dados do bday.fm.
// Campo vazio = a linha simplesmente não aparece na tela. Nunca mostrar marcador do tipo "[CNPJ]" ou "TODO" ao visitante.
// TODO(dono): endereço completo, com cidade, UF e CEP. O Decreto 7.962/2013 (art. 2º) pede endereço físico e eletrônico
//   no site que vende pela internet.
// TODO(dono): e-mail de contato e de pedidos sobre dados pessoais. Fica em aberto até o domínio de e-mail do WorkEnd
//   funcionar. Não usar os e-mails contato@ e privacidade@ do bday.fm.
// TODO(dono): encarregado pelo tratamento de dados pessoais (LGPD, art. 41).
// TODO(dono): número de WhatsApp para o rodapé e a página de preço. Sem número, sem link wa.me.
// Foro: o dono decidiu não ter cláusula de foro por enquanto (21/11/2026).
export const EMPRESA = {
  razaoSocial: "Nuvem Inc.",
  cnpj: "32.598.953/0001-90",
  endereco: "", // TODO(dono)
  email: "", // TODO(dono)
  encarregado: "", // TODO(dono)
};

// "Nuvem Inc. · CNPJ 32.598.953/0001-90", com o endereço no fim quando existir
export const identificacao = () => [EMPRESA.razaoSocial, EMPRESA.cnpj && `CNPJ ${EMPRESA.cnpj}`, EMPRESA.endereco].filter(Boolean).join(" · ");
