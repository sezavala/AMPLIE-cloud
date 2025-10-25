import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import authPlugin from "../app/middleware/auth.js";
import { ENV } from "../app/env.js";
import policyRoutes from "./routes/policy.js";
import emotionRoutes from "./routes/emotion.js";

export function buildApp() {
  // Create Fastify instance and set logger
  // If production mode, only log informational messages
  // Else, log debugging messages to help developers
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  // CORS is a security mechanism implemented by web browsers that restricts web pages
  // from making requests to a different domain than the one that served the web page.
  app.register(cors, { origin: true });
  // Helmet helps secure Express/Fastify apps by setting various HTTP headers
  app.register(helmet);
  // A set of common utilities and error handling capabilities
  app.register(sensible);
  // Register our auth plugin
  app.register(authPlugin);
  // Register policy routes for emotion/mode -> fixture
  app.register(policyRoutes);
  // Register emotionRoutes for determining emotion based off of text / audio
  app.register(emotionRoutes);

  // GET route for health, currently just returing OK status
  app.get("/health", async () => {
    return { status: "ok", version: ENV.API_VERSION };
  });

  // GET route for protected routes using verify Token method which just returns OK with user Identifier and API version
  app.get("/protected", { preHandler: app.verifyJWT }, async (request) => {
    return { ok: true, sub: request.user?.sub, version: ENV.API_VERSION };
  });

  return app;
}
