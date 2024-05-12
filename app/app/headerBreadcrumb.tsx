'use client'
import { MdHome } from 'react-icons/md'
import React from 'react'
import { Breadcrumbs, BreadcrumbItem } from '@nextui-org/breadcrumbs'
import { usePathname } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'

export default function headerBreadcrumb() {
  const paths =
    usePathname()
      .split('/app')[1]
      .split('/')
      ?.filter((path) => path) || []

  return (
    <Breadcrumbs className="flex flex-col justify-center">
      <BreadcrumbItem href="/app/">
        <MdHome size={20}></MdHome>
      </BreadcrumbItem>
      {paths.map((path, idx) => {
        const newPath = '/app/' + paths.slice(0, idx + 1).join('/')
        return (
          <BreadcrumbItem href={newPath} key={path}>
            {path}
          </BreadcrumbItem>
        )
      })}
    </Breadcrumbs>
  )
}
