import { Router } from '../../lib/electron-router-dom'
import Layout from './layout'
import { Route } from 'react-router-dom'
import Home from './screens/Home'
import NewDevice from './screens/newDevice'
// @ts-ignore
import React from 'react'

export function Routes() {
    return (
        <Router
          main={
          <Route path="/" element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/newDevice" element={<NewDevice />} >
            </Route>
          </Route>
        }
        />
    )
  }