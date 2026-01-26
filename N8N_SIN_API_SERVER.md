# 🚀 N8N Sin API Server - Conexión Directa a Supabase

## ✨ Cambio Importante

**ANTES:** Frontend → API Server ← N8N → Supabase  
**AHORA:** Frontend → Supabase ← N8N (conexión directa)

## 🎯 Nueva Arquitectura con Dos Workflows

```
┌──────────────┐         ┌──────────────────────────────┐
│   Frontend   │         │     N8N  (2 Workflows)       │
│   (Vercel)   │         │                              │
│              │         │  WF1: Búsqueda (cada 4h)     │
│ • Búsqueda   │         │  WF2: Análisis (cada 1h)     │
│   manual     │         │                              │
│ • Análisis   │         └──────────────┬───────────────┘
│   manual     │                        │
└──────┬───────┘                        │
       │                                │
       │ REST API                       │ REST API  
       │ Directo                        │ Directo
       │                                │
       └────────────┬───────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   SUPABASE    │
            │               │
            │ • search_jobs │
            │ • funds       │
            │   analyzed_at │
            │ • users       │
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

## 📋 División de Responsabilidades

### Frontend (Manual)
- ✅ Búsqueda cuando usuario presiona "Buscar"
- ✅ Análisis cuando usuario presiona botón "Analizar" en un fondo específico
- ✅ Inserta fondos SIN análisis automático (analyzed_at = NULL)
- ❌ NO realiza análisis automático

### N8N (Automático)
- ✅ **Workflow 1:** Búsqueda automática cada 4 horas (solo premium)
- ✅ **Workflow 2:** Análisis automático cada 1 hora de TODOS los fondos sin analizar
- ✅ Analiza fondos de ambas fuentes (Frontend + N8N)

## 🔧 Configuración N8N

### Variables de Entorno

```
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_ANON_KEY = eyJxxx...
SUPABASE_SERVICE_KEY = eyJxxx... (para write operations)
GEMINI_API_KEY = AIzaSyxxx...
GOOGLE_CSE_ID = your-cse-id
```

---

## 🔄 WORKFLOW 1: Búsqueda Automática (cada 4h)

### Nodos del Workflow

1. **Schedule Trigger**
   - Cron: `0 */4 * * *` (cada 4 horas)

2. **Supabase: Get Premium Users**
   ```
   GET {{SUPABASE_URL}}/rest/v1/profiles?user_type=eq.premium
   Headers:
     apikey: {{SUPABASE_ANON_KEY}}
     Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
   ```

3. **Loop Users** (Split in Batches: 1)

4. **Supabase: Create Job**
   ```
   POST {{SUPABASE_URL}}/rest/v1/search_jobs
   Headers:
     apikey: {{SUPABASE_ANON_KEY}}
     Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
     Prefer: return=representation
   Body:
   {
     "user_id": "{{$json.user_id}}",
     "status": "pending",
     "auto_analyze": false
   }
   ```

5. **Function: Build Search Query**
   ```javascript
   // Construir query para Gemini
   const user = $input.all()[0].json;
   const searchQuery = `
   Encuentra fondos de inversión para:
   Industria: ${user.industry}
   Monto: ${user.funding_amount}
   Tipo: ${user.funding_type}
   `;
   
   return {
     query: searchQuery,
     jobId: user.job_id,
     userId: user.user_id
   };
   ```

6. **HTTP Request: Gemini AI Search**
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
   Headers:
     Content-Type: application/json
   Body:
   {
     "contents": [{
       "parts": [{
         "text": "{{$json.query}}"
       }]
     }],
     "generationConfig": {
       "temperature": 0.7
     }
   }
   Query Params:
     key: {{GEMINI_API_KEY}}
   ```

7. **Function: Parse Funds**
   ```javascript
   // Procesar respuesta de Gemini
   const response = $input.all()[0].json;
   const text = response.candidates[0].content.parts[0].text;
   
   // Extraer fondos del texto
   const funds = JSON.parse(text); // Gemini devuelve JSON
   
   return funds.map(fund => ({
     user_id: $node["Build Search Query"].json.userId,
     nombre_fondo: fund.name,
     gestor: fund.manager,
     monto_disponible: fund.amount,
     descripcion: fund.description,
     url_aplicacion: fund.url,
     analyzed_at: null  // ⚠️ Sin análisis automático
   }));
   ```

