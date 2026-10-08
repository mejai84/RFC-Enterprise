"use client";

import { useEffect, useState } from "react";
import styles from "./loading.module.css";

const frames = Array.from({ length: 82 }, (_, index) => `/scroll-sequences/logo/Create_3D_logo_video_20261007161453_${String(index).padStart(3, "0")}.webp`);

export function BrandLoader({ label, overlay = false, onClick }: { label: string; overlay?: boolean; onClick?: () => void }) {
  const [frame, setFrame] = useState(0);
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) frames.slice(1).forEach((source) => { const image = new Image(); image.src = source; });
    const started = performance.now(); let animation = 0;
    const draw = (now: number) => { if (!reduced) setFrame(Math.floor(((now - started) % 2700) / 2700 * frames.length)); animation = requestAnimationFrame(draw); };
    animation = requestAnimationFrame(draw);
    const progressTimer = window.setInterval(() => setProgress((current) => current >= 92 ? current : Math.min(92, current + Math.max(1, Math.ceil((94 - current) / 9)))), 180);
    return () => { cancelAnimationFrame(animation); window.clearInterval(progressTimer); };
  }, []);
  return <div className={`${styles.screen} ${overlay ? styles.overlay : ""}`} role="status" aria-live="polite" aria-label={label} onClick={onClick}>
    <div className={styles.logoWrap}><img alt="" className={styles.logoFrame} src={frames[frame]} /></div>
    <p className={styles.text}>{label}</p>
    <div className={styles.progressTrack} aria-hidden="true"><span className={styles.progressFill} style={{ transform: `scaleX(${progress / 100})` }} /></div>
  </div>;
}