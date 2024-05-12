"use client"
import React, { useEffect, useRef } from 'react'
import { Sidebar } from './sidebar'
import { SubSidebar } from './subSidebar'

export default function sidebarParent() {
    const activeLinkRef: React.MutableRefObject<null | HTMLButtonElement> = useRef(null) 

    return (
        <>
            <Sidebar activeLinkRef={activeLinkRef}></Sidebar>
            <SubSidebar activeLinkRef={activeLinkRef}></SubSidebar>
        </>
    )
}
