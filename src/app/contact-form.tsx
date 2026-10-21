"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const contactFunctionUrl =
  process.env.NEXT_PUBLIC_CONTACT_FUNCTION_URL?.trim().replace(/\/+$/, "") ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/contact-form`
    : "");

type SubmitStatus = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const honeypot = String(data.get("website") ?? "").trim();

    // Trampa antispam: un humano no ve ni completa este campo. Se responde
    // como éxito para no dar señales al bot.
    if (honeypot) {
      setStatus("success");
      setMessage("Recibimos tu solicitud. Te contactaremos pronto.");
      form.reset();
      startedAt.current = Date.now();
      return;
    }

    if (!contactFunctionUrl) {
      setStatus("error");
      setMessage(
        "El canal de contacto no está configurado. Escríbenos al correo corporativo mientras habilitamos el formulario.",
      );
      return;
    }

    setStatus("sending");
    setMessage("Enviando tu solicitud…");

    try {
      const response = await fetch(contactFunctionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          company: String(data.get("company") ?? ""),
          email: String(data.get("email") ?? ""),
          location: String(data.get("location") ?? ""),
          service: String(data.get("service") ?? ""),
          message: String(data.get("message") ?? ""),
          website: "",
          startedAt: startedAt.current,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(
          result.error ||
            "No fue posible enviar la solicitud. Intenta nuevamente en unos minutos.",
        );
        return;
      }

      setStatus("success");
      setMessage(
        result.message ||
          "Recibimos tu solicitud. El equipo de RFC se pondrá en contacto contigo.",
      );
      form.reset();
      startedAt.current = Date.now();
    } catch {
      setStatus("error");
      setMessage(
        "No fue posible comunicarnos con el canal de contacto. Revisa tu conexión e intenta nuevamente.",
      );
    }
  }

  return (
    <form
      className="site-contact-form"
      aria-describedby="contact-form-note"
      onSubmit={submitRequest}
    >
      <div className="site-form-grid">
        <label>
          Nombre completo
          <input
            name="name"
            autoComplete="name"
            placeholder="Cómo le llamamos"
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          Empresa u organización
          <input
            name="company"
            autoComplete="organization"
            placeholder="Opcional"
            maxLength={160}
          />
        </label>
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            maxLength={254}
            required
          />
        </label>
        <label>
          Ciudad o municipio
          <input
            name="location"
            autoComplete="address-level2"
            placeholder="Dónde se realizará"
            minLength={2}
            maxLength={160}
            required
          />
        </label>
      </div>
      <label className="site-form-full">
        Tipo de necesidad
        <select name="service" defaultValue="" required>
          <option value="" disabled>Seleccione una opción</option>
          <option>Arquitectura e ingeniería</option>
          <option>Estructuras metálicas</option>
          <option>Mantenimiento integral</option>
          <option>Paisajismo y exteriores</option>
          <option>Otra necesidad</option>
        </select>
      </label>
      <label className="site-form-full">
        Cuéntenos brevemente
        <textarea
          name="message"
          rows={5}
          placeholder="Alcance, estado actual, fechas o cualquier dato que nos ayude a entender el proyecto."
          minLength={10}
          maxLength={3000}
          required
        />
      </label>
      <label
        aria-hidden="true"
        style={{ height: 1, left: -9999, opacity: 0, overflow: "hidden", position: "absolute", width: 1 }}
      >
        No completar este campo
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button
        className="site-form-button"
        type="submit"
        disabled={status === "sending" || !contactFunctionUrl}
      >
        {status === "sending" ? "Enviando…" : "Enviar solicitud"}
      </button>
      <p className="site-form-note" id="contact-form-note">
        La solicitud se envía directamente al canal corporativo. Sus datos no se
        almacenan en este navegador ni se publican en esta página.
      </p>
      {!contactFunctionUrl ? (
        <p className="site-form-note" role="status">
          El canal de contacto no está configurado en este entorno. Define
          NEXT_PUBLIC_CONTACT_FUNCTION_URL o NEXT_PUBLIC_SUPABASE_URL.
        </p>
      ) : null}
      {message ? (
        <p
          className="site-form-note"
          role="status"
          aria-live="polite"
          data-status={status}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
