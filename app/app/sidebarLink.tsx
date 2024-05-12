import React, { forwardRef, ReactNode, MutableRefObject } from 'react'
import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { motion } from 'framer-motion'
import TooltipComponent from '@/components/Tooltip'

interface SidebarLinkProps {
  href: string
  TitleNode: ReactNode
  IconNode: ReactNode
  mini: boolean
  active: boolean
}

const SidebarLink = forwardRef<HTMLButtonElement, SidebarLinkProps>(
  ({ href, TitleNode, IconNode, mini, active }, ref) => {
    const sideLink = (
      <motion.li
        className={
          active ? 'rounded-l-xl border-r-4 border-primary bg-background' : ''
        }
        layout
        transition={spring}
      >
        <div>
          <Button
            variant="light"
            as={Link}
            ref={active ? ref : null}
            href={href}
            className={
              'flex h-unit-xl min-w-0 items-center gap-10 rounded-none rounded-l-medium p-3 px-6 transition-all ' +
              (mini ? 'justify-center ' : 'justify-start ')
            }
            startContent={
              <motion.div layout transition={spring}>
                {IconNode}
              </motion.div>
            }
          >
            {!mini && TitleNode}
          </Button>
        </div>
      </motion.li>
    )
    const name = href.split('/')[2] || 'Home'
    return <TooltipComponent trigger={sideLink} disabled={!mini} placement='end'>{name}</TooltipComponent>
  }
)

const spring = {
  type: 'tween',
}

export default SidebarLink
