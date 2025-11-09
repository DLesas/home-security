'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from '@nextui-org/navbar'
import { Badge } from '@nextui-org/badge'
import { Button } from '@nextui-org/button'
import { MdNotifications } from 'react-icons/md'
import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
import { useTheme } from 'next-themes'
import { useSocket } from './socketInitializer'
import { useSocketData } from './socketData'
import NextLink from 'next/link'
import { Link as NextUILink } from '@nextui-org/link'

interface Issue {
  msg: string
  time: Date
  id: string
}

interface Data {
  alarm: boolean
  logs: {
    [key: string]: any
  }
  issues: Issue[] | []
}

function dismiss(socket: any, callback: () => void, subject: string) {
  if (socket) {
    socket.timeout(5000).emit('dismiss', subject, callback)
  }
}

function Notifications({ data }: { data: Data }) {
  const { socket } = useSocket()

  return (
    <Badge
      content={data.issues?.length > 0 ? data.issues.length : undefined}
      shape="circle"
      color="danger"
      size="sm"
    >
      <Popover placement="bottom-end" showArrow offset={10}>
        <PopoverTrigger>
          <Button
            isIconOnly
            radius="full"
            variant="light"
            size="sm"
            aria-label="Notifications"
          >
            <MdNotifications size={20} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <div className="px-4 py-3 border-b border-default-200 dark:border-default-100">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.issues?.length > 0 ? (
              <div className="divide-y divide-default-200 dark:divide-default-100">
                {data.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="px-4 py-3 hover:bg-default-100 dark:hover:bg-default-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-default-700 dark:text-default-600 flex-1">
                        {issue.msg}
                      </p>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => dismiss(socket, () => {}, issue.id)}
                        className="shrink-0"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-default-500">No notifications</p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </Badge>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button isIconOnly radius="full" variant="light" size="sm">
        <div className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <Button
      isIconOnly
      radius="full"
      variant="light"
      size="sm"
      onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <HiOutlineSun size={20} /> : <HiOutlineMoon size={20} />}
    </Button>
  )
}

export default function AppNavbar() {
  const pathname = usePathname()
  const { data } = useSocketData()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  const menuItems = [
    { name: 'Home', href: '/home' },
    { name: 'Logs', href: '/logs' },
    { name: 'Scheduling', href: '/scheduling' },
    { name: 'Settings', href: '/settings' },
    { name: 'Test', href: '/test' },
    { name: 'All', href: '/all' },
  ]

  return (
    <Navbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      maxWidth="2xl"
      classNames={{
        wrapper: 'px-4 md:px-6',
        base: 'border-b border-default-200 dark:border-default-100',
      }}
    >
      {/* Mobile: Hamburger + Logo */}
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          className="md:hidden"
        />
        <NavbarBrand>
          <NextUILink
            as={NextLink}
            href="/home"
            color="foreground"
            className="font-volkorn font-semibold text-lg"
          >
            Home Security
          </NextUILink>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop: Navigation Links */}
      <NavbarContent className="hidden md:flex gap-6" justify="center">
        {menuItems.map((item) => (
          <NavbarItem key={item.href} isActive={pathname === item.href}>
            <NextUILink
              as={NextLink}
              href={item.href}
              color={pathname === item.href ? 'primary' : 'foreground'}
              className="text-sm font-medium"
            >
              {item.name}
            </NextUILink>
          </NavbarItem>
        ))}
      </NavbarContent>

      {/* Right Side: Notifications + Theme Toggle */}
      <NavbarContent justify="end">
        <NavbarItem>
          <ThemeToggle />
        </NavbarItem>
        <NavbarItem>
          <Notifications data={data} />
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu */}
      <NavbarMenu className="pt-6 gap-2">
        {menuItems.map((item) => (
          <NavbarMenuItem key={item.href}>
            <NextUILink
              as={NextLink}
              href={item.href}
              color={pathname === item.href ? 'primary' : 'foreground'}
              className="w-full text-base py-2"
              onPress={() => setIsMenuOpen(false)}
            >
              {item.name}
            </NextUILink>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  )
}
