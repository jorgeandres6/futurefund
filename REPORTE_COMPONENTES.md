# Reporte de Componentes del Proyecto FutureFund

> Generado: Abril 16, 2026

---

## Descripción General

**FutureFund** es una SPA (Single Page Application) desarrollada en React + TypeScript que ayuda a empresas latinoamericanas (principalmente Ecuador) a descubrir, analizar y hacer seguimiento de fondos de inversión de impacto y fuentes de financiamiento. Usa IA para buscar, emparejar y analizar la elegibilidad de fondos según el perfil de la empresa y los Objetivos de Desarrollo Sostenible (ODS/SDGs).

---

## 1. Tecnologías y Herramientas

| Categoría | Tecnología | Versión |
|---|---|---|
| **Frontend** | React | 19 |
| **Lenguaje** | TypeScript | 5.8 |
| **Build Tool** | Vite + `@vitejs/plugin-react` | 6.2 |
| **Estilos** | Tailwind CSS | — |
| **IA / LLM** | Google Gemini (`@google/genai`) | 1.29 |
| **Base de Datos / Auth** | Supabase (`@supabase/supabase-js`) | 2.9 |
| **Servidor API** | Express.js (Node.js) | — |
| **Dev Server API** | Nodemon | — |
| **Despliegue** | Vercel | — |

---

## 2. Plataformas Externas

| Plataforma | Uso |
|---|---|
| **Supabase** | Autenticación (email/password + sesiones), base de datos PostgreSQL (`profiles`, `funds`, `search_jobs`, email tracking), suscripciones en tiempo real |
| **Google Gemini API** | Descubrimiento de fondos vía JSON estructurado, extracción de documentos (brief/financieros), resumen del perfil empresarial, análisis de aplicaciones |
| **Google Custom Search API** | Búsquedas web para encontrar fuentes de financiamiento (requiere `SEARCH_ENGINE_ID`) |
| **n8n** | Automatización de flujos vía webhooks y el servidor Express; dispara búsquedas en segundo plano |
| **Vercel** | Hosting y despliegue de la aplicación frontend |

---

## 3. Archivos Principales

| Archivo | Descripción |
|---|---|
| [App.tsx](App.tsx) | Componente raíz. Gestiona estado global: usuario autenticado, lista de fondos, estados de carga, navegación por tabs (`search` / `dashboard` / `profile`), flujo de onboarding y ciclo de sesión de Supabase. |
| [index.tsx](index.tsx) | Punto de entrada de React. Monta `<App />` en el DOM con `React.StrictMode`. |
| [types.ts](types.ts) | Tipos de dominio: `Fund`, `CompanyProfile`, `ApplicationAnalysis`, `HistoryEntry`, `FinancialMetrics`. |
| [index.html](index.html) | HTML base de la aplicación. |
| [vite.config.ts](vite.config.ts) | Configuración del servidor de desarrollo y build. |
| [tsconfig.json](tsconfig.json) | Configuración del compilador TypeScript. |
| [vercel.json](vercel.json) | Configuración de despliegue en Vercel. |
| [package.json](package.json) | Dependencias y scripts del proyecto. |

---

## 4. Componentes UI (`components/`)

