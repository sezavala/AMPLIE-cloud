import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.js";

let app: FastifyInstance | undefined;

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      app = buildApp();
      await app.ready();
    }
    // Normalize path so Fastify sees "/health" instead of "/api/health"
    if (typeof req.url === "string" && req.url.startsWith("/api/")) {
      req.url = req.url.slice(4) || "/";
    }
    app.server.emit("request", req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}
