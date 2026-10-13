import Link from "next/link";

/** Maqueta navegable: todavía no autentica ni almacena credenciales. */
export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand" href="/"><span className="brand-mark">RF</span>Representaciones Figueroa</Link>
        <p className="eyebrow">Acceso</p>
        <h1>Ingresa a la plataforma</h1>
        <p>La operación interna de Representaciones Figueroa Castro se centraliza aquí.</p>
        <form>
          <label className="form-field">Correo<input type="email" name="email" placeholder="nombre@empresa.com" /></label>
          <label className="form-field">Contraseña<input type="password" name="password" placeholder="••••••••" /></label>
          <button className="primary-button" type="submit">Continuar</button>
        </form>
        <p className="auth-note">Pantalla de demostración. No procesa credenciales.</p>
        <p className="auth-note"><Link href="/">Volver al sitio</Link></p>
      </section>
    </main>
  );
}
