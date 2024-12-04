import { NextUIProvider } from '@nextui-org/system'
import { SidebarProvider } from './components/ui/sidebar'
import { ThemeProvider } from 'next-themes'
import SocketInitializer from './socketInitializerContext'
import { SocketDataProvider } from './socketDataContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextUIProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <SidebarProvider>
          <SocketInitializer>
            <SocketDataProvider>{children}</SocketDataProvider>
          </SocketInitializer>
        </SidebarProvider>
      </ThemeProvider>
    </NextUIProvider>
  )
}     