8. **Supabase: INSERT Funds** (Loop - SIN análisis)
   ```
   POST {{SUPABASE_URL}}/rest/v1/funds
   Headers:
     apikey: {{SUPABASE_ANON_KEY}}
     Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
     Prefer: resolution=merge-duplicates
   Body:
   {
     "user_id": "{{$json.user_id}}",
     "nombre_fondo": "{{$json.nombre_fondo}}",
     "gestor": "{{$json.gestor}}",
     "analyzed_at": null
     ...
   }
   ```

9. **Supabase: Update Job Status**
    ```
    PATCH {{SUPABASE_URL}}/rest/v1/search_jobs?id=eq.{{$json.jobId}}
    Body:
    {
      "status": "completed",
      "progress": 100,
      "funds_found": {{$json.count}},
      "completed_at": "{{$now}}"
    }
    ```

---

## 🔬 WORKFLOW 2: Análisis Automático (cada 1h)

### Objetivo
Analiza TODOS los fondos sin análisis (tanto los que insertó el Frontend como los que insertó N8N)

### Nodos del Workflow

1. **Schedule Trigger**
   - Cron: `0 * * * *` (cada hora)

2. **Supabase: Get Unanalyzed Funds**
   ```
   GET {{SUPABASE_URL}}/rest/v1/funds?analyzed_at=is.null&select=*,profiles!inner(user_type)&profiles.user_type=eq.premium&limit=10
   Headers:
     apikey: {{SUPABASE_ANON_KEY}}
     Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
   
   Nota: Limitar a 10 fondos por ejecución para evitar timeout
   ```

3. **IF: Has Funds** (Check if array length > 0)

4. **Loop Funds** (Split in Batches: 1)

5. **HTTP Request: Gemini AI Analysis**
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
   Headers:
     Content-Type: application/json
   Body:
   {
     "contents": [{
       "parts": [{
         "text": "Analiza este fondo de inversión y proporciona un análisis detallado:\n\nNombre: {{$json.nombre_fondo}}\nGestor: {{$json.gestor}}\nMonto: {{$json.monto_disponible}}\nDescripción: {{$json.descripcion}}\n\nProporciona:\n1. Análisis de idoneidad\n2. Puntos fuertes\n3. Riesgos\n4. Puntuación de compatibilidad (0-100)"
       }]
     }],
     "generationConfig": {
       "temperature": 0.7
     }
   }
   Query Params:
     key: {{GEMINI_API_KEY}}
   ```

6. **Function: Parse Analysis**
   ```javascript
   const response = $input.all()[0].json;
   const analysisText = response.candidates[0].content.parts[0].text;
   const fundData = $node["Loop Funds"].json;
   
   // Extraer score del análisis (buscar patrón 0-100)
   const scoreMatch = analysisText.match(/(\d+)\/100|puntuación[:\s]+(\d+)/i);
   const matchScore = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : 50;
   
   return {
     fundId: fundData.id,
     analysis: analysisText,
     matchScore: matchScore
   };
   ```

7. **Supabase: Update Fund with Analysis**
    ```
    PATCH {{SUPABASE_URL}}/rest/v1/funds?id=eq.{{$json.fundId}}
    Headers:
      apikey: {{SUPABASE_ANON_KEY}}
      Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
    Body:
    {
      "analisis_gemini": "{{$json.analysis}}",
      "match_score": {{$json.matchScore}},
      "analyzed_at": "{{$now}}"
    }
    ```

---

## ✅ Ventajas

✅ **Sin servidor**: No hay que mantener API Server Express  
✅ **Más simple**: Menos componentes = menos problemas  
✅ **Más rápido**: Conexión directa a Supabase  
✅ **Menos costos**: Sin hosting de servidor Node.js  
✅ **Escalable**: Supabase maneja la carga  
✅ **Mismo resultado**: Frontend y N8N escriben en misma DB  

## 🔒 Seguridad

- **Frontend**: Usa `SUPABASE_ANON_KEY` (limitado por RLS)
- **N8N**: Usa `SUPABASE_SERVICE_KEY` (bypass RLS para automation)
- **RLS Policies**: Protegen datos por user_id

## 📝 Notas Importantes

1. N8N debe usar `SUPABASE_SERVICE_KEY` para poder insertar datos
2. UPSERT evita duplicados (constraint unique en user_id + nombre_fondo)
3. Gemini API requiere parsing cuidadoso de las respuestas
4. Workflow puede tardar 2-5 minutos por usuario

## 🚀 Siguiente Paso

Ver archivos actualizados:
- [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - Diagrama completo
- [N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md) - Guía detallada
- [QUICKSTART_N8N.md](QUICKSTART_N8N.md) - Inicio rápido
