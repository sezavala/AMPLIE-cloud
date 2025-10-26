import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import authPlugin from "../app/middleware/auth.js";
import { ENV } from "../app/env.js";

import policyRoutes from "./routes/policy.js";
import emotionRoutes from "./routes/emotion.js";
import embedRoutes from "./routes/embed.js";
import retrieveRoutes from "./routes/retrieve.js";
import roomRoutes from "./routes/room.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  // ✅ Allow CORS for Expo mobile apps
  app.register(cors, {
    origin: (origin, cb) => {
      // Allow localhost, Expo, and all mobile/web clients during dev
      const allowedOrigins = [
        "http://localhost:8081",
        "exp://",
        "http://",
        "https://",
      ];

      if (
        !origin ||
        allowedOrigins.some((prefix) => origin?.startsWith(prefix))
      ) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  });

  app.register(helmet, {
    // Disable HSTS for local dev
    hsts: ENV.NODE_ENV === "production",
  });

  app.register(sensible);

  // ⚠️ Disable JWT auth for demo (re-enable after hackathon)
  // app.register(authPlugin);

  // Business logic routes
  app.register(policyRoutes);
  app.register(emotionRoutes);
  app.register(embedRoutes);
  app.register(retrieveRoutes);
  app.register(roomRoutes);

  app.get("/health", async () => {
    return { status: "ok", version: ENV.API_VERSION };
  });

  // ⚠️ Disable protected route for demo
  // app.get("/protected", { preHandler: app.verifyJWT }, async (request) => {
  //   return { ok: true, sub: request.user?.sub, version: ENV.API_VERSION };
  // });

  return app;
}
