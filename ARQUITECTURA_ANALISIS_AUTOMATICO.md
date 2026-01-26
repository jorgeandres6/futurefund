# 📋 RESUMEN: Arquitectura Final - Análisis Automático en N8N

## 🎯 Decisión Final del Usuario

> "Movamos todo el tema del análisis automático a N8N, dejando en el frontend solo análisis cuando se presione el botón de analizar"

## ✨ Nueva División de Responsabilidades

### Frontend (Vercel) - MANUAL
✅ **Búsqueda Manual:**
- Usuario presiona botón "Buscar"
- Gemini AI busca fondos
- Inserta en Supabase **SIN análisis** (`analyzed_at = NULL`)

✅ **Análisis Manual:**
- Usuario presiona botón "Analizar" en un fondo específico
- Gemini AI analiza ese fondo
- Actualiza `analisis_gemini` y `analyzed_at`

❌ **NO hace:**
- Análisis automático de fondos

---

### N8N - AUTOMÁTICO

#### Workflow 1: Búsqueda (cada 4 horas)
✅ **Búsqueda Automática:**
- Obtiene usuarios premium
- Busca fondos con Gemini AI
- Inserta en Supabase **SIN análisis** (`analyzed_at = NULL`)

#### Workflow 2: Análisis (cada 1 hora)
✅ **Análisis Automático de TODOS los fondos pendientes:**
- Query: `SELECT * FROM funds WHERE analyzed_at IS NULL AND user.premium = true`
- Analiza fondos de **ambas fuentes** (Frontend + N8N)
- Actualiza con análisis y marca `analyzed_at = NOW()`

---

## 🔄 Flujo Completo

### Escenario 1: Usuario Premium busca manualmente

```
1. Usuario → Frontend → "Buscar"
2. Frontend → Gemini AI → Buscar fondos
3. Frontend → Supabase → INSERT fondos (analyzed_at = NULL)
4. N8N Workflow 2 (1h después) → Detecta fondos sin analizar
5. N8N → Gemini AI → Analiza fondos
6. N8N → Supabase → UPDATE con análisis (analyzed_at = NOW())
7. Frontend → Realtime subscription → Muestra análisis
```

### Escenario 2: N8N busca automáticamente

```
1. N8N Workflow 1 (cada 4h) → Buscar fondos premium
2. N8N → Supabase → INSERT fondos (analyzed_at = NULL)
3. N8N Workflow 2 (1h después) → Detecta fondos sin analizar
4. N8N → Gemini AI → Analiza fondos
5. N8N → Supabase → UPDATE con análisis
6. Usuario ve fondos y análisis cuando entra
```

### Escenario 3: Usuario quiere análisis inmediato

```
1. Usuario ve fondo sin analizar
2. Usuario → Presiona botón "Analizar"
3. Frontend → Gemini AI → Análisis inmediato
4. Frontend → Supabase → UPDATE con análisis
5. Frontend → Muestra análisis al instante
```

---

## 🗄️ Cambios en Base de Datos

### Tabla `funds` - Nuevo campo

```sql
ALTER TABLE funds 
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_funds_analyzed_at 
ON funds(analyzed_at) 
WHERE analyzed_at IS NULL;
```

**Estados:**
- `analyzed_at = NULL` → Pendiente de análisis
- `analyzed_at = <timestamp>` → Ya analizado

---

## 📦 Archivos Actualizados

### Documentación Principal
- ✅ **ARCHITECTURE_DIAGRAM.md** - Diagrama con dos workflows N8N
- ✅ **N8N_SIN_API_SERVER.md** - Dos workflows completos
- ✅ **QUICKSTART_N8N.md** - Setup de ambos workflows
- ✅ **migration-add-analyzed-at.sql** - Nueva migración

### Pendientes de Actualizar
- ⬜ **N8N_INTEGRATION_GUIDE.md** - Detalles técnicos
- ⬜ **N8N_WORKFLOW_GUIDE.md** - Guía completa
- ⬜ **RESUMEN_N8N_INTEGRATION.md** - Resumen ejecutivo
- ⬜ **Frontend components** - Botón de análisis manual

---

## 🚀 Ventajas de Esta Arquitectura

✅ **Separación clara de responsabilidades**
- Frontend = Manual (control del usuario)
- N8N = Automático (sin intervención)

