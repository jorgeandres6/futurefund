# Guía Completa: N8N Workflow - Proceso Paralelo e Independiente

## 🎯 Concepto: Búsqueda Paralela Automatizada

N8N funciona como un **proceso completamente independiente** que ejecuta la misma función que el frontend: buscar fondos, analizarlos y guardarlos en Supabase. Ambos procesos coexisten sin interferencia.

## 🏗️ Arquitectura Simplificada

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│     N8N      │ ──HTTP─→ │ API Server   │ ──SQL─→ │  Supabase    │
│  (Automático)│          │ (Express)    │         │  Database    │
└──────────────┘         └──────────────┘         └──────────────┘
      │                         │                         │
Ejecuta cada              Realiza búsquedas        Guarda fondos
4 horas                   con Gemini               (UPSERT)

        ↑ PARALELO ↑
        
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │ ──HTTP─→ │ API Server   │ ──SQL─→ │  Supabase    │
│   (Manual)   │          │ (Express)    │         │  Database    │
└──────────────┘         └──────────────┘         └──────────────┘
      │                         │                         │
Usuario hace              Realiza búsquedas        Guarda fondos
click "Buscar"            con Gemini               (UPSERT)
```

**Nota:** Ambos usan el **mismo API Server** y **misma lógica**.

## 📋 Prerrequisitos

1. ✅ API Server corriendo (ver [API_SERVER_README.md](API_SERVER_README.md))
2. ✅ Migraciones SQL ejecutadas en Supabase
3. ✅ Cuenta en N8N (cloud o self-hosted)
4. ✅ Frontend funcionando (opcional - N8N es independiente)

## 🔧 Setup del Workflow N8N

### Paso 1: Crear Variables de Entorno en N8N

En N8N, ir a **Settings → Variables** y agregar:

```
API_SERVER_URL = http://your-server-ip:3001
```

**Importante:**  
- El API Server debe ser accesible desde N8N  
- Si N8N está en cloud, exponer el servidor públicamente o usar túnel (ngrok, cloudflared)  
- Si N8N está self-hosted en mismo servidor, usar localhost:3001

### Paso 2: Crear Nuevo Workflow

Nombre: **FutureFund Auto Search - Parallel Process**

**Descripción:** Proceso independiente que busca y analiza fondos automáticamente cada 4 horas.

## 📊 Nodos del Workflow

### Nodo 1: Schedule Trigger ⏰

**Tipo:** Schedule Trigger

**Configuración:**
```
Mode: Every X hours
Value: 4
```

O para horario específico:
```
Cron Expression: 0 */4 * * *
```

---

### Nodo 2: Get Premium Users 👥

**Tipo:** HTTP Request

**Configuración:**
```
Method: GET
URL: {{$env.API_SERVER_URL}}/api/users/premium

Headers:
  Content-Type: application/json

Response Format: JSON
```

**Output esperado:**
```json
{
  "users": [
    {
      "user_id": "uuid-123",
      "company_name": "EcoTech Solutions",
      "user_type": "premium"
    }
  ]
}
```

---

### Nodo 3: Loop Over Users 🔄

**Tipo:** Split In Batches

**Configuración:**
```
Batch Size: 1
Options:
  - Reset: true
```

Esto procesa un usuario a la vez.

---

### Nodo 4: Create Search Job 📝

**Tipo:** HTTP Request

**Configuración:**
```
Method: POST
URL: {{$env.API_SERVER_URL}}/api/jobs/create

Headers:
  Content-Type: application/json

Body (JSON):
{
  "userId": "{{$json.user_id}}",
  "autoAnalyze": true,
  "webhookUrl": "{{$node["Webhook"].json.webhookUrl}}"
}

Response Format: JSON
```

**Output esperado:**
```json
{
  "success": true,
  "job": {
    "id": "job-uuid-456",
    "user_id": "uuid-123",
    "status": "pending"
  }
}
```

---

### Nodo 5: Execute Search Job ▶️

**Tipo:** HTTP Request

**Configuración:**
```
Method: POST
URL: {{$env.API_SERVER_URL}}/api/jobs/execute

