import styles from "../loading.module.css";

/** Loader de restablecimiento de contraseña. */
export default function Loading() {
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
      <p className={styles.text}>Preparando el cambio de contraseña…</p>
      <span className={styles.bar} aria-hidden="true" />
    </div>
  );
}
