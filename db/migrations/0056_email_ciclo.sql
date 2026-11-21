-- WE-17 (21/11/2026): e-mails de ciclo de vida (loja incompleta no 2º e no 5º dia, resumo da semana e unidades de IA
-- acabando) e o descadastro. Só acrescenta duas tabelas; nada é apagado nem muda de valor.

-- 1) Um registro por gatilho: cada e-mail de ciclo de vida sai uma vez só. A chave diz o quê e de quem, por exemplo
--    "loja2:<usuário>:<lote>", "resumo:<usuário>:2026-S47" ou "ia80:<empresa>:2026-11". O envio só acontece depois de
--    gravar a chave (INSERT … ON CONFLICT DO NOTHING), então nem dois servidores ao mesmo tempo mandam em dobro.
CREATE TABLE IF NOT EXISTS email_gatilho (
  chave      TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,                -- loja_dia2 | loja_dia5 | resumo | ia_80 | ia_100
  email_id   TEXT,                         -- email_enviado.id
  status     TEXT,                         -- enviado | sem_chave | erro | pulado
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_gatilho_usuario_idx ON email_gatilho (usuario_id);

-- 2) Preferências de e-mail, mudadas pela página /emails (link assinado, sem login) ou pelo descadastro de um clique
--    (List-Unsubscribe). Sem linha = recebe tudo. Os e-mails da conta (boas-vindas, reserva, pagamento, vencimento e
--    senha) não passam por aqui e continuam saindo.
CREATE TABLE IF NOT EXISTS email_preferencia (
  usuario_id    TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  dicas         BOOLEAN NOT NULL DEFAULT true,   -- loja incompleta (2º e 5º dia)
  resumo        BOOLEAN NOT NULL DEFAULT true,   -- resumo da semana
  unidades      BOOLEAN NOT NULL DEFAULT true,   -- unidades de IA acabando (80% e 100%)
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