Headers:
  Content-Type: application/json

Body (JSON):
{
  "jobId": "{{$json.job.id}}"
}

Response Format: JSON
```

Este endpoint retorna inmediatamente y ejecuta la búsqueda en segundo plano.

---

### Nodo 6 (Opcional): Wait for Completion ⏳

**Tipo:** HTTP Request (en loop)

**Configuración:**
```
Method: GET
URL: {{$env.API_SERVER_URL}}/api/jobs/{{$json.jobId}}

Headers:
  Content-Type: application/json

Wait Between Tries: 30 seconds
Max Tries: 60 (30 minutos total)

Continue If: {{$json.job.status === "completed"}}
```

---

### Nodo 7 (Opcional): Send Email Notification 📧

**Tipo:** Send Email / Slack / Discord

**Configuración:**
```
To: {{$json.job.profile_snapshot.email}}
Subject: ✅ Nueva búsqueda completada en FutureFund

Body:
Hola {{$json.job.profile_snapshot.company_name}},

Tu búsqueda automatizada ha finalizado:
- Fondos encontrados: {{$json.job.funds_found}}
- Fondos analizados: {{$json.job.funds_analyzed}}

Ingresa a FutureFund para ver los resultados.
```

---

## 🎨 Workflow Completo (JSON)

```json
{
  "name": "FutureFund Auto Search",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 4
            }
          ]
        }
      },
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "={{$env.API_SERVER_URL}}/api/users/premium",
        "options": {}
      },
      "name": "Get Premium Users",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Loop Users",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "={{$env.API_SERVER_URL}}/api/jobs/create",
        "method": "POST",
        "body": {
          "userId": "={{$json.user_id}}",
          "autoAnalyze": true
        },
        "options": {}
      },
      "name": "Create Job",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300]
    },
    {
      "parameters": {
        "url": "={{$env.API_SERVER_URL}}/api/jobs/execute",
        "method": "POST",
        "body": {
          "jobId": "={{$json.job.id}}"
        },
        "options": {}
      },
      "name": "Execute Job",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1050, 300]
    }
  ],
  "connections": {
    "Schedule": {
      "main": [[{ "node": "Get Premium Users", "type": "main", "index": 0 }]]
    },
    "Get Premium Users": {
      "main": [[{ "node": "Loop Users", "type": "main", "index": 0 }]]
    },
    "Loop Users": {
      "main": [[{ "node": "Create Job", "type": "main", "index": 0 }]]
    },
    "Create Job": {
      "main": [[{ "node": "Execute Job", "type": "main", "index": 0 }]]
    }
  }
}
```

## 🚀 Activación

1. Copiar el JSON del workflow
2. En n8n: **Import from Clipboard**
3. Configurar variables de entorno
4. **Activar** el workflow

## 🧪 Testing

### Test Manual

1. En el workflow, hacer clic en **Execute Workflow**
2. Ver logs en cada nodo
3. Verificar en Supabase que se creó el job
4. Verificar en el API server logs

### Test de Endpoint

```bash
# Health check
curl http://localhost:3001/health

# Get premium users
curl http://localhost:3001/api/users/premium

# Create job manual
curl -X POST http://localhost:3001/api/jobs/create \
  -H "Content-Type: application/json" \
  -d '{"userId":"your-user-uuid","autoAnalyze":true}'

# Execute job
curl -X POST http://localhost:3001/api/jobs/execute \
  -H "Content-Type: application/json" \
  -d '{"jobId":"job-uuid"}'

# Check status
curl http://localhost:3001/api/jobs/job-uuid
```

## 📊 Monitoring

### En n8n

- Ver **Executions** para historial
- Configurar alertas en caso de error
- Ver logs de cada nodo

### En API Server

```bash
# Ver logs en tiempo real
npm run dev

# O en producción
pm2 logs futurefund-api
```

### En Supabase

```sql
-- Ver jobs recientes
SELECT * FROM search_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver jobs en ejecución
SELECT * FROM search_jobs 
WHERE status = 'running';

