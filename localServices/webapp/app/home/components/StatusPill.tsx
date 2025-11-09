interface StatusPillProps {
  type: 'armed' | 'disarmed' | 'open' | 'closed' | 'unknown' | 'connected' | 'disconnected'
  children: React.ReactNode
}

export function StatusPill({ type, children }: StatusPillProps) {
  const styles = {
    armed: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
    disarmed: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
    open: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
    closed: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
    unknown: 'bg-default-200 text-default-700 dark:bg-default-100 dark:text-default-600',
    connected: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
    disconnected: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${styles[type]}`}>
      {children}
    </span>
  )
}
