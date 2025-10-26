import path from "path";
import { generateMusic } from "../services/fishAudio.js";
import { uploadToS3 } from "../services/storage.js";

export default async function generateRoute(fastify) {
  fastify.post("/generate", async (req, res) => {
    const { emotion } = req.body;
    fastify.log.info(`[Generate] Starting Fish Audio for emotion=${emotion}`);

    // 1️⃣ Generate audio (TTS)
    const { filePath, bpm, genre } = await generateMusic(emotion);

    // 2️⃣ Upload to S3 and get signed URL
    const key = path.basename(filePath);
    const clipUrl = await uploadToS3(filePath, key);

    // 3️⃣ Return signed clip URL + metadata
    return { clipUrl, bpm, genre, expiresIn: 3600 };
  });
}
