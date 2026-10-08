"use client";

import { useEffect, useState } from "react";
import styles from "../loading.module.css";

/**
 * Portada de bienvenida en la pantalla de acceso: reproduce el logo 3D una vez y
 * luego deja pasar al formulario. No exige nada a la persona: el acceso sigue
 * siendo el de siempre, solo lo recibe primero el toque de identidad.
 */
export function LoginSplash() {
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Se da de baja a tiempo y con una transicion para que no quede la capa
    // invisible bloqueando nada si la persona espera.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = window.setTimeout(() => setFade(true), reduce ? 600 : 1700);
    const t2 = window.setTimeout(() => setVisible(false), reduce ? 900 : 2250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={styles.screen}
      role="status"
      aria-live="polite"
      aria-label="Bienvenido"
      onClick={() => setVisible(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        transition: "opacity 0.5s ease",
        opacity: fade ? 0 : 1,
      }}
    >
      <div className={styles.logoWrap}>
        <video
          className={styles.logoVideo}
          src="/Create_3D_logo_video_20261007161453.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      </div>
      <p className={styles.text}>Bienvenido a RFC Enterprise</p>
      <span className={styles.bar} aria-hidden="true" />
    </div>
  );
}
