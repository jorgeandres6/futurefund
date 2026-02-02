# 📧 Sistema de Seguimiento de Correos (Email Tracking)

## 📋 Descripción

Este sistema permite registrar y hacer seguimiento de todos los correos electrónicos enviados y recibidos por el proceso automático de N8N y las acciones manuales del frontend.

---

## 🗄️ Estructura de la Tabla

### Tabla: `email_tracking`

La tabla almacena información completa sobre cada correo procesado por el sistema.

#### Campos de la Tabla

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único del registro |
| `user_id` | UUID | Usuario relacionado con el correo (puede ser null) |
| `fund_id` | UUID | Fondo relacionado con el correo (puede ser null) |
| `email_type` | TEXT | Tipo de correo: `received` o `sent` |
| `from_email` | TEXT | Dirección del remitente |
| `to_email` | TEXT | Dirección del destinatario |
| `email_body` | TEXT | Cuerpo del correo (opcional) |
| `date` | TIMESTAMP | Fecha y hora del correo |

---

## 🔧 Instalación

### 1. Ejecutar la Migración

Ejecuta el archivo SQL en tu base de datos Supabase:

```sql
-- En el panel SQL de Supabase, ejecuta:
-- migration-email-tracking.sql
```

O usando la CLI de Supabase:

```bash
supabase db push migration-email-tracking.sql
```

### 2. Verificar la Creación

```sql
-- Verifica que la tabla se creó correctamente
SELECT * FROM email_tracking LIMIT 1;

-- Verifica las funciones
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_email_stats', 'log_email_sent');
```

---

## 💻 Uso en N8N

### Ejemplo: Registrar Correo Enviado

Después de enviar un correo en N8N (nodo de Email), agrega un nodo de Supabase:

#### Nodo Supabase: Log Email

```json
{
  "method": "POST",
  "url": "{{$env.SUPABASE_URL}}/rest/v1/rpc/log_email",
  "headers": {
    "apikey": "{{$env.SUPABASE_SERVICE_KEY}}",
    "Authorization": "Bearer {{$env.SUPABASE_SERVICE_KEY}}",
    "Content-Type": "application/json"
  },
  "body": {
    "p_email_type": "sent",
    "p_from_email": "noreply@futurefund.com",
    "p_to_email": "{{$json.to_email}}",
    "p_email_body": "{{$json.body}}",
    "p_user_id": "{{$json.user_id}}",
    "p_fund_id": "{{$json.fund_id}}"
  }
}
```

### Ejemplo: Inserción Directa

```json
{
  "method": "POST",
  "url": "{{$env.SUPABASE_URL}}/rest/v1/email_tracking",
  "headers": {
    "apikey": "{{$env.SUPABASE_SERVICE_KEY}}",
    "Authorization": "Bearer {{$env.SUPABASE_SERVICE_KEY}}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  },
  "body": {
    "email_type": "sent",
    "from_email": "noreply@futurefund.com",
    "to_email": "usuario@ejemplo.com",
    "email_body": "Hemos encontrado un nuevo fondo que coincide con tu perfil...",
    "user_id": "{{$json.user_id}}",
    "fund_id": "{{$json.fund_id}}"
  }
}
```

---

## 📊 Consultas Útiles

### Obtener Estadísticas de un Usuario

```sql
SELECT * FROM get_email_stats('user-uuid-aqui');
```

Resultado:
```
total_emails | sent_emails | received_emails | last_email_date
-------------|-------------|-----------------|----------------
25           | 20          | 5               | 2026-01-29 10:30
```

### Ver Correos Recientes de un Usuario

```sql
SELECT 
  email_type,
  from_email,
  to_email,
  date
FROM email_tracking
WHERE user_id = 'user-uuid-aqui'
ORDER BY date DESC
LIMIT 10;
```

### Correos Enviados a un Destinatario Específico

```sql
SELECT 
  from_email,
  email_body,
  date
FROM email_tracking
WHERE to_email = 'destinatario@ejemplo.com'
  AND email_type = 'sent'
ORDER BY date DESC;
```

### Correos por Fondo Específico

```sql
SELECT 
  e.email_type,
  e.from_email,
  e.to_email,
  e.date,
  f.nombre_fondo
FROM email_tracking e
JOIN funds f ON e.fund_id = f.id
WHERE e.fund_id = 'fund-uuid-aqui'
ORDER BY e.date DESC;
```

### Contar Correos por Tipo

```sql
SELECT 
  email_type,
  COUNT(*) as total
FROM email_tracking
GROUP BY email_type;
```

---

## 🎯 Casos de Uso

### 1. **Seguimiento Básico de Correos**

Registrar todos los correos enviados y recibidos por el sistema:
- Correos enviados por N8N (automáticos)
- Correos manuales del frontend
- Respuestas recibidas de fondos

### 2. **Auditoría Simple**

- Mantener registro histórico de comunicaciones
- Rastrear cuándo se contactó un fondo
- Verificar correos enviados a usuarios

### 3. **Análisis de Comunicación**

- Ver historial de correos por usuario
- Identificar fondos más contactados
- Estadísticas básicas de envío/recepción

### 4. **Reporting**

- Número de correos enviados por día
- Usuarios más activos en comunicaciones
- Fondos con más intercambio de correos

---

## 🔐 Seguridad (RLS)

La tabla tiene Row Level Security (RLS) habilitado:

- **Lectura**: Los usuarios solo pueden ver sus propios correos
- **Inserción**: El sistema puede insertar correos (usar service key desde N8N)
- **Eliminación**: Los usuarios pueden eliminar sus propios correos

### Acceso desde N8N

Para insertar desde N8N, usa el **Service Key**:

```
Authorization: Bearer <SUPABASE_SERVICE_KEY>
```

---

##  Próximos Pasos

1. **Ejecutar Migración en Supabase**
   - Aplicar el archivo `migration-email-tracking.sql`

2. **Integrar en N8N**
   - Agregar nodo de logging después de enviar correos
   - Usar la función `log_email()` o inserción directa

3. **Vista en Frontend**
   - Mostrar historial de correos en el perfil del usuario
   - Estadísticas básicas de comunicación

---

## 📖 Referencias

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [N8N Email Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.emailsend/)
- [N8N Supabase Node](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/)

---

## 🆘 Soporte

Para problemas o preguntas:
1. Revisa los logs de Supabase
2. Verifica las políticas RLS
3. Confirma que estás usando el Service Key correcto en N8N
