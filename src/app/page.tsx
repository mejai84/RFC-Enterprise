import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "./contact-form";
import { ParallaxVideo } from "./parallax-video";
import { ScrollFrameSequence } from "./scroll-frame-sequence";
import styles from "./home-premium.module.css";

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

const logoFrames = Array.from(
  { length: 82 },
  (_, index) => `/scroll-sequences/logo/Create_3D_logo_video_20261007161453_${String(index).padStart(3, "0")}.webp`,
);

const structureFrames = Array.from(
  { length: 102 },
  (_, index) => `/scroll-sequences/structure/steel-beam-structure-exploding-rfc_${String(index).padStart(3, "0")}.webp`,
);
export default function Home() {
  return (
    <main className={styles.page} id="main-content" tabIndex={-1}>
      {/* Héroe en blanco con el logo explosivo como pieza de parallax */}
      <section className={styles.hero} id="inicio">
        <ScrollFrameSequence
          className={styles.heroVideo}
          frames={logoFrames}
          mode="hero"
          label="Animación de la identidad RFC"
        />
        <nav className={styles.nav} aria-label="Navegación principal">
          <Link className={styles.logo} href="#inicio" aria-label="Representaciones Figueroa Castro, inicio">
            <Image className={styles.logoImage} src="/rfc-logo.svg" alt="RFC Representaciones Figueroa Castro" width={46} height={46} priority />
            <b>Representaciones<br />Figueroa Castro</b>
          </Link>
          <div className={styles.navLinks}>
            <a href="#nosotros">Nosotros</a>
            <a href="#servicios">Servicios</a>
            <a href="#proceso">Cómo trabajamos</a>
          </div>
          <Link className={styles.portal} href="/login">Portal de empleados <span aria-hidden="true">↗</span></Link>
          <a className={styles.cta} href="#contacto">Iniciar una conversación <span aria-hidden="true">→</span></a>
        </nav>

        <div className={styles.heroContent}>
          <p className={styles.kicker}>Caucasia, Antioquia · Desde 2014</p>
          <h1>La precisión que una obra necesita antes de empezar.</h1>
          <p className={styles.lede}>
            Arquitectura, ingeniería, estructuras metálicas y mantenimiento para proyectos que exigen decisiones claras y una ejecución bien acompañada.
          </p>
          <div className={styles.actions}>
            <a className={styles.btn} href="#contacto">Cuéntenos su proyecto <span aria-hidden="true">↘</span></a>
            <a className={styles.btnGhost} href="#servicios">Ver capacidades <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>

      <section className={styles.strip} aria-label="Capacidades principales">
        <p>Diseño y consultoría técnica</p>
        <p>Fabricación estructural</p>
        <p>Mantenimiento de instalaciones</p>
        <p>Intervenciones exteriores</p>
      </section>

      <section className={styles.intro} id="nosotros">
        <p className={styles.label}>Una firma local, una respuesta técnica</p>
        <div>
          <h2>Conocemos el terreno antes de proponer la solución.</h2>
          <p>Desde Caucasia acompañamos proyectos que requieren criterio técnico, capacidad de coordinación y atención a los detalles que sostienen una obra en el tiempo.</p>
          <p>Trabajamos sobre la pregunta importante: qué debe funcionar, cómo se va a construir y qué necesita el proyecto para mantenerse operativo después de la entrega.</p>
        </div>
      </section>

      {/* Estructura metálica con parallax de la vista explosiva */}
      <section className={styles.videoPanel} aria-labelledby="estructura-title">
        <ScrollFrameSequence
          className={styles.panelVideo}
          frames={structureFrames}
          mode="panel"
          label="Estructura metálica en vista explosiva"
        />
        <div className={styles.panelCopy}>
          <p className={styles.label}>Estructura a la medida</p>
          <h2 id="estructura-title">Diseñamos cada componente para que monte sin sorpresas.</h2>
          <p>Desde estructuras y soportes hasta ajustes, mantenimiento y montajes, integramos fabricación metalmecánica con criterio técnico, seguridad y coordinación de obra.</p>
        </div>
      </section>

      <section className={styles.services} id="servicios">
        <div className={styles.servicesHeading}>
          <p className={styles.label}>Capacidades</p>
          <h2>Un equipo para las decisiones que mantienen una obra en movimiento.</h2>
        </div>
        <div className={styles.servicesGrid}>
          {services.map((service) => (
            <article className={styles.service} key={service.title}>
              <span className={styles.serviceLine} aria-hidden="true" />
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Marco de taller metalmecánica con parallax */}
      <section className={styles.videoPanelAlt} aria-labelledby="metalmecanica-title">
        <div className={styles.panelCopy}>
          <p className={styles.label}>Capacidad de taller y campo</p>
          <h2 id="metalmecanica-title">Fabricamos con precisión para que cada componente responda en operación.</h2>
          <p>Desde estructuras y soportes hasta ajustes, mantenimiento y montajes, integramos fabricación metalmecánica con criterio técnico, seguridad y coordinación de obra.</p>
          <a className={styles.btn} href="#contacto">Hablemos de su necesidad <span aria-hidden="true">↘</span></a>
        </div>
        <ParallaxVideo
          className={styles.panelVideoAlt}
          poster="/workshop-fabrication-rfc.png"
          source="/rfc-metalmecanica.mp4"
          speed={0.09}
        />
      </section>

      <section className={styles.process} id="proceso">
        <div className={styles.processHeading}>
          <p className={styles.label}>Cómo trabajamos</p>
          <h2>Un proceso simple para proyectos que no pueden improvisar.</h2>
        </div>
        <ol className={styles.processList}>
          {approach.map(([title, description], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.statement}>
        <p>“Construir bien comienza por entender con claridad lo que cada proyecto exige.”</p>
      </section>

      {/* Campo e instalaciones con parallax */}
      <section className={styles.videoPanel} aria-labelledby="campo-title">
        <ParallaxVideo
          className={styles.panelVideo}
          poster="/hero-industrial-rfc.png"
          source="/rfc-caucasia-oil-station.mp4"
          speed={0.075}
        />
        <div className={styles.panelCopy}>
          <p className={styles.label}>Proyectos que se mantienen vivos</p>
          <h2 id="campo-title">Acompañamos la operación antes, durante y después de la entrega.</h2>
          <p>Mantenimiento de instalaciones y seguimiento en campo para que cada proyecto siga rindiendo después de que termina la obra.</p>
        </div>
      </section>

      <section className={styles.contact} id="contacto">
        <div className={styles.contactIntro}>
          <p className={styles.label}>Hablemos de su proyecto</p>
          <h2>Empecemos con la información que realmente importa.</h2>
          <p>Comparta el tipo de intervención, su ubicación y el momento en que necesita ejecutarla. Así podremos preparar una conversación técnica útil desde el inicio.</p>
          <a className={styles.address} href="https://maps.google.com/?q=Calle+29+K+27+62+Caucasia+Antioquia" target="_blank" rel="noreferrer">Calle 29 K #27-62<br />Caucasia, Antioquia</a>
        </div>
        <ContactForm />
      </section>

      <footer className={styles.footer}>
        <Link className={styles.logo} href="#inicio">
          <Image className={styles.logoImageSmall} src="/rfc-logo.svg" alt="RFC" width={40} height={40} />
          <b>Representaciones<br />Figueroa Castro</b>
        </Link>
        <p>© {new Date().getFullYear()} Representaciones Figueroa Castro S.A.S.</p>
        <Link href="/login">Acceso al portal</Link>
      </footer>
    </main>
  );
}
