import Link from "next/link";
import Image from "next/image";

const services = [
  ["01", "Arquitectura e ingeniería", "Planeación y acompañamiento técnico para convertir una necesidad en una solución construible."],
  ["02", "Estructuras metálicas", "Fabricación de elementos estructurales con atención al detalle, la seguridad y el desempeño."],
  ["03", "Mantenimiento integral", "Soporte a instalaciones y espacios para preservar su operación y su valor en el tiempo."],
  ["04", "Paisajismo", "Intervenciones exteriores que conectan funcionalidad, entorno y experiencia."],
];

export default function Home() {
  return (
    <main className="site-page" id="main-content" tabIndex={-1}>
      <section className="site-hero" id="inicio">
        <nav className="site-nav" aria-label="Navegación principal">
          <Link className="site-logo" href="#inicio" aria-label="Representaciones Figueroa Castro, inicio">
            <Image
              className="site-logo-image"
              src="/rfc-logo.svg"
              alt="RFC Representaciones Figueroa Castro"
              width={54}
              height={54}
              priority
            />
            <b>Representaciones<br />Figueroa Castro</b>
          </Link>
          <div className="site-nav-links">
            <a href="#nosotros">Nosotros</a>
            <a href="#servicios">Servicios</a>
            <a href="#contacto">Contacto</a>
          </div>
          <Link className="site-nav-cta" href="/login">
            Acceso a la aplicación <span>↗</span>
          </Link>
        </nav>

        <div className="site-hero-content">
          <p className="site-kicker">Caucasia · Antioquia</p>
          <h1>Infraestructura que responde a lo que viene.</h1>
          <p className="site-lede">
            Arquitectura, ingeniería, estructuras y mantenimiento para proyectos que necesitan precisión desde el primer trazo.
          </p>
          <a className="site-button" href="#servicios">
            Conozca nuestras capacidades <span>↘</span>
          </a>
        </div>

        <div className="site-hero-footer">
          <span>Representaciones Figueroa Castro S.A.S.</span>
          <span>Desde 2014</span>
        </div>
      </section>

      <section className="site-intro" id="nosotros">
        <p className="site-section-label">Nuestra mirada</p>
        <div>
          <h2>El rigor técnico también puede sentirse cercano.</h2>
          <p>
            Trabajamos desde Caucasia, Antioquia, integrando experiencia técnica y criterio práctico para acompañar obras, estructuras, instalaciones y entornos que deben funcionar todos los días.
          </p>
        </div>
      </section>

      <section className="site-services" id="servicios">
        <div className="site-section-heading">
          <p className="site-section-label">Capacidades</p>
          <h2>Una respuesta técnica, de principio a fin.</h2>
        </div>
        <div className="site-services-grid">
          {services.map(([number, title, description]) => (
            <article className="site-service" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-statement">
        <p>“Construir bien comienza por entender con claridad lo que cada proyecto exige.”</p>
      </section>

      <section className="site-contact" id="contacto">
        <div>
          <p className="site-section-label">Conversemos</p>
          <h2>Su próximo proyecto merece una conversación seria.</h2>
        </div>
        <div className="site-contact-details">
          <a href="tel:+5748392417">(4) 839 2417</a>
          <a href="https://maps.google.com/?q=Calle+29+K+27+62+Caucasia+Antioquia" target="_blank" rel="noreferrer">
            Calle 29 K #27-62<br />Caucasia, Antioquia
          </a>
          <p>Atención para proyectos de arquitectura, ingeniería, mantenimiento y estructuras.</p>
        </div>
      </section>

      <footer className="site-footer">
        <Link className="site-logo" href="#inicio">
          <Image
            className="site-logo-image"
            src="/rfc-logo.svg"
            alt="RFC"
            width={44}
            height={44}
          />
          <b>Representaciones<br />Figueroa Castro</b>
        </Link>
        <p>© {new Date().getFullYear()} Representaciones Figueroa Castro S.A.S.</p>
        <Link href="/login">Acceso al portal</Link>
      </footer>
    </main>
  );
}
