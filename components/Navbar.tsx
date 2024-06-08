'use client'

import React, { useEffect, useState } from 'react'
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
import { socket } from '@/lib/socket'
import { Link } from '@nextui-org/link'
import { Button } from '@nextui-org/button'
import { AcmeLogo } from './AcmeLogo'
import { MdNotifications } from 'react-icons/md'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@nextui-org/dropdown'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'

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

// const example = {
//   alarm: false,
//   logs: {
//     House: {
//       'Back door': {
//         status: 'closed',
//       },
//       'Dining room': {
//         status: 'closed',
//       },
//       'Front door': {
//         status: 'closed',
//       },
//       'Living room': {
//         status: 'closed',
//       },
//     },
//   },
//   issues: [{ msg: 'test', time: new Date() }],
// }

type data = Example

function dismiss(callback: () => void, subject: String) {
  // send a request to '192.168.5.157' + ':5000' + '/arm')
  socket.timeout(5000).emit('dismiss', subject, callback)
}

function Notifications({ data }: { data: data }) {
  return (
    <Badge
      content={data.issues ? data.issues.length > 0? data.issues.length : undefined: undefined}
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
                  <div className="flex flex-row justify-between gap-4 items-center">
                    <div className="whitespace-break-spaces">{issue.msg}</div>
                    <Button size="sm" onClick={() => dismiss(() => {}, issue.id)}>dismiss</Button>
                  </div>
                ))
              : null}
          </div>
          {/* <DropdownItem key="new" shortcut="⌘N" description="Create a new file">
            New file
          </DropdownItem>
          <DropdownItem
            key="copy"
            shortcut="⌘C"
            description="Copy the file link"
          >
            Copy link
          </DropdownItem>
          <DropdownItem
            key="edit"
            shortcut="⌘⇧E"
            showDivider
            description="Allows you to edit the file"
          >
            Edit file
          </DropdownItem>
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            shortcut="⌘⇧D"
            description="Permanently delete the file"
          >
            Delete file
          </DropdownItem> */}
        </PopoverContent>
      </Popover>
    </Badge>
  )
}

export default function App() {
  const [data, setData] = useState<data>({} as data)
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  useEffect(() => {
    function onData(value: data) {
      setData(value)
    }

    socket.on('data', onData)

    return () => {
      socket.off('data', onData)
    }
  }, [])

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
          <Notifications data={data}></Notifications>
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