| Componente | Descripción |
|---|---|
| [AuthScreen.tsx](components/AuthScreen.tsx) | Formulario de login, registro y recuperación de contraseña. Usa Supabase Auth directamente. Gestiona confirmación de email y reset de contraseña vía token en URL. |
| [Dashboard.tsx](components/Dashboard.tsx) | Tabla principal de gestión de fondos. Ordenable/filtrable por tipo, estado, ODS y favoritos. Muestra insignias de impact score. Abre `FundDetailModal`. Soporta exportación a XLSX. |
| [FundCard.tsx](components/FundCard.tsx) | Vista de tarjeta para un fondo en resultados de búsqueda. Dispara análisis IA bajo demanda vía `webReviewService` y persiste el resultado en Supabase. Muestra badge de estado. |
| [FundDetailModal.tsx](components/FundDetailModal.tsx) | Modal de detalle completo de un fondo con tabs: Info general, Análisis de aplicación, Historial de emails, y datos del formulario extraídos. Sanitiza y renderiza HTML. |
| [OnboardingForm.tsx](components/OnboardingForm.tsx) | Formulario multi-paso para nuevos usuarios. Recopila datos de la empresa, selecciona ODS, sube documentos (convertidos a base64). Llama a Gemini para auto-extraer datos de documentos. |
| [ProfileView.tsx](components/ProfileView.tsx) | Vista editable del perfil empresarial. Permite actualizar campos, re-subir documentos y regenerar el resumen empresarial con IA. |
| [ResultsDisplay.tsx](components/ResultsDisplay.tsx) | Grid de componentes `FundCard` para los resultados de búsqueda. Incluye botones de descarga en JSON y CSV. |
| [SearchBar.tsx](components/SearchBar.tsx) | Botón toggle: "Iniciar Búsqueda Exhaustiva" / "Detener Búsqueda" con estado de spinner. |
| [icons/DownloadIcon.tsx](components/icons/DownloadIcon.tsx) | Icono SVG de descarga. |
| [icons/SearchIcon.tsx](components/icons/SearchIcon.tsx) | Icono SVG de búsqueda. |
| [icons/SpinnerIcon.tsx](components/icons/SpinnerIcon.tsx) | Icono SVG animado (spinner de carga). |

---

## 5. Servicios (`services/`)

