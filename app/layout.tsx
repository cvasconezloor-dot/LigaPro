import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGEC-LP · Gestión de Competiciones",
  description: "Sistema de gestión de competiciones de LigaPro Ecuador.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
