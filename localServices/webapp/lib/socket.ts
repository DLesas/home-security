import { io, Socket } from 'socket.io-client'

// "undefined" means the URL will be computed from the `window.location` object
// const URL = 'http://192.168.5.157:5000';
// const URL = 'http://192.168.226.94:5000';
const URL_VPN = 'http://' + process.env.NEXT_PUBLIC_IP + ':5000'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'

export const createSocket = (
  url: string
): Socket<DefaultEventsMap, DefaultEventsMap> => {
  return io(url)
}
