-- Equipe de IA do cliente (11/11/2026). Cada conta com lote ativo ganha uma empresa de verdade (dona: usuario_id) e os
-- membros do escritório viram agentes do motor. As conversas de visitantes com a equipe da loja ficam separadas da
-- conversa do dono (visitante_id preenchido); a conversa do dono e a do escritório interno ficam com visitante_id nulo.
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS usuario_id TEXT REFERENCES usuario(id) ON DELETE CASCADE;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS contatos JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS empresa_usuario_idx ON empresa (usuario_id);

ALTER TABLE mensagem ADD COLUMN IF NOT EXISTS visitante_id TEXT REFERENCES usuario(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS mensagem_conversa_idx ON mensagem (agente_id, visitante_id, criado_em);
CREATE INDEX IF NOT EXISTS uso_ia_agente_data_idx ON uso_ia (agente_id, criado_em);
