// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import { headers } from 'next/headers'
import { Toaster } from 'react-hot-toast'
import { Vollkorn } from 'next/font/google'
import { Metadata } from 'next'
import SocketInitializer from './socketInitializer'
import { SocketDataProvider } from './socketData'
import Navbar from './Navbar'

export const metadata: Metadata = {
  applicationName: "Dimitri's home security",
  manifest: '/manifest.json',
  title: 'Home security',
  description: 'Home security system monitoring.',
  icons: [
    { rel: 'apple-touch-icon', url: '/securityIcon.webp' },
    { rel: 'icon', url: '/securityIcon.webp' },
  ],
  // ... other options
}

const VollkornFont = Vollkorn({
  subsets: ['latin'],
  variable: '--font-vollkorn',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body className={`${VollkornFont.variable} font-sans antialiased`}>
        <Providers>
          <Toaster position="bottom-right" reverseOrder={false} />
          <SocketInitializer>
            <SocketDataProvider>
              <Navbar />
              <main className="min-h-screen">
                {children}
              </main>
            </SocketDataProvider>
          </SocketInitializer>
        </Providers>
      </body>
    </html>
  )
}
