"use client";

import { useEffect, useRef } from "react";

type ScrollFrameSequenceProps = {
  className: string;
  frames: readonly string[];
  /** El hero ocupa recorrido adicional para revelar la secuencia de forma deliberada. */
  mode: "hero" | "panel";
  label: string;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function ScrollFrameSequence({ className, frames, mode, label }: ScrollFrameSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root || frames.length === 0) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const images = new Map<number, HTMLImageElement>();
    let targetFrame = 0;
    let renderedFrame = -1;
    let animationFrame = 0;
    let disposed = false;

    const paint = (index: number) => {
      const image = images.get(index);
      if (!image?.complete || image.naturalWidth === 0) return;
      const rect = root.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      renderedFrame = index;
    };

    const load = (index: number) => {
      if (index < 0 || index >= frames.length || images.has(index)) return;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (!disposed && index === targetFrame) paint(index);
      };
      image.src = frames[index];
      images.set(index, image);
    };

    const preloadAround = (index: number) => {
      for (let offset = -5; offset <= 8; offset += 1) load(index + offset);
    };

    const update = () => {
      animationFrame = 0;
      const target = mode === "hero" ? root.parentElement : root;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const progress = media.matches
        ? 0
        : mode === "hero"
          ? clamp(-rect.top / Math.max(1, rect.height - window.innerHeight))
          : clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
      const nextFrame = Math.round(progress * (frames.length - 1));
      targetFrame = nextFrame;
      preloadAround(nextFrame);
      if (images.get(nextFrame)?.complete) paint(nextFrame);
      else if (renderedFrame < 0) load(0);
    };

    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    };

    load(0);
    preloadAround(0);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) requestUpdate();
    }, { rootMargin: "240px 0px" });
    observer.observe(mode === "hero" ? root.parentElement ?? root : root);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    media.addEventListener("change", requestUpdate);
    requestUpdate();

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      media.removeEventListener("change", requestUpdate);
    };
  }, [frames, mode]);

  return (
    <div
      ref={rootRef}
      className={className}
      role="img"
      aria-label={label}
      style={{ backgroundImage: `url("${frames[0]}")` }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
