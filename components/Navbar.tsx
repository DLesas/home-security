'use client'

import React, { useEffect } from 'react'
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from '@nextui-org/navbar'
import { Link } from '@nextui-org/link'
import { Button } from '@nextui-org/button'
import { AcmeLogo } from './AcmeLogo'

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const [status, setStatus] = React.useState<Boolean>(true)

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(
          `http://${process.env.NEXT_PUBLIC_IP}:5000/status`,
          {
            method: 'GET',
          }
        )
        const data: any = await response.json()
        setStatus(data['armed'])
        // You might need to handle the response based on the actual content type
      } catch (error) {
        console.error('Error fetching sensor data:', error)
      }
    }, 500)

    // Clean up intervals on component unmount
    return () => {
      clearInterval(intervalId)
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
          <p className="font-bold text-inherit">ACME</p>
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
          {status ? (
            <Button
              onClick={() => {
                fetch(`http://${process.env.NEXT_PUBLIC_IP}:5000/disarm`)
              }}
              color="primary"
              variant="flat"
            >
              Disarm
            </Button>
          ) : (
            <Button
              onClick={() => {
                fetch(`http://${process.env.NEXT_PUBLIC_IP}:5000/arm`)
              }}
              color="primary"
              variant="flat"
            >
              Arm
            </Button>
          )}
        </NavbarItem>
        <NavbarItem>
          <span>Armed: {JSON.stringify(status)}</span>
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
