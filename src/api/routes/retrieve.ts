import type { FastifyPluginAsync } from "fastify";
import type { PolicyOutput } from "@/app/clients/asione";
import { createChromaClient } from "@/app/clients/chroma";

const COLLECTION = "amplie_tracks_v1";

const retrieveRoutes: FastifyPluginAsync = async (app) => {
  // Retrieve request to extract policies from tracks
  app.post(
    "/retrieve",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            policy: {
              type: "object",
              properties: {
                tempo: { type: "number" },
                energy: { type: "number" },
                valence: { type: "number" },
                genres: { type: "array", items: { type: "string" } },
              },
              required: ["tempo", "energy", "valence", "genres"],
              additionalProperties: false,
            },
            k: { type: "number", minimum: 1, maximum: 50 },
          },
          required: ["policy"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { policy, k = 5 } = request.body as {
        policy: PolicyOutput;
        k?: number;
      };
      try {
        const chroma = createChromaClient();
        // Results from our query of our tracks
        const { results } = await chroma.query(COLLECTION, policy, k);
        // Response: deterministic order already enforced client-side
        return reply.send({ items: results });
      } catch (err: any) {
        request.log.error({ err }, "Retrieve failed");
        const status = typeof err?.status === "number" ? err.status : 502;
        return reply.code(status).send({
          error: "UpstreamFailure",
          message: err?.message ?? "Retrieve failed",
        });
      }
    }
  );
};

export default retrieveRoutes;
