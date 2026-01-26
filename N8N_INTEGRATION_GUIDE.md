# Integración N8N: Proceso Paralelo Directo a Supabase

## 🎯 Objetivo

N8N funciona como un **proceso paralelo e independiente** del frontend que:
1. Se conecta directamente a Supabase (sin API Server)
2. Busca fondos con Gemini AI + Google CSE
3. Analiza fondos automáticamente
4. Guarda resultados en Supabase usando UPSERT

Tanto el **frontend en Vercel** como **N8N** pueden ejecutar búsquedas de forma independiente, escribiendo directamente en la misma base de datos.

## 📋 Arquitectura Paralela

```
┌─────────────┐         ┌─────────────┐
│  Frontend   │         │     N8N     │
│   (Vercel)  │         │  Workflow   │
│             │         │             │
│  Búsqueda   │         │  Búsqueda   │
│   Manual    │         │ Automática  │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │   SQL REST API        │   SQL REST API
       │   (Directo)           │   (Directo)
       │                       │
       └───────────┬───────────┘
                   │
                   ▼
         ┌─────────────────┐
         │    SUPABASE     │
         │                 │
         │  • search_jobs  │
         │  • funds        │
         │  • users        │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
    ┌────────┐        ┌────────┐
    │ Gemini │        │Google  │
    │   AI   │        │  CSE   │
    └────────┘        └────────┘
```

### Componentes

1. **Frontend Web App**: Búsqueda manual por el usuario
2. **N8N Workflow**: Búsqueda automática programada
3. **Supabase**: Base de datos común + REST API
4. **Gemini AI**: Búsqueda y análisis inteligente
5. **Google CSE**: Motor de búsqueda personalizado

## 🔧 Setup

### Prerrequisitos

✅ Cuenta en Supabase configurada  
✅ Migraciones SQL ejecutadas en Supabase  
✅ Cuenta en N8N (cloud o self-hosted)  
✅ API Keys: Gemini AI + Google CSE  
✅ Frontend funcionando en Vercel (opcional - N8N es independiente)

**NO SE REQUIERE API SERVER** - N8N se conecta directamente a Supabase.

### 1. Ejecutar Migraciones SQL

En el SQL Editor de Supabase, ejecuta ambos archivos:

#### a) Restricción única para fondos
```sql
-- Archivo: migration-add-unique-constraint.sql
ALTER TABLE funds 
ADD CONSTRAINT funds_user_fund_unique 
UNIQUE (user_id, nombre_fondo);

CREATE INDEX IF NOT EXISTS idx_funds_user_nombre 
ON funds(user_id, nombre_fondo);
```

**Propósito**: Evita duplicados cuando tanto el frontend como N8N guardan fondos.

#### b) Tabla de jobs
```sql
-- Archivo: migration-search-jobs.sql
-- (Ejecutar el contenido completo del archivo)
```

**Propósito**: Rastrea el estado de búsquedas tanto manuales (frontend) como automáticas (N8N).

### 2. Configurar API Server

El API Server es el **motor compartido** que usan tanto el frontend como N8N.

```bash
cd server

# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env
# Editar con tus credenciales
```

**Archivo `server/.env`:**
```env
API_PORT=3001

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

API_KEY=AIzaSyxxx...
SEARCH_ENGINE_ID=your-cse-id
```

**Iniciar servidor:**
```bash
npm run dev
# O con nodemon
npx nodemon index.js
```

### 3. Configurar N8N Workflow

### 3. Configurar N8N Workflow

N8N actuará como un **cliente independiente** del API Server, ejecutando las mismas búsquedas que el frontend pero de forma programada.

#### Workflow: "FutureFund Auto Search"

**Nodos del workflow:**

1. **Schedule Trigger**
   - Tipo: Cron Expression
   - Expresión: `0 */4 * * *` (cada 4 horas)
   - Propósito: Ejecutar búsquedas automáticas para usuarios premium

2. **Get Premium Users** (HTTP Request)
   ```
   Method: GET
   URL: {{$env.API_SERVER_URL}}/api/users/premium
   Headers:
     - Content-Type: application/json
   ```
   **Response ejemplo:**
   ```json
   {
     "users": [
       {
         "user_id": "uuid-123",
         "company_name": "EcoTech",
         "user_type": "premium"
       }
     ]
   }
   ```

