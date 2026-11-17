-- Conversas internas da equipe de IA (16/11/2026): quando o dono pede algo a um chefe (CEO, diretor, gerente), o chefe
-- pode passar partes da tarefa para quem responde a ele. Cada pedido e a resposta ficam aqui (feed "Conversas internas",
-- andamento na conversa e atividade da cena 3D). origem_* = a pessoa que recebeu o pedido do dono e a mensagem dele.
CREATE TABLE IF NOT EXISTS conversa_interna (
  id              TEXT PRIMARY KEY,
  empresa_id      TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  de_agente       TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  para_agente     TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  origem_agente   TEXT,
  origem_mensagem TEXT,
  pedido          TEXT NOT NULL,
  resposta        TEXT,
  status          TEXT NOT NULL DEFAULT 'pedido', -- pedido | respondido | erro
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS conversa_interna_empresa_idx ON conversa_interna(empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS conversa_interna_agentes_idx ON conversa_interna(de_agente, para_agente);
