import type { FastifyPluginAsync } from "fastify";
import { createChromaClient } from "@/app/clients/chroma";
import seed from "@/app/data/chroma-data/seed.json"

const COLLECTION = "amplie_tracks_v1";

const embedRoutes: FastifyPluginAsync = async (app) => {
  // embed POST request
  app.post("/embed", async (_req, reply) => {
    try {
      const chroma = createChromaClient();
      const { collection, count } = await chroma.upsert(COLLECTION, seed);
      return reply.send({ ok: true, collection: collection.name, count });
    } catch (err: any) {
      app.log.error({ err }, "Embed failed");
      const status = typeof err?.status === "number" ? err.status : 502;
      return reply.code(status).send({
        error: "UpstreamFailure",
        message: err?.message || "Embed failed",
      });
    }
  });
};

export default embedRoutes;
