# Análisis Automático para Usuarios Premium

## Descripción

Los usuarios con plan **Premium** ahora tienen acceso a análisis automático del proceso de aplicación que se ejecuta **en tiempo real** para cada fuente de financiamiento encontrada durante la búsqueda, sin necesidad de hacer clic en el botón "Analizar Proceso de Aplicación" en cada carta de fondo.

## Características

### Análisis Automático en Tiempo Real
- ✅ Se ejecuta automáticamente **para cada fondo nuevo** en el momento que se encuentra
- ✅ No espera a que finalicen las 4 fases de búsqueda
- ✅ Solo analiza fondos nuevos que no tienen análisis previo
- ✅ Muestra progreso en tiempo real: "🔍 Analizando: [Nombre del Fondo]..."
- ✅ Todos los análisis se almacenan automáticamente en Supabase
- ✅ No requiere intervención manual del usuario
- ✅ Procesamiento paralelo: la búsqueda continúa mientras se analizan fondos previos

### Información Extraída
Para cada fondo de financiamiento, el análisis automático obtiene:

1. **Elegibilidad**: Si la organización (Ecuador/Latinoamérica) es elegible
2. **Requisitos**: Lista de requisitos clave para aplicar
3. **Pasos de Aplicación**: Secuencia detallada del proceso
4. **Fechas Clave**: Deadlines y ciclos de financiamiento
5. **Link Directo**: URL específica para iniciar la aplicación
6. **Correos de Contacto**: Emails reales extraídos del sitio web

## Flujo de Ejecución

### Análisis en Tiempo Real (Solo Premium)
```
Fase 1: Descubrimiento Global
  └─> Se encuentran 3 fondos
  └─> 🔍 Analizando: Fondo A...
  └─> 🔍 Analizando: Fondo B...
  └─> 🔍 Analizando: Fondo C...
  └─> Guarda resultados en Supabase
  
 Fase 2: Expansión Global
  └─> Se encuentran 5 fondos nuevos
  └─> 🔍 Analizando: Fondo D...
  └─> (Análisis continúa en paralelo)
  
 Fase 3: Descubrimiento Ecuador
  └─> Se encuentran fondos nuevos
  └─> 🔍 Análisis automático...
  
Fase 4: Expansión Ecuador
  └─> Finaliza búsqueda
  └─> Análisis en segundo plano continúa
```

## Diferencias por Tipo de Usuario

### Demo / Basic
- ✅ Búsqueda de fondos completa (4 fases)
- ✅ Visualización de resultados
- ✅ Análisis manual (botón en cada carta)
- ❌ Análisis automático no disponible

### Premium
- ✅ Búsqueda de fondos completa (4 fases)
- ✅ Visualización de resultados
- ✅ **Análisis automático en tiempo real para cada fondo nuevo**
- ✅ **Procesamiento paralelo: búsqueda + análisis simultáneos**
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
   - Función: `analyzeFundApplication()` usada individualmente
   - Procesa cada fondo en el momento que se encuentra

2. **services/supabaseService.ts**
   - Función: `saveFundAnalysis()`
   - Guarda análisis individual en la base de datos

3. **App.tsx**
   - Función `addFunds()` modificada para ser `async`
   - Verifica `userType === 'premium'` antes de analizar
   - Ejecuta análisis en segundo plano con IIFE async
   - No bloquea la búsqueda principal
   - Actualiza UI en tiempo real conforme se completan los análisis

### Ejemplo de Uso

```typescript
// Dentro de addFunds (async)
if (user?.profile?.userType === 'premium' && newFunds.length > 0) {
  const fundsToAnalyze = newFunds.filter(f => !f.analisis_aplicacion);
  
  if (fundsToAnalyze.length > 0) {
    // Ejecutar análisis en segundo plano (no bloquea)
    (async () => {
      for (const fund of fundsToAnalyze) {
        setLoadingMessage(`🔍 Analizando: ${fund.nombre_fondo}...`);
        
        const analysis = await analyzeFundApplication(
          fund.nombre_fondo, 
          fund.url_fuente
        );
        
        if (analysis) {
          // Actualizar estado
          setFunds(currentFunds => 
            currentFunds.map(f => 
              f.nombre_fondo === fund.nombre_fondo 
                ? { ...f, analisis_aplicacion: analysis }
                : f
            )
          );
          
          // Guardar en Supabase
          await saveFundAnalysis(userId, fund.nombre_fondo, analysis);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    })();
  }
}
```

## Beneficios

### Para el Usuario Premium
- ⚡ Ahorra tiempo significativo (no necesita hacer clic en cada fondo)
- 📈 **Datos disponibles en tiempo real** conforme se encuentran fondos
- 🚀 **No espera al final de la búsqueda** - acceso inmediato a análisis
- 💾 Todo almacenado automáticamente en la nube
- 📧 Acceso directo a información de contacto
- 🔄 Procesamiento paralelo: búsqueda continúa mientras se analizan fondos

### Para el Negocio
- 💎 Valor agregado claro para el plan premium
- 🎯 Diferenciación entre planes de usuario
- 📈 Incentivo para upgrade de plan

## Limitaciones y Consideraciones

1. **API Rate Limits**: Se incluye pausa de 1 segundo entre análisis para evitar saturar la API
2. **Tiempo de Ejecución**: Aproximadamente 1-2 seg por fondo (procesamiento en segundo plano)
3. **Procesamiento Asíncrono**: Los análisis continúan en segundo plano incluso después de completar las 4 fases
4. **Cancelación**: El usuario puede detener la búsqueda en cualquier momento; análisis completados se conservan
5. **Fondos sin Información**: Si un fondo no tiene información clara, se registra pero no se interrumpe el proceso
6. **Orden no Garantizado**: Los análisis se completan en el orden que se encuentran los fondos

## Mensaje de Estado

Durante el análisis automático, el usuario verá mensajes en tiempo real:
```
Fase 1/4: Analizando oportunidades globales...
🔍 Analizando: Green Climate Fund...
Fase 2/4: Profundizando en fondos de inversión ODS...
🔍 Analizando: Global Environment Facility...
🔍 Analizando: Adaptation Fund...
```

Los mensajes de análisis aparecen **entremezclados** con las fases de búsqueda, indicando procesamiento paralelo.

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
