import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ENV } from "../env.js";

// sub: Unique ID given to entity/user
// claims: Holds custome info about the user
type VerifyResult = { sub: string; claims: Record<string, unknown> };

// It informs the compiler that the FastifyInstance, FastifyRequest, and FastifyReply objects will have specific, custom properties
declare module "fastify" {
  // Fastify interface for verify requests made by users  reply to send HTTP codes
  interface FastifyInstance {
    verifyJWT(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  // Fastify request interface to hold users trying to make requests
  interface FastifyRequest {
    user?: VerifyResult;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Will we be using Clerks Web Token for sending information
  const useClerk = Boolean(ENV.CLERK_JWKS_URL);
  // If we are using Clerk, fetch and cache Key set
  const verifier = useClerk
    ? createRemoteJWKSet(new URL(ENV.CLERK_JWKS_URL!))
    : undefined;
  // If we aren't using Clerk, but we have a shared secret, encode the secret
  const sharedSecret =
    !useClerk && ENV.JWT_SHARED_SECRET
      ? new TextEncoder().encode(ENV.JWT_SHARED_SECRET)
      : undefined;
  // Else error out
  if (!verifier && !sharedSecret) {
    fastify.log.warn(
      "No auth configured: set Clerk JWKS URL or use JWT SHARED SECRET"
    );
  }

  // Decorate FastifyInstance
  fastify.decorate("verifyJWT", async function verifyJWT(request, reply) {
    // Retireve Auth value
    const auth = request.headers.authorization;
    // Bearer is common convention of JWT
    // Slice string and start from 7th character, removing 'Bearer '
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) {
      return reply.code(401).send({ error: "Missing bearer token" });
    }

    // Collect payload information
    try {
      // If using Clerk, use Clerks verification function
      const { payload } = useClerk
        ? await jwtVerify(token, verifier!, {
            audience: ENV.CLERK_AUDIENCE,
            issuer: ENV.CLERK_ISSUER,
          })
        : await jwtVerify(token, sharedSecret!);
      request.user = {
        sub: String(payload.sub ?? ""),
        claims: payload as Record<string, unknown>,
      };
    } catch (err) {
      request.log.debug({ err }, "JWT verification failed");
      return reply.code(401).send({ error: "Invalid token" });
    }
  });
};

export default authPlugin;
