-- Ruas com nome (12/11/2026): uma empresa fundadora (1º mês pago com o preço de fundador) dá nome a UMA rua livre.
-- Sem linha aqui, a rua usa o nome padrão do mapa (src/office/data/mundo.ts, RUAS).
CREATE TABLE IF NOT EXISTS rua_nome (
  rua TEXT PRIMARY KEY, -- id da rua no mapa: z-78, x26...
  nome TEXT NOT NULL, -- nome completo, já com "Rua" ou "Avenida"
  usuario_id TEXT REFERENCES usuario(id) ON DELETE SET NULL,
  empresa TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- uma rua por conta
CREATE UNIQUE INDEX IF NOT EXISTS rua_nome_usuario_idx ON rua_nome (usuario_id) WHERE usuario_id IS NOT NULL;
