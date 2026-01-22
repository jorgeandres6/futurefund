# Guía de Configuración de Supabase para FutureFund

## Pasos para configurar Supabase

### 1. Crear una cuenta en Supabase
1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta gratuita
3. Crea un nuevo proyecto

### 2. Configurar la base de datos
1. En el panel de Supabase, ve a **SQL Editor**
2. Copia el contenido del archivo `supabase-schema.sql`
3. Pégalo en el editor y ejecuta el script
4. Esto creará las tablas `profiles` y `funds` con sus políticas RLS

### 3. Obtener las credenciales
1. En el panel de Supabase, ve a **Settings** > **API**
2. Copia los siguientes valores:
   - **Project URL**: Tu URL de Supabase
   - **anon/public key**: Tu clave pública (anon key)

### 4. Configurar variables de entorno
1. Crea un archivo `.env` en la raíz del proyecto (copia de `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Edita el archivo `.env` con tus credenciales:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publica-aqui
   ```

### 5. Configurar autenticación por email
1. En Supabase, ve a **Authentication** > **Settings**
2. Asegúrate de que **Email Auth** esté habilitado
3. Opcional: Configura plantillas de email personalizadas
4. Opcional: Desactiva la confirmación de email para pruebas (en **Email Auth Providers**)

### 6. Ejecutar la aplicación
```bash
npm install
npm run dev
```

## Estructura de la base de datos

### Tabla `profiles`
Almacena los perfiles corporativos de los usuarios:
- Información de la empresa
- Tipo de financiamiento buscado
- ODS seleccionados
- Archivos adjuntos (brief, financials)
- Métricas financieras
- Resumen generado por IA

### Tabla `funds`
Almacena los fondos de inversión encontrados:
- Información del fondo
- ODS detectados
- Puntuación de impacto
- Análisis de aplicación
- Estado de la aplicación

## Seguridad

Las políticas de Row Level Security (RLS) aseguran que:
- Los usuarios solo pueden ver y editar sus propios datos
- Cada usuario está aislado de los datos de otros usuarios
- Las operaciones están autenticadas mediante Supabase Auth

## Características implementadas

✅ **Autenticación**
- Registro de nuevos usuarios
- Inicio de sesión
- Cierre de sesión
- Persistencia de sesión

✅ **Gestión de perfiles**
- Crear perfil corporativo
- Actualizar perfil
- Guardar archivos en base64
- Generar resumen con IA

✅ **Gestión de fondos**
- Guardar resultados de búsqueda
- Cargar fondos al iniciar sesión
- Actualizar estado de aplicaciones
- Persistencia automática

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Reinicia el servidor de desarrollo después de crear/editar `.env`

### Error en la autenticación
- Verifica que ejecutaste el script SQL correctamente
- Confirma que las políticas RLS están habilitadas
- Revisa los logs en el panel de Supabase

### Datos no se guardan
- Verifica que las políticas RLS permiten INSERT/UPDATE
- Confirma que el usuario está autenticado
- Revisa la consola del navegador para errores

## Próximos pasos (opcional)

- Implementar almacenamiento de archivos con Supabase Storage
- Añadir búsqueda en tiempo real con Supabase Realtime
- Configurar backups automáticos
- Implementar límites de tamaño para archivos
