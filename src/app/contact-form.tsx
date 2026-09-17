"use client";

import { useState, type FormEvent } from "react";

const recipient = "rfcsas094@gmail.com";

export function ContactForm() {
  const [message, setMessage] = useState("");

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = [
      `Nombre: ${data.get("name")}`,
      `Empresa: ${data.get("company") || "No indicada"}`,
      `Correo: ${data.get("email")}`,
      `Ubicación: ${data.get("location")}`,
      `Tipo de necesidad: ${data.get("service")}`,
      "",
      "Detalle:",
      String(data.get("message") || ""),
    ].join("\n");
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent("Solicitud desde el sitio web RFC")}&body=${encodeURIComponent(body)}`;
    setMessage("Se abrirá su cliente de correo con la solicitud preparada para enviar.");
  }

  return <form className="site-contact-form" aria-describedby="contact-form-note" onSubmit={submitRequest}>
    <div className="site-form-grid">
      <label>Nombre completo<input name="name" autoComplete="name" placeholder="Cómo le llamamos" required /></label>
      <label>Empresa u organización<input name="company" autoComplete="organization" placeholder="Opcional" /></label>
      <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" required /></label>
      <label>Ciudad o municipio<input name="location" autoComplete="address-level2" placeholder="Dónde se realizará" required /></label>
    </div>
    <label className="site-form-full">Tipo de necesidad<select name="service" defaultValue="" required><option value="" disabled>Seleccione una opción</option><option>Arquitectura e ingeniería</option><option>Estructuras metálicas</option><option>Mantenimiento integral</option><option>Paisajismo y exteriores</option><option>Otra necesidad</option></select></label>
    <label className="site-form-full">Cuéntenos brevemente<textarea name="message" rows={5} placeholder="Alcance, estado actual, fechas o cualquier dato que nos ayude a entender el proyecto." required /></label>
    <button className="site-form-button" type="submit">Enviar solicitud</button>
    <p className="site-form-note" id="contact-form-note">La solicitud se prepara para enviarse al canal corporativo. Sus datos no se publican en esta página.</p>
    {message ? <p className="site-form-note" role="status">{message}</p> : null}
  </form>;
}
