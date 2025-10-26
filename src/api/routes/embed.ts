import type { FastifyPluginAsync } from "fastify";
import { createChromaClient } from "@/app/clients/chroma";
import seed from "@/app/data/chroma-data/seed.json";

const embedRoutes: FastifyPluginAsync = async (app) => {
  app.post("/embed", async (request, reply) => {
    try {
      const chroma = createChromaClient();
      const collectionName = "amplie_tracks_v1";

      app.log.info(`Embedding ${seed.length} tracks into ${collectionName}...`);

      // Use the ChromaClient's upsert method which handles API version fallbacks
      const { collection, count } = await chroma.upsert(collectionName, seed);

      app.log.info(
        `✅ Embedded ${count} seed tracks into collection: ${collection.name}`
      );

      return {
        ok: true,
        count,
        collection: collection.name,
        collectionId: collection.id,
      };
    } catch (err) {
      app.log.error({ err }, "Failed to embed tracks");
      return reply.code(500).send({
        error: "Failed to embed tracks",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
};

export default embedRoutes;
