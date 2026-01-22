# Migración: Agregar campo user_type

## ✅ Cambios realizados en el código

Se ha agregado el campo `user_type` en:

1. **types.ts** - Interface `CompanyProfile`:
   - Campo: `userType?: 'demo' | 'basic' | 'premium'`

2. **types/database.ts** - Tipos de Supabase:
   - `Row`: `user_type: string`
   - `Insert`: `user_type?: string`
   - `Update`: `user_type?: string`

3. **services/supabaseService.ts**:
   - `saveProfile()`: Guarda `user_type` con valor por defecto 'demo'
   - `loadProfile()`: Lee `user_type` de la base de datos

4. **supabase-schema.sql**:
   - Columna agregada con `DEFAULT 'demo'`
   - Constraint: `CHECK (user_type IN ('demo', 'basic', 'premium'))`

## 🚀 Pasos para aplicar en Supabase

### Opción 1: SQL Editor (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Abre el **SQL Editor** desde el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido de `migration-add-user-type.sql`
5. Ejecuta la query (botón "Run" o Ctrl+Enter)

### Opción 2: Table Editor

1. Ve a **Table Editor** > `profiles`
2. Click en "Add Column"
3. Configura:
   - Name: `user_type`
   - Type: `text`
   - Default Value: `'demo'`
   - Is Nullable: No ✓
4. Guarda los cambios

Luego ejecuta en SQL Editor:
```sql
ALTER TABLE profiles 
ADD CONSTRAINT check_user_type 
CHECK (user_type IN ('demo', 'basic', 'premium'));
```

## ✅ Verificación

Después de ejecutar la migración, verifica:

```sql
-- Ver estructura de la tabla
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'user_type';

-- Ver usuarios existentes
SELECT user_id, company_name, user_type
FROM profiles
LIMIT 10;
```

Todos los usuarios existentes deberían tener `user_type = 'demo'` automáticamente.

## 📝 Tipos de usuario

- **demo**: Usuario de prueba gratuito (por defecto)
- **basic**: Usuario con plan básico
- **premium**: Usuario con plan premium

## 🔄 Próximos pasos

Ahora puedes:
1. Implementar lógica de restricción de features basada en `userType`
2. Crear pantalla de upgrade de plan
3. Agregar lógica de pago para cambiar de demo → basic → premium

Ejemplo de uso:
```typescript
if (user?.profile?.userType === 'demo') {
  // Mostrar banner "Upgrade to Premium"
  // Limitar funcionalidades
}
```
