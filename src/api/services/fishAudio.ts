import fs from "fs";

const FISH_API_KEY = process.env.FISH_API_KEY!;
const FISH_API_BASE = "https://api.fish.audio/v1";

// 🎵 Generate TTS-based MP3 clip from text
export async function generateMusic(emotion: string) {
  const prompt = `I have evaluated that you feel ${emotion} here is the summary : placeholder and a playlist to (placeholder)`;
  const url = `${FISH_API_BASE}/tts`;

  console.log(`[FishAudio] 🎶 Generating clip for: ${emotion}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FISH_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: prompt,
      format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[FishAudio] API error ${res.status}: ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = `./clips/${emotion}-${Date.now()}.mp3`;
  fs.mkdirSync("./clips", { recursive: true });
  fs.writeFileSync(filePath, buffer);

  console.log(`[FishAudio] ✅ Saved clip at: ${filePath}`);

  // Fake some music metadata for demo purposes
  const bpm = emotion === "happy" ? 120 : 90;
  const genre = emotion === "happy" ? "pop" : "ambient";

  return { filePath, bpm, genre };
}
