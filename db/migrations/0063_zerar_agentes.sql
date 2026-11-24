-- 24/11/2026, pedido do dono: "vamos zerar agentes. quero criar 1 a 1 desde o atendente, CEO", "todos agentes, só
-- permanece os usuários, personagens comprados que não estão em uma empresa", "apaga todos. vou criar um por um".
-- Decisões dele: apagar de vez; inclui o catálogo, a equipe das lojas dos clientes, os agentes da Nuvem e os moradores;
-- loja nova nasce sem ninguém (src/office/data/escritorio.ts › SEM_EQUIPE).
--
-- APAGA:
--  - todos os agentes (Nuvem, lojas, o registro de custo dos moradores): as conversas, as mensagens, os treinos
--    (conhecimento, skills, regras), as tarefas, os eventos, o uso de IA, as conversas internas e as imagens da equipe
--    vão junto (ON DELETE CASCADE de agente);
--  - o catálogo "Agentes à venda" do admin (agente_catalogo) e os agentes comprados pelas lojas (agente_contratado);
--  - a equipe gravada nas lojas (terreno.escritorio.equipe), nas equipes guardadas (terreno_arquivo) e nas páginas
--    grátis (loja_vitrine): fica a lista vazia; setores, prédio, marca e decoração ficam;
--  - as conversas, as relações e os pedidos dos moradores da cidade (os moradores saíram do código).
-- FICA: as contas, os personagens dos usuários, as lojas (lote, quiosque, marca, prédio), os pagamentos, as
-- assinaturas e os extratos de créditos e de unidades de IA (imutáveis, migrações 0042/0053).
DELETE FROM agente;
DELETE FROM agente_catalogo;
DELETE FROM agente_contratado;

UPDATE terreno SET escritorio = jsonb_set(escritorio, '{equipe}', '[]'::jsonb), atualizado_em = now()
 WHERE escritorio IS NOT NULL AND jsonb_typeof(escritorio -> 'equipe') = 'array' AND jsonb_array_length(escritorio -> 'equipe') > 0;
UPDATE terreno_arquivo SET escritorio = jsonb_set(escritorio, '{equipe}', '[]'::jsonb)
 WHERE escritorio IS NOT NULL AND jsonb_typeof(escritorio -> 'equipe') = 'array' AND jsonb_array_length(escritorio -> 'equipe') > 0;
UPDATE loja_vitrine SET escritorio = jsonb_set(escritorio, '{equipe}', '[]'::jsonb)
 WHERE escritorio IS NOT NULL AND jsonb_typeof(escritorio -> 'equipe') = 'array' AND jsonb_array_length(escritorio -> 'equipe') > 0;

DELETE FROM morador_mensagem;
DELETE FROM morador_relacao;
DELETE FROM morador_pedido;
