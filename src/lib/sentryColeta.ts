// O que o Sentry pode coletar sozinho (WE-23, 22/11/2026): nada de dado pessoal. No Sentry 11 o sendDefaultPii virou
// dataCollection, e o padrão dele coleta quase tudo (usuário, cookies, cabeçalhos, corpos, busca do endereço, variáveis
// locais). Aqui fica tudo desligado; src/lib/sentryLimpar.ts ainda limpa o que sobrar antes do envio.
export const COLETA_SENTRY = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as never[], // lista vazia = nenhum corpo de requisição ou resposta
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};
