-- Migración: Agregar campo analyzed_at a tabla funds
-- Propósito: Permitir que N8N analice fondos insertados sin análisis

-- Agregar columna analyzed_at si no existe
ALTER TABLE funds 
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Crear índice para consultas eficientes de fondos sin analizar
CREATE INDEX IF NOT EXISTS idx_funds_analyzed_at 
ON funds(analyzed_at) 
WHERE analyzed_at IS NULL;

-- Comentarios
COMMENT ON COLUMN funds.analyzed_at IS 'Timestamp de cuando fue analizado el fondo por Gemini AI. NULL = pendiente de análisis';

-- Migrar fondos existentes (opcional)
-- Si quieres marcar fondos existentes que ya tienen análisis:
UPDATE funds 
SET analyzed_at = updated_at 
WHERE analisis_gemini IS NOT NULL 
  AND analyzed_at IS NULL;

-- Verificar
SELECT 
  COUNT(*) as total_fondos,
  COUNT(analyzed_at) as fondos_analizados,
  COUNT(*) - COUNT(analyzed_at) as fondos_pendientes
FROM funds;
