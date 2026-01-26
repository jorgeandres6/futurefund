# ✅ Implementación Completa: Arquitectura Paralela Frontend + N8N

## 🎯 Problema Resuelto

Frontend en Vercel y N8N funcionan como **procesos paralelos e independientes** que realizan la misma tarea: buscar fondos, analizarlos y poblar Supabase. Usuario puede usar uno, otro, o ambos.

## 🏗️ Arquitectura Paralela

```
┌──────────────┐         ┌──────────────┐
│   Frontend   │         │     N8N      │
│   (Vercel)   │         │  Workflow    │
│              │         │              │
│  Búsqueda    │         │  Búsqueda    │
│   Manual     │         │ Automática   │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │   HTTP Requests        │   HTTP Requests
       │                        │
       └────────┬───────────────┘
                │
                ▼
        ┌───────────────┐
        │  API SERVER   │
        │  (Express)    │
        │               │
        │  • Búsqueda   │
        │  • Análisis   │
        │  • Jobs       │
        └───────┬───────┘
                │
                │ SQL
                ▼
        ┌───────────────┐
        │   SUPABASE    │
        │               │
        │ • funds       │
        │ • search_jobs │
        │ • users       │
        └───────────────┘
```

**Ventajas:**
- ✅ Frontend y N8N no dependen uno del otro
- ✅ Un solo API Server para ambos
- ✅ Misma lógica de búsqueda y análisis
- ✅ UPSERT evita duplicados
- ✅ Logs centralizados

## 📦 Archivos Creados

### 1. API Server (Node.js + Express)
- **[server/index.js](server/index.js)** - Servidor principal con endpoints REST
- **[server/searchEngine.js](server/searchEngine.js)** - Módulo de búsquedas con Gemini
- **[server/analyzer.js](server/analyzer.js)** - Módulo de análisis de fondos
- **[server/.env.example](server/.env.example)** - Variables de entorno

**Propósito:** Motor compartido usado por frontend y N8N.

### 2. Migraciones SQL
- **[migration-search-jobs.sql](migration-search-jobs.sql)** - Tabla para trackear jobs
- **[migration-add-unique-constraint.sql](migration-add-unique-constraint.sql)** - Restricción única (UPSERT)

**Propósito:** Evitar duplicados cuando ambos procesos escriben en Supabase.

### 3. Servicios Frontend (Opcional)
- **[services/jobService.ts](services/jobService.ts)** - API para monitorear jobs desde el frontend

**Propósito:** Permite al frontend ver jobs ejecutados por N8N.

### 4. Tipos
- **[types/database.ts](types/database.ts)** - Actualizado con tipo `search_jobs`

### 5. Documentación
- **[N8N_INTEGRATION_GUIDE.md](N8N_INTEGRATION_GUIDE.md)** - Guía completa de integración
- **[N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md)** - Paso a paso del workflow
- **[QUICKSTART_N8N.md](QUICKSTART_N8N.md)** - Inicio rápido
- **[ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)** - Diagramas completos

## 🚀 Inicio Rápido (4 Pasos)

### Paso 1: Instalar y Configurar API Server

```bash
cd server

# Instalar dependencias
npm install express cors dotenv @supabase/supabase-js @google/genai

# Configurar .env
cp .env.example .env
# Editar con tus credenciales

# Iniciar servidor
npm run dev
```

El servidor debe estar en `http://localhost:3001`

### Paso 2: Ejecutar Migraciones en Supabase

Ir al SQL Editor de Supabase y ejecutar:

```sql
-- 1. Restricción única para fondos
ALTER TABLE funds 
ADD CONSTRAINT funds_user_fund_unique 
UNIQUE (user_id, nombre_fondo);

-- 2. Tabla de jobs (ejecutar todo el archivo migration-search-jobs.sql)
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
-- ... resto del archivo
```

### Paso 3: Configurar n8n

#### Opción A: n8n Cloud
1. Crear cuenta en n8n.io
2. Ir a Settings → Variables
3. Agregar: `API_SERVER_URL = http://your-server-ip:3001`

#### Opción B: n8n Self-Hosted
```bash
docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
```

### Paso 4: Crear Workflow en n8n

