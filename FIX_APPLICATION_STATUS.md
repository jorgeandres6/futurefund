# Fix: Application Status External Updates

## Problema Identificado

Cuando una aplicación externa cambiaba el campo `application_status` en la base de datos, ese cambio se revertía automáticamente al estado "PENDIENTE" o se perdía.

### Causas del Problema

1. **Borrado y Reinserción Completa**: La función `saveFunds()` borraba TODOS los fondos del usuario y los volvía a insertar desde el estado local, perdiendo cualquier cambio externo.

2. **Persistencia Agresiva**: El `useEffect` en `App.tsx` ejecutaba `saveFunds()` cada vez que el estado `funds` cambiaba, sobrescribiendo constantemente la base de datos.

3. **Valores por Defecto Forzados**: El código establecía `'PENDIENTE'` como valor por defecto tanto al cargar como al guardar fondos.

## Solución Implementada

### 1. Cambio de DELETE+INSERT a UPSERT

**Archivo**: [services/supabaseService.ts](services/supabaseService.ts)

- Eliminamos el `DELETE` de todos los fondos
- Implementamos `UPSERT` con `onConflict: 'user_id,nombre_fondo'`
- Solo se actualiza `application_status` si la aplicación lo proporciona explícitamente
- Los cambios externos se preservan si el campo es `null` o `undefined` en el estado local

```typescript
// Antes (PROBLEMA)
await supabase.from('funds').delete().eq('user_id', userId);
await supabase.from('funds').insert(fundsData);

// Después (SOLUCIÓN)
await supabase.from('funds').upsert(fundsData, {
  onConflict: 'user_id,nombre_fondo',
  ignoreDuplicates: false
});
```

### 2. Persistencia Inteligente

**Archivo**: [App.tsx](App.tsx)

- Agregamos comparación profunda (via JSON) para detectar cambios reales
- Solo se persiste cuando los fondos realmente han cambiado
- Evita guardar en cada render

```typescript
const lastSavedFundsRef = useRef<string>('');

// Solo guardar si hay cambios reales
const currentFundsJSON = JSON.stringify(funds);
if (currentFundsJSON !== lastSavedFundsRef.current) {
  await saveFunds(userId, funds);
  lastSavedFundsRef.current = currentFundsJSON;
}
```

### 3. Eliminación de Valores por Defecto

- Al cargar: `applicationStatus: item.application_status || undefined` (en lugar de `'PENDIENTE'`)
- Al guardar: Solo se incluye `application_status` si está definido
- En UI: Se muestra "Sin definir" para valores `undefined`

### 4. Restricción Única en Base de Datos

**Archivo**: [migration-add-unique-constraint.sql](migration-add-unique-constraint.sql)

Se debe ejecutar esta migración en Supabase para permitir el UPSERT:

```sql
ALTER TABLE funds 
ADD CONSTRAINT funds_user_fund_unique 
UNIQUE (user_id, nombre_fondo);
```

## Instrucciones de Implementación

1. **Aplicar la migración SQL**:
   - Ve al SQL Editor en Supabase
   - Ejecuta el contenido de `migration-add-unique-constraint.sql`

2. **Verificar el comportamiento**:
   - Los cambios de código ya están aplicados
   - La aplicación ahora usa UPSERT
   - Los cambios externos se preservarán

## Comportamiento Esperado

### Antes
```
1. App externa cambia application_status a "APROBADO"
2. Usuario hace búsqueda en FutureFund
3. useEffect ejecuta saveFunds()
4. saveFunds() borra todo y reinserta
5. application_status vuelve a "PENDIENTE" ❌
```

### Después
```
1. App externa cambia application_status a "APROBADO"
2. Usuario hace búsqueda en FutureFund
3. useEffect detecta que no hay cambios reales (JSON igual)
4. No se ejecuta saveFunds() o se ejecuta con UPSERT
5. application_status se preserva como "APROBADO" ✅
```

## Archivos Modificados

- [services/supabaseService.ts](services/supabaseService.ts) - Cambio a UPSERT
- [App.tsx](App.tsx) - Persistencia inteligente
- [components/Dashboard.tsx](components/Dashboard.tsx) - UI actualizada
- [migration-add-unique-constraint.sql](migration-add-unique-constraint.sql) - Nueva migración

## Notas Técnicas

- La restricción `UNIQUE (user_id, nombre_fondo)` asume que no habrá fondos duplicados con el mismo nombre para un usuario
- Si existe esa posibilidad, considerar agregar `ticker_isin` a la clave única
- El spread operator `...(fund.applicationStatus ? { application_status: fund.applicationStatus } : {})` asegura que el campo solo se incluye si tiene valor
