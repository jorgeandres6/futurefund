-- ========================================
-- Migración: Tabla de Seguimiento de Correos
-- ========================================
-- Esta tabla almacena el historial de correos enviados y recibidos
-- por el proceso automático de N8N

-- Crear tabla de seguimiento de correos (versión simplificada)
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fund_id UUID REFERENCES funds(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('received', 'sent', 'RECIBIDO', 'ENVIADO', 'recibido', 'enviado')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  email_body TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_email_tracking_user_id ON email_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_fund_id ON email_tracking(fund_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_email_type ON email_tracking(email_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_date ON email_tracking(date DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para email_tracking
-- Los usuarios solo pueden ver sus propios correos
CREATE POLICY "Users can view their own emails"
  ON email_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios premium pueden insertar correos (proceso automático)
CREATE POLICY "System can insert emails"
  ON email_tracking FOR INSERT
  WITH CHECK (true); -- Permitir inserción desde N8N con service key

-- Los usuarios pueden eliminar sus propios correos
CREATE POLICY "Users can delete their own emails"
  ON email_tracking FOR DELETE
  USING (auth.uid() = user_id);

-- Función para obtener estadísticas de correos por usuario
CREATE OR REPLACE FUNCTION get_email_stats(p_user_id UUID)
RETURNS TABLE (
  total_emails BIGINT,
  sent_emails BIGINT,
  received_emails BIGINT,
  last_email_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_emails,
    COUNT(*) FILTER (WHERE email_type = 'sent')::BIGINT as sent_emails,
    COUNT(*) FILTER (WHERE email_type = 'received')::BIGINT as received_emails,
    MAX(date) as last_email_date
  FROM email_tracking
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar un correo
CREATE OR REPLACE FUNCTION log_email(
  p_email_type TEXT,
  p_from_email TEXT,
  p_to_email TEXT,
  p_email_body TEXT,
  p_user_id UUID DEFAULT NULL,
  p_fund_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email_id UUID;
BEGIN
  INSERT INTO email_tracking (
    email_type,
    from_email,
    to_email,
    email_body,
    user_id,
    fund_id
  ) VALUES (
    p_email_type,
    p_from_email,
    p_to_email,
    p_email_body,
    p_user_id,
    p_fund_id
  )
  RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios sobre la tabla
COMMENT ON TABLE email_tracking IS 'Registro simplificado de correos electrónicos enviados y recibidos';
COMMENT ON COLUMN email_tracking.email_type IS 'Tipo de correo: received (recibido) o sent (enviado)';
COMMENT ON COLUMN email_tracking.date IS 'Fecha y hora del correo';
