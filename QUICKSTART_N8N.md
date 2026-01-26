# 🚀 INICIO RÁPIDO: N8N Sin API Server

## Concepto

N8N y Frontend son **procesos paralelos e independientes** que se conectan **directamente a Supabase**. No hay API Server intermedio.

```
Frontend (Manual) ─────┐
  • Búsqueda manual    │
  • Análisis manual    ├──→ Supabase ──→ Gemini AI
                       │
N8N (Automático) ──────┘
  • Búsqueda auto (4h)
  • Análisis auto (1h)
```

**División de Responsabilidades:**
- Frontend: Inserta fondos SIN análisis automático
- N8N: Analiza TODOS los fondos pendientes (de ambas fuentes)

## Setup en 4 Pasos

### 1️⃣ Ejecutar Migraciones SQL

En Supabase SQL Editor:

```sql
-- Restricción única (UPSERT para evitar duplicados)
ALTER TABLE funds 
ADD CONSTRAINT funds_user_fund_unique 
UNIQUE (user_id, nombre_fondo);

-- Campo analyzed_at para tracking de análisis
ALTER TABLE funds 
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_funds_analyzed_at 
ON funds(analyzed_at) 
WHERE analyzed_at IS NULL;

-- Tabla de jobs
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS search_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status job_status DEFAULT 'pending' NOT NULL,
  progress INTEGER DEFAULT 0,
  current_phase TEXT,
  error_message TEXT,
  funds_found INTEGER DEFAULT 0,
  funds_analyzed INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auto_analyze BOOLEAN DEFAULT false,
  profile_snapshot JSONB,
  result_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_search_jobs_user_id ON search_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status);
```

### 2️⃣ Obtener API Keys

1. **Supabase:**
   - URL: `https://your-project.supabase.co`
   - Anon Key: Dashboard → Settings → API
   - Service Role Key: Dashboard → Settings → API (⚠️ nunca exponer al cliente)

2. **Gemini AI:**
   - https://makersuite.google.com/app/apikey
   - Crear API Key

3. **Google Custom Search:**
   - https://programmablesearchengine.google.com/
   - Crear Search Engine → Obtener ID

### 3️⃣ Configurar N8N - Workflow 1: Búsqueda

1. **Crear Workflow**
   - Nombre: "FutureFund - Auto Search (4h)"

2. **Variables de Entorno** (Settings → Variables):
   ```
   SUPABASE_URL = https://your-project.supabase.co
   SUPABASE_ANON_KEY = eyJxxx...
   SUPABASE_SERVICE_KEY = eyJxxx...
   GEMINI_API_KEY = AIzaSyxxx...
   GOOGLE_CSE_ID = your-cse-id
   ```

3. **Importar JSON del Workflow:**

Ver `N8N_SIN_API_SERVER.md` para el workflow completo de búsqueda.

**Resumen de nodos:**
- Schedule Trigger (cada 4h)
- Get Premium Users
- Loop Users
- Create Job
- Gemini AI Search
- Parse Funds
- INSERT Funds (SIN análisis - `analyzed_at = NULL`)
- Update Job Status

### 4️⃣ Configurar N8N - Workflow 2: Análisis

1. **Crear Segundo Workflow**
   - Nombre: "FutureFund - Auto Analysis (1h)"

2. **Importar JSON del Workflow:**

Ver `N8N_SIN_API_SERVER.md` para el workflow completo de análisis.

**Resumen de nodos:**
- Schedule Trigger (cada 1h)
- Get Unanalyzed Funds (`WHERE analyzed_at IS NULL`)
- IF Has Funds
- Loop Funds
- Gemini AI Analysis
- Parse Analysis
- UPDATE Fund (con `analyzed_at = NOW()`)

---

