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
  ASIONE_API_VERSION: process.env.ASIONE_API_VERSION ?? "v2",

  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_BASE_URL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1/",
  GROQ_MODEL: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
  GROQ_TRANSCRIBE_MODEL:
    process.env.GROQ_TRANSCRIBE_MODEL ?? "whisper-large-v3-turbo",
  GROQ_TIMEOUT_MS: process.env.GROQ_TIMEOUT_MS ?? "1200",

  // Chroma
  CHROMA_URL: process.env.CHROMA_URL,
  CHROMA_KEY: process.env.CHROMA_KEY,
  CHROMA_TIMEOUT_MS: process.env.CHROMA_TIMEOUT_MS ?? "1500",
  CHROMA_API_VERSION: process.env.CHROMA_API_VERSION ?? "v2",
  CHROMA_TENANT: process.env.CHROMA_TENANT, // optional; defaults in client
  CHROMA_DATABASE: process.env.CHROMA_DATABASE, // optional; defaults in client
} as const;
