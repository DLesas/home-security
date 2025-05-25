import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expoPasskey } from "expo-passkey/server";
import { db } from "../db/db";
 
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "pg" or "mysql"
  }), 
  plugins: [
    expoPasskey({
      rpId: process.env.EXPO_PASSKEY_RPID!,
      rpName: process.env.EXPO_PASSKEY_RPNAME!
    })
  ]
  //... the rest of your config
});