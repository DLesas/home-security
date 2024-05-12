'use server'

import { getUserInfo } from '@/lib/auth/utils/serverUtils'
import { headers } from 'next/headers'
import { userAgent, NextRequest } from 'next/server'

export default async function test() {

  return (
    <>
      <div>headers: {JSON.stringify(headers())}</div>
    </>
  )
}
