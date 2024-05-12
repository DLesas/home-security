'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { Divider } from '@nextui-org/divider'
import { FaListCheck } from 'react-icons/fa6'
import { MdHome, MdStorage, MdPerson } from 'react-icons/md'
import { RiShoppingBag3Fill } from 'react-icons/ri'
import { SiGoogleanalytics } from 'react-icons/si'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface subItem {
  title: string
  href: string
}

interface subItems {
  [key: string]: subItem[]
}

const subItems: subItems = {
  '/app/products': [
    { title: 'Overview', href: '/app/products' },
    { title: 'Product Categories', href: '/app/products/categories' },
    { title: 'Product Files', href: '/app/products/tags' },
    { title: 'Product Attributes', href: '/app/products/attributes' },
    { title: 'Product Collections', href: '/app/products/collections' },
  ],
  '/app/inventory': [
    { title: 'Overview', href: '/app/inventory' },
    { title: 'Stock', href: '/app/inventory/stock' },
    { title: 'Inventory Locations', href: '/app/inventory/locations' },
  ],
  '/app/orders': [
    { title: 'All Orders', href: '/app/orders' },
    { title: 'Order Statuses', href: '/app/orders/statuses' },
    { title: 'Order Refunds', href: '/app/orders/refunds' },
  ],
  '/app/customers': [
    { title: 'All Customers', href: '/app/customers' },
    { title: 'Customer Groups', href: '/app/customers/groups' },
  ],
  '/app/analytics': [
    { title: 'All Analytics', href: '/app/analytics' },
    { title: 'Analytics Reports', href: '/app/analytics/reports' },
  ],
}

const framerSidebarPanel = {
  initial: {
    x: 0,
    width: '0',
    opacity: 0,
    borderRightWidth: '0px',
    transition: { type: 'tween', duration: 0.5 },
  },
  animate: {
    x: 0,
    width: '100%',
    opacity: 1,
    borderRightWidth: '1px',
    transition: { type: 'tween', duration: 0.8, delay: 0.3 },
  },
  exit: {
    x: -50,
    width: '0%',
    borderRightWidth: '0px',
    opacity: 0,
    transition: { type: 'tween', duration: 0.5 },
  },
}

const framerText = (delay: number) => {
  return {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: {
      delay: 0.5 + delay / 10,
    },
  }
}

// const framerBottomText = (delay: number) => {
//   return {
//     initial: { opacity: 0, x: -50 },
//     animate: { opacity: 1, x: 0 },
//     transition: {
//       delay: 0.5 + (items.length + bottomItems.length - delay) / 10,
//     },
//   };
// };

const framerIcon = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: {
    type: 'spring',
    stiffness: 260,
    damping: 20,
    delay: 1.6,
  },
}

export const SubSidebar = ({
  activeLinkRef,
}: {
  activeLinkRef: React.MutableRefObject<null | HTMLButtonElement>
}) => {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [y, setY] = useState(0)

  useEffect(() => {
    if (path === '/app') {
      setOpen(false)
    } else {
      setOpen(true)
    }
  }, [path])

  useEffect(() => {
    if (open) {
      setY(activeLinkRef.current?.getBoundingClientRect().y || 0)
    }
  }, [open, path])

  const TwoPath = '/' + path.split('/')[1] + '/' + path.split('/')[2]
  const links = subItems[TwoPath]
  // path === "/app" ? setOpen(false) : setOpen(true);
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
      {/* <motion.div
              {...framerSidebarBackground}
              aria-hidden="true"
              className="fixed bottom-0 left-0 right-0 top-0 z-10 bg-[rgba(0,0,0,0.1)] backdrop-blur-sm"
            ></motion.div> */}
      <AnimatePresence mode="popLayout" initial={false}>
        {open && (
          <motion.div
            variants={framerSidebarPanel}
            initial="initial"
            animate={'animate'}
            exit="exit"
            className="relative bottom-0 top-0 flex h-screen w-full flex-col justify-between border-r-1 p-3 pt-32"
            aria-label="Sidebar"
          >
            {/* <div className="flex flex-row justify-center text-lg font-medium text-primary">{ TwoPath.split('/')[2] }</div> */}
            <ul
              className={
                'absolute flex w-[140px] flex-col justify-center gap-6 '
              }
              style={{ top: `${y}px` }}
            >
              {links &&
                links.map((item, idx) => {
                  const { title, href } = item
                  return (
                    <li key={TwoPath + title}>
                      <Button
                        variant="light"
                        as={Link}
                        href={href}
                        className={
                          'flex h-unit-xl w-full items-center justify-start gap-10 px-3 text-center transition-all ' +
                          (path === href ? 'bg-zinc-100' : '')
                        }
                      >
                        <motion.span className="" {...framerText(idx)}>
                          {title}
                        </motion.span>
                      </Button>
                    </li>
                  )
                })}
            </ul>
            <div></div>
          </motion.div>
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
