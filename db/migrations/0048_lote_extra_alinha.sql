-- Lote extra (20/11/2026, v94): o lote extra passa a renovar junto com o lote principal e não renova mais sozinho
-- (src/server/terrenoExtra.ts). Os lotes duplos de antes vencem cada um num dia; aqui o extra que venceria antes passa a
-- vencer no mesmo dia do principal. Só estende o prazo, nunca encurta, e não cobra nada.
UPDATE terreno a SET pago_ate = p.pago_ate, avisado_em = NULL, atualizado_em = now()
  FROM terreno p
  WHERE a.anexo_de = p.chave AND a.status = 'ativo' AND p.status = 'ativo' AND p.pago_ate IS NOT NULL
    AND (a.pago_ate IS NULL OR a.pago_ate < p.pago_ate);
