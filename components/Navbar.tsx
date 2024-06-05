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
import { socket } from '@/lib/socket'
import { Link } from '@nextui-org/link'
import { Button } from '@nextui-org/button'
import { AcmeLogo } from './AcmeLogo'

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
        <NavbarItem>
        </NavbarItem>
        <NavbarItem>
          
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
