# Arquitectura: Sistema Paralelo - Frontend + N8N (Sin API Server)

## 🎯 Concepto: División de Responsabilidades

**Frontend en Vercel** y **N8N Workflow** funcionan como procesos independientes con responsabilidades específicas:

### Frontend:
- ✅ Búsqueda manual de fondos
- ✅ Guardar fondos en Supabase (sin análisis)
- ✅ Análisis manual cuando el usuario presiona botón "Analizar"

### N8N:
- ✅ Búsqueda automática de fondos (cada 4 horas)
- ✅ Análisis automático de TODOS los fondos sin análisis
- ✅ Incluye fondos del frontend y de N8N

Ambos se conectan **directamente** a Supabase y Gemini AI sin servidor intermedio.

## 🏗️ Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FUTUREFUND WEB APP (Vercel)                       │
│                         [PROCESO 1]                                  │
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Usuario    │    │  Búsqueda    │    │  Dashboard   │          │
│  │   Manual     │───►│   Manual     │───►│   muestra    │          │
│  │   Inicia     │    │ Gemini AI +  │    │   fondos     │          │
│  │              │    │ Google CSE   │    │              │          │
│  │              │    │ (SIN análisis│    │  Botón       │          │
│  │              │    │  automático) │    │ "Analizar"   │          │
│  │              │    │              │    │  (Manual)    │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                   │                   │
│                                                   │ SQL Queries      │
│                                                   │ Directas         │
└───────────────────────────────────────────────────┼──────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                    │
│                      [BASE DE DATOS COMÚN]                           │
│                                                                       │
│  ┌─────────────────────┐    ┌─────────────────────┐                │
│  │   search_jobs       │    │      funds          │                │
│  │  ┌───────────────┐  │    │  ┌──────────────┐  │                │
│  │  │ id            │  │    │  │ nombre_fondo │  │                │
│  │  │ user_id       │  │    │  │ gestor       │  │                │
│  │  │ status        │◄─┼────┼─►│ analisis     │  │                │
│  │  │ progress      │  │    │  │  _gemini     │  │                │
│  │  │ current_phase │  │    │  │ analyzed_at  │  │                │
│  │  │ funds_found   │  │    │  │ (NULL = sin  │  │                │
│  │  │ funds_analyzed│  │    │  │  análisis)   │  │                │
│  │  └───────────────┘  │    │  └──────────────┘  │                │
│  │                     │    │                     │                │
│  │  States:            │    │  UPSERT preserva   │                │
│  │  • pending          │    │  cambios de ambos  │                │
│  │  • running          │    │  procesos          │                │
│  │  • completed        │    │                     │                │
│  │  • failed           │    │  N8N analiza todos │                │
│  │  • cancelled        │    │  donde analyzed_at │                │
│  └─────────────────────┘    │  IS NULL           │                │
│                              │  │ id           │  │                │
│                              │  │ user_type    │  │                │
│                              │  │ (premium/    │  │                │
│                              │  │  basic)      │  │                │
│                              │  └──────────────┘  │                │
│                              └─────────────────────┘                │
│                                                                       │
│  + API REST (Postgres REST API)                                     │
│  + Realtime Subscriptions                                           │
│  + Row Level Security (RLS)                                         │
└───────────┬─────────────────────────────────────┬───────────────────┘
            │                                     │
            │ SQL Queries                         │ SQL Queries
            │ (Proceso Frontend)                  │ (Proceso N8N)
            │                                     │
            │                                     ▼
            │                          ┌─────────────────────────────────────┐
            │                          │  N8N WORKFLOW [PROCESO 2]           │
            │                          │  (Automatización Paralela)          │
            │                          │                                     │
            │                          │  ┌──────────────────────────────┐  │
            │                          │  │  WORKFLOW 1: Búsqueda        │  │
            │                          │  │  [Schedule: Every 4h]        │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Supabase: Get Premium Users│  │
            │                          │  │    (SQL Query)               │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  [Loop Each User]            │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Supabase: Create Job        │  │
            │                          │  │    (INSERT search_jobs)      │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Gemini AI: Búsqueda Fondos │  │
            │                          │  │    + Google CSE              │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Supabase: INSERT Fondos    │  │
            │                          │  │    (SIN análisis automático) │  │
            │                          │  │    analyzed_at = NULL        │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Supabase: Update Job       │  │
            │                          │  │    (status=completed)        │  │
            │                          │  └──────────────────────────────┘  │
            │                          │                                     │
            │                          │  ┌──────────────────────────────┐  │
            │                          │  │  WORKFLOW 2: Análisis        │  │
            │                          │  │  [Schedule: Every 1h]        │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Supabase: Get Fondos       │  │
            │                          │  │  WHERE analyzed_at IS NULL   │  │
            │                          │  │  AND user.premium = true     │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  [Loop Each Fund]            │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Gemini AI: Analizar Fondo  │  │
            │                          │  │         │                    │  │
            │                          │  │         ▼                    │  │
            │                          │  │  Supabase: UPDATE Fund      │  │
            │                          │  │  SET analisis_gemini = ...  │  │
            │                          │  │      analyzed_at = NOW()    │  │
            │                          │  └──────────────────────────────┘  │
            │                          │                                     │
            │                          │  Variables de Entorno:              │
            │                          │  • SUPABASE_URL                     │
            │                          │  • SUPABASE_KEY                     │
            │                          │  • GEMINI_API_KEY                   │
            │                          │  • GOOGLE_CSE_ID                    │
            │                          └─────────────────────────────────────┘
            │                                     │
            │    Mismo resultado                  │    Mismo resultado
            │    en Supabase                      │    en Supabase
            │                                     │
            └─────────────────┬───────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  GEMINI AI      │
                    │  + Google CSE   │
                    │                 │
                    │  • Búsqueda     │
                    │  • Análisis     │
                    └─────────────────┘
