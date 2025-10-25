import "dotenv/config";

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),
  API_VERSION: process.env.API_VERSION ?? "0.1.0",
  CLERK_JWKS_URL: process.env.CLERK_JWKS_URL,
  CLERK_AUDIENCE: process.env.CLERK_AUDIENCE,
  CLERK_ISSUER: process.env.CLERK_ISSUER,
  JWT_SHARED_SECRET: process.env.JWT_SHARED_SECRET,
  ASIONE_MODE: process.env.ASIONE_MODE, // "mock" | "live"
  ASIONE_URL: process.env.ASIONE_URL, // e.g., https://api.asione.ai
  ASIONE_API_KEY: process.env.ASIONE_API_KEY, // secret
  ASIONE_TIMEOUT_MS: process.env.ASIONE_TIMEOUT_MS, // default 8000
  ASIONE_HEADER_KEY: process.env.ASIONE_HEADER_KEY, // default "Authorization"
  ASIONE_BEARER: process.env.ASIONE_BEARER,
} as const;
