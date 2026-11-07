-- Escritório compacto (07/11/2026, pedido do Brenno): prédio menor com Recepção, Gestão de tráfego, Criativos,
-- Consultoria, Diretoria e Sala do CEO. Na Nuvem ficam só o CEO (BrenoNuvem) e a recepcionista (Aurora).
-- Todo o resto é desligado do mesmo jeito que o "demitir" do painel (ativo = false, sem mesa): ficha, skills,
-- regras, conversas e tarefas continuam no banco, só não aparecem mais.
UPDATE agente SET ativo = false, mesa_id = NULL, atualizado_em = now()
 WHERE empresa_id = 'emp_nuvem' AND ativo = true AND nivel <> 'ceo' AND area <> 'recepcao';

-- Os setores de criação antigos viraram "Criativos" (imagens e vídeo); quem for religado um dia já cai na sala certa.
UPDATE agente SET area = 'criativos' WHERE area IN ('designgrafico', 'criacao');

-- Ação automática "ao concluir uma arte" que mandava pra um setor que não existe mais: volta pra "só me avisar".
UPDATE agente SET config = config - 'aoConcluir'
 WHERE config ? 'aoConcluir' AND COALESCE(config->'aoConcluir'->>'encaminharPara', '') NOT IN ('', 'trafego', 'criativos', 'consultoria', 'recepcao');
