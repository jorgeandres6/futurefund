<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1jZNffq-3jAGhhcO3QPfT1-kVQu54iNFl

## Ejecutar localmente / Run locally

**Requisitos:** Node.js (v16+ recomendado)

1. Instala dependencias:
   `npm install`
2. Crea un archivo `.env.local` copiando `.env.example` y rellena las variables (NO subir este archivo al repositorio):
   - `API_KEY` — clave para Google GenAI / Gemini
   - `SEARCH_ENGINE_ID` — (opcional) ID para Google Custom Search
3. Ejecuta la app en modo desarrollo:
   `npm run dev`

---

## Desplegar en Vercel (interfaz web) — Instrucciones rápidas 🚀

1. Crea un repositorio en GitHub (o usa uno existente). En tu proyecto local:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin main
   ```
2. Ve a https://vercel.com, haz "Import Project" → selecciona GitHub → elige tu repositorio.
3. En la configuración de importación usa:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Añade las variables de entorno en Vercel (Project Settings → Environment Variables):
   - `API_KEY` = <tu clave>
   - `SEARCH_ENGINE_ID` = <tu Custom Search ID> (si aplica)
5. Despliega y verifica la URL proporcionada por Vercel.

> Nota: No subas claves secretas al repositorio. Usa las variables de entorno en Vercel o en `.env.local` durante desarrollo.

---

## Integración continua (GitHub Actions)

Se incluye un workflow básico en `.github/workflows/ci.yml` que ejecuta `npm ci` y `npm run build` en `push` y `pull_request` contra `main`.

---

## Variables de entorno usadas por el proyecto

- `API_KEY` — Clave para Google GenAI / Gemini usada en `services/`.
- `SEARCH_ENGINE_ID` — ID del motor para Google Custom Search (opcional, si no está definido la app cae en modo generativo sin búsqueda web).

Si necesitas ayuda para configurar estas variables en Vercel, dime y te doy los pasos detallados.
# futurefund
