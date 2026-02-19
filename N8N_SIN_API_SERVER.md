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

5. **Supabase: Get Existing Funds**
   ```
   GET {{SUPABASE_URL}}/rest/v1/funds?user_id=eq.{{$json.user_id}}&select=nombre_fondo
   Headers:
     apikey: {{SUPABASE_ANON_KEY}}
     Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
   ```
   - Obtiene solo los nombres de los fondos existentes del usuario

6. **Function: Build Search Query**
   ```javascript
   // Construir query con lista de fondos existentes
   const user = $node["Supabase: Create Job"].json;
   const existingFunds = $node["Supabase: Get Existing Funds"].json;
   
   // Crear lista de nombres de fondos existentes
   const existingFundNames = existingFunds.map(f => f.nombre_fondo);
   
   const searchQuery = `
   Encuentra fondos de inversión para:
   Industria: ${user.industry}
   Monto: ${user.funding_amount}
   Tipo: ${user.funding_type}
   `;
   
   return {
     query: searchQuery,
     existingFunds: existingFundNames,
     jobId: user.id,
     userId: user.user_id
   };
   ```

7. **AI Agent: Busqueda automatica de fondos**
   **Prompt (usar como System + User):**
   ```
   Eres un analista financiero. Encuentra fondos de inversion que coincidan con la consulta del usuario.

   Reglas:
   - Devuelve SOLO JSON valido. Sin Markdown, sin texto extra.
   - Salida: un arreglo JSON de objetos (0..N).
   - No inventes datos. Si falta informacion, usa "N/A" o null segun el campo.
   - IMPORTANTE: NO incluyas fondos que ya existan en la lista de fondos existentes.
   - Campos requeridos (no nulos) SOLO para busqueda:
     - nombre_fondo (string)
     - gestor_activos (string)
     - ticker_isin (string, usa "N/A" si no hay)
     - url_fuente (string, URL directa a la fuente)
     - ods_encontrados (array string, puede ser [])
     - keywords_encontradas (array string, puede ser [])
     - evidencia_texto (string, breve evidencia o resumen)
   - No incluyas campos de analisis (es_elegible, requisitos, pasos, fechas, links, contactos, estado).

   Consulta del usuario:
   {{$json.query}}

   Fondos existentes (NO los incluyas en tu respuesta):
   {{JSON.stringify($json.existingFunds)}}

   Formato de salida (ejemplo):
   [
     {
       "nombre_fondo": "Fondo Verde Latam",
       "gestor_activos": "Gestora X",
       "ticker_isin": "LU1234567890",
       "url_fuente": "https://ejemplo.com/fondo",
       "ods_encontrados": ["ODS 7", "ODS 13"],
       "keywords_encontradas": ["energia renovable", "sostenibilidad"],
       "evidencia_texto": "Invierte en energia solar y eolica en Latam."
     }
   ]
   ```

