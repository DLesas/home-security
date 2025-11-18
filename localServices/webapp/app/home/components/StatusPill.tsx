import { Chip } from '@nextui-org/chip'

interface StatusPillProps {
  type: 'armed' | 'disarmed' | 'open' | 'closed' | 'unknown' | 'connected' | 'disconnected'
  children: React.ReactNode
  startContent?: React.ReactNode
}

export function StatusPill({ type, children, startContent }: StatusPillProps) {
  const colorMap = {
    armed: 'danger' as const,
    disarmed: 'success' as const,
    open: 'secondary' as const,
    closed: 'primary' as const,
    unknown: 'default' as const,
    connected: 'success' as const,
    disconnected: 'danger' as const,
  }

  return (
    <Chip
      startContent={startContent}
      color={colorMap[type]}
      variant="flat"
      size="sm"
    >
      {children}
    </Chip>
  )
}
