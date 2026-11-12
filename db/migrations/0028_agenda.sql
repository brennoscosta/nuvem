-- Agendamento pela loja (12/11/2026): o dono liga a agenda, cadastra serviços e horários; o visitante marca pelo cartão
-- da loja no mapa, pela página /loja/N ou conversando com a atendente de IA. Só acrescenta tabelas.

-- configuração da agenda, por conta (a empresa é da conta, não do lote)
CREATE TABLE IF NOT EXISTS agenda_loja (
  dono_id TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  ligada BOOLEAN NOT NULL DEFAULT false,
  servicos JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ id, nome, duracao (min), preco (texto) }]
  horarios JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "0".."6": { aberto, ini, fim, pausaIni?, pausaFim? } } (0 = domingo)
  passo SMALLINT NOT NULL DEFAULT 30, -- de quantos em quantos minutos começam os horários
  antecedencia_min INT NOT NULL DEFAULT 60, -- marcar com pelo menos N minutos de antecedência
  dias_frente SMALLINT NOT NULL DEFAULT 30, -- até quantos dias à frente
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- horários marcados. status: marcado | cancelado | concluido | faltou. origem: cartao | atendente
CREATE TABLE IF NOT EXISTS agendamento (
  id TEXT PRIMARY KEY,
  dono_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  terreno_chave TEXT,
  empresa TEXT NOT NULL DEFAULT '',
  cliente_id TEXT REFERENCES usuario(id) ON DELETE SET NULL,
  servico_id TEXT NOT NULL,
  servico TEXT NOT NULL,
  preco TEXT NOT NULL DEFAULT '',
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  nome TEXT NOT NULL,
  contato TEXT NOT NULL,
  obs TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'marcado',
  origem TEXT NOT NULL DEFAULT 'cartao',
  cancelado_por TEXT, -- cliente | dono
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agendamento_dono_idx ON agendamento (dono_id, inicio);
CREATE INDEX IF NOT EXISTS agendamento_cliente_idx ON agendamento (cliente_id, inicio);
