-- Script para gestionar tipos de usuario en FutureFund
-- Ejecutar en Supabase SQL Editor

-- ============================================
-- PROMOVER A USUARIO PREMIUM
-- ============================================

-- Opción 1: Por user_id (UUID de Supabase Auth)
UPDATE profiles
SET user_type = 'premium'
WHERE user_id = 'INSERTAR_UUID_AQUI';

-- Opción 2: Por email del usuario (requiere JOIN con auth.users)
UPDATE profiles
SET user_type = 'premium'
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'usuario@ejemplo.com'
);

-- Opción 3: Por nombre de compañía
UPDATE profiles
SET user_type = 'premium'
WHERE company_name = 'Nombre de la Compañía';

-- ============================================
-- PROMOVER A USUARIO BASIC
-- ============================================

UPDATE profiles
SET user_type = 'basic'
WHERE user_id = 'INSERTAR_UUID_AQUI';

-- ============================================
-- DEGRADAR A USUARIO DEMO
-- ============================================

UPDATE profiles
SET user_type = 'demo'
WHERE user_id = 'INSERTAR_UUID_AQUI';

-- ============================================
-- CONSULTAS ÚTILES
-- ============================================

-- Ver todos los usuarios con su tipo actual
SELECT 
  p.company_name,
  u.email,
  p.user_type,
  p.created_at,
  p.updated_at
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
ORDER BY p.created_at DESC;

-- Contar usuarios por tipo
SELECT 
  user_type,
  COUNT(*) as total_usuarios
FROM profiles
GROUP BY user_type
ORDER BY total_usuarios DESC;

-- Ver usuarios premium con sus fondos
SELECT 
  p.company_name,
  u.email,
  COUNT(f.id) as total_fondos,
  COUNT(CASE WHEN f.es_elegible IS NOT NULL THEN 1 END) as fondos_analizados
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
LEFT JOIN funds f ON p.user_id = f.user_id
WHERE p.user_type = 'premium'
GROUP BY p.company_name, u.email
ORDER BY total_fondos DESC;

-- Ver fondos con análisis automático (premium)
SELECT 
  f.nombre_fondo,
  f.es_elegible,
  ARRAY_LENGTH(f.contact_emails, 1) as num_emails,
  f.link_directo_aplicacion,
  p.company_name,
  p.user_type
FROM funds f
JOIN profiles p ON f.user_id = p.user_id
WHERE f.es_elegible IS NOT NULL
AND p.user_type = 'premium'
ORDER BY f.created_at DESC
LIMIT 20;

-- Verificar integridad de tipos de usuario
SELECT 
  user_type,
  COUNT(*) as total
FROM profiles
WHERE user_type NOT IN ('demo', 'basic', 'premium')
GROUP BY user_type;
-- (Debería retornar 0 filas)

-- ============================================
-- MIGRACIÓN MASIVA (CON CUIDADO)
-- ============================================

-- Promover todos los usuarios demo a basic
-- DESCOMENTAR SOLO SI ESTÁS SEGURO
/*
UPDATE profiles
SET user_type = 'basic'
WHERE user_type = 'demo';
*/

-- Promover primeros 10 usuarios a premium (beta testers)
-- DESCOMENTAR SOLO SI ESTÁS SEGURO
/*
UPDATE profiles
SET user_type = 'premium'
WHERE user_id IN (
  SELECT user_id FROM profiles
  ORDER BY created_at ASC
  LIMIT 10
);
*/

-- ============================================
-- CREAR ÍNDICE PARA MEJORAR RENDIMIENTO
-- ============================================

-- Índice para búsquedas por user_type
CREATE INDEX IF NOT EXISTS idx_profiles_user_type 
ON profiles(user_type);

-- ============================================
-- AUDITORÍA DE CAMBIOS
-- ============================================

-- Ver últimas actualizaciones de tipo de usuario
SELECT 
  p.company_name,
  u.email,
  p.user_type,
  p.updated_at
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE p.updated_at > NOW() - INTERVAL '7 days'
ORDER BY p.updated_at DESC;

-- ============================================
-- ESTADÍSTICAS DE USO (PREMIUM)
-- ============================================

-- Promedio de fondos analizados por usuario premium
SELECT 
  AVG(fondos_analizados) as promedio_analisis,
  MAX(fondos_analizados) as max_analisis,
  MIN(fondos_analizados) as min_analisis
FROM (
  SELECT 
    p.user_id,
    COUNT(CASE WHEN f.es_elegible IS NOT NULL THEN 1 END) as fondos_analizados
  FROM profiles p
  LEFT JOIN funds f ON p.user_id = f.user_id
  WHERE p.user_type = 'premium'
  GROUP BY p.user_id
) as stats;

-- ============================================
-- EJEMPLO DE USO COMPLETO
-- ============================================

/*
-- Paso 1: Identificar al usuario
SELECT 
  u.id as user_id,
  u.email,
  p.company_name,
  p.user_type
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.email = 'correo@ejemplo.com';

-- Paso 2: Copiar el user_id del resultado

-- Paso 3: Actualizar a premium
UPDATE profiles
SET user_type = 'premium'
WHERE user_id = 'UUID_COPIADO';

-- Paso 4: Verificar el cambio
SELECT 
  company_name,
  user_type,
  updated_at
FROM profiles
WHERE user_id = 'UUID_COPIADO';
*/
