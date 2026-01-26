# FutureFund API Server

Servidor API para ejecutar búsquedas automatizadas desde n8n.

## 🚀 Setup

### 1. Instalar dependencias

```bash
npm install express cors dotenv @supabase/supabase-js @google/genai
npm install --save-dev nodemon
```

### 2. Configurar variables de entorno

Copiar `server/.env.example` a `server/.env` y configurar:

```env
API_PORT=3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
API_KEY=your-gemini-api-key
SEARCH_ENGINE_ID=your-google-cse-id
```

### 3. Ejecutar migraciones en Supabase

```sql
-- migration-add-unique-constraint.sql
ALTER TABLE funds 
ADD CONSTRAINT funds_user_fund_unique 
UNIQUE (user_id, nombre_fondo);

-- migration-search-jobs.sql
-- (ejecutar todo el archivo)
```

### 4. Iniciar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

El servidor estará disponible en `http://localhost:3001`

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Crear Job
```
POST /api/jobs/create
Body: {
  "userId": "uuid",
  "autoAnalyze": true,
  "webhookUrl": "https://optional-callback-url"
}
```

### Ejecutar Job
```
POST /api/jobs/execute
Body: {
  "jobId": "uuid"
}
```

### Obtener Estado de Job
```
GET /api/jobs/:jobId
```

### Listar Usuarios Premium
```
GET /api/users/premium
```

## 🔧 Uso con n8n

Ver [N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md) para la configuración completa del workflow.

Workflow básico:
```
Schedule → HTTP: Get Premium Users → Loop → HTTP: Create Job → HTTP: Execute Job
```

## 📦 Estructura

```
server/
├── index.js          # Servidor principal Express
├── searchEngine.js   # Búsquedas con Gemini
├── analyzer.js       # Análisis de fondos
└── .env.example      # Variables de entorno
```

## 🐳 Deployment

### Opción 1: VPS/Servidor propio
```bash
pm2 start server/index.js --name futurefund-api
```

### Opción 2: Heroku
```bash
heroku create futurefund-api
git push heroku main
```

### Opción 3: Railway/Render
Conectar repositorio y configurar:
- Build Command: `npm install`
- Start Command: `node server/index.js`
- Port: 3001

## 🔒 Seguridad

- Usar HTTPS en producción
- Implementar rate limiting
- Validar tokens de autenticación si es necesario
- No exponer claves API en el código

## 📊 Monitoreo

Logs del servidor:
```bash
tail -f logs/api.log
```

Health check:
```bash
curl http://localhost:3001/health
```
