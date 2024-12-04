import React from 'react'
import { FaRegCalendarDays, FaRegUser } from 'react-icons/fa6'
import { FaCircle, FaHome, FaRegCircle, FaRegFileAlt } from 'react-icons/fa'
import { MdSettings, MdAddModerator  } from 'react-icons/md'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { FaChevronUp } from 'react-icons/fa'
import { Tabs, Tab } from '@nextui-org/tabs'
import { MdSunny } from 'react-icons/md'
import { IoMdMoon } from 'react-icons/io'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from './ui/sidebar'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { IconType } from 'react-icons'
import { useSocketData } from '@renderer/socketDataContext'
import { checkArmedState, countDoorEntries } from '@renderer/utils/socketHelpers'
import { NavLink } from 'react-router-dom'

// Menu items.

type SidebarChildItem = {
  title: string
  url: string
}

type SidebarParentItem = {
  title: string
  url?: string
  icon: IconType
  collapsible: boolean
  items?: SidebarChildItem[]
}

const sidebarItems: SidebarParentItem[] = [
  {
    title: 'Home',
    url: '/',
    icon: FaHome,
    collapsible: false
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: MdSettings,
    collapsible: false
  },
  {
    title: 'Scheduling',
    url: '/scheduling',
    icon: FaRegCalendarDays,
    collapsible: false
  },
  {
    title: 'New Device',
    url: '/newDevice',
    icon: MdAddModerator,
    collapsible: false
  },
  {
    title: 'Logs',
    icon: FaRegFileAlt,
    collapsible: true,
    items: [
      {
        title: 'Access Logs',
        url: '/logs/access'
      },
      {
        title: 'Event Logs',
        url: '/logs/event'
      },
      {
        title: 'Device Logs',
        url: '/logs/device'
      }
    ]
  }
]

export function AppSidebar() {
  const { isConnected, data } = useSocketData()
  const armed = checkArmedState(countDoorEntries(data))

  return (
    <Sidebar className="flex flex-row justify-center dark:bg-foreground-50 bg-foreground-100 border-foreground-300 py-8">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="flex gap-2 px-2 py-1 items-center">
                {isConnected ? (
                  <span className="flex flex-row items-center gap-2 text-green-400">
                    <FaCircle size={12}></FaCircle> Connected{' '}
                  </span>
                ) : (
                  <span className="flex flex-row items-center gap-2 text-red-400">
                    <FaRegCircle size={12}></FaRegCircle> Disconnected{' '}
                  </span>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem className="flex px-2 items-center">
                <span>System is </span>
                {armed === 'Armed' ? (
                  <span className="text-red-400 ml-1">armed</span>
                ) : armed === 'Disarmed' ? (
                  <span className="text-green-400 ml-1">disarmed</span>
                ) : armed === 'Partially armed' ? (
                  <span className="text-yellow-400 ml-1">partially armed</span>
                ) : (
                  <span className="ml-1">unknown</span>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem className="flex px-2 items-center">
                Alarm is{' '}
                {data.alarm ? (
                  <span className="text-red-400 ml-1"> playing </span>
                ) : (
                  <span className="text-green-400 ml-1">not playing</span>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) =>
                item.collapsible ? (
                  <CollapsibleSidebarItem key={item.title} item={item} />
                ) : (
                  <NonCollapsibleSidebarItem key={item.title} item={item} />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="flex flex-row justify-center">
        <ThemeToggle />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

type SidebarItemProps = {
  item: SidebarParentItem
}

function NonCollapsibleSidebarItem({ item }: SidebarItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink to={item.url!}>
          <item.icon />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function CollapsibleSidebarItem({ item }: SidebarItemProps) {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <item.icon />
            {item.title}
            <FaChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:-rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((item) => (
              <SidebarMenuSubItem key={item.title}>
                <SidebarMenuSubButton>
                  <NavLink to={item.url!}>
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [selected, setSelected] = useState('dark')
  const { setTheme } = useTheme()
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <Tabs
      radius="full"
      color="primary"
      selectedKey={selected}
      // @ts-ignore
      onSelectionChange={(e: string) => {
        setSelected(e)
        console.log(e)
        setTheme(e)
      }}
    >
      <Tab
        key="dark"
        title={
          <div className="flex items-center space-x-2">
            <IoMdMoon />
            <span>Dark</span>
          </div>
        }
      ></Tab>
      <Tab
        key="light"
        title={
          <div className="flex items-center space-x-2">
            <MdSunny />
            <span>Light</span>
          </div>
        }
      ></Tab>
    </Tabs>
  )
}
