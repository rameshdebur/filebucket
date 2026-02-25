import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DropR - Secure File Dropper for Physios",
  description: "Secure, ephemeral file sharing tailored for physiotherapy clinics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="bg-mesh"></div>
        {children}
      </body>
    </html>
  );
}
