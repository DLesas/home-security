import { createAuthClient } from "better-auth/client";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const auth = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_AUTH_URL || "http://localhost:8787",
  plugins: [
    expoClient({
      scheme: process.env.EXPO_PUBLIC_APP_SCHEME || "myapp",
      storagePrefix: process.env.EXPO_PUBLIC_APP_SCHEME || "myapp",
      storage: SecureStore,
    }),
  ],
});
