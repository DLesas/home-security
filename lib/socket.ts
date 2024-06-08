import { io } from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
// const URL = 'http://192.168.5.157:5000';
// const URL = 'http://192.168.226.94:5000';
const URL = "http://" + process.env.NEXT_PUBLIC_IP + ":5000"


export const socket = io(URL);