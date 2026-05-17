import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Syne } from 'next/font/google'
import { AppToaster } from '@/components/AppToaster'
import { AuthProvider } from '@/contexts/AuthContext'
import { BRAND } from '@/lib/brand'
import './globals.css'

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fontDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: `${BRAND.name} - UNIKIN`,
  description: 'Vente de tickets Wi‑Fi (import CSV, forfaits 24h / 7j / 30j)',
  applicationName: BRAND.name,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: BRAND.icons.favicon16, sizes: '16x16', type: 'image/png' },
      { url: BRAND.icons.favicon32, sizes: '32x32', type: 'image/png' },
      { url: BRAND.icons.favicon, sizes: '48x48', type: 'image/png' },
    ],
    shortcut: BRAND.icons.favicon32,
    apple: BRAND.icons.apple,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className="font-sans min-h-screen">
        <AuthProvider>
          {children}
          <AppToaster />
        </AuthProvider>
      </body>
    </html>
  )
}
