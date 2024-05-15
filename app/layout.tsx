import './globals.css'
import { Providers } from './providers'
import { headers } from 'next/headers'
import { Toaster } from 'react-hot-toast'
import { Vollkorn } from 'next/font/google'
import Navbar from '@/components/Navbar'

const VollkornFont = Vollkorn({
  subsets: ['latin'],
  variable: '--font-vollkorn',
})

export const metadata = {
  title: 'placeholder Inventory System',
  description:
    'Home page for Balanced horse feeds, an equine feed company specialising in innovative, cheap and efficient equine products',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  const pathname = headersList.get('x-invoke-path') || ''

  return (
    <html lang="en" className="bg-background text-foreground theme-blue-dark">
      <body className={`${VollkornFont.variable} font-sans`}>
        <Providers>
          <Toaster position="bottom-right" reverseOrder={false}></Toaster>
          <Navbar></Navbar>
          {children}
        </Providers>
      </body>
    </html>
  )
}
