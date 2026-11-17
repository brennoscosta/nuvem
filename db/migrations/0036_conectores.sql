-- Conectores por empresa (17/11/2026, pedido do dono: "essa opção de conectar a empresa tem que ter, pode ser por api ou
-- algum outro jeito, pois queremos automatizar muitas tarefas"). Quatro jeitos de ligar a empresa a outros sistemas:
--  - chave_api: chaves da API v1 do WorkEnd (outro sistema dá tarefas e lê as entregas). Só o hash sha256 fica guardado.
--  - conector tipo 'aviso': avisos automáticos (webhooks de saída) assinados com HMAC-SHA256;
--  - conector tipo 'fonte': fonte de dados de leitura que os agentes recebem no contexto antes de responder;
--  - conector tipo 'destino': para onde o dono envia uma entrega (rascunho de notícia, missão…), sempre com o clique dele.
-- segredo = texto cifrado com AES-256-GCM (chave derivada do segredo do servidor): o segredo HMAC (aviso/destino) ou o
-- cabeçalho de autorização (fonte). Nunca volta para a tela.
CREATE TABLE IF NOT EXISTS chave_api (
  id          TEXT PRIMARY KEY,
  empresa_id  TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  usuario_id  TEXT NOT NULL,
  lote        TEXT NOT NULL,
  nome        TEXT NOT NULL,
  prefixo     TEXT NOT NULL,
  hash        TEXT NOT NULL UNIQUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso  TIMESTAMPTZ,
  revogada_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS chave_api_empresa_idx ON chave_api(empresa_id);

CREATE TABLE IF NOT EXISTS conector (
  id            TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL, -- aviso | fonte | destino
  nome          TEXT NOT NULL,
  url           TEXT NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}', -- aviso: {eventos}; fonte: {setores, cabecalho}; destino: {tipos}
  segredo       TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso    TIMESTAMPTZ,
  ultimo_erro   TEXT
);
CREATE INDEX IF NOT EXISTS conector_empresa_idx ON conector(empresa_id, tipo);

-- histórico: cada aviso disparado, cada envio para um destino, cada teste
CREATE TABLE IF NOT EXISTS conector_registro (
  id          TEXT PRIMARY KEY,
  empresa_id  TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  conector_id TEXT REFERENCES conector(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL, -- aviso | envio | teste
  evento      TEXT,
  status      TEXT NOT NULL, -- tentando | ok | erro
  codigo      INT,
  tentativas  INT NOT NULL DEFAULT 0,
  resumo      TEXT,
  resposta    TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conector_registro_idx ON conector_registro(empresa_id, criado_em DESC);

-- tarefas dadas pela API v1 (rodam como se o dono tivesse pedido; a entrega fica aqui e na conversa)
CREATE TABLE IF NOT EXISTS tarefa_api (
  id               TEXT PRIMARY KEY,
  empresa_id       TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  chave_id         TEXT,
  membro_id        TEXT NOT NULL,
  agente_id        TEXT NOT NULL,
  texto            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'trabalhando', -- trabalhando | entregue | erro
  resposta_inicial TEXT,
  entrega          TEXT,
  erro             TEXT,
  avisar           TEXT,
  mensagem_id      TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  entregue_em      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tarefa_api_empresa_idx ON tarefa_api(empresa_id, criado_em DESC);
