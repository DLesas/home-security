const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  reloadOnOnline: true,
  //register: true, // register the PWA service worker
  skipWaiting: true,
  //disable: process.env.NODE_ENV === 'development',
  // ... other options you like
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Enable React strict mode for improved error handling
  swcMinify: true,
}

module.exports = withPWA(nextConfig)


//module.exports = nextConfig
