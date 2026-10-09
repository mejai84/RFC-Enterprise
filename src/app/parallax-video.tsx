"use client";

import { useEffect, useRef, useState } from "react";

type ParallaxVideoProps = {
  className: string;
  poster?: string;
  source: string;
  speed?: number;
  /** El hero carga su video desde el HTML inicial, sin intercambiar una imagen estática. */
  eager?: boolean;
  mobilePlayback?: boolean;
};

export function ParallaxVideo({ className, poster, source, speed = 0.11, eager = false, mobilePlayback = false }: ParallaxVideoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactScreen = window.matchMedia("(max-width: 700px)");
    const updateMode = () => setCanAnimate(!reducedMotion.matches && !compactScreen.matches);
    updateMode();
    reducedMotion.addEventListener("change", updateMode);
    compactScreen.addEventListener("change", updateMode);
    return () => {
      reducedMotion.removeEventListener("change", updateMode);
      compactScreen.removeEventListener("change", updateMode);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canPlay = !reducedMotion.matches && (canAnimate || eager || mobilePlayback);
    if (!root || !video || !canPlay) {
      video?.pause();
      return;
    }

    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      if (reducedMotion.matches || !canAnimate) return;
      const offset = Math.max(-70, Math.min(70, (window.innerHeight / 2 - root.getBoundingClientRect().top) * speed));
      root.style.setProperty("--parallax-offset", `${offset.toFixed(1)}px`);
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateParallax);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reducedMotion.matches) void video.play().catch(() => undefined);
      else if (!mobilePlayback) video.pause();
    }, { threshold: 0.12 });
    const startMobilePlayback = () => {
      if (mobilePlayback && !reducedMotion.matches) void video.play().catch(() => undefined);
    };
    const onMotionPreferenceChange = () => {
      if (reducedMotion.matches) video.pause();
      else void video.play().catch(() => undefined);
      requestUpdate();
    };

    observer.observe(root);
    video.addEventListener("canplay", startMobilePlayback);
    startMobilePlayback();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reducedMotion.addEventListener("change", onMotionPreferenceChange);
    requestUpdate();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      video.removeEventListener("canplay", startMobilePlayback);
    };
  }, [canAnimate, eager, mobilePlayback, speed]);

  const loadVideo = eager || mobilePlayback || canAnimate;
  return <div ref={rootRef} className={className} aria-hidden="true"><video ref={videoRef} autoPlay={loadVideo} loop muted playsInline preload={eager || mobilePlayback ? "auto" : loadVideo ? "metadata" : "none"} poster={poster}>{loadVideo ? <source src={source} type="video/mp4" /> : null}</video></div>;
}