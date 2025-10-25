import { buildApp } from "./api/app.js";
import { ENV } from "./app/env.js";

async function main() {
  // Build our Fastify App to access routes
  const app = buildApp();
  try {
    await app.listen({ port: ENV.PORT, host: "0.0.0.0" });
    app.log.info(`API listening on http://localhost:${ENV.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
