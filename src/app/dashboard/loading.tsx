import styles from "../loading.module.css";

/**
 * Loader del Resumen: este si carga operaciones reales, asi que dice lo que se
 * esta trayendo en vez de una frase generica.
 */
export default function DashboardLoading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-label="Cargando">
      <div className={styles.logoWrap}>
        <video
          className={styles.logoVideo}
          src="/Create_3D_logo_video_20261007161453.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      </div>
      <p className={styles.text}>Cargando las obras y los materiales…</p>
      <span className={styles.bar} aria-hidden="true" />
    </div>
  );
}
