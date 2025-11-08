'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
import { AcmeLogo } from '../components/AcmeLogo'
import { MdNotifications } from 'react-icons/md'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
import { useSocket } from './socketInitializer'
import { useSocketData } from './socketData'
import NextLink from 'next/link'
import { Link as NextUILink } from '@nextui-org/link'

type LogStatus = 'open' | 'closed'
interface DoorValues {
  status: LogStatus
  armed: boolean
}

interface DoorEntries {
  [key: string]: DoorValues
}

interface Example {
  alarm: boolean
  logs: {
    [key: string]: DoorEntries | {}
  }
  issues:
    | {
        msg: string
        time: Date
        id: string
      }[]
    | [] // Update to allow for an empty array
}

type Data = Example

function dismiss(socket: any, callback: () => void, subject: string) {
  if (socket) {
    socket.timeout(5000).emit('dismiss', subject, callback)
  }
}

function Notifications({ data }: { data: Data }) {
  const { socket } = useSocket()

  return (
    <Badge
      content={
        data.issues
          ? data.issues.length > 0
            ? data.issues.length
            : undefined
          : undefined
      }
      shape="circle"
      color="danger"
    >
      <Popover placement="bottom" showArrow offset={20}>
        <PopoverTrigger>
          <Button isIconOnly radius="full" variant="light">
            <MdNotifications size={24}></MdNotifications>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-4/6 p-4"
          aria-label="Dropdown menu with description"
        >
          <div className="flex flex-col gap-4">
            {data.issues
              ? data.issues.map((issue) => (
                  <div
                    className="flex flex-row items-center justify-between gap-4"
                    key={issue.id}
                  >
                    <div className="whitespace-break-spaces">{issue.msg}</div>
                    <Button
                      size="sm"
                      onClick={() => dismiss(socket, () => {}, issue.id)}
                    >
                      dismiss
                    </Button>
                  </div>
                ))
              : null}
          </div>
        </PopoverContent>
      </Popover>
    </Badge>
  )
}

export default function App() {
  const router = useRouter()
  const pathname = usePathname()
  const { data, isConnected } = useSocketData()
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
    <Navbar isMenuOpen={isMenuOpen} onMenuOpenChange={setIsMenuOpen}>
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          className="sm:hidden"
        />
        <NavbarBrand>
          <AcmeLogo />
          <p className="font-bold text-inherit">Dimitri's security</p>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden gap-4 sm:flex" justify="center">
        <NavbarItem isActive={pathname === '/home'}>
          <NextUILink
            as={NextLink}
            href="/home"
            color={pathname === '/home' ? 'primary' : 'foreground'}
          >
            Home
          </NextUILink>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/logs'}>
          <NextUILink
            as={NextLink}
            href="/logs"
            color={pathname === '/logs' ? 'primary' : 'foreground'}
          >
            Logs
          </NextUILink>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/scheduling'}>
          <NextUILink
            as={NextLink}
            href="/scheduling"
            color={pathname === '/scheduling' ? 'primary' : 'foreground'}
          >
            Scheduling
          </NextUILink>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/settings'}>
          <NextUILink
            as={NextLink}
            href="/settings"
            color={pathname === '/settings' ? 'primary' : 'foreground'}
          >
            Settings
          </NextUILink>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/all'}>
          <NextUILink
            as={NextLink}
            href="/all"
            color={pathname === '/all' ? 'primary' : 'foreground'}
          >
            All
          </NextUILink>
        </NavbarItem>
        <NavbarItem isActive={pathname === '/test'}>
          <NextUILink
            as={NextLink}
            href="/test"
            color={pathname === '/test' ? 'primary' : 'foreground'}
          >
            Test
          </NextUILink>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem></NavbarItem>
        <NavbarItem>
          <Notifications data={data} />
        </NavbarItem>
      </NavbarContent>
      <NavbarMenu>
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item}-${index}`}>
            <NextUILink
              as={NextLink}
              color={item.href === pathname ? 'primary' : 'foreground'}
              className="w-full"
              href={item.href}
              onPress={() => {
                setIsMenuOpen(false)
              }}
            >
              {item.name}
            </NextUILink>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  )
}
