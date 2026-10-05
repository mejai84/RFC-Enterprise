"use client";

import { useRef, useState } from "react";

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
  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas)
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
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
              Firme con el dedo o con el mouse dentro del recuadro.
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
              <button type="button" className="btn-cancel" onClick={clear}>
                Limpiar
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
                Confirmar firma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
