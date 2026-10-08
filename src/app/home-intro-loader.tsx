"use client";

import { useEffect, useState } from "react";
import styles from "./home-intro-loader.module.css";

const frames = Array.from({ length: 82 }, (_, index) => `/scroll-sequences/logo/Create_3D_logo_video_20261007161453_${String(index).padStart(3, "0")}.webp`);

/** Presentación breve de marca exclusiva de la portada pública. */
export function HomeIntroLoader() {
  const [frame, setFrame] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const timer = window.setTimeout(() => setVisible(false), 700);
      return () => window.clearTimeout(timer);
    }
    frames.slice(1).forEach((source) => { const image = new Image(); image.src = source; });
    const startedAt = performance.now();
    let animation = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(now - startedAt, 2700);
      setFrame(Math.min(frames.length - 1, Math.floor((elapsed / 2700) * frames.length)));
      if (elapsed < 2700) animation = requestAnimationFrame(animate);
    };
    animation = requestAnimationFrame(animate);
    const leaveTimer = window.setTimeout(() => setLeaving(true), 3000);
    const removeTimer = window.setTimeout(() => setVisible(false), 3360);
    return () => { cancelAnimationFrame(animation); window.clearTimeout(leaveTimer); window.clearTimeout(removeTimer); };
  }, []);

  if (!visible) return null;
  return (
    <div className={`${styles.screen} ${leaving ? styles.leaving : ""}`} role="status" aria-live="polite" aria-label="Cargando RFC Enterprise">
      <span aria-hidden="true" className={styles.grid} />
      <div className={styles.identity}>
        <span aria-hidden="true" className={styles.rule} />
        <img alt="" className={styles.logo} src={frames[frame]} />
        <p>Representaciones Figueroa Castro</p>
        <small>Ingeniería · construcción · mantenimiento</small>
      </div>
    </div>
  );
}