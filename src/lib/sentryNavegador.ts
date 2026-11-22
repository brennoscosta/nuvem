// Sentry do navegador (WE-23, 22/11/2026): só as duas funções que src/instrumentation-client.ts usa. A página baixa este
// arquivo só no primeiro erro, e a importação nomeada deixa o compilador tirar o resto do pacote (gravação de tela,
// formulário de opinião, medidas de tempo), o que o import("@sentry/nextjs") inteiro não deixava.
export { init, captureException } from "@sentry/nextjs";