✅ **Análisis centralizado**
- Un solo lugar analiza fondos (N8N)
- Evita duplicación de lógica
- Más fácil de mantener

✅ **Flexibilidad para el usuario**
- Usuario premium puede esperar análisis automático
- O puede analizar manualmente cuando quiera
- Mejor UX

✅ **Eficiencia de recursos**
- N8N procesa en lotes (10 fondos/hora)
- Evita saturar Gemini AI
- Rate limiting controlado

✅ **Sincronización automática**
- Frontend usa Realtime subscriptions
- Ve actualizaciones cuando N8N termina
- Sin polling manual

---

## ⚙️ Configuración N8N

### Workflow 1: Búsqueda (cada 4h)
```
Cron: 0 */4 * * *
Acciones:
  1. Get Premium Users
  2. Loop → Buscar fondos con Gemini
  3. INSERT en Supabase (SIN análisis)
```

### Workflow 2: Análisis (cada 1h)
```
Cron: 0 * * * *
Acciones:
  1. Get Fondos WHERE analyzed_at IS NULL (limit 10)
  2. Loop → Analizar con Gemini
  3. UPDATE en Supabase (con analyzed_at)
```

---

## 🔐 Variables de Entorno N8N

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...  # Para write operations
GEMINI_API_KEY=AIzaSyxxx...
GOOGLE_CSE_ID=your-cse-id
```

---

## 🎨 Cambios en Frontend

### geminiService.ts
```typescript
// Mantener función de análisis para uso manual
export async function analyzeFund(fund: Fund): Promise<string> {
  // Llamar Gemini AI
  // Retornar análisis
}
```

### Dashboard.tsx
```tsx
// Agregar botón "Analizar" en cada FundCard
<button onClick={() => handleManualAnalysis(fund.id)}>
  Analizar Ahora
</button>

// Handler
const handleManualAnalysis = async (fundId) => {
  const analysis = await analyzeFund(fund);
  await supabase
    .from('funds')
    .update({ 
      analisis_gemini: analysis,
      analyzed_at: new Date().toISOString()
    })
    .eq('id', fundId);
};
```

---

## 📊 Monitoreo

### Queries útiles:

```sql
-- Ver fondos pendientes de análisis
SELECT COUNT(*) as pending
FROM funds 
WHERE analyzed_at IS NULL;

-- Ver fondos analizados hoy
SELECT COUNT(*) as analyzed_today
FROM funds 
WHERE DATE(analyzed_at) = CURRENT_DATE;

-- Ver estado de jobs N8N
SELECT status, COUNT(*) 
FROM search_jobs 
GROUP BY status;
```

---

## ✅ Checklist de Implementación

### Base de Datos
- [x] Ejecutar `migration-add-analyzed-at.sql`
- [x] Verificar índice en `analyzed_at`
- [x] Probar query de fondos pendientes

### N8N
- [ ] Crear Workflow 1 (Búsqueda)
- [ ] Crear Workflow 2 (Análisis)
- [ ] Configurar variables de entorno
- [ ] Probar workflows manualmente
- [ ] Activar schedules

### Frontend
- [ ] Agregar botón "Analizar" en FundCard
- [ ] Implementar handler de análisis manual
- [ ] Configurar Realtime subscription en `analyzed_at`
- [ ] Mostrar estado "Analizando..." mientras espera
- [ ] Probar análisis manual

### Testing
- [ ] Usuario busca → Verificar INSERT sin análisis
- [ ] N8N Workflow 2 → Verificar análisis automático
- [ ] Usuario presiona "Analizar" → Verificar análisis manual
- [ ] Verificar no duplicados (constraint unique)
- [ ] Verificar Realtime updates

---

## 🎯 Próximos Pasos

1. **Implementar migración SQL** → `migration-add-analyzed-at.sql`
2. **Configurar N8N workflows** → Ver `N8N_SIN_API_SERVER.md`
3. **Actualizar Frontend** → Agregar botón análisis manual
4. **Testing completo** → Probar todos los escenarios
5. **Documentar** → Actualizar archivos pendientes

---

## 📚 Referencias

- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Diagrama completo
- [N8N_SIN_API_SERVER.md](./N8N_SIN_API_SERVER.md) - Workflows detallados
- [QUICKSTART_N8N.md](./QUICKSTART_N8N.md) - Setup rápido
- [migration-add-analyzed-at.sql](./migration-add-analyzed-at.sql) - Migración SQL
