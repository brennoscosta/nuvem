-- Guia passo a passo (21/11/2026, frente "tutorial"): o progresso de cada conta nos roteiros do guia com holofote
-- (src/office/guia). Uma linha por conta e roteiro:
--  - feitos: os passos de visita e os manuais já vistos. Os passos de FATO (perfil completo, lote pago, personagem
--    ativo…) nunca ficam guardados aqui: o servidor confere no banco a cada leitura (src/server/guia.ts).
--  - dispensado_em: a pessoa pediu para não mostrar mais o roteiro (o botão "Guia" continua abrindo).
--  - concluido_em: terminou o roteiro.
-- O roteiro especial "_telas" guarda as telas que a pessoa já abriu (passos de visita).
CREATE TABLE IF NOT EXISTS guia_progresso (
  usuario_id    TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  roteiro       TEXT NOT NULL,
  feitos        TEXT[] NOT NULL DEFAULT '{}',
  dispensado_em TIMESTAMPTZ,
  concluido_em  TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, roteiro)
);
