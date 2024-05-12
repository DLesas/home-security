'use client'

import useWindowDimensions from '@/hooks/useWindowDimensions'
import { useFingerprintDetails, useFingerprint } from '@/hooks/useFingerprint'
import { readStreamableValue } from 'ai/rsc'
import { createCompany } from '@/lib/auth/createCompany'
import { useState } from 'react'
import { Button } from '@nextui-org/button'



export default function test() {
  const [returnedval, setReturnedVal] = useState('ask')
  const { height, width } = useWindowDimensions()
  const fingerprintDetails = useFingerprintDetails()
  const fingerprintHash = useFingerprint()

  return (
    <>
      <div>height: {height}</div>
      <div>width:{width}</div>
      <div>fingerprint details: {JSON.stringify(fingerprintDetails)}</div>
      <div>fingerprint hash: {JSON.stringify(fingerprintHash)}</div>
      <Button
        onClick={async () => {
          const { status } = await createCompany(
            {
              companyName: 'test',
            },
            '123'
          )
          for await (const value of readStreamableValue(status)) {
            setReturnedVal(value as string)
          }
        }}
      >
        {returnedval}
      </Button>
    </>
  )
}
