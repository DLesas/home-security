import type { TooltipProps } from 'react-aria-components'
import { OverlayArrow, Tooltip, TooltipTrigger } from 'react-aria-components'

interface MyTooltipProps extends Omit<TooltipProps, 'children'> {
  children: React.ReactNode
  trigger: React.ReactNode
  disabled?: boolean
}

export default function TooltipComponent({
  trigger,
  children,
  disabled,
  ...props
}: MyTooltipProps) {
  return (
    <TooltipTrigger delay={1000} isDisabled={disabled}>
      {trigger}
      <Tooltip {...props}>
        <OverlayArrow>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        {children}
      </Tooltip>
    </TooltipTrigger>
  )
}
