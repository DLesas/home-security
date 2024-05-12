'use client'

import { useState } from 'react'
import { StreamableMultiStepLoader as Loader } from '@/components/multi-step-loader'
import { MdCoronavirus } from 'react-icons/md'
import { Button } from '@nextui-org/button'
import { createCompany } from '@/lib/auth/createCompany'
import { readStreamableValue } from 'ai/rsc'

const loadingStates = [
  {
    text: 'Buying a condo',
  },
  {
    text: 'Travelling in a flight',
  },
  {
    text: 'Meeting Tyler Durden',
  },
  {
    text: 'He makes soap',
  },
  {
    text: 'We goto a bar',
  },
  {
    text: 'Start a fight',
  },
  {
    text: 'We like it',
  },
  {
    text: 'Welcome to F**** C***',
  },
]

export default function MultiStepLoaderDemo() {
  const [loading, setLoading] = useState(false)
  const [currentState, setCurrentState] = useState(0)
  const [returnedVal, setReturnedVal] = useState('ask')
  return (
    <>
      {/* Core Loader Modal */}
      <Loader
        loadingStates={loadingStates}
        loading={loading}
        currentState={currentState}
      />

      {/* The buttons are for demo only, remove it in your actual code ⬇️ */}
      <Button
        className="mx-auto flex h-10 items-center justify-center rounded-lg bg-[#39C3EF] px-8 text-sm font-medium text-black transition duration-200 hover:bg-[#39C3EF]/90 md:text-base"
        style={{
          boxShadow:
            '0px -1px 0px 0px #ffffff40 inset, 0px 1px 0px 0px #ffffff40 inset',
        }}
        onClick={async () => {
          setLoading(true)
          const { status } = await createCompany(
            {
              companyName: 'test',
            },
            '123'
          )
          for await (const value of readStreamableValue(status)) {
            setReturnedVal(value as string)
            setCurrentState((prev) => prev + 1)
          }
        }}
      >
        {returnedVal}
      </Button>

      {loading && (
        <button
          className="fixed right-4 top-4 z-[120] text-black dark:text-white"
          onClick={() => setLoading(false)}
        >
          <MdCoronavirus />
        </button>
      )}
    </>
  )
}
