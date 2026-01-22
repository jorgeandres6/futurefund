# Inicio Rápido - Integración Supabase en FutureFund

## ✅ Ya Completado

1. ✅ Instalada la dependencia `@supabase/supabase-js`
2. ✅ Creados servicios de Supabase (cliente y funciones)
3. ✅ Actualizado el sistema de autenticación
4. ✅ Implementada persistencia de perfiles y fondos
5. ✅ Configurado el archivo de variables de entorno

## 🚀 Pasos para Activar Supabase

### 1. Crear proyecto en Supabase (5 minutos)
1. Ve a https://supabase.com y crea una cuenta gratuita
2. Crea un nuevo proyecto
3. Espera a que el proyecto termine de configurarse

### 2. Configurar la base de datos (2 minutos)
1. En tu proyecto de Supabase, ve a **SQL Editor**
2. Abre el archivo `supabase-schema.sql` de este proyecto
3. Copia todo el contenido y pégalo en el SQL Editor
4. Haz clic en **Run** para ejecutar el script
5. Verás las tablas `profiles` y `funds` creadas

### 3. Configurar variables de entorno (1 minuto)
1. En Supabase, ve a **Settings** → **API**
2. Copia estos dos valores:
   - **Project URL** (ej: https://xxxxxxxxxxxxx.supabase.co)
   - **anon/public key** (la clave pública larga)

3. Crea un archivo `.env` en la raíz del proyecto:
   ```bash
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_publica_aqui
   ```

### 4. Configurar autenticación (30 segundos)
1. En Supabase, ve a **Authentication** → **Providers**
2. Asegúrate de que **Email** esté habilitado
3. Para desarrollo, desactiva "Confirm email" en **Email Auth**

### 5. Ejecutar la aplicación
```bash
npm run dev
```

## 🎯 ¿Qué cambió?

### Antes (localStorage)
- Los datos se guardaban solo en el navegador
- Si borrabas las cookies, perdías todo
- No había verdadera autenticación

### Ahora (Supabase)
- ✅ **Autenticación real** con email/password
- ✅ **Base de datos en la nube** (PostgreSQL)
- ✅ **Sincronización automática** de datos
- ✅ **Seguridad** con Row Level Security
- ✅ **Datos persistentes** entre dispositivos

## 📁 Archivos Creados/Modificados

### Nuevos archivos:
- `services/supabaseClient.ts` - Cliente de Supabase
- `services/supabaseService.ts` - Funciones para guardar/cargar datos
- `types/database.ts` - Tipos TypeScript para la base de datos
- `supabase-schema.sql` - Script SQL para crear tablas
- `.env.example` - Plantilla de variables de entorno
- `SUPABASE_SETUP.md` - Guía detallada

### Archivos modificados:
- `components/AuthScreen.tsx` - Usa Supabase Auth
- `App.tsx` - Integrado con Supabase para perfiles y fondos
- `package.json` - Añadida dependencia de Supabase

## 🔍 Verificar que funciona

1. Abre la aplicación
2. Crea una cuenta nueva
3. Completa el perfil corporativo
4. Realiza una búsqueda de fondos
5. Cierra sesión y vuelve a entrar
6. ✅ Todos tus datos deberían estar ahí!

## ⚠️ Problemas comunes

### "Missing Supabase environment variables"
→ Verifica que creaste el archivo `.env` y reinicia el servidor

### "Invalid API key"
→ Revisa que copiaste la clave correcta (anon/public, no service_role)

### "User not found" al hacer login
→ Verifica que ejecutaste el script SQL correctamente

### Los datos no se guardan
→ Revisa la consola del navegador para ver errores
→ Verifica en Supabase → Table Editor que las tablas existen

## 📊 Ver tus datos en Supabase

1. Ve a **Table Editor** en tu proyecto de Supabase
2. Verás las tablas `profiles` y `funds`
3. Puedes ver y editar los datos directamente ahí

## 🎓 Próximos pasos opcionales

- Configurar Storage de Supabase para archivos grandes
- Añadir confirmación por email
- Implementar recuperación de contraseña
- Añadir límites de tasa (rate limiting)
- Configurar backups automáticos

## 📚 Documentación

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
