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
import { Button } from '@nextui-org/button'
import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2'
import { useTheme } from 'next-themes'
import NextLink from 'next/link'
import { Link as NextUILink } from '@nextui-org/link'
import NotificationsPopover from '../components/NotificationsPopover'

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
          <NotificationsPopover />
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
