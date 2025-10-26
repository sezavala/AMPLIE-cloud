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

// New Fish Audio + S3 route
import generateRoute from "./routes/generate.js"; // ✅ Add this line

export function buildApp() {
  // Create Fastify instance and configure logger
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  // Register security and utility plugins
  app.register(cors, { origin: true });
  app.register(helmet);
  app.register(sensible);

  // Auth plugin (JWT/shared secret)
  app.register(authPlugin);

  // Business logic routes
  app.register(policyRoutes);
  app.register(generateRoute); // ✅ Register /generate route
  // Register emotionRoutes for determining emotion based off of text / audio
  app.register(emotionRoutes);
  // Routes to create/get a collection and insert items (tracks)
  app.register(embedRoutes);
  // Routes to retrieve tracks from a collection
  app.register(retrieveRoutes);

  // Health route
  app.get("/health", async () => {
    return { status: "ok", version: ENV.API_VERSION };
  });

  // Example protected route
  app.get("/protected", { preHandler: app.verifyJWT }, async (request) => {
    return { ok: true, sub: request.user?.sub, version: ENV.API_VERSION };
  });

  return app;
}

