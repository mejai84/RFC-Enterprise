import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="brand" href="/">
          <Image
            src="/rfc-logo.svg"
            alt="RFC"
            width={34}
            height={34}
            priority
          />
          Representaciones Figueroa
        </Link>
        <div className="eyebrow">ERP empresarial</div>
        <h1 id="login-title">Bienvenido de nuevo</h1>
        <p>Ingresa con tu cuenta para acceder a las aplicaciones habilitadas.</p>
        <LoginForm />
        <p className="auth-note">
          El acceso se valida con Supabase Auth. Solicita al administrador la activación de tu cuenta.
        </p>
      </section>
    </main>
  );
}