Ver guía completaHTTP GET → /api/users/premium
│   Users     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Loop Users  │  (Split in batches)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Create Job  │  HTTP POST → /api/jobs/create
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Execute Job  │  HTTP POST → /api/jobs/execute
┌─────────────┐
│Get Premium  │  (Query Supabase profiles)
│   Users     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Loop Users  │  (Split in batches)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Create Job  │  (Insert search_jobs)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Execute Job  │  (Call Edge Function)
└─────────────┘
```

#### Nodo 1: Schedule Trigger
```json
{
  "cronExpression": "0 */4 * * *",
  "triggerTimes": {
    "mode": "cronExpression"
  }
}
```

#### Nodo 2: HTTP Request - Get Premium Users
```
Method: GET
URL: {{$env.SUPABASE_URL}}/rest/v1/profiles?user_type=eq.premium&select=user_id,company_name
Headers:
  - apikey: {{$env.SUPABASE_ANON_KEY}}
  - Authorization: Bearer {{$env.SUPABASE_SERVICE_KEY}}
```

#### Nodo 3: HTTP Request - Create Job
```
Method: POST
URL: {{$env.SUPABASE_URL}}/rest/v1/search_jobs
Headers:
  - apikey: {{$env.SUPABASE_ANON_KEY}}
  - Authorization: Bearer {{$env.SUPABASE_SERVICE_KEY}}
  - Content-Type: application/json
  - Prefer: return=representation
Body:
{
  "user_id": "{{$json.user_id}}",
  "status": "pending",
  "auto_analyze": true
}
```

### Endpoints HTTP

El API server expone:

- `GET /health` - Health check
- `GET /api/users/premium` - Lista de usuarios premium
- `POST /api/jobs/create` - Crear nuevo job
- `POST /api/jobs/execute` - Ejecutar job (async)
- `GET /api/jobs/:jobId` - Estado del job

Ver [API_SERVER_README.md](API_SERVER_README.md) para detalles.

## 📊 Flujo Completo: Procesos Paralelos

### Proceso 1: Frontend (Manual)
```
Usuario → Click "Buscar" → API Server
   ↓
API Server ejecuta:
   - Fase 1: Búsqueda global con Gemini
   - Fase 2: Búsqueda Ecuador con Gemini
   - Fase 3: Análisis automático (premium)
   ↓
API Server guarda fondos en Supabase (UPSERT)
   ↓
Usuario ve resultados en tiempo real ✅
```

### Proceso 2: N8N (Automático)
```
N8N Schedule (cada 4 horas)
   ↓
HTTP GET → API Server → Detecta usuarios premium
   ↓
HTTP POST → API Server → Crea job en search_jobs
   ↓
HTTP POST → API Server → Ejecuta búsqueda (async)
   ↓
API Server ejecuta:
   - Fase 1: Búsqueda global con Gemini
   - Fase 2: Búsqueda Ecuador con Gemini
   - Fase 3: Análisis automático (premium)
   ↓
API Server guarda fondos en Supabase (UPSERT)
   ↓
API Server actualiza job status → completed
   ↓
Usuario abre FutureFund → Ve resultados automáticos ✅
```

**Ambos procesos usan exactamente la misma lógica en el API Server.**

## 🎨 Integrar en la UI

### Agregar en App.tsx

```typescript
import { getUserSearchJobs, createSearchJob } from './services/jobService';

const [searchJobs, setSearchJobs] = useState<SearchJob[]>([]);
const [latestJob, setLatestJob] = useState<SearchJob | null>(null);

// Cargar jobs al iniciar
useEffect(() => {
  if (userId) {
    getUserSearchJobs(userId).then(jobs => {
      setSearchJobs(jobs);
      if (jobs.length > 0) {
        setLatestJob(jobs[0]);
      }
    });
  }
}, [userId]);