| Servicio | Descripción |
|---|---|
| [supabaseClient.ts](services/supabaseClient.ts) | Inicializa y exporta el cliente Supabase tipado usando `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. |
| [supabaseService.ts](services/supabaseService.ts) | Todas las operaciones de BD: `saveProfile`, `loadProfile`, `loadFunds`, `updateFundFavorite`, `saveFundAnalysis`, `getFundEmails`. Mapea entre snake_case (BD) y camelCase (app). |
| [geminiService.ts](services/geminiService.ts) | Servicio IA principal. Funciones: `discoverFinancingSources`, `expandSearch`, `discoverEcuadorFinancingSources`, `expandEcuadorSearch`, `getDemoData`, `generateCompanyProfileSummary`, `extractDataFromBrief`, `extractFinancialMetrics`. Usa salida estructurada de Gemini (JSON schema) y Google Custom Search. |
| [webReviewService.ts](services/webReviewService.ts) | `analyzeFundApplication` — obtiene la URL del fondo y usa Gemini para extraer elegibilidad, requisitos, pasos de aplicación, fechas límite y emails. `autoAnalyzeFundsForPremium` — análisis automático en lote para usuarios premium con soporte de AbortSignal. |
| [jobService.ts](services/jobService.ts) | Capa de integración con n8n. `createSearchJob`, polling de estado de jobs. Diseñado para búsquedas en segundo plano orquestadas por webhooks n8n a través del servidor Express. |

---

## 6. Servidor API (`server/`) — Express para n8n

| Archivo | Descripción |
|---|---|
| [server/index.js](server/index.js) | Servidor Express (puerto 3001). Expone endpoints REST: `GET /health`, `POST /api/jobs/create`, rutas de estado/cancelación de jobs. Usado por n8n para disparar y monitorear búsquedas asíncronas. |
| [server/analyzer.js](server/analyzer.js) | Módulo Node.js que envuelve Gemini (`gemini-1.5-flash`) para análisis de aplicaciones de fondos en el servidor. Espejo de `webReviewService.ts` para el contexto del servidor API. |
| [server/searchEngine.js](server/searchEngine.js) | Pipeline de Google Custom Search + análisis Gemini en el servidor. Espejo de la lógica de búsqueda de `geminiService.ts` para el servidor API. |
| [server/impactScore.js](server/impactScore.js) | Copia del utilitario de normalización de impact score para el servidor. |

---

## 7. Utilidades (`utils/`)

| Archivo | Descripción |
|---|---|
| [utils/impactScore.ts](utils/impactScore.ts) | `normalizeImpactScore` — normaliza valores raw (números, strings como "alta"/"high") a entero 0–100. `formatImpactScore` — formatea como porcentaje. `getImpactScoreTier` — retorna `'high'` / `'medium'` / `'low'`. |

---

## 8. Tipos (`types/`)

| Archivo | Descripción |
|---|---|
| [types/database.ts](types/database.ts) | Definiciones de tipos Supabase para tablas: `profiles`, `funds`, `search_jobs` y email tracking — shapes de Row, Insert y Update. |
| [types/images.d.ts](types/images.d.ts) | Declaración de módulo TypeScript para imports de imágenes (`.png`, `.svg`, etc.). |

---

## 9. Migraciones SQL

| Archivo | Descripción |
|---|---|
| [supabase-schema.sql](supabase-schema.sql) | Esquema principal de la base de datos. |
| [migration-add-history.sql](migration-add-history.sql) | Agrega tabla/columnas de historial de comunicaciones. |
| [migration-add-user-type.sql](migration-add-user-type.sql) | Agrega columna `user_type` al perfil (`demo` / `basic` / `premium`). |
| [migration-add-analyzed-at.sql](migration-add-analyzed-at.sql) | Agrega timestamp `analyzed_at` a fondos. |
| [migration-add-unique-constraint.sql](migration-add-unique-constraint.sql) | Restricciones de unicidad en fondos. |
| [migration-email-tracking.sql](migration-email-tracking.sql) | Tabla de seguimiento de emails por fondo. |
| [migration-search-jobs.sql](migration-search-jobs.sql) | Tabla de jobs de búsqueda para integración n8n. |
| [update-fund-dates.sql](update-fund-dates.sql) | Script de actualización de fechas en fondos. |
| [manage-user-types.sql](manage-user-types.sql) | Script para gestionar tipos de usuario. |

---

## 10. Flujos de N8N

> Nota: Se listan los flujos identificados en la captura para que puedas completar el funcionamiento de cada uno.

1. FF Analisis - Analisis y clasificacion de los gestores de fondos
2. FutureFund Auto Search - Busqueda de los gestores de fondos
3. FF PRIMER CONTACTO REINTENTO - Reintento del primer contacto con los gestores de fondos
4. FF Forms - Scrapping de los gestores de fondos
5. FORMULARIO CONTACTO - Contacto con los gestores de fondos a través de sus formularios
6. FF PRIMER CONTACTO - Primer contacto con los gestores de fondos por correo electronico
7. FF CLASIFICADOR CORREOS - Clasificación de los correos recibidos por parte de los gestores de fondos
8. FF Analisis CORRECCION - Corrección de los perfiles de los gestores de fondos
9. FF RESPONDER CORREOS - Respuesta automatica de lo correos recibidos desde los gestores de fondos
10. Rectificacion - Correcciones realizadas a los datos de los perfiles de los gestores de fondos según lo requerido.
11. IC SN DATA - Flujo para el proyecto de Informe Confidencial
12. FF Clasificador tipo de fondos - Reclasificación de los tipos de gestores de fondos de acuerdo al listado entregado
13. RAG RecycleDigitly Mail - RAG
14. INFORMACION FINANCIERA TRIBUTBOT - RAG

---

## 11. Patrones Arquitectónicos Clave

- **Niveles de usuario**: `demo` / `basic` / `premium` almacenados en `profiles.user_type` — controla acceso a análisis automático y otras funciones premium.
- **Doble ruta de ejecución**: La búsqueda y análisis se ejecuta tanto en el cliente (llamadas directas a Gemini desde el browser) como en el servidor (vía Express + n8n para jobs en segundo plano).
- **Salida IA estructurada**: Todas las llamadas a Gemini usan definiciones de JSON schema (`Type.OBJECT`) para obtener respuestas estructuradas confiables.
- **Impact Scoring**: Los fondos se puntúan de 0–100 según alineación con ODS; valores legacy en string ("alta", "high") se normalizan a valores numéricos.
- **Auth completa**: Login, registro, recuperación y confirmación de email gestionados con Supabase Auth.
