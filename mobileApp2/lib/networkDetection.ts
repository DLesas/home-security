// Network detection for Expo/React Native
// Mirrors logic from `localServices/webapp/lib/networkDetection.ts`

import * as SecureStore from "expo-secure-store";

interface ServerEndpoint {
  name: string;
  url: string;
  priority: number; // Lower = higher priority
}

const ENDPOINTS: ServerEndpoint[] = [
  { name: "Local Network", url: "http://192.168.5.157:8080", priority: 1 },
  { name: "Local Network", url: "http://192.168.0.116:8080", priority: 2 },
  { name: "local", url: "http://localhost:8080", priority: 3 },
  { name: "test 2", url: "http://192.168.0.16:8080", priority: 4 },
  { name: "Test Network", url: "http://192.168.96.1:8080", priority: 5 },
  { name: "VPN", url: "http://100.77.41.71:8080", priority: 6 },
];

const TIMEOUT_MS = 3000; // 3 seconds

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  // AbortController is available in RN 0.76, but implement a fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    // Fallback without AbortController
    return await Promise.race<Promise<Response>>([
      fetch(url, { method: "GET" }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ) as any,
    ]);
  }
}

async function testEndpoint(endpoint: ServerEndpoint): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${endpoint.url}/health`,
      TIMEOUT_MS
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function detectBestEndpoint(): Promise<ServerEndpoint | null> {
  // Try cache first
  const cached = await getCachedEndpoint();
  if (cached) {
    if (await testEndpoint(cached)) {
      return cached;
    } else {
      await clearCachedEndpoint();
    }
  }

  const results = await Promise.all(
    ENDPOINTS.map(async (endpoint) => ({
      endpoint,
      isReachable: await testEndpoint(endpoint),
    }))
  );

  const workingEndpoints = results
    .filter((r) => r.isReachable)
    .map((r) => r.endpoint)
    .sort((a, b) => a.priority - b.priority);

  if (workingEndpoints.length === 0) return null;

  const best = workingEndpoints[0];
  await setCachedEndpoint(best);
  return best;
}

// Cache utilities using SecureStore
const CACHE_KEY = "home_security_endpoint";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedEndpoint(): Promise<ServerEndpoint | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    const { endpoint, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_DURATION) {
      await SecureStore.deleteItemAsync(CACHE_KEY);
      return null;
    }
    return endpoint;
  } catch {
    return null;
  }
}

async function setCachedEndpoint(endpoint: ServerEndpoint): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      CACHE_KEY,
      JSON.stringify({ endpoint, timestamp: Date.now() })
    );
  } catch {}
}

async function clearCachedEndpoint(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY);
  } catch {}
}

export type { ServerEndpoint };
