"use client";

import { useEffect, useRef, useState } from "react";

export function SignatureCapture({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));
  const [loadedFromValue, setLoadedFromValue] = useState(false);

  /**
   * Al reabrir el lienzo se pinta la firma que ya existe. Sin esto, «Ver o
   * reemplazar firma» mostraba un recuadro vacío y no había forma de decidir si
   * se dejaba la anterior o se cambiaba.
   */
  useEffect(() => {
    if (!open || !value || loadedFromValue) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      setHasInk(true);
      setLoadedFromValue(true);
    };
    image.onerror = () => setLoadedFromValue(true);
    image.src = value;
    return () => {
      cancelled = true;
    };
  }, [open, value, loadedFromValue]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d")!;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    drawing.current = true;
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };
  /**
   * Limpiar borra de verdad: antes solo vaciaba el lienzo y la firma guardaba
   * seguía ahí, así que el botón no hacía lo que prometía.
   */
  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas)
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setLoadedFromValue(true);
    onChange("");
  };
  return (
    <>
      <div className="signature-summary">
        <span>{value ? "Firma capturada" : "Firma pendiente"}</span>
        <button
          type="button"
          className="btn-cancel"
          onClick={() => setOpen(true)}
        >
          {value ? "Ver o reemplazar firma" : label}
        </button>
      </div>
      {open && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Capturar firma"
        >
          <div className="modal-card small">
            <div className="modal-header">
              <div>
                <p>Confirmación de entrega</p>
                <h3>Firma manuscrita</h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p className="panel-intro">
              {value
                ? "Esta es la firma guardada. Puedes dejarla como está, limpiarla para empezar de nuevo o firmar encima."
                : "Firme con el dedo o con el mouse dentro del recuadro."}
            </p>
            <canvas
              ref={canvasRef}
              className="signature-canvas"
              width="900"
              height="320"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={() => {
                drawing.current = false;
              }}
              onPointerCancel={() => {
                drawing.current = false;
              }}
            />{" "}
            <div className="modal-actions">
              {value ? (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    // Cancelar deja la firma como estaba, sin tocarla.
                    setLoadedFromValue(true);
                    setOpen(false);
                  }}
                >
                  Dejarla como está
                </button>
              ) : (
                <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
              )}
              <button type="button" className="btn-cancel" onClick={clear}>
                {value ? "Quitar la firma" : "Limpiar"}
              </button>
              <button
                type="button"
                className="inventory-action"
                disabled={!hasInk}
                onClick={() => {
                  onChange(canvasRef.current?.toDataURL("image/png") ?? "");
                  setOpen(false);
                }}
              >
                Guardar esta firma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
