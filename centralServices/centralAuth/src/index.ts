import { Hono } from "hono";
import { auth } from "./lib/auth"; // path to your auth file
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
 
const app = new Hono();
 
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
 
serve(app);