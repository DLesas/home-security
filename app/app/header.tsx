import React from 'react'
import HeaderBreadcrumb from './headerBreadcrumb'
import { Avatar } from '@nextui-org/avatar'
import LightDark from '@/components/LightDark'
import { Popover, PopoverTrigger } from '@nextui-org/popover'

export default function header() {
  return (
    <div className="flex flex-row items-center justify-between">
      <HeaderBreadcrumb></HeaderBreadcrumb>
      <div className="flex flex-row items-center justify-between gap-2">
        <Popover color="primary" placement="bottom">
          <PopoverTrigger>
            <Avatar className="h-[30px] w-[30px]"></Avatar>
          </PopoverTrigger>
          <div>hello</div>
        </Popover>
        <LightDark></LightDark>
      </div>
    </div>
  )
}