-- Ver estadísticas
SELECT 
  status,
  COUNT(*) as count,
  AVG(funds_found) as avg_funds,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM search_jobs
WHERE completed_at IS NOT NULL
GROUP BY status;
```

## 🔧 Troubleshooting

### Error: "Cannot connect to API server"

```bash
# Verificar que el servidor está corriendo
curl http://localhost:3001/health

# Verificar variables de entorno en n8n
# Verificar firewall si está en otro servidor
```

### Error: "Job execution failed"

```sql
-- Ver error en la base de datos
SELECT error_message FROM search_jobs WHERE status = 'failed';
```

### Jobs se quedan en "pending"

- Verificar que el endpoint `/api/jobs/execute` se está llamando
- Ver logs del API server
- Verificar que las credenciales de Gemini son correctas

## ⚙️ Configuración Avanzada

### Diferentes Frecuencias por Usuario

Agregar nodo **Function** después de "Get Premium Users":

```javascript
// Filter users based on last search date
const users = $input.all();
const filtered = users.filter(user => {
  const lastSearch = user.json.last_search_date;
  if (!lastSearch) return true;
  
  const hoursSince = (Date.now() - new Date(lastSearch)) / (1000 * 60 * 60);
  return hoursSince >= 24; // Only if more than 24 hours
});

return filtered;
```

### Webhook para Notificaciones

Agregar nodo **Webhook** al inicio:

```
Webhook URL: https://your-n8n.com/webhook/job-complete
Method: POST
```

Pasar la URL al crear el job para recibir callback cuando complete.

## 🎉 Beneficios de la Arquitectura Paralela

✅ **Procesos independientes** - Frontend y N8N no se bloquean mutuamente  
✅ **Sin serverless** - Control total del API Server  
✅ **HTTP simple** - Fácil de debuggear  
✅ **Logs completos** - Ver todo en el API server  
✅ **Flexible** - Fácil de extender y modificar  
✅ **Misma lógica** - Un solo código, dos puntos de entrada  
✅ **UPSERT** - Evita duplicados entre ambos procesos  

## 🔀 Comparación: Frontend vs N8N

| Aspecto | Frontend (Manual) | N8N (Automático) |
|---------|-------------------|------------------|
| **Trigger** | Usuario click | Schedule (4h) |
| **API Server** | ✅ Mismo | ✅ Mismo |
| **Lógica búsqueda** | ✅ Misma | ✅ Misma |
| **Base de datos** | ✅ Misma | ✅ Misma |
| **Análisis** | ✅ Gemini AI | ✅ Gemini AI |
| **Usuario presente** | Sí | No requerido |
| **Frecuencia** | A demanda | Cada 4 horas |

**Resultado:** Ambos procesos escriben en Supabase sin conflictos gracias a UPSERT.

## 📞 Soporte y Debugging

- **API Server logs**: `npm run dev` o `pm2 logs`
- **N8N logs**: Panel de Executions
- **Supabase**: Query `search_jobs` directamente
- **Testing**: Ejecutar workflow manualmente en N8N

## 🎯 Casos de Uso Reales

### Caso 1: Usuario Premium Pasivo
```
1. Usuario se registra y nunca abre la app
2. N8N ejecuta búsquedas cada 4 horas
3. Usuario entra después de 2 días
4. Resultado: 50+ fondos ya listos
```

### Caso 2: Usuario Activo + N8N
```
1. N8N ejecutó búsqueda a las 10:00 AM (30 fondos)
2. Usuario entra a las 2:00 PM y hace búsqueda manual (20 fondos más)
3. Resultado: 50 fondos sin duplicados (UPSERT)
```

### Caso 3: Frontend sin N8N
```
1. Usuario desactiva N8N
2. Frontend sigue funcionando perfectamente
3. Búsqueda manual siempre disponible
```

---

**¡Proceso paralelo configurado! Frontend y N8N trabajan en armonía.** 🚀
