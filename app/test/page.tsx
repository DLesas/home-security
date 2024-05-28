"use client"

import { Button } from '@nextui-org/button'
import React, { useState } from 'react'

export default function Testpage() {
  const [alarm, setAlarm] = useState(false)
  const turnOn = async () => {
    const response = await fetch(
      `http://${process.env.NEXT_PUBLIC_IP}:5000/on`,
      {
        method: 'GET',
      }
    )
    const data = await response.json()
    setAlarm(data)
  }

  const turnOff = async () => {
    const response = await fetch(
      `http://${process.env.NEXT_PUBLIC_IP}:5000/off`,
      {
        method: 'GET',
      }
    )
    const data = await response.json()
    setAlarm(data)
  }

  return (
    <div className="flex justify-center">
      <div className="flex flex-col gap-20">
        <Button variant="solid" color="danger" onClick={turnOn}>
          turn on all alarms
        </Button>
        <Button variant="solid" color="primary" onClick={turnOff}>
          turn off all alarms
        </Button>
        <div>alarm is {alarm ? 'on' : 'off'} </div>
      </div>
    </div>
  )
}
