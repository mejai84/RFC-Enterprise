"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "../brand-loader";

export function LoginSplash() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 800 : 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <BrandLoader label="Bienvenido a RFC Enterprise" overlay onClick={() => setVisible(false)} /> : null;
}