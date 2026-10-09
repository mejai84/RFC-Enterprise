import Link from "next/link";
import Image from "next/image";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page} id="main-content">
      <nav className={styles.nav} aria-label="Navegacion para volver">
        <Link className={styles.brand} href="/" aria-label="Representaciones Figueroa Castro, inicio">
          <Image src="/rfc-logo.svg" alt="RFC Representaciones Figueroa Castro" width={42} height={42} priority />
          <span>Representaciones<br />Figueroa Castro</span>
        </Link>
        <Link className={styles.portal} href="/login">Acceso al portal</Link>
      </nav>
      <section className={styles.content} aria-labelledby="not-found-title">
        <div className={styles.copy}>
          <p className={styles.code}>Error 404</p>
          <h1 id="not-found-title">Esta pieza no encajo en el plano.</h1>
          <p>La direccion que busca no existe o cambio de ubicacion. Regresemos a un punto conocido.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/">Ir a la portada</Link>
            <Link className={styles.secondary} href="/login">Entrar al portal</Link>
          </div>
        </div>
        <div className={styles.diagram} aria-hidden="true">
          <span className={styles.cornerA} />
          <span className={styles.cornerB} />
          <span className={styles.beamA} />
          <span className={styles.beamB} />
          <span className={styles.core}>404</span>
          <span className={styles.measure}>RFC / ESTRUCTURA / 404</span>
        </div>
      </section>
    </main>
  );
}
