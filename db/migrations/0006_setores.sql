-- Setores novos (térreo único): engenharia→desenvolvimento, marketing→criacao, suporte→atendimento;
-- áreas do antigo 1º andar: design→criacao, produto→planejamento, dados→analise, parcerias→vendas, sucesso→atendimento.
UPDATE agente SET
  area = CASE area
    WHEN 'engenharia' THEN 'desenvolvimento' WHEN 'marketing' THEN 'criacao' WHEN 'suporte' THEN 'atendimento'
    WHEN 'design' THEN 'criacao' WHEN 'produto' THEN 'planejamento' WHEN 'dados' THEN 'analise'
    WHEN 'parcerias' THEN 'vendas' WHEN 'sucesso' THEN 'atendimento' ELSE area END,
  mesa_id = CASE
    WHEN mesa_id LIKE 'engenharia-%' THEN 'desenvolvimento-' || substr(mesa_id, length('engenharia-') + 1)
    WHEN mesa_id LIKE 'marketing-%'  THEN 'criacao-' || substr(mesa_id, length('marketing-') + 1)
    WHEN mesa_id LIKE 'suporte-%'    THEN 'atendimento-' || substr(mesa_id, length('suporte-') + 1)
    WHEN mesa_id LIKE 'design-%'     THEN 'criacao-' || substr(mesa_id, length('design-') + 1)
    WHEN mesa_id LIKE 'produto-%'    THEN 'planejamento-' || substr(mesa_id, length('produto-') + 1)
    WHEN mesa_id LIKE 'dados-%'      THEN 'analise-' || substr(mesa_id, length('dados-') + 1)
    WHEN mesa_id LIKE 'parcerias-%'  THEN 'vendas-' || substr(mesa_id, length('parcerias-') + 1)
    WHEN mesa_id LIKE 'sucesso-%'    THEN 'atendimento-' || substr(mesa_id, length('sucesso-') + 1)
    ELSE mesa_id END;
