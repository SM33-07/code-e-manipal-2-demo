import "@/styles/fonts.css"
import "@/styles/tailwind.css"
import "@/styles/index.css"

import { ThemeProvider } from "@/components/ThemeProvider"
import RootClient from "./RootClient"

export const metadata = {
  title: "Code-e-Manipal Portal",
  description: "Hackathon submission and judging platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-background text-foreground relative overflow-x-hidden transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark"]}
          storageKey="code-e-manipal-theme"
        >
          <RootClient>{children}</RootClient>
        </ThemeProvider>
      </body>
    </html>
  )
}
