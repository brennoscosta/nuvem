-- Configurações livres do agente (ex.: ação automática ao concluir uma tarefa: encaminhar a arte pro gerente de outro setor).
ALTER TABLE agente ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
