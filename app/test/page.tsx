"use client"

import React, { useEffect, useState } from 'react';
import { useSocket } from '../socketInitializer'
import { Button } from '@nextui-org/button';

const StorageListenerComponent: React.FC = () => {
 const {socket} = useSocket()
 const [data, setData] = useState()


  useEffect(() => {
    socket!.timeout(10000).emit('logs', {name: 'Shed', date: '29-06-24'}, (e: any) => {console.log(e)
      setData(e)
    })
  }, [socket]);


  return (
    <div>
      {JSON.stringify(data)}
    </div>
  );
};

export default StorageListenerComponent;
