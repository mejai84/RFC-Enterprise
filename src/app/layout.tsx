import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "RFC Enterprise | Representaciones Figueroa Castro",
  description: "Portal empresarial de Representaciones Figueroa Castro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body><a className="skip-link" href="#main-content">Saltar al contenido principal</a>{children}</body>
    </html>
  );
}
