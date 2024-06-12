"use client"

import React, { useEffect, useState } from 'react';
import { useSocket } from '../socketInitializer'
import { Button } from '@nextui-org/button';

const StorageListenerComponent: React.FC = () => {
 const socket = useSocket()
  const [socketUrl, setSocketUrl] = useState<string | null>(null);

  const initializeSocket = (url: string) => {
    console.log(`Initializing socket with URL: ${url}`);
    // Your socket initialization logic here
  };

  useEffect(() => {
    setSocketUrl(sessionStorage.getItem('socketUrl'))
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'socketUrl') {
        const newSocketUrl = event.newValue;
        if (newSocketUrl) {
          console.log(`New socket URL: ${newSocketUrl}`);
          initializeSocket(newSocketUrl);
          setSocketUrl(newSocketUrl);
        } else {
          console.log('Socket URL removed');
          setSocketUrl(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <div>
      <h2>Current Socket URL directly: {socketUrl}</h2>
      <h3>Current Socket URL in context: {socket? JSON.stringify(socket) : 'no socket'}</h3>
      <p>Change the socket URL in localStorage from another tab to see updates here.</p>
    <Button onClick={() => sessionStorage.removeItem('socketUrl')}> remove </Button>
    <Button onClick={() => sessionStorage.setItem('socketUrl', 'http://localhost:5000')}> set </Button>
    </div>
  );
};

export default StorageListenerComponent;
