import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Representaciones Figueroa Castro",
  description: "Obras civiles, metalmecánica, ambiental y eléctrica en Caucasia, Antioquia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
