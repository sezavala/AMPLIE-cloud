import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import authPlugin from "../app/middleware/auth.js";
import { ENV } from "../app/env.js";

// Existing routes
import policyRoutes from "./routes/policy.js";
import emotionRoutes from "./routes/emotion.js";
import embedRoutes from "./routes/embed.js";
import retrieveRoutes from "./routes/retrieve.js";
// import generateRoute from "./routes/generate.js"; // ❌ Temporarily comment out

// Room routes
import roomRoutes from "./routes/room.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.register(cors, { origin: true });
  app.register(helmet);
  app.register(sensible);
  app.register(authPlugin);

  // Business logic routes
  app.register(policyRoutes);
  // app.register(generateRoute); // ❌ Temporarily disabled
  app.register(emotionRoutes);
  app.register(embedRoutes);
  app.register(retrieveRoutes);
  app.register(roomRoutes);

  app.get("/health", async () => {
    return { status: "ok", version: ENV.API_VERSION };
  });

  app.get("/protected", { preHandler: app.verifyJWT }, async (request) => {
    return { ok: true, sub: request.user?.sub, version: ENV.API_VERSION };
  });

  return app;
}
