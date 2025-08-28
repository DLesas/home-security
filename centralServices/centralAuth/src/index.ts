import "dotenv/config";
import { Hono } from "hono";
import { auth } from "./lib/auth";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";

const app = new Hono();

// CORS for webapp and expo
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = new Set([
        process.env.WEBAPP_ORIGIN || "http://localhost:3000",
      ]);
      if (!origin) return origin;
      if (origin.startsWith("exp://")) return origin;
      if (allowed.has(origin)) return origin;
      return ""; // disallow others
    },
    allowHeaders: ["content-type", "authorization"],
    credentials: true,
  })
);

app.get("/health", (c) => c.text("ok"));

// Delegate Better Auth routes
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 8787 });
