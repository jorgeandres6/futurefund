# Análisis Automático para Usuarios Premium

## Descripción

Los usuarios con plan **Premium** ahora tienen acceso a análisis automático del proceso de aplicación para todas las fuentes de financiamiento encontradas durante la búsqueda, sin necesidad de hacer clic en el botón "Analizar Proceso de Aplicación" en cada carta de fondo.

## Características

### Análisis Automático
- ✅ Se ejecuta automáticamente después de completar las 4 fases de búsqueda
- ✅ Solo analiza fondos nuevos que no tienen análisis previo
- ✅ Muestra progreso en tiempo real: "🔍 Analizando X/Total: [Nombre del Fondo]..."
- ✅ Todos los análisis se almacenan automáticamente en Supabase
- ✅ No requiere intervención manual del usuario

### Información Extraída
Para cada fondo de financiamiento, el análisis automático obtiene:

1. **Elegibilidad**: Si la organización (Ecuador/Latinoamérica) es elegible
2. **Requisitos**: Lista de requisitos clave para aplicar
3. **Pasos de Aplicación**: Secuencia detallada del proceso
4. **Fechas Clave**: Deadlines y ciclos de financiamiento
5. **Link Directo**: URL específica para iniciar la aplicación
6. **Correos de Contacto**: Emails reales extraídos del sitio web

## Flujo de Ejecución

### Fase 5: Análisis Automático (Solo Premium)
```
Fase 1: Descubrimiento Global
Fase 2: Expansión Global
Fase 3: Descubrimiento Ecuador
Fase 4: Expansión Ecuador
Fase 5: 🔍 Análisis Automático (PREMIUM)
  └─> Analiza cada fondo sin análisis previo
  └─> Guarda resultados en Supabase
  └─> Actualiza UI con datos completos
```

## Diferencias por Tipo de Usuario

### Demo / Basic
- ✅ Búsqueda de fondos completa (4 fases)
- ✅ Visualización de resultados
- ❌ Análisis manual (botón en cada carta)
- ❌ Análisis automático no disponible

### Premium
- ✅ Búsqueda de fondos completa (4 fases)
- ✅ Visualización de resultados
- ✅ **Análisis automático de todos los fondos**
- ✅ Datos guardados automáticamente en BD
- ✅ Acceso inmediato a información de contacto

## Configuración de Usuario Premium

Para configurar un usuario como Premium, actualiza el campo `user_type` en la tabla `profiles`:

```sql
UPDATE profiles
SET user_type = 'premium'
WHERE user_id = 'UUID_DEL_USUARIO';
```

O desde la interfaz de administración de Supabase:
1. Ir a Table Editor → profiles
2. Buscar al usuario por `company_name` o `user_id`
3. Editar el campo `user_type` y cambiar a `premium`

## Implementación Técnica

### Archivos Modificados

1. **services/webReviewService.ts**
   - Nueva función: `autoAnalyzeFundsForPremium()`
   - Procesa fondos en lote con control de progreso
   - Maneja errores individuales sin interrumpir el proceso

2. **services/supabaseService.ts**
   - Nueva función: `saveFundAnalysis()`
   - Guarda análisis individual en la base de datos

3. **App.tsx**
   - Fase 5 integrada después de la búsqueda
   - Verifica `userType === 'premium'` antes de ejecutar
   - Actualiza estado y UI con análisis completos

### Ejemplo de Uso

```typescript
// Verificar si el usuario es premium
if (profile?.userType === 'premium') {
  // Ejecutar análisis automático
  const analysisResults = await autoAnalyzeFundsForPremium(
    allCurrentFunds,
    (current, total, fundName) => {
      // Mostrar progreso
      setLoadingMessage(`🔍 Analizando ${current}/${total}: ${fundName}...`);
    },
    signal
  );
  
  // Actualizar fondos con análisis
  // Guardar en Supabase automáticamente
}
```

## Beneficios

### Para el Usuario Premium
- ⚡ Ahorra tiempo significativo (no necesita hacer clic en cada fondo)
- 📊 Datos completos disponibles inmediatamente después de la búsqueda
- 💾 Todo almacenado automáticamente en la nube
- 📧 Acceso directo a información de contacto de todos los fondos

### Para el Negocio
- 💎 Valor agregado claro para el plan premium
- 🎯 Diferenciación entre planes de usuario
- 📈 Incentivo para upgrade de plan

## Limitaciones y Consideraciones

1. **API Rate Limits**: Se incluye pausa de 1 segundo entre análisis para evitar saturar la API
2. **Tiempo de Ejecución**: Depende del número de fondos encontrados (aproximadamente 1-2 seg por fondo)
3. **Cancelación**: El usuario puede detener la búsqueda en cualquier momento usando el botón de detener
4. **Fondos sin Información**: Si un fondo no tiene información clara, se registra pero no se interrumpe el proceso

## Mensaje de Estado

Durante el análisis automático, el usuario verá:
```
🔍 Analizando proceso de aplicación automáticamente (Premium)...
🔍 Analizando 3/15: Green Climate Fund...
```

## Base de Datos

Todos los análisis se almacenan en la tabla `funds` con los siguientes campos:
- `es_elegible` (TEXT)
- `resumen_requisitos` (TEXT[])
- `pasos_aplicacion` (TEXT[])
- `fechas_clave` (TEXT)
- `link_directo_aplicacion` (TEXT)
- `contact_emails` (TEXT[])

## Soporte y Mantenimiento

Para verificar el estado de análisis de un usuario:
```sql
SELECT 
  nombre_fondo,
  es_elegible,
  ARRAY_LENGTH(contact_emails, 1) as num_emails,
  link_directo_aplicacion
FROM funds
WHERE user_id = 'UUID_DEL_USUARIO'
AND es_elegible IS NOT NULL;
```
