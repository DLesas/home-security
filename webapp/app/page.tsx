'use client'

import { Button } from '@nextui-org/button'
import { useRouter } from 'next/navigation'
import { useSocket } from './socketInitializer'

const vpnIP = '100.77.41.71'
//const homeIP = '192.168.226.94' //'192.168.0.126'
//const homeIP = '192.168.0.126' //'192.168.0.116'
const homeIP = '192.168.5.157'

export default function SelectSocket() {
  const router = useRouter()
  const { socket, setUrl, url } = useSocket()
  return (
    <div className="flex w-full flex-col items-center gap-28">
      Which network are you connected to?
      <Button
        onClick={(e) => {
          setUrl(`http://192.168.96.1:8080`)
          router.push('/home')
        }}
      >
        Test
      </Button>
      <Button
        color={'secondary'}
        onClick={(e) => {
          setUrl(`http://${homeIP}:5000`)
          router.push('/home')
        }}
      >
        Millfarm house local network
      </Button>
      <Button
        onClick={(e) => {
          setUrl(`http://${vpnIP}:5000`)
          router.push('/home')
        }}
      >
        Remote VPN
      </Button>
    </div>
  )
}
