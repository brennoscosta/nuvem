-- Correção (22/11/2026, achado da exclusão de conta): os agentes contratados eram lidos só pela chave do lote. Quando o
-- lote vencia, saía do mapa e era vendido de novo, a equipe comprada pelo dono antigo aparecia para o comprador novo (na
-- lista de contratados fora da equipe) e podia entrar na equipe dele sem pagar. Agora o contrato guarda também a conta
-- dona da empresa (dono_id: o titular do lote na hora da compra; se um sócio pagou, o titular) e só vale no lote enquanto
-- o titular for o mesmo. Quando o lote sai do mapa, os contratos ficam guardados para o dono antigo e voltam com a equipe
-- guardada quando ele reserva de novo (src/server/terrenos.ts › reservarTerreno). Só aditiva.
ALTER TABLE agente_contratado ADD COLUMN IF NOT EXISTS dono_id TEXT;

-- contratos que já existem: o titular de agora, se quem pagou é ele ou sócio dele; senão quem tinha o lote quando ele
-- saiu do mapa depois da compra (terreno_arquivo); senão quem pagou
UPDATE agente_contratado c SET dono_id = COALESCE(
    (SELECT t.usuario_id FROM terreno t WHERE t.chave = c.terreno_chave AND (t.usuario_id = c.usuario_id OR c.usuario_id = ANY(t.socios))),
    (SELECT a.usuario_id FROM terreno_arquivo a WHERE a.chave = c.terreno_chave AND a.arquivado_em >= c.criado_em ORDER BY a.arquivado_em LIMIT 1),
    c.usuario_id)
  WHERE c.dono_id IS NULL;

-- quem gravar sem dono_id (código de outro ramo ainda sem esta correção, teste por SQL) recebe o titular do lote, ou quem pagou
CREATE OR REPLACE FUNCTION workend_agente_dono() RETURNS trigger AS $$
BEGIN
  IF NEW.dono_id IS NULL THEN
    NEW.dono_id := COALESCE((SELECT t.usuario_id FROM terreno t WHERE t.chave = NEW.terreno_chave), NEW.usuario_id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS agente_contratado_dono ON agente_contratado;
CREATE TRIGGER agente_contratado_dono BEFORE INSERT ON agente_contratado FOR EACH ROW EXECUTE FUNCTION workend_agente_dono();

CREATE INDEX IF NOT EXISTS agente_contratado_dono_idx ON agente_contratado (dono_id, terreno_chave);
