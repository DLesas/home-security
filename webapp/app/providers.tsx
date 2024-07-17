'use client'

import { NextUIProvider } from '@nextui-org/system'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <NextUIProvider navigate={router.push}>{children}</NextUIProvider>
    </QueryClientProvider>
  )
}
