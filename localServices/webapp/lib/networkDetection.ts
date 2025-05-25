interface ServerEndpoint {
  name: string
  url: string
  priority: number // Lower = higher priority
}

const ENDPOINTS: ServerEndpoint[] = [
  { name: 'Local Network', url: 'http://192.168.5.157:8080', priority: 1 },
  { name: 'local', url: 'http://localhost:8080', priority: 2 },
  { name: 'test 2', url: 'http://192.168.0.16:8080', priority: 3 },
  { name: 'Test Network', url: 'http://192.168.96.1:8080', priority: 4 },
  { name: 'VPN', url: 'http://100.77.41.71:8080', priority: 5 },
]

const TIMEOUT_MS = 3000 // 3 second timeout per endpoint

/**
 * Tests if a server endpoint is reachable
 */
async function testEndpoint(endpoint: ServerEndpoint): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(`${endpoint.url}/health`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors',
    })
    console.log(response)

    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Finds the best available server endpoint
 * Tries all endpoints in parallel, returns the highest priority one that works
 */
export async function detectBestEndpoint(): Promise<ServerEndpoint | null> {
  console.log('🔍 Detecting available server endpoints...')

  // Check cache first
  const cached = getCachedEndpoint()
  if (cached) {
    console.log(`📋 Found cached endpoint: ${cached.name}`)
    // Quick test cached endpoint
    if (await testEndpoint(cached)) {
      console.log(`✅ Cached endpoint still works: ${cached.name}`)
      return cached
    } else {
      console.log(`❌ Cached endpoint no longer works, clearing cache`)
      clearCachedEndpoint()
    }
  }

  // Test all endpoints in parallel
  const tests = ENDPOINTS.map(async (endpoint) => {
    const isReachable = await testEndpoint(endpoint)
    return { endpoint, isReachable }
  })

  const results = await Promise.all(tests)

  // Find working endpoints, sorted by priority
  const workingEndpoints = results
    .filter((result) => result.isReachable)
    .map((result) => result.endpoint)
    .sort((a, b) => a.priority - b.priority)

  if (workingEndpoints.length === 0) {
    console.error('❌ No server endpoints are reachable')
    return null
  }

  const bestEndpoint = workingEndpoints[0]
  console.log(
    `✅ Found working endpoint: ${bestEndpoint.name} (${bestEndpoint.url})`
  )

  // Cache the result
  setCachedEndpoint(bestEndpoint)

  return bestEndpoint
}

/**
 * Cache management
 */
const CACHE_KEY = 'home_security_endpoint'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

function getCachedEndpoint(): ServerEndpoint | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const { endpoint, timestamp } = JSON.parse(cached)

    // Check if cache is still valid
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    return endpoint
  } catch {
    return null
  }
}

function setCachedEndpoint(endpoint: ServerEndpoint): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        endpoint,
        timestamp: Date.now(),
      })
    )
  } catch {
    // Ignore storage errors
  }
}

function clearCachedEndpoint(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore storage errors
  }
}
