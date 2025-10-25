import 'dotenv/config';

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  API_VERSION: process.env.API_VERSION ?? '0.1.0',
  CLERK_JWKS_URL: process.env.CLERK_JWKS_URL,
  CLERK_AUDIENCE: process.env.CLERK_AUDIENCE,
  CLERK_ISSUER: process.env.CLERK_ISSUER,
  JWT_SHARED_SECRET: process.env.JWT_SHARED_SECRET,
};
