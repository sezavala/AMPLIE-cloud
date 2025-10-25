import type { FastifyPluginAsync } from "fastify";
import { createASIOneClient } from "@/app/clients/asione";

// Routes for our API
const policyRoutes: FastifyPluginAsync = async (app) => {
  // Create ASIOne client based on prod / dev
  const client = createASIOneClient();

  app.post(
    "/policy",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            emotion: { type: "string", minLength: 1 },
            mode: { type: "string", enum: ["major", "minor"] },
          },
          required: ["emotion"],
          additionalProperties: false,
        },
        response: {
          200: {
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
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        emotion: string;
        mode?: "major" | "minor";
      };
      try {
        // getPoliy -> convert emotions/mode into FIXTURES
        const data = await client.getPolicy({
          emotion: body.emotion,
          mode: body.mode,
        });
        return reply.send(data);
      } catch (err: any) {
        request.log.error({ err }, "ASI:One policy request failed");
        const status = typeof err?.status === "number" ? err.status : 502;
        return reply.code(status).send({
          error: "UpstreamFailure",
          message: err?.message ?? "ASI:One request failed",
        });
      }
    }
  );
};

export default policyRoutes;