3. **Loop Over Users** (Split In Batches)
   - Batch Size: 1
   - Propósito: Procesar un usuario a la vez

4. **Create Search Job** (HTTP Request)
   ```
   Method: POST
   URL: {{$env.API_SERVER_URL}}/api/jobs/create
   Headers:
     - Content-Type: application/json
   Body:
     {
       "userId": "{{$json.user_id}}",
       "autoAnalyze": true
     }
   ```

5. **Execute Job** (HTTP Request)
   ```
   Method: POST
   URL: {{$env.API_SERVER_URL}}/api/jobs/execute
   Headers:
     - Content-Type: application/json
   Body:
     {
       "jobId": "{{$json.id}}"
     }
   ```

6. **Wait for Completion** (opcional - Polling)
   - Esperar 30 segundos
   - GET /api/jobs/{{jobId}}
   - Verificar si status === 'completed'

7. **Send Notification** (opcional)
   - Email/Slack cuando el job complete
   - Personalizable por usuario

### 4. Variables de Entorno en N8N

En N8N, ir a **Settings → Variables** y agregar:

```
API_SERVER_URL = http://your-server-ip:3001
```

**Importante**: El API Server debe ser accesible desde N8N (mismo servidor o expuesto públicamente).

## 🔑 Diferencias: Frontend vs N8N

### Frontend (Proceso Manual)
```
Usuario → Click "Buscar" → API Server
   │                            │
   │                            ├─ POST /api/jobs/create
   │                            ├─ POST /api/jobs/execute
   │                            └─ Búsqueda + Análisis
   │
   └─ Monitorea progreso en tiempo real
```

### N8N (Proceso Automático)
```
Schedule (4h) → API Server
                    │
                    ├─ GET /api/users/premium
                    ├─ POST /api/jobs/create (para cada user)
                    ├─ POST /api/jobs/execute (para cada job)
                    └─ Búsqueda + Análisis
```

**Ambos usan exactamente los mismos endpoints y lógica.**

## � API Endpoints Compartidos

Estos endpoints son usados tanto por el frontend como por N8N:

### GET /api/users/premium
Obtener lista de usuarios premium (usado por N8N)

**Response:**
```typescript
{
  users: [
    {
      user_id: string;
      company_name: string;
      user_type: 'premium';
    }
  ]
}
```

### POST /api/jobs/create
Crear un nuevo job de búsqueda

**Request:**
```typescript
{
  userId: string;
  autoAnalyze: boolean; // true para premium
}
```

**Response:**
```typescript
{
  id: string;
  user_id: string;
  status: 'pending';
  progress: 0;
  created_at: string;
}
```

### POST /api/jobs/execute
Ejecutar búsqueda (proceso asíncrono)

**Request:**
```typescript
{
  jobId: string;
}
```

**Response:**
```typescript
{
  success: true;
  message: 'Job execution started';
  jobId: string;
}
```

### GET /api/jobs/:id
Obtener estado de un job

**Response:**
```typescript
{
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
## ⚙️ Configuración Avanzada

### Frecuencia de Ejecución

**Recomendaciones por tipo de usuario:**
- Demo users: Manual solamente (sin N8N)
- Basic users: 1 vez por semana (opcional)
- Premium users: Cada 4 horas (automatizado)

**En N8N:** El workflow obtiene solo usuarios premium, por lo que solo ellos reciben búsquedas automáticas.

### Monitoreo de Jobs desde el Frontend (Opcional)

Si quieres que el frontend muestre el progreso de jobs ejecutados por N8N:

```typescript
import { getUserSearchJobs } from './services/jobService';

// En el componente
const [searchJobs, setSearchJobs] = useState<SearchJob[]>([]);

