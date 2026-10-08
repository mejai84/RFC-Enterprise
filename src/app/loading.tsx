import styles from "./loading.module.css";

/**
 * Loader premium de la aplicación: blanco, con el logo 3D como pieza central.
 * Se muestra mientras viaja una ruta. No explica ni añade pasos: solo identidad.
 */
export default function Loading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-label="Cargando">
      <div className={styles.logoWrap}>
        {/* El logo en 3D es la pieza principal; en movimiento reducido se deja
            quieto como cualquier otro logotipo. */}
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
      <p className={styles.text}>Cargando…</p>
      <span className={styles.bar} aria-hidden="true" />
    </div>
  );
}