```

## 🔀 Procesos Paralelos: Frontend vs N8N

### División de Responsabilidades

**Frontend (Manual - Usuario activo):**
- ✅ Búsqueda manual de fondos (cuando el usuario presiona "Buscar")
- ✅ Análisis manual de un fondo específico (cuando presiona botón "Analizar")
- ❌ NO realiza análisis automático

**N8N (Automático - Sin intervención del usuario):**
- ✅ Búsqueda automática cada 4 horas (solo usuarios premium)
- ✅ Análisis automático cada 1 hora de TODOS los fondos sin analizar
- ✅ Analiza fondos de ambas fuentes (Frontend y N8N)

### Proceso 1: Frontend (Manual)
```
Usuario → Click "Buscar" → Supabase + Gemini AI
   │                            │
   │                            └─ Búsqueda + INSERT (SIN análisis)
   │
   └─ Usuario → Click "Analizar" en un fondo → Gemini AI + UPDATE
```

### Proceso 2: N8N (Automatizado)
```
WORKFLOW 1 (cada 4h):
  Schedule → Get Premium Users → Loop → Buscar fondos → INSERT (SIN análisis)

WORKFLOW 2 (cada 1h):
  Schedule → Get Fondos WHERE analyzed_at IS NULL → Loop → Analizar → UPDATE
     │              │
     │              └─ Búsqueda + Análisis + UPSERT (misma lógica)
     │
     └─ Ejecuta sin intervención del usuario
```

### Ambos procesos:
✅ Conectan directamente a Supabase (REST API)  
✅ Usan Gemini AI para búsqueda y análisis  
✅ Escriben en la misma base de datos  
✅ Usan UPSERT para evitar duplicados  
✅ Respetan los permisos de usuario (RLS)  
❌ No hay API Server intermedio

## 🔄 Flujo de Estados de un Job

```
┌──────────┐
│ PENDING  │  Job creado, esperando ejecución
└────┬─────┘
     │
     │ N8N trigger o manual
     ▼
┌──────────┐
│ RUNNING  │  Ejecutando búsqueda (3 fases)
└────┬─────┘  Progress: 0% → 100%
     │        current_phase actualizado
     │
     ├──► [Error] ──────────┐
     │                      ▼
     │                 ┌──────────┐
     │                 │ FAILED   │
     │                 └──────────┘
     │
     ├──► [Usuario cancela] ─┐
     │                       ▼
     │                 ┌──────────┐
     │                 │CANCELLED │
     │                 └──────────┘
     │
     │ [Success]
     ▼
┌──────────┐
│COMPLETED │  All phases done
└──────────┘  result_summary populated
```

## 📊 Actualización de Progreso

```
Job Progress Timeline:
─────────────────────────────────────────────────────────────►

0%    25%        50%         75%         100%
│     │          │           │            │
Start Phase 1    Phase 2     Phase 3      Complete
      │          │           │            │
      Búsqueda   Búsqueda    Análisis     Done
      Global     Ecuador     (Premium)
      │          │           │            │
      └──────────┴───────────┴────────────┘
              Supabase Updates
         (Realtime propagation)
                  │
                  ▼
              [Web UI]
          Shows progress bar
       "Fase 2/3: Búsqueda Ecuador"
        Fondos encontrados: 45
