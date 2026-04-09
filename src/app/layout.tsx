import type { Metadata } from "next"
import "./globals.css"
import { I18nProvider } from "@/lib/mcc-i18n"

export const metadata: Metadata = {
  title: "MCC — Management Command Center",
  description: "Operational intelligence for Makeberry Production",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  )
}
