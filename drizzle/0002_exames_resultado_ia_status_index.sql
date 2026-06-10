-- Add virtual column + index on exames.resultado_ia.status for fast filtering
-- Used by listarExamesRejeitadosIa — avoids full JSON_EXTRACT scan on every query.
-- TiDB/MySQL automatically uses this index when the WHERE expression matches.
ALTER TABLE `exames`
  ADD COLUMN `resultado_ia_status` VARCHAR(30)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(resultado_ia, '$.status'))) VIRTUAL,
  ADD INDEX `idx_exames_resultado_ia_status` (`resultado_ia_status`);