```

## 🔐 Seguridad y Permisos

```
┌────────────────┐           ┌────────────────┐
│  Frontend      │           │  N8N Worker    │
│  (Browser)     │           │  (Backend)     │
└────────┬───────┘           └────────┬───────┘
         │                            │
         │ Anon Key                   │ Service Role Key
         │ (Limited)                  │ (Full Access)
         ▼                            ▼
    ┌─────────────────────────────────────┐
    │           Supabase                  │
    │                                     │
    │  RLS Policies:                      │
    │  • Users can only see their funds   │
    │  • Users can only see their jobs    │
    │  • N8N can create/update all        │
    │                                     │
    └─────────────────────────────────────┘
```

## 🎯 Casos de Uso

### Caso 1: Usuario Premium con N8N Automático
```
1. Usuario se registra como Premium
2. N8N ejecuta cada 4 horas automáticamente
3. N8N conecta a Supabase → Gemini AI → Guarda fondos
4. Usuario abre la app → Ve fondos ya listos
5. No requiere intervención manual
```

### Caso 2: Usuario hace Búsqueda Manual (Frontend)
```
1. Usuario abre dashboard
2. Click en "Buscar Fondos"
3. Frontend conecta a Supabase → Gemini AI → Guarda fondos
4. Resultados aparecen en tiempo real
5. Misma lógica que N8N
```

### Caso 3: Ambos procesos coexisten
```
1. N8N ejecutó búsqueda a las 10:00 AM (30 fondos)
2. Usuario entra a las 11:00 AM y hace búsqueda manual (20 fondos)
3. UPSERT evita duplicados automáticamente
4. Usuario ve 50 fondos únicos
```

### Caso 4: Usuario Premium apaga N8N
```
1. Usuario desactiva automatización en N8N
2. Sigue usando búsqueda manual del frontend
3. App funciona perfectamente sin N8N
4. N8N es opcional, no requerido
```

## 🛠️ Tecnologías Utilizadas

| Componente | Tecnología | Propósito |
|------------|-----------|-----------|
| Frontend | React + TypeScript | UI, búsqueda manual |
| Backend | Supabase | Database + Auth + Realtime |
| Automation | N8N | Búsqueda automática 24/7 |
| AI | Google Gemini | Búsqueda y análisis |
| Search | Google CSE | Web scraping |
| Deployment | Vercel | Hosting del frontend |

## 🔑 Ventajas de la Arquitectura Sin API Server

✅ **Independencia**: Frontend y N8N no dependen de un servidor  
✅ **Simplicidad**: Menos componentes = menos mantenimiento  
✅ **Sin servidor**: No hay que mantener/hostear API Server  
✅ **Directo**: Conexión directa a Supabase (más rápido)  
✅ **Escalabilidad**: Supabase maneja la carga  
✅ **Misma Lógica**: Workflow duplicado en Frontend y N8N  
✅ **Sin Duplicados**: UPSERT en Supabase evita fondos duplicados  
✅ **Costos**: Sin servidor Express = sin hosting adicional  

## 🔄 Flujo de Datos Unificado

```
┌──────────────┐         ┌──────────────┐
│   FRONTEND   │         │     N8N      │
│   (Manual)   │         │  (Automático)│
└──────┬───────┘         └──────┬───────┘
       │                        │
       │   SQL REST API         │   SQL REST API
       │                        │
       └────────┬───────────────┘
                │
                ▼
        ┌───────────────┐
        │   SUPABASE    │
        │   (Database)  │
        └───────┬───────┘
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
    ┌────────┐      ┌────────┐
    │ Gemini │      │Google  │
    │   AI   │      │  CSE   │
    └────────┘      └────────┘
```

## 📈 Métricas Rastreadas

En `search_jobs.result_summary`:
```json
{
  "total_funds": 47,
  "phases_completed": 3,
  "analyzed_funds": 32,
  "execution_time_seconds": 180,
  "phase_breakdown": {
    "global_discovery": 15,
    "ecuador_discovery": 20,
    "analysis": 32
  }
}
```

## 🎉 Resultado Final

**Dos caminos, un destino:** Usuario puede buscar fondos manualmente o dejar que N8N lo haga automáticamente. Ambos conectan directamente a Supabase y Gemini AI sin servidor intermedio.

**Frontend independiente. N8N opcional. Sin API Server. Funcionalidad completa.** ✨
