import Image from "next/image";
import Link from "next/link";
import { PasswordRecoveryForm } from "./password-recovery-form";

export default function ResetPasswordPage() {
  return <main className="auth-page"><section className="auth-card" aria-labelledby="password-title">
    <Link className="brand" href="/"><Image src="/rfc-logo.svg" alt="RFC" width={34} height={34} priority />Representaciones Figueroa</Link>
    <div className="eyebrow">Seguridad de cuenta</div>
    <h1 id="password-title">Contraseña de acceso</h1>
    <PasswordRecoveryForm />
  </section></main>;
}
