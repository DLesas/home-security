import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? "localhost",
    user: process.env.POSTGRES_USER ?? "user",
    port: 5432,
    password: process.env.POSTGRES_PASSWORD ?? "password",
    database: process.env.POSTGRES_DB ?? "homeSecurityDB",
  },
  verbose: true,
});
