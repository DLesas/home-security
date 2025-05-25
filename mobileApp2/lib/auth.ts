import { createAuthClient } from "better-auth/client";
import { expoPasskeyClient } from "expo-passkey";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "https://api.example.com",
  trustedOrigins: ["myapp://"], // Your API base URL
  plugins: [
    expoPasskeyClient({
      storagePrefix: "your-app", // Optional storage key prefix (default: "_better-auth")
    }),
    expoClient({
        scheme: "myapp",
        storagePrefix: "myapp",
        storage: SecureStore,
    })
  ],
});

// Export actions for use throughout your app
export const {
  registerPasskey,
  authenticateWithPasskey,
  listPasskeys,
  revokePasskey,
  getBiometricInfo,
  isPasskeySupported,
  checkPasskeyRegistration,
  getStorageKeys,
} = authClient;