"use client";

import { useEffect, useState } from "react";
import styles from "./home-intro-loader.module.css";

/** Presentación breve de marca exclusiva de la portada pública. */
export function HomeIntroLoader() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 700 : 2000;
    const leaveTimer = window.setTimeout(() => setLeaving(true), duration);
    const removeTimer = window.setTimeout(() => setVisible(false), duration + 360);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(removeTimer); };
  }, []);

  if (!visible) return null;
  return (
    <div className={`${styles.screen} ${leaving ? styles.leaving : ""}`} role="status" aria-live="polite" aria-label="Cargando RFC Enterprise">
      <span aria-hidden="true" className={styles.grid} />
      <div className={styles.identity}>
        <span aria-hidden="true" className={styles.rule} />
        <img alt="" className={styles.logo} src="/rfc-loader-premium.png" />
        <p>Representaciones Figueroa Castro</p>
        <small>Ingeniería · construcción · mantenimiento</small>
      </div>
    </div>
  );
}