// Subscripción a cambios en tiempo real
useEffect(() => {
  if (!userId) return;

  const subscription = supabase
    .channel('search_jobs_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'search_jobs',
        filter: `user_id=eq.${userId}`
      },
      (payload: any) => {
        const updatedJob = payload.new as SearchJob;
        setSearchJobs(prev => 
          prev.map(j => j.id === updatedJob.id ? updatedJob : j)
        );
        if (updatedJob.id === latestJob?.id) {
          setLatestJob(updatedJob);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [userId, latestJob?.id]);
```

### Mostrar Progreso en Dashboard

```tsx
{latestJob && latestJob.status === 'running' && (
  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-white font-semibold">
        🔍 Búsqueda en progreso
      </h3>
      <span className="text-blue-400 text-sm">
        {latestJob.progress}%
      </span>
    </div>
    
    <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
      <div 
        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${latestJob.progress}%` }}
      />
    </div>
    
    <p className="text-gray-300 text-sm">
      {latestJob.current_phase || 'Procesando...'}
    </p>
    
    <div className="flex gap-4 text-xs text-gray-400 mt-2">
      <span>Fondos encontrados: {latestJob.funds_found}</span>
      {latestJob.auto_analyze && (
        <span>Analizados: {latestJob.funds_analyzed}</span>
      )}
    </div>
  </div>
)}
```

### Botón Manual para Iniciar Búsqueda

```tsx
const handleStartBackgroundSearch = async () => {
  if (!userId) return;
  
  try {
    const job = await createSearchJob(
      userId,
      user?.profile?.userType === 'premium'
    );
    
    setSearchJobs([job, ...searchJobs]);
    setLatestJob(job);
    
    // Opcional: Ejecutar inmediatamente
    // await executeSearchJob(job.id);
  } catch (error) {
    console.error('Error creating job:', error);
  }
};

// En el UI
<button
  onClick={handleStartBackgroundSearch}
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
>
  🚀 Iniciar Búsqueda en Segundo Plano
</button>
```

## 🔒 Seguridad

✅ **RLS Policies**: Configuradas en la migración SQL
✅ **User Isolation**: Cada job está asociado a un user_id
✅ **Service Key**: Solo se usa en n8n (backend)
✅ **Webhooks**: Opcional con validación

## 📈 Configuración Recomendada

### Por Tipo de Usuario

| User Type | Frecuencia | Auto-analyze |
|-----------|-----------|--------------|
| Demo      | Manual    | No           |
| Basic     | Semanal   | No           |
| Premium   | Diario    | Sí           |

### En n8n

Agregar nodo condicional después de "Get Users":

```javascript
// En un nodo "Function"
if ($json.user_type === 'premium') {
  return { autoAnalyze: true, schedule: 'daily' };
} else if ($json.user_type === 'basic') {
  return { autoAnalyze: false, schedule: 'weekly' };
} else {
  return null; // Skip demo users
}
```

## 🎉 Beneficios de la Arquitectura Paralela

1. ✅ **Independencia Total**: Frontend y N8N no dependen uno del otro
2. ✅ **Sin Edge Functions**: Todo mediante API REST estándar
3. ✅ **HTTP Simple**: Fácil de debuggear y testear
4. ✅ **Control Total**: Acceso completo al servidor
5. ✅ **Logs Completos**: Ver todo en tiempo real
6. ✅ **Misma Lógica**: Un solo código, dos puntos de entrada
7. ✅ **UPSERT**: Evita duplicados entre ambos procesos
8. ✅ **Flexible**: Fácil de modificar y extender
9. ✅ **Escalable**: Cada proceso escala por separado

## 🔀 Comparación: Frontend vs N8N

| Aspecto | Frontend | N8N |
|---------|----------|-----|
| **Trigger** | Usuario manual | Schedule automático |
| **API Server** | ✅ Mismo | ✅ Mismo |
| **Lógica búsqueda** | ✅ Misma | ✅ Misma |
| **Base de datos** | ✅ Misma | ✅ Misma |
| **Frecuencia** | A demanda | Cada 4 horas |
| **Requiere usuario** | Sí | No |

**Resultado:** Ambos procesos coexisten sin interferencia.

## 🚀 Próximos Pasos

1. ⬜ Instalar y configurar el API server
2. ⬜ Ejecutar migraciones SQL en Supabase
3. ⬜ Crear workflow en N8N con los nodos HTTP
4. ⬜ Activar el workflow
5. ⬜ Probar ejecución manual
6. ⬜ Verificar que los fondos se guardan en Supabase
7. ⬜ (Opcional) Integrar UI de progreso en el Dashboard

## 📞 Soporte
- **Setup API Server**: [API_SERVER_README.md](API_SERVER_README.md)
- **Workflow N8N**: [N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md)
- **Arquitectura**: [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)
- **Quickstart**: [QUICKSTART_N8N.md](QUICKSTART_N8N.md)

---

**¡Frontend y N8N trabajando en paralelo! Dos caminos, un destino.** 🎊