```json
{
  "name": "FutureFund Auto Search - Direct to Supabase",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{"field": "hours", "hoursInterval": 4}]
        }
      },
      "name": "Schedule Every 4h",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/rest/v1/profiles",
        "queryParameters": {
          "parameters": [
            {
              "name": "user_type",
              "value": "eq.premium"
            },
            {
              "name": "select",
              "value": "user_id,company_name,industry,funding_amount"
            }
          ]
        },
        "options": {
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "={{$env.SUPABASE_ANON_KEY}}"
              },
              {
                "name": "Authorization",
                "value": "=Bearer {{$env.SUPABASE_SERVICE_KEY}}"
              }
            ]
          }
        }
      },
      "name": "Get Premium Users",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300]
    },
    {
      "parameters": {
        "batchSize": 1
      },
      "name": "Loop Users",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/rest/v1/search_jobs",
        "method": "POST",
        "bodyParametersJson": "={\"user_id\": \"{{$json.user_id}}\", \"status\": \"pending\", \"auto_analyze\": true}",
        "options": {
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "={{$env.SUPABASE_ANON_KEY}}"
              },
              {
                "name": "Authorization",
                "value": "=Bearer {{$env.SUPABASE_SERVICE_KEY}}"
              },
              {
                "name": "Prefer",
                "value": "return=representation"
              }
            ]
          }
        }
      },
      "name": "Create Job",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300]
    },
    {
      "parameters": {
        "functionCode": "// Construir query para Gemini\nconst searchQuery = `Encuentra 10 fondos de inversión relevantes para:\nIndustria: ${$json.industry}\nMonto necesario: ${$json.funding_amount}\nRetorna JSON array con: name, manager, amount, description, url`;\n\nreturn {\n  query: searchQuery,\n  jobId: $json.id,\n  userId: $json.user_id\n};"
      },
      "name": "Build Search Query",
      "type": "n8n-nodes-base.function",
      "position": [1050, 300]
    },
    {
      "parameters": {
        "url": "=https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={{$env.GEMINI_API_KEY}}",
        "method": "POST",
        "bodyParametersJson": "={\"contents\": [{\"parts\": [{\"text\": \"{{$json.query}}\"}]}]}"
      },
      "name": "Gemini Search",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1250, 300]
    }
  ],
  "connections": {
    "Schedule Every 4h": {"main": [[{"node": "Get Premium Users"}]]},
    "Get Premium Users": {"main": [[{"node": "Loop Users"}]]},
    "Loop Users": {"main": [[{"node": "Create Job"}]]},
    "Create Job": {"main": [[{"node": "Build Search Query"}]]},
    "Build Search Query": {"main": [[{"node": "Gemini Search"}]]}
  }
}
```

4. **Activar Workflow** ✅

## ✅ Testing

### Test Supabase Connection

```bash
# Get premium users
curl "https://your-project.supabase.co/rest/v1/profiles?user_type=eq.premium" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

### Test Gemini AI

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello Gemini"}]}]}'
```

### Test N8N Workflow

1. En N8N, click **Execute Workflow** (icono play)
2. Ver logs de cada nodo
3. Verificar en Supabase que se crearon jobs y fondos

## 📊 Monitoreo

### Ver Jobs en Supabase

```sql
-- Jobs recientes
SELECT * FROM search_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Fondos insertados hoy
SELECT COUNT(*) FROM funds 
WHERE created_at > NOW() - INTERVAL '1 day';
```

### Ver Execution History en N8N

1. N8N Dashboard → Workflows
2. Click en "FutureFund Auto Search"
3. Tab "Executions"
4. Ver historial completo

## 🔀 Arquitectura Final

```
┌────────────────────────────────────────┐
│          Proceso 1: Frontend           │
│                                        │
│  Usuario → Click "Buscar" → Supabase  │
│                                        │
└───────────────┬────────────────────────┘
                │
                │  REST API Directo
                │
┌───────────────▼────────────────────────┐
│            SUPABASE                    │
│                                        │
│  • search_jobs                         │
│  • funds                               │
│  • users                               │
│                                        │
└───────────────▲────────────────────────┘
                │
                │  REST API Directo
                │
┌───────────────┴────────────────────────┐
│          Proceso 2: N8N                │
│                                        │
│  Schedule → Gemini → UPSERT Supabase  │
│                                        │
└────────────────────────────────────────┘
```

## 🎉 ¡Listo!

Ahora tienes dos formas de poblar la base de datos:

1. **Frontend (Manual)**: Usuario hace click en "Buscar"
2. **N8N (Automático)**: Ejecuta cada 4 horas sin intervención

Ambos escriben directamente en Supabase sin servidor intermedio.

## 📚 Documentación Completa

- [N8N_SIN_API_SERVER.md](N8N_SIN_API_SERVER.md) - Guía detallada nueva
- [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - Diagramas actualizados
