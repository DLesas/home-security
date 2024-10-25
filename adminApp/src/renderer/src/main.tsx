import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Routes } from './routes'
import { Providers } from './providers'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <Routes />
    </Providers>
  </React.StrictMode>
)
