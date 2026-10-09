"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Posiciona un popover de ayuda para que nunca se salga de la pantalla.
 *
 * Con solo CSS el popover se alinea a la izquierda del disparador, y si el
 * disparador está cerca del borde derecho el texto queda fuera de la vista.
 * Tampoco sirve cuando el contenedor tiene desplazamiento: cualquier
 * ancestro con overflow recorta el popover flotante.
 *
 * La solución es fijar el popover respecto de la ventana y medir dónde
 * cabe: primero a la derecha del disparador, y si no cabe, a la izquierda.
 * Si tampoco cabe arriba, se abre hacia arriba.
 */
function useHelpPosition(abierto: boolean) {
  const disparador = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLSpanElement | null>(null);
  const [estilo, setEstilo] = useState<{ top: number; left: number } | null>(null);

  const medir = useCallback(() => {
    const d = disparador.current;
    const p = popover.current;
    if (!d || !p) return;

    const caja = d.getBoundingClientRect();
    const anchoPop = p.offsetWidth || 320;
    const altoPop = p.offsetHeight || 140;
    const margen = 10;
    const alto = window.innerHeight;

    // Preferencia: a la derecha del disparador.
    let izquierda = caja.right + margen;
    // Si no cabe a la derecha, se abre a la izquierda.
    if (izquierda + anchoPop > window.innerWidth - margen) {
      izquierda = caja.left - anchoPop - margen;
    }
    // Si tampoco cabe a la izquierda, se alinea al borde de la ventana.
    if (izquierda < margen) izquierda = margen;
    if (izquierda + anchoPop > window.innerWidth - margen) {
      izquierda = Math.max(margen, window.innerWidth - anchoPop - margen);
    }

    // Preferencia: debajo. Si no cabe, arriba.
    let arriba = caja.bottom + margen;
    if (arriba + altoPop > alto - margen) {
      arriba = caja.top - altoPop - margen;
    }
    if (arriba < margen) arriba = margen;
    if (arriba + altoPop > alto - margen) {
      arriba = Math.max(margen, alto - altoPop - margen);
    }

    setEstilo({ top: Math.round(arriba), left: Math.round(izquierda) });
  }, []);

  useEffect(() => {
    if (!abierto) {
      setEstilo(null);
      return;
    }
    medir();
    const alCambiar = () => medir();
    window.addEventListener("resize", alCambiar);
    window.addEventListener("scroll", alCambiar, true);
    return () => {
      window.removeEventListener("resize", alCambiar);
      window.removeEventListener("scroll", alCambiar, true);
    };
  }, [abierto, medir]);

  return { disparador, popover, estilo };
}

/** Icono de ayuda contextual: aparece al pasar el cursor, al llegar con el
 * teclado y al tocarlo en pantallas pequeñas. */
export function HelpHint({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [conFoco, setConFoco] = useState(false);
  const visible = abierto || conFoco;
  const { disparador, popover, estilo } = useHelpPosition(visible);

  return (
    <span
      className={`quote-help ${compact ? "is-compact" : ""} ${visible ? "is-open" : ""}`}
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
      onFocus={() => setConFoco(true)}
      onBlur={() => setConFoco(false)}
    >
      <button
        type="button"
        ref={disparador}
        className="quote-help-trigger"
        aria-label={title}
        aria-expanded={visible}
      >
        ?
      </button>
      <span
        ref={popover}
        className="quote-help-popover"
        role="tooltip"
        style={estilo ? { top: estilo.top, left: estilo.left } : undefined}
      >
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </span>
  );
}