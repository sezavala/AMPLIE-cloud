import type { FastifyPluginAsync } from "fastify";
import { createGroqClient } from "@/app/clients/groq";

const emotionRoutes: FastifyPluginAsync = async (app) => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  if (!hasGroq) {
    app.log.warn("GROQ_API_KEY not set");
  }

  // If we have Groq, allow for users to make POST requests to /emotion
  app.post(
    "/emotion",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            text: { type: "string" },
            audioUrl: { type: "string", format: "uri" },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              emotion: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["emotion", "confidence"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      if (!hasGroq) {
        return reply
          .code(501)
          .send({ error: "NotImplemented", message: "Cloud emotion disabled" });
      }
      const body = request.body as { text?: string; audioUrl?: string };
      try {
        // If we have Groq implemented, create Groq client and await results (emotion)
        const client = createGroqClient();
        const result = await client.detectEmotion(body);
        // Return results
        return reply.send(result);
      } catch (err: any) {
        request.log.error({ err }, "Emotion analysis failed");
        const status = typeof err?.status === "number" ? err.status : 502;
        const message =
          err?.message === "Upstream timeout"
            ? "Groq timeout"
            : err?.message || "Emotion analysis failed";
        return reply.code(status).send({
          error: status === 504 ? "UpstreamTimeout" : "UpstreamFailure",
          message,
        });
      }
    }
  );
};

export default emotionRoutes;