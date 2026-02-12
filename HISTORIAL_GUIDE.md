# Funcionalidad de Historial de Fondos

## Descripción General
Se ha agregado una nueva pestaña "Historial" en el modal de detalles de cada fondo que permite registrar y visualizar todas las comunicaciones e interacciones con el fondo.

## Cambios Implementados

### 1. Tipos Actualizados (`types.ts`)
Se agregaron dos nuevas interfaces:

#### `HistoryEntry`
```typescript
{
  id?: string;
  type: 'email_sent' | 'email_received' | 'form_filled' | 'note' | 'call' | 'meeting';
  date: string;
  description: string;
  details?: {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    form_name?: string;
    form_data?: Record<string, any>;
    notes?: string;
    [key: string]: any;
  };
}
```

#### Campo `history` en `Fund`
- Tipo: `HistoryEntry[]`
- Almacena el historial completo de interacciones

### 2. Nueva Pestaña en el Modal (`FundDetailModal.tsx`)
- **Ubicación**: Cuarta pestaña después de "Información General", "Aplicación" y "Emails"
- **Nombre**: "Historial"
- **Indicador**: Badge morado con el número de entradas en el historial

### 3. Tipos de Entradas Soportadas

| Tipo | Icono | Color | Uso |
|------|-------|-------|-----|
| `email_sent` | Sobre cerrado | Azul | Email enviado al fondo |
| `email_received` | Sobre abierto | Verde | Email recibido del fondo |
| `form_filled` | Documento | Morado | Formulario de aplicación completado |
| `note` | Lápiz | Amarillo | Nota o comentario interno |
| `call` | Teléfono | Índigo | Llamada telefónica |
| `meeting` | Personas | Rojo | Reunión presencial o virtual |

### 4. Estructura de la Base de Datos
La migración SQL en `migration-add-history.sql` agrega:
- Columna `history` de tipo JSONB
- Valor por defecto: array vacío `[]`
- Índice GIN para búsquedas eficientes

## Cómo Usar

### Visualizar el Historial
1. Hacer clic en cualquier fondo del dashboard
2. Seleccionar la pestaña "Historial"
3. Ver todas las entradas ordenadas por fecha (más recientes primero)

### Agregar una Entrada al Historial

#### Ejemplo 1: Email Enviado
```typescript
const newEntry: HistoryEntry = {
  type: 'email_sent',
  date: new Date().toISOString(),
  description: 'Email de solicitud de información',
  details: {
    from: 'usuario@empresa.com',
    to: 'contacto@fondo.com',
    subject: 'Solicitud de información adicional',
    body: 'Estimados:\n\nMe gustaría solicitar...'
  }
};

// Agregar al historial del fondo
fund.history = [...(fund.history || []), newEntry];
```

#### Ejemplo 2: Formulario Completado
```typescript
const formEntry: HistoryEntry = {
  type: 'form_filled',
  date: new Date().toISOString(),
  description: 'Formulario de aplicación completado',
  details: {
    form_name: 'Aplicación DAF 2026',
    form_data: {
      empresa: 'Mi Empresa S.A.',
      monto_solicitado: '50000',
      plazo: '24 meses'
    }
  }
};
```

#### Ejemplo 3: Nota Interna
```typescript
const noteEntry: HistoryEntry = {
  type: 'note',
  date: new Date().toISOString(),
  description: 'Seguimiento pendiente',
  details: {
    notes: 'El gestor mencionó que la próxima ronda abre en marzo. Hacer seguimiento la primera semana.'
  }
};
```

#### Ejemplo 4: Llamada Telefónica
```typescript
const callEntry: HistoryEntry = {
  type: 'call',
  date: new Date().toISOString(),
  description: 'Llamada con gestor del fondo',
  details: {
    notes: 'Conversación duró 20 minutos. El gestor confirma interés en nuestro proyecto. Siguiente paso: enviar documentación financiera.'
  }
};
```

## Migración de Datos

Para ejecutar la migración en Supabase:

1. Acceder al editor SQL de Supabase
2. Copiar el contenido de `migration-add-history.sql`
3. Ejecutar la migración
4. Verificar que la columna `history` se haya creado correctamente

```sql
-- Verificar la columna
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'funds' AND column_name = 'history';
```

## Beneficios

1. **Centralización**: Todo el historial de comunicaciones en un solo lugar
2. **Trazabilidad**: Registro completo de todas las interacciones
3. **Contexto**: Información detallada de cada comunicación
4. **Organización**: Vista cronológica ordenada automáticamente
5. **Tipificación**: Íconos y colores para identificar rápidamente el tipo de entrada

## Próximos Pasos

Para futuras mejoras, se podría:
- Agregar botón para crear nuevas entradas desde la UI
- Filtrar entradas por tipo
- Búsqueda dentro del historial
- Exportar historial a PDF o Excel
- Notificaciones de seguimiento basadas en el historial
- Integración automática con el sistema de emails
