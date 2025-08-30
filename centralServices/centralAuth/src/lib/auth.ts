import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expoPasskey } from "expo-passkey/server";
import { db } from "../db/db";

/**
 * Central Better Auth configuration
 * - Drizzle adapter (Postgres)
 * - Expo passkeys for biometric sign-in
 * - CORS and trusted origins for web + Expo deep links
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  baseURL: process.env.AUTH_BASE_URL || "http://localhost:8787", // dev default
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
  cors: {
    origins: [
      process.env.WEBAPP_ORIGIN || "http://localhost:3000",
      // Expo development URLs use custom schemes; allow them explicitly
      "exp://localhost",
      "exp://*",
      process.env.EXPO_APP_SCHEME
        ? `${process.env.EXPO_APP_SCHEME}://`
        : "myapp://",
    ],
    allowedHeaders: ["content-type", "authorization"],
    credentials: true,
  },
  trustedOrigins: [
    process.env.WEBAPP_ORIGIN || "http://localhost:3000",
    process.env.EXPO_APP_SCHEME
      ? `${process.env.EXPO_APP_SCHEME}://`
      : "myapp://",
  ],
  plugins: [
    expoPasskey({
      rpId: process.env.EXPO_PASSKEY_RPID || "localhost",
      rpName: process.env.EXPO_PASSKEY_RPNAME || "Local Better Auth",
    }),
  ],
});
