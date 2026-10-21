// Edge Function pública del formulario de contacto de la portada.
// Runtime: Supabase Edge Functions (Deno). No usa claves de Supabase: solo el
// proveedor transaccional configurado por variables de entorno del proyecto.
//
// Variables requeridas:
//   RESEND_API_KEY          Llave del proveedor transaccional (secreto).
//   CONTACT_TO_EMAIL        Buzón corporativo receptor (uno o varios separados por coma).
//   CONTACT_FROM_EMAIL      Remitente verificado en el proveedor.
// Requeridas:
//   CONTACT_ALLOWED_ORIGIN  Origen(es) permitidos para CORS, separados por coma.
//                           La funci?n rechaza solicitudes hasta configurarlo.
//
// La función no persiste datos personales. El rate limit es en memoria por
// isolate; para una protección durable se requiere un almacén compartido.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 100;
const MAX_BODY_BYTES = 20_000;

const ALLOWED_SERVICES = new Set([
  "Arquitectura e ingeniería",
  "Estructuras metálicas",
  "Mantenimiento integral",
  "Paisajismo y exteriores",
  "Otra necesidad",
]);

type RateBucket = { count: number; resetAt: number };
const buckets = new Map<string, RateBucket>();

function checkRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (now > bucket.resetAt) buckets.delete(bucketKey);
      }
    }
    return false;
  }
  if (current.count >= max) return true;
  current.count += 1;
  return false;
}

function configuredOrigins(): string[] {
  return (Deno.env.get("CONTACT_ALLOWED_ORIGIN") ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsHeaders(origin?: string): HeadersInit {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin?: string,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

function cleanText(value: unknown, maxLength: number, allowNewlines = false): string {
  const raw = typeof value === "string" ? value : "";
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(allowNewlines ? /[^\S\n]+/g : /\s+/g, " ")
    .trim();
  const withoutControls = normalized.replace(
    allowNewlines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g,
    "",
  );
  return withoutControls.slice(0, maxLength);
}

function isEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) &&
    !/[\r\n]/.test(value)
  );
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwarded ||
    "unknown"
  );
}

function recipients(): string[] {
  return (Deno.env.get("CONTACT_TO_EMAIL") ?? "")
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter((value) => isEmail(value))
    .slice(0, 3);
}

function safeHeader(value: string, fallback: string): string {
  const cleaned = value.replace(/[\r\n]+/g, " ").trim();
  return cleaned || fallback;
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("origin")?.replace(/\/+$/, "") ?? "";
  const allowedOrigins = configuredOrigins();
  if (!allowedOrigins.length) {
    console.error("contact-form: falta CONTACT_ALLOWED_ORIGIN.");
    return jsonResponse(
      { error: "El canal de contacto no est? configurado." },
      503,
    );
  }
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return jsonResponse({ error: "Origen no permitido." }, 403);
  }
  const allowedOrigin = requestOrigin;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405, allowedOrigin);
  }

  const ip = clientIp(request);
  if (checkRateLimit(`ip:${ip}`, MAX_PER_IP) || checkRateLimit("global", MAX_GLOBAL)) {
    return jsonResponse(
      {
        error:
          "Recibimos demasiadas solicitudes desde esta conexión. Espera unos minutos antes de intentarlo de nuevo.",
      },
      429,
      allowedOrigin,
      { "Retry-After": "600" },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "La solicitud es demasiado grande." }, 413, allowedOrigin);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "La solicitud es demasiado grande." }, 413, allowedOrigin);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    payload = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "El cuerpo de la solicitud no es válido." }, 400, allowedOrigin);
  }

  // Honeypot. Se responde como éxito para no revelar el filtro.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonResponse({ ok: true, message: "Recibimos tu solicitud." }, 200, allowedOrigin);
  }

  const startedAt = Number(payload.startedAt);
  if (
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    Date.now() - startedAt < 1_500
  ) {
    return jsonResponse(
      { error: "La solicitud se envió demasiado rápido. Intenta nuevamente." },
      400,
      allowedOrigin,
    );
  }

  const name = cleanText(payload.name, 120);
  const company = cleanText(payload.company, 160);
  const email = cleanText(payload.email, 254).toLowerCase();
  const location = cleanText(payload.location, 160);
  const service = cleanText(payload.service, 80);
  const message = cleanText(payload.message, 3_000, true);

  if (name.length < 2) {
    return jsonResponse({ error: "Indica tu nombre completo." }, 400, allowedOrigin);
  }
  if (!isEmail(email)) {
    return jsonResponse({ error: "Indica un correo electrónico válido." }, 400, allowedOrigin);
  }
  if (location.length < 2) {
    return jsonResponse({ error: "Indica la ciudad o municipio." }, 400, allowedOrigin);
  }
  if (!ALLOWED_SERVICES.has(service)) {
    return jsonResponse({ error: "Selecciona un tipo de necesidad válido." }, 400, allowedOrigin);
  }
  if (message.length < 10) {
    return jsonResponse(
      { error: "Cuéntanos un poco más sobre la necesidad (mínimo 10 caracteres)." },
      400,
      allowedOrigin,
    );
  }

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("CONTACT_FROM_EMAIL")?.trim();
  const to = recipients();
  if (!apiKey || !from || !to.length) {
    console.error("contact-form: faltan RESEND_API_KEY, CONTACT_FROM_EMAIL o CONTACT_TO_EMAIL.");
    return jsonResponse(
      {
        error:
          "El canal de contacto no está configurado. Escríbenos al correo corporativo mientras lo habilitamos.",
      },
      503,
      allowedOrigin,
    );
  }

  const subject = safeHeader(
    `Solicitud web RFC · ${service} · ${name}`,
    "Solicitud web RFC",
  );
  const text = [
    `Nombre: ${name}`,
    `Empresa: ${company || "No indicada"}`,
    `Correo: ${email}`,
    `Ubicación: ${location}`,
    `Tipo de necesidad: ${service}`,
    "",
    "Detalle:",
    message,
    "",
    `Recibida: ${new Date().toISOString()}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: safeHeader(from, "RFC Enterprise <no-reply@localhost>"),
        to,
        reply_to: email,
        subject,
        text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // No se registra el cuerpo del proveedor ni datos del visitante.
      console.error("contact-form: el proveedor rechazó el envío.", response.status);
      return jsonResponse(
        {
          error:
            "No fue posible entregar la solicitud en este momento. Intenta nuevamente en unos minutos.",
        },
        502,
        allowedOrigin,
      );
    }

    return jsonResponse(
      {
        ok: true,
        message:
          "Recibimos tu solicitud. El equipo de RFC se pondrá en contacto contigo.",
      },
      200,
      allowedOrigin,
    );
  } catch (error) {
    console.error(
      "contact-form: error de red con el proveedor.",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonResponse(
      {
        error:
          "No fue posible entregar la solicitud en este momento. Intenta nuevamente en unos minutos.",
      },
      502,
      allowedOrigin,
    );
  } finally {
    clearTimeout(timeout);
  }
});
