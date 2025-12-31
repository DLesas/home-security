'use client'

interface ToggleProps {
  isSelected?: boolean
  onChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: {
    track: 'w-8 h-4',
    thumb: 'w-3 h-3',
    translate: 'translate-x-4',
    text: 'text-xs',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-5 h-5',
    translate: 'translate-x-5',
    text: 'text-sm',
  },
  lg: {
    track: 'w-14 h-7',
    thumb: 'w-6 h-6',
    translate: 'translate-x-7',
    text: 'text-base',
  },
}

export function Toggle({
  isSelected = false,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: ToggleProps) {
  const s = sizes[size]

  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-3 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={isSelected}
        disabled={disabled}
        onClick={() => !disabled && onChange(!isSelected)}
        className={`
          relative inline-flex shrink-0 rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          ${s.track}
          ${isSelected ? 'bg-primary' : 'bg-default-200'}
          ${disabled ? '' : 'hover:opacity-80'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block transform rounded-full
            bg-white shadow-lg ring-0
            transition duration-200 ease-in-out
            ${s.thumb}
            ${isSelected ? s.translate : 'translate-x-0.5'}
          `}
          style={{ marginTop: '0.125rem' }}
        />
      </button>
      {label && <span className={`${s.text} text-default-700`}>{label}</span>}
    </label>
  )
}
