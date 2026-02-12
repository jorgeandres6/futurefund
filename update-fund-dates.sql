-- Script para actualizar fechas de fondos a fechas recientes
-- Ejecutar este script si las fechas de análisis están desactualizadas

-- Opción 1: Actualizar analyzed_at con la fecha actual para todos los fondos
-- (Usar si quieres que todos los fondos muestren la fecha actual)
UPDATE funds 
SET analyzed_at = CURRENT_TIMESTAMP
WHERE analyzed_at IS NULL OR analyzed_at < '2025-01-01';

-- Opción 2: Actualizar solo los fondos que tienen análisis
-- (Más conservador, solo actualiza fondos que ya fueron analizados)
UPDATE funds 
SET analyzed_at = CURRENT_TIMESTAMP
WHERE analisis_aplicacion IS NOT NULL 
  AND (analyzed_at IS NULL OR analyzed_at < '2025-01-01');

-- Opción 3: Si prefieres usar fecha_scrapeo actualizada
-- (Menos recomendado, ya que fecha_scrapeo debería ser inmutable)
-- UPDATE funds 
-- SET fecha_scrapeo = CURRENT_TIMESTAMP
-- WHERE fecha_scrapeo < '2025-01-01';

-- Verificar los resultados
SELECT 
  nombre_fondo,
  fecha_scrapeo,
  analyzed_at,
  COALESCE(analyzed_at, fecha_scrapeo) as fecha_mostrar
FROM funds
ORDER BY COALESCE(analyzed_at, fecha_scrapeo) DESC
LIMIT 20;

-- Ver estadísticas de fechas
SELECT 
  DATE_TRUNC('year', COALESCE(analyzed_at, fecha_scrapeo::timestamp)) as año,
  COUNT(*) as cantidad_fondos
FROM funds
GROUP BY año
ORDER BY año DESC;
