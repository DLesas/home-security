'use client'

import React from 'react'
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
import { Link } from '@nextui-org/link'
import { Button } from '@nextui-org/button'
import { AcmeLogo } from '../components/AcmeLogo'
import { MdNotifications } from 'react-icons/md'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
import { useSocket } from './socketInitializer'
import { useSocketData } from './socketData'

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
  const socket = useSocket()

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
  const { data, isConnected } = useSocketData()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  const menuItems = [
    'Profile',
    'Dashboard',
    'Activity',
    'Analytics',
    'System',
    'Deployments',
    'My Settings',
    'Team Settings',
    'Help & Feedback',
    'Log Out',
  ]

  return (
    <Navbar onMenuOpenChange={setIsMenuOpen}>
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
        <NavbarItem>
          <Link color="foreground" href="#">
            Features
          </Link>
        </NavbarItem>
        <NavbarItem isActive>
          <Link href="#" aria-current="page">
            Customers
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link color="foreground" href="#">
            Integrations
          </Link>
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
            <Link
              color={
                index === 2
                  ? 'primary'
                  : index === menuItems.length - 1
                    ? 'danger'
                    : 'foreground'
              }
              className="w-full"
              href="#"
              size="lg"
            >
              {item}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  )
}
