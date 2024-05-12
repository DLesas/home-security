'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Divider } from '@nextui-org/divider'
import { FaListCheck } from 'react-icons/fa6'
import {
  MdHome,
  MdStorage,
  MdPerson,
  MdSettings,
  MdSettingsInputComponent,
  MdSupervisorAccount,
  MdAccountBalance,
  MdChevronRight,
} from 'react-icons/md'
import { RiShoppingBag3Fill } from 'react-icons/ri'
import { SiGoogleanalytics } from 'react-icons/si'
import companyLogo from './SampleCompanyLogo.png'
import SidebarProfile from './sidebarProfile'
import SidebarNotifications from './sidebarNotifications'
import SidebarCompanyProfile from './sidebarCompanyProfile'
import { usePathname } from 'next/navigation'
import SidebarLink from './sidebarLink'

const items = [
  { title: 'Home', Icon: MdHome, href: '/app' },
  { title: 'Products', Icon: RiShoppingBag3Fill, href: '/app/products' },
  { title: 'Inventory', Icon: MdStorage, href: '/app/inventory' },
  { title: 'Orders', Icon: FaListCheck, href: '/app/orders' },
  { title: 'Customers', Icon: MdPerson, href: '/app/customers' },
  { title: 'Analytics', Icon: SiGoogleanalytics, href: '/app/analytics' },
]

const bottomItems = [
  { title: 'Team', Icon: MdSupervisorAccount, href: '/app/team' },
  {
    title: 'Integrations',
    Icon: MdSettingsInputComponent,
    href: '/app/integrations',
  },
  { title: 'Billing', Icon: MdAccountBalance, href: '/app/billing' },
  { title: 'Settings', Icon: MdSettings, href: '/app/settings' },
]

const framerSidebarPanel = {
  initial: { x: '-100%', width: (256 / 100) * 80 },
  animate: {
    x: 0,
    width: (256 / 100) * 80,
    transition: { type: 'tween', duration: 0.5 },
  },
  mini: {
    x: 0,
    width: '90px',
    transition: { type: 'tween', duration: 0.5 },
  },
  exit: {
    x: '-100%',
    width: (256 / 100) * 80,
    transition: { type: 'tween', duration: 0.5 },
  },
}

const framerText = (delay: number) => {
  return {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: {
      delay: 0.3 + delay / 10,
    },
  }
}

export const Sidebar = ({
  activeLinkRef,
}: {
  activeLinkRef: React.MutableRefObject<null | HTMLButtonElement>
}) => {
  const path = usePathname()
  const twoPath =
    '/' +
    path.split('/')[1] +
    (path.split('/')[2] ? '/' + path.split('/')[2] : '')
  console.log(twoPath)
  const [open, setOpen] = useState(false)
  const [mini, setMini] = useState(false)
  const ref = useRef(null)
  // const toggleSidebar = () => setOpen((prev) => !prev);

  useEffect(() => {
    setOpen(true)
  }, [])

  useEffect(() => {
    if (open) {
      if (path === '/app') {
        setMini(false)
      } else {
        setMini(true)
      }
    }
  }, [path, open])

  const framerIcon = {
    initial: { scale: mini ? 0.5 : 0 },
    animate: { scale: 1 },
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
      delay: mini ? 0 : 1.4,
    },
  }

  // TODO: get dynamic image of company logo instead of static
  // TODO: get dynamic company name instead of static

  return (
    <>
      {/* <button
        onClick={toggleSidebar}
        className="rounded-xl border-2 border-zinc-800 p-3"
        aria-label="toggle sidebar"
      >
        <GiHamburgerMenu />
      </button> */}
      <AnimatePresence mode="popLayout" initial={false}>
        {open && (
          <>
            {/* <motion.div
              {...framerSidebarBackground}
              aria-hidden="true"
              className="fixed bottom-0 left-0 right-0 top-0 z-10 bg-[rgba(0,0,0,0.1)] backdrop-blur-sm"
            ></motion.div> */}
            <motion.div
              variants={framerSidebarPanel}
              layout
              initial="initial"
              animate={open ? (mini ? 'mini' : 'animate') : 'exit'}
              className={
                'bottom-0 left-0 top-0 flex h-screen flex-col gap-4 border-r-2 '
              }
              ref={ref}
              aria-label="Sidebar"
            >
              <div className="p-3">
                <SidebarCompanyProfile
                  mini={mini}
                  companyLogo={companyLogo}
                ></SidebarCompanyProfile>
              </div>
              <ul>
                {items.map((item, idx) => {
                  const { title, href, Icon } = item
                  return (
                    <SidebarLink
                      key={title}
                      mini={mini}
                      href={href}
                      ref={activeLinkRef}
                      active={twoPath === href}
                      IconNode={
                        <motion.div {...framerIcon}>
                          <Icon
                            size={20}
                            className={href === path ? 'active-icon' : ''}
                          />
                        </motion.div>
                      }
                      TitleNode={
                        <motion.span {...framerText(idx)}>{title}</motion.span>
                      }
                    ></SidebarLink>
                  )
                })}
              </ul>
              <div className="flex h-full flex-col justify-end gap-4">
                <motion.ul>
                  {bottomItems.map((item, idx) => {
                    const { title, href, Icon } = item
                    return (
                      <SidebarLink
                        ref={activeLinkRef}
                        key={title}
                        mini={mini}
                        href={href}
                        active={href === path}
                        IconNode={
                          <motion.div {...framerIcon}>
                            <Icon
                              size={20}
                              className={href === path ? 'active-icon' : ''}
                            />
                          </motion.div>
                        }
                        TitleNode={
                          <motion.span {...framerText(items.length + idx)}>
                            {title}
                          </motion.span>
                        }
                      ></SidebarLink>
                    )
                  })}
                </motion.ul>
                <motion.div className="p-3" {...framerIcon}>
                  <SidebarNotifications mini={mini}></SidebarNotifications>
                </motion.div>
                {/* <Divider></Divider>
                <motion.div {...framerIcon}>
                  <SidebarProfile mini={mini}></SidebarProfile>
                </motion.div> */}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

const framerSidebarBackground = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { delay: 0.2 } },
  transition: { duration: 0.3 },
}
