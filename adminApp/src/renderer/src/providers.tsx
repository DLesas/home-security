import { NextUIProvider } from '@nextui-org/system'
import { SidebarProvider } from './components/ui/sidebar'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextUIProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <SidebarProvider>{children}</SidebarProvider>
      </ThemeProvider>
    </NextUIProvider>
  )
}     