8. **Function: Parse Funds**
   ```javascript
  // Procesar respuesta del AI Agent (JSON en texto)
  const response = $input.all()[0].json;
  let text = response.text || response.output || response.data || '';
   
   // Extraer fondos del texto (limpiar posibles bloques ```json)
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const funds = JSON.parse(text); // AI Agent devuelve JSON
   const now = new Date().toISOString();
   
   return funds.map(fund => ({
     user_id: $node["Build Search Query"].json.userId,
     nombre_fondo: fund.nombre_fondo,
     gestor_activos: fund.gestor_activos,
     ticker_isin: fund.ticker_isin || 'N/A',
     url_fuente: fund.url_fuente,
     fecha_scrapeo: now,
     ods_encontrados: fund.ods_encontrados || [],
     keywords_encontradas: fund.keywords_encontradas || [],
     puntuacion_impacto: 'Pendiente',
     evidencia_texto: fund.evidencia_texto || '',
     es_elegible: null,
     resumen_requisitos: null,
     pasos_aplicacion: null,
     fechas_clave: null,
     link_directo_aplicacion: null,
     contact_emails: null,
     application_status: null,
     analyzed_at: null  // ⚠️ Sin análisis automático
   }));
   ```
   ⚠️ **Nota:** El AI Agent ya filtró duplicados, todos los fondos en esta respuesta son NUEVOS

9. **Loop Over Funds** (Split in Batches: 1)
   - Separa cada fondo nuevo para insertarlo individualmente

10. **Supabase: INSERT Fund**
   ```
   POST {{SUPABASE_URL}}/rest/v1/funds
   Headers:
     apikey: {{SUPABASE_ANON_KEY}}
     Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
   Body:
   {
     "user_id": "{{$json.user_id}}",
     "nombre_fondo": "{{$json.nombre_fondo}}",
     "gestor_activos": "{{$json.gestor_activos}}",
     "ticker_isin": "{{$json.ticker_isin}}",
     "url_fuente": "{{$json.url_fuente}}",
     "fecha_scrapeo": "{{$json.fecha_scrapeo}}",
     "ods_encontrados": {{$json.ods_encontrados}},
     "keywords_encontradas": {{$json.keywords_encontradas}},
     "puntuacion_impacto": "{{$json.puntuacion_impacto}}",
     "evidencia_texto": "{{$json.evidencia_texto}}",
     "analyzed_at": null
   }
   ```

11. **Function: Aggregate Results**
    ```javascript
    // Contar fondos nuevos insertados
    const insertedFunds = $node["Supabase: INSERT Fund"].json;
    const jobId = $node["Build Search Query"].json.jobId;
    
    return {
      jobId: jobId,
      fundsFound: Array.isArray(insertedFunds) ? insertedFunds.length : 1
    };
    ```

12. **Supabase: Update Job Status**
    ```
    PATCH {{SUPABASE_URL}}/rest/v1/search_jobs?id=eq.{{$json.jobId}}
    Headers:
      apikey: {{SUPABASE_ANON_KEY}}
      Authorization: Bearer {{SUPABASE_SERVICE_KEY}}
    Body:
    {
      "status": "completed",
      "progress": 100,
      "funds_found": {{$json.fundsFound}},
      "completed_at": "{{$now}}"
    }
    ```

### ✨ Ventajas del Filtrado Inteligente

**✅ Eficiencia:** Una sola consulta inicial vs. N consultas individuales  
**✅ Simplicidad:** El AI Agent filtra duplicados, sin lógica condicional compleja  
**✅ Precisión:** El AI puede hacer matching inteligente de nombres similares  
**✅ Menos nodos:** Menos pasos = menos puntos de falla

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
         "text": "Analiza este fondo de inversión y proporciona un análisis detallado en formato JSON:\n\nNombre: {{$json.nombre_fondo}}\nGestor: {{$json.gestor_activos}}\nURL: {{$json.url_fuente}}\nDescripción: {{$json.evidencia_texto}}\n\nResponde ÚNICAMENTE con un objeto JSON (sin markdown) con esta estructura:\n{\n  \"analisis_completo\": \"Análisis detallado de idoneidad del fondo\",\n  \"puntos_fuertes\": [\"punto 1\", \"punto 2\", \"punto 3\"],\n  \"riesgos\": [\"riesgo 1\", \"riesgo 2\"],\n  \"puntuacion_impacto\": \"Alto|Medio|Bajo\",\n  \"es_elegible\": \"Si|No|Requiere más información\",\n  \"resumen_requisitos\": [\"requisito 1\", \"requisito 2\"],\n  \"pasos_aplicacion\": [\"paso 1\", \"paso 2\", \"paso 3\"],\n  \"fechas_clave\": \"Información sobre deadlines o fechas importantes\",\n  \"contact_emails\": [\"email1@example.com\", \"email2@example.com\"],\n  \"link_directo_aplicacion\": \"URL directa para aplicar\"\n}\n\nIMPORTANTE:\n- puntuacion_impacto debe ser \"Alto\", \"Medio\" o \"Bajo\"\n- es_elegible debe indicar si el fondo es elegible para el usuario\n- Si no encuentras información para un campo, usa null o array vacío\n- Los emails deben ser válidos si los encuentras en la descripción o deducibles del gestor\n- El análisis debe ser completo y profesional"
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
   let analysisText = response.candidates[0].content.parts[0].text;
   const fundData = $node["Loop Funds"].json;
   
   // Limpiar markdown si viene con ```json
   analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
   
   let parsedData;
   try {
     parsedData = JSON.parse(analysisText);
   } catch (error) {
     // Si falla el parsing, crear estructura mínima
     console.error('Error parsing JSON:', error);
     parsedData = {
       analisis_completo: analysisText,
       puntuacion_impacto: 'Medio',
       es_elegible: null,
       puntos_fuertes: [],
       riesgos: [],
       resumen_requisitos: [],
       pasos_aplicacion: [],
       fechas_clave: null,
       contact_emails: [],
       link_directo_aplicacion: fundData.url_fuente
     };
   }
   
   return {
     fundId: fundData.id,
     evidenciaTexto: parsedData.analisis_completo || analysisText,
     puntuacionImpacto: parsedData.puntuacion_impacto || 'Medio',
     esElegible: parsedData.es_elegible || null,
     resumenRequisitos: parsedData.resumen_requisitos || [],
     pasosAplicacion: parsedData.pasos_aplicacion || [],
     fechasClave: parsedData.fechas_clave || null,
     contactEmails: parsedData.contact_emails || [],
     linkDirectoAplicacion: parsedData.link_directo_aplicacion || fundData.url_fuente
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
      "evidencia_texto": "{{$json.evidenciaTexto}}",
      "puntuacion_impacto": "{{$json.puntuacionImpacto}}",
      "es_elegible": "{{$json.esElegible}}",
      "resumen_requisitos": {{JSON.stringify($json.resumenRequisitos)}},
      "pasos_aplicacion": {{JSON.stringify($json.pasosAplicacion)}},
      "fechas_clave": "{{$json.fechasClave}}",
      "contact_emails": {{JSON.stringify($json.contactEmails)}},
      "link_directo_aplicacion": "{{$json.linkDirectoAplicacion}}",
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

## 🎯 Análisis Automático Completo

El Workflow 2 ahora extrae información estructurada de cada fondo:

### Información Extraída

| Campo | Descripción | Tipo |
|-------|-------------|------|
| `evidencia_texto` | Análisis detallado de idoneidad | TEXT |
| `puntuacion_impacto` | Nivel de impacto (Alto/Medio/Bajo) | TEXT |
| `es_elegible` | Si el fondo es elegible para el usuario | TEXT |
| `resumen_requisitos` | Lista de requisitos del fondo | TEXT[] |
| `pasos_aplicacion` | Pasos del proceso de aplicación | TEXT[] |
| `fechas_clave` | Deadlines e información temporal | TEXT |
| `contact_emails` | Emails de contacto del gestor | TEXT[] |
| `link_directo_aplicacion` | URL directa para aplicar | TEXT |

### Ventajas del Análisis Estructurado

✅ **Perfil Completo**: Toda la información necesaria para aplicar al fondo  
✅ **Contacto Directo**: Emails extraídos o deducidos del gestor  
✅ **Proceso Claro**: Pasos específicos para la aplicación  
✅ **Requisitos**: Lista clara de lo que necesita el emprendedor  
✅ **Fechas Importantes**: Deadlines para no perder oportunidades  

### Formato de Respuesta Gemini

Gemini devuelve JSON estructurado:
```json
{
  "analisis_completo": "Este fondo es ideal para startups en fase seed...",
  "puntos_fuertes": [
    "Red de mentores amplia",
    "Proceso rápido (3-4 semanas)",
    "No requiere colateral"
  ],
  "riesgos": [
    "Alta competitividad",
    "Requiere traction demostrable"
  ],
  "puntuacion_impacto": "Alto",
  "es_elegible": "Si - cumple con todos los requisitos",
  "resumen_requisitos": [
    "Startup tecnológica",
    "Revenue > $50K MRR",
    "Equipo fundador completo"
  ],
  "pasos_aplicacion": [
    "1. Registrarse en el portal",
    "2. Completar formulario de aplicación",
    "3. Subir pitch deck y financials",
    "4. Entrevista inicial (15 min)",
    "5. Due diligence (2-3 semanas)"
  ],
  "fechas_clave": "Ronda Q2 2026: Aplicaciones hasta 30 de marzo",
  "contact_emails": ["info@fundmanager.com", "applications@fund.vc"],
  "link_directo_aplicacion": "https://fundmanager.com/apply"
}
```

## 🚀 Siguiente Paso

Ver archivos actualizados:
- [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - Diagrama completo
- [N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md) - Guía detallada
- [QUICKSTART_N8N.md](QUICKSTART_N8N.md) - Inicio rápido
