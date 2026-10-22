import type { SVGProps } from "react";

export type InventoryIconName =
  | "alert"
  | "box"
  | "check"
  | "close"
  | "download"
  | "movement"
  | "plus"
  | "project"
  | "settings"
  | "warning"
  | "writeoff";

type InventoryIconProps = SVGProps<SVGSVGElement> & {
  name: InventoryIconName;
};

/**
 * Iconografía lineal compartida por Inventario y Kardex. Los iconos son
 * decorativos: el texto visible de cada control conserva el significado.
 */
export function InventoryIcon({ className, name, ...props }: InventoryIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`inventory-icon${className ? ` ${className}` : ""}`}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {name === "box" && (
        <>
          <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" />
          <path d="m3 8.5 9 5.5 9-5.5" />
          <path d="M12 14v7" />
        </>
      )}
      {name === "movement" && (
        <>
          <path d="M7 7h11l-3-3" />
          <path d="M17 17H6l3 3" />
        </>
      )}
      {name === "project" && (
        <>
          <path d="M4 21V7l8-4 8 4v14" />
          <path d="M9 21v-6h6v6" />
          <path d="M8 10h.01M16 10h.01" />
        </>
      )}
      {name === "alert" && (
        <>
          <path d="M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
      {name === "writeoff" && (
        <>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M6.5 7 7.4 20h9.2l.9-13" />
          <path d="M10 11v5M14 11v5" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.8v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3L9 19l-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H5.6v-2.8h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L7 8.2l2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.8V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14H21a1.7 1.7 0 0 0-1.6 1Z" />
        </>
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "download" && (
        <>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </>
      )}
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "warning" && (
        <>
          <path d="M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}
