"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./loading.module.css";

type Props = { label: string; overlay?: boolean; dismissAfterCycle?: boolean };

export function BrandLoader({ label, overlay = false, dismissAfterCycle = false }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = video.current;
    const syncDuration = () => { if (element?.duration) element.playbackRate = Math.max(1, element.duration / 3); };
    element?.addEventListener("loadedmetadata", syncDuration);
    if (!dismissAfterCycle) return () => element?.removeEventListener("loadedmetadata", syncDuration);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveTimer = window.setTimeout(() => setLeaving(true), reduced ? 700 : 3000);
    const removeTimer = window.setTimeout(() => setVisible(false), reduced ? 900 : 3360);
    return () => { element?.removeEventListener("loadedmetadata", syncDuration); window.clearTimeout(leaveTimer); window.clearTimeout(removeTimer); };
  }, [dismissAfterCycle]);

  if (!visible) return null;
  return <div className={`${styles.screen} ${overlay ? styles.overlay : ""} ${leaving ? styles.leaving : ""}`} role="status" aria-live="polite" aria-label={label}>
    <span aria-hidden="true" className={styles.grid} />
    <span aria-hidden="true" className={styles.glow} />
    <div className={styles.logoWrap}><video ref={video} aria-hidden="true" autoPlay className={styles.logoVideo} loop muted playsInline preload="auto" src="/rfc-logo-loader.mp4" /></div>
    <p className={styles.text}>{label}</p>
    <div className={styles.progressTrack} aria-hidden="true"><span className={styles.progressFill} /></div>
  </div>;
}