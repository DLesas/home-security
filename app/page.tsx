import { cookies } from 'next/headers'

export default async function Index() {

  const cameras = [
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
  ]

  const doorSensors = [
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
    { name: '', url: '' },
  ]

  return (
    <div className="flex w-full flex-1 flex-row items-center gap-20">
      {}
    </div>
  )
}