useEffect(() => {
  if (userId) {
    getUserSearchJobs(userId).then(setSearchJobs);
  }
}, [userId]);
```

### Subscripción en Tiempo Real (Opcional)

Para ver actualizaciones en vivo de jobs ejecutados por N8N:

```typescript
useEffect(() => {
  if (!userId) return;

  const subscription = supabase
    .channel('search_jobs_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'search_jobs',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('Job updated by N8N:', payload);
        // Actualizar estado local
        setSearchJobs(prev => 
          prev.map(j => j.id === payload.new.id ? payload.new : j)
        );
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [userId]);
```

## 🚀 Workflow Completo N8N

### Variables de Entorno en N8N
```
API_SERVER_URL = http://your-server-ip:3001
```

### Workflow JSON Completo

```json
{
  "name": "FutureFund Auto Search",
  "nodes": [
    {
      "name": "Schedule Every 4h",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "cronExpression": "0 */4 * * *"
      }
    },
    {
      "name": "Get Premium Users",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.API_SERVER_URL}}/api/users/premium",
        "method": "GET"
      }
    },
    {
      "name": "Loop Users",
      "type": "n8n-nodes-base.splitInBatches",
      "parameters": {
        "batchSize": 1
      }
    },
    {
      "name": "Create Job",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.API_SERVER_URL}}/api/jobs/create",
        "method": "POST",
        "body": {
          "userId": "={{$json.user_id}}",
          "autoAnalyze": true
        }
      }
    },
    {
      "name": "Execute Job",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.API_SERVER_URL}}/api/jobs/execute",
        "method": "POST",
        "body": {
          "jobId": "={{$json.id}}"
        }
      }
    }
  ]
}
```

## 📊 Monitoreo y Debugging

### Ver Jobs Ejecutados por N8N

Consulta SQL en Supabase:

```sql
SELECT 
  j.id,
  p.company_name,
  j.status,
  j.progress,
  j.funds_found,
  j.funds_analyzed,
  j.created_at,
  j.completed_at,
  EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) as duration_seconds
FROM search_jobs j
LEFT JOIN profiles p ON p.user_id = j.user_id
WHERE j.created_at > NOW() - INTERVAL '7 days'
ORDER BY j.created_at DESC;
```

### Logs del API Server

```bash
# Ver logs en tiempo real
tail -f server/logs.txt

# O en la terminal donde corre el servidor
npm run dev
```

### Verificar Ejecución en N8N

1. Ir a N8N dashboard
2. Workflow → Executions
3. Ver historial de ejecuciones
4. Click en cada ejecución para ver detalles

## 🔒 Seguridad

✅ **API Server**: Solo acepta requests desde N8N y frontend  
✅ **Supabase RLS**: Usuarios solo ven sus propios fondos y jobs  
✅ **UPSERT**: Evita duplicados cuando ambos procesos escriben  
✅ **No hay Edge Functions**: Toda la lógica en API Server controlado

## 🎯 Ventajas de Esta Arquitectura

1. **Frontend independiente**: Funciona sin N8N
2. **N8N opcional**: Usuario puede desactivarlo
3. **Misma lógica**: Un solo código para ambos procesos
4. **Escalable**: Cada proceso escala por separado
5. **Sin duplicados**: UPSERT maneja concurrencia
6. **Flexible**: Fácil añadir más procesos paralelos

## 📝 Resumen de Flujo

### Proceso Frontend (Manual)
```
Usuario → Frontend → API Server → Supabase
                         ↓
                    Gemini AI
                    Google CSE
```

### Proceso N8N (Automático)
```
Schedule → N8N → API Server → Supabase
                     ↓
                Gemini AI
                Google CSE
```

**Resultado:** Ambos escriben en la misma base de datos, mismo formato, sin conflictos.

## 🎓 Ejemplo Completo

1. **Usuario Premium se registra**
2. **N8N ejecuta cada 4 horas:**
   - Detecta usuario premium
   - Crea job en Supabase
   - Llama a API Server
   - Busca fondos con Gemini
   - Analiza fondos automáticamente
   - Guarda en Supabase
3. **Usuario entra a la app:**
   - Ve fondos ya procesados por N8N
   - Puede hacer búsqueda manual adicional
   - Ambos resultados coexisten

## 🔄 Próximos Pasos

1. ✅ Ejecutar migraciones SQL
2. ✅ Configurar y iniciar API Server
3. ✅ Crear workflow en N8N
4. ✅ Probar ejecución manual en N8N
5. ✅ Activar schedule (cada 4 horas)
6. ✅ Monitorear primeras ejecuciones
7. ✅ Ajustar frecuencia según necesidad

- [ ] Implementar la Edge Function completa
- [ ] Crear el workflow en n8n
- [ ] Agregar UI para ver jobs en el dashboard
- [ ] Configurar notificaciones por email
- [ ] Agregar métricas y analytics
