# Función de contacto de la portada

Edge Function pública que recibe el formulario de la portada, valida los datos y
entrega la solicitud a un proveedor transaccional (Resend por defecto). No usa
`localStorage`, no escribe datos personales en Supabase y no expone claves al
navegador.

## Variables de entorno

Configúralas en Supabase → Edge Functions → Secrets (o con `supabase secrets set`):

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `RESEND_API_KEY` | Sí | Llave secreta del proveedor. Nunca se guarda en el repositorio. |
| `CONTACT_TO_EMAIL` | Sí | Buzón corporativo receptor. Admite hasta 3 correos separados por coma o punto y coma. |
| `CONTACT_FROM_EMAIL` | Sí | Remitente verificado en el proveedor, por ejemplo `RFC Enterprise <no-reply@rfcdominio.com>`. |
| `CONTACT_ALLOWED_ORIGIN` | S? | Origen permitido para CORS, por ejemplo `https://rfcdominio.com,https://www.rfcdominio.com`. La funci?n rechaza solicitudes hasta configurarlo. |

Variables del frontend (build de Next.js):

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_CONTACT_FUNCTION_URL` | URL completa de la función. Si no se define, se usa `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contact-form`. |

## Despliegue

```bash
supabase functions deploy contact-form --no-verify-jwt
```

La función es pública porque la portada no requiere sesión. La protección viene
de la validación, el honeypot, la trampa de tiempo, el límite por IP y el límite
global. El rate limit es **en memoria por isolate**; si el proyecto escala a
varias instancias y se necesita un límite durable, se debe conectar a un almacén
compartido (por ejemplo Upstash Redis o una tabla de Supabase) en una migración
coordinada.

## Prueba manual

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/contact-form" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"name":"Prueba RFC","email":"prueba@example.com","location":"Caucasia","service":"Otra necesidad","message":"Solicitud de prueba con más de diez caracteres.","startedAt":1}'
```

No incluyas llaves reales en la terminal compartida ni en capturas. Para revisar
la entrega, usa un buzón de pruebas y rota la llave si se filtró.
