import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "./contact-form";

const services = [
  {
    title: "Arquitectura e ingeniería",
    description: "Estudios, diseño y acompañamiento técnico para llevar una necesidad a una solución construible.",
  },
  {
    title: "Estructuras metálicas",
    description: "Fabricación e instalación de elementos estructurales con atención al detalle, la seguridad y el desempeño.",
  },
  {
    title: "Mantenimiento integral",
    description: "Intervenciones para conservar la continuidad, el estado y la vida útil de instalaciones y activos.",
  },
  {
    title: "Paisajismo y exteriores",
    description: "Espacios exteriores funcionales que responden al lugar, al uso diario y a las condiciones de operación.",
  },
];

const approach = [
  ["Entender", "Escuchamos el alcance, las condiciones del sitio y lo que la operación necesita resolver."],
  ["Definir", "Traducimos esa información en una alternativa técnica clara, con prioridades y criterios de ejecución."],
  ["Ejecutar", "Coordinamos el trabajo con orden en campo, seguimiento y una comunicación directa durante el proceso."],
];

export default function Home() {
  return (
    <main className="site-page" id="main-content" tabIndex={-1}>
      <section className="site-hero" id="inicio">
        <nav className="site-nav" aria-label="Navegación principal">
          <Link className="site-logo" href="#inicio" aria-label="Representaciones Figueroa Castro, inicio">
            <Image className="site-logo-image" src="/rfc-logo.svg" alt="RFC Representaciones Figueroa Castro" width={54} height={54} priority />
            <b>Representaciones<br />Figueroa Castro</b>
          </Link>
          <div className="site-nav-links">
            <a href="#nosotros">Nosotros</a>
            <a href="#servicios">Servicios</a>
            <a href="#proceso">Cómo trabajamos</a>
          </div>
          <Link className="site-portal-access" href="/login">Portal de empleados <span aria-hidden="true">↗</span></Link>
          <a className="site-nav-cta" href="#contacto">Iniciar una conversación <span aria-hidden="true">→</span></a>
        </nav>

        <div className="site-hero-content">
          <p className="site-kicker">Caucasia, Antioquia · Desde 2014</p>
          <h1>La precisión que una obra necesita antes de empezar.</h1>
          <p className="site-lede">Arquitectura, ingeniería, estructuras metálicas y mantenimiento para proyectos que exigen decisiones claras y una ejecución bien acompañada.</p>
          <div className="site-hero-actions">
            <a className="site-button" href="#contacto">Cuéntenos su proyecto <span aria-hidden="true">↘</span></a>
            <a className="site-text-link" href="#servicios">Ver capacidades <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <div className="site-hero-footer">
          <span>Representaciones Figueroa Castro S.A.S.</span>
          <span>Ingeniería con criterio de obra</span>
        </div>
      </section>

      <section className="site-capability-strip" aria-label="Capacidades principales">
        <p>Diseño y consultoría técnica</p><span aria-hidden="true" />
        <p>Fabricación estructural</p><span aria-hidden="true" />
        <p>Mantenimiento de instalaciones</p><span aria-hidden="true" />
        <p>Intervenciones exteriores</p>
      </section>

      <section className="site-intro" id="nosotros">
        <p className="site-section-label">Una firma local, una respuesta técnica</p>
        <div>
          <h2>Conocemos el terreno antes de proponer la solución.</h2>
          <p>Desde Caucasia acompañamos proyectos que requieren criterio técnico, capacidad de coordinación y atención a los detalles que sostienen una obra en el tiempo.</p>
          <p>Trabajamos sobre la pregunta importante: qué debe funcionar, cómo se va a construir y qué necesita el proyecto para mantenerse operativo después de la entrega.</p>
        </div>
      </section>

      <section className="site-work" aria-labelledby="work-title">
        <div className="site-work-media">
          <Image src="/operations-oil-rfc.png" alt="Estación petrolera con tuberías, tanques de almacenamiento y equipos de bombeo" width={1536} height={1024} sizes="(max-width: 800px) 100vw, 52vw" unoptimized />
        </div>
        <div className="site-work-copy">
          <p className="site-section-label">Del planteamiento al detalle</p>
          <h2 id="work-title">Una buena ejecución empieza por ordenar bien las decisiones.</h2>
          <p>El diseño, los materiales, la intervención en campo y el mantenimiento no son conversaciones aisladas. Los reunimos desde el principio para que cada etapa tenga una dirección concreta.</p>
          <a className="site-text-link dark-link" href="#proceso">Conozca nuestro enfoque <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className="site-services" id="servicios">
        <div className="site-section-heading">
          <p className="site-section-label">Capacidades</p>
          <h2>Un equipo para las decisiones que mantienen una obra en movimiento.</h2>
        </div>
        <div className="site-services-grid">
          {services.map((service) => (
            <article className="site-service" key={service.title}>
              <span className="site-service-line" aria-hidden="true" />
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-process" id="proceso">
        <div className="site-process-heading">
          <p className="site-section-label">Cómo trabajamos</p>
          <h2>Un proceso simple para proyectos que no pueden improvisar.</h2>
        </div>
        <ol className="site-process-list">
          {approach.map(([title, description], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="site-statement">
        <p>“Construir bien comienza por entender con claridad lo que cada proyecto exige.”</p>
      </section>

      <section className="site-contact" id="contacto">
        <div className="site-contact-intro">
          <p className="site-section-label">Hablemos de su proyecto</p>
          <h2>Empecemos con la información que realmente importa.</h2>
          <p>Comparta el tipo de intervención, su ubicación y el momento en que necesita ejecutarla. Así podremos preparar una conversación técnica útil desde el inicio.</p>
          <a className="site-address" href="https://maps.google.com/?q=Calle+29+K+27+62+Caucasia+Antioquia" target="_blank" rel="noreferrer">Calle 29 K #27-62<br />Caucasia, Antioquia</a>
        </div>
        <ContactForm />
      </section>

      <footer className="site-footer">
        <Link className="site-logo" href="#inicio"><Image className="site-logo-image" src="/rfc-logo.svg" alt="RFC" width={44} height={44} /><b>Representaciones<br />Figueroa Castro</b></Link>
        <p>© {new Date().getFullYear()} Representaciones Figueroa Castro S.A.S.</p>
        <Link href="/login">Acceso al portal</Link>
      </footer>
    </main>
  );
}
