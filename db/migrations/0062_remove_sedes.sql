-- 24/11/2026, pedido do dono: "exclua as lojas bday.fm, social rp, nuvcam, appzone". Decisão dele: apagar de vez os dados
-- das quatro sedes; os lotes de esquina viram lotes à venda (src/office/data/mundo.ts) e o código fica sem nenhuma sede
-- (src/office/data/sedes.ts › SEDES = []).
--
-- Chaves das sedes no terreno (data/mundo.ts › chaveDoLote, que continua trocando as chaves nesses quarteirões para
-- nenhum lote vizinho mudar de chave): Social RP 1,1,0 · AppZone -1,-1,0 · bday.fm -1,1,0 · NUVCAM 1,-1,0.
--
-- APAGA: o terreno de cada sede (com o escritório, a equipe e os sócios), a empresa de cada uma (agentes, conversas,
--   tarefas, conexões, conectores, chaves de API, vitrine, endereço e WhatsApp vão em cascata), o mural, a carteira de
--   unidades de IA, os agentes comprados, as equipes guardadas (terreno_arquivo), visitas, cliques, destaques,
--   atividade e horários marcados nessas lojas.
-- A Social RP usava a empresa antiga do titular (emp_<usuário>, src/server/equipeCliente.ts › empresaIdDe). Se o titular
--   não tem outra loja, a empresa sai inteira; se tem, saem só os agentes da equipe da sede.
-- FICA, como em toda exclusão (src/server/exclusao.ts): os pagamentos e assinaturas (obrigação fiscal), o extrato de
--   unidades de IA (imutável, migração 0042/0053), as contas dos titulares e sócios (só perdem a sede), e o que é de
--   outras pessoas: carimbos do passaporte e pedidos de moradores passam a dizer "Loja encerrada"; outdoor, anúncio e
--   evento da praça que apontavam para a sede perdem só o link.
DO $$
DECLARE
  chaves CONSTANT text[] := ARRAY['1,1,0', '-1,-1,0', '-1,1,0', '1,-1,0'];
  ch text;
  t record;
  emp text;
  outras int;
BEGIN
  FOREACH ch IN ARRAY chaves LOOP
    SELECT chave, usuario_id, escritorio INTO t FROM terreno WHERE chave = ch;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- empresa só deste lote: emp_<titular>_<chave sem sinais> (as sedes e os lotes da conta admin)
    emp := 'emp_' || t.usuario_id || '_' || regexp_replace(replace(ch, '-', 'm'), '[^a-zA-Z0-9]', '_', 'g');
    DELETE FROM mural WHERE empresa_id = emp;
    DELETE FROM ia_carteira WHERE empresa_id = emp;
    DELETE FROM empresa WHERE id = emp;

    -- Social RP: empresa antiga do titular (emp_<titular>)
    IF ch = '1,1,0' THEN
      emp := 'emp_' || t.usuario_id;
      SELECT count(*) INTO outras FROM terreno
        WHERE usuario_id = t.usuario_id AND chave <> ALL(chaves) AND (anexo_de IS NULL OR anexo_de <> ALL(chaves));
      IF outras = 0 THEN
        DELETE FROM mural WHERE empresa_id = emp;
        DELETE FROM ia_carteira WHERE empresa_id = emp;
        DELETE FROM empresa WHERE id = emp;
      ELSIF t.escritorio IS NOT NULL AND jsonb_typeof(t.escritorio -> 'equipe') = 'array' THEN
        -- o titular tem outra loja na mesma empresa: saem só os agentes da equipe da sede (agenteIdDe: ag_<empresa sem
        -- "emp_">_<membro>). O id do membro pode ser o mesmo nas duas equipes ("atendente", "ceo"): esse agente é também o
        -- da outra loja e fica.
        DELETE FROM agente WHERE empresa_id = emp AND id IN (
          SELECT 'ag_' || substr(emp, 5) || '_' || (m ->> 'id') FROM jsonb_array_elements(t.escritorio -> 'equipe') m
           WHERE m ? 'id' AND (m ->> 'id') NOT IN (
             SELECT o_m ->> 'id' FROM terreno o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.escritorio -> 'equipe') = 'array' THEN o.escritorio -> 'equipe' ELSE '[]'::jsonb END) o_m
              WHERE o.usuario_id = t.usuario_id AND o.chave <> ALL(chaves) AND o_m ? 'id'));
      END IF;
    END IF;
  END LOOP;

  -- o que é da loja de cada sede, pela chave
  DELETE FROM whatsapp_conexao WHERE terreno_chave = ANY(chaves);
  DELETE FROM agente_contratado WHERE terreno_chave = ANY(chaves);
  DELETE FROM terreno_arquivo WHERE chave = ANY(chaves);
  DELETE FROM visita_loja WHERE terreno_chave = ANY(chaves);
  DELETE FROM visita_dia WHERE terreno_chave = ANY(chaves);
  DELETE FROM clique_loja WHERE terreno_chave = ANY(chaves);
  DELETE FROM destaque_semana WHERE terreno_chave = ANY(chaves);
  DELETE FROM atividade WHERE terreno_chave = ANY(chaves) AND tipo <> 'pagamento'; -- a de pagamento fica, como os pagamentos
  DELETE FROM agendamento WHERE terreno_chave = ANY(chaves);

  -- de outras pessoas: fica, sem a loja
  UPDATE passaporte_carimbo SET empresa_nome = 'Loja encerrada' WHERE loja_chave = ANY(chaves);
  UPDATE morador_pedido SET empresa_nome = 'Loja encerrada' WHERE loja_chave = ANY(chaves);
  UPDATE outdoor SET terreno_chave = NULL WHERE terreno_chave = ANY(chaves);
  UPDATE anuncio_praca SET terreno_chave = NULL WHERE terreno_chave = ANY(chaves);
  UPDATE evento_praca SET terreno_chave = NULL WHERE terreno_chave = ANY(chaves);

  -- por último o terreno (e uma ampliação, se houver): o lote volta a ficar à venda
  DELETE FROM terreno WHERE chave = ANY(chaves) OR anexo_de = ANY(chaves);
END $$;
