import { ENV } from "../env.js";

// Export emotion input and output to be used in other modules
export type EmotionInput = { text?: string; audioUrl?: string };
export type EmotionOutput = { emotion: string; confidence: number };

// Create groq client
export class GroqClient {
  constructor(
    // Config file for groq
    private readonly cfg = {
      baseUrl: ENV.GROQ_BASE_URL!,
      apiKey: ENV.GROQ_API_KEY!,
      model: ENV.GROQ_MODEL!,
      transcribeModel: ENV.GROQ_TRANSCRIBE_MODEL!,
      timeoutMs: Number(ENV.GROQ_TIMEOUT_MS ?? 1200),
      maxAudioBytes: 10 * 1024 * 1024, // 10MB safety cap
    }
  ) {
    if (!this.cfg.apiKey) {
      throw new Error("GROQ_API_KEY is required");
    }
  }

  private endpoint(p: string) {
    const base = this.cfg.baseUrl.endsWith("/")
      ? this.cfg.baseUrl
      : this.cfg.baseUrl + "/";
    return new URL(p, base);
  }

  // Map content-type or URL to a safe filename with an allowed extension
  private inferFilename(srcUrl: string, contentType: string | null): string {
    const urlExt = (() => {
      try {
        const u = new URL(srcUrl);
        const m = u.pathname.match(/\.([a-z0-9]+)$/i);
        return m?.[1]?.toLowerCase();
      } catch {
        return undefined;
      }
    })();

    const mimeToExt: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "mp4",
      "audio/mpeg3": "mp3",
      "audio/ogg": "ogg",
      "audio/opus": "opus",
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/flac": "flac",
      "audio/m4a": "m4a",
      "video/mp4": "mp4",
      "video/webm": "webm",
    };

    const extFromMime = contentType
      ? mimeToExt[contentType.toLowerCase()]
      : undefined;
    const ext = extFromMime ?? urlExt ?? "wav";
    return `audio.${ext}`;
  }

  // Detect an emotion from text or audio
  async detectEmotion(input: EmotionInput): Promise<EmotionOutput> {
    if (!input.text && !input.audioUrl) {
      throw this.badRequest("Provide text or audioUrl");
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    // If we are given text, use it, else transcribe audio from URL
    try {
      const text =
        input.text ??
        (await this.transcribeAudio(input.audioUrl!, { signal: ctrl.signal }));
      return await this.classifyText(text, { signal: ctrl.signal });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        const e = new Error("Upstream timeout");
        // @ts-ignore
        e.status = 504;
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  private async transcribeAudio(
    url: string,
    opts: { signal: AbortSignal }
  ): Promise<string> {
    const res = await fetch(url, { method: "GET", signal: opts.signal });
    if (!res.ok) {
      const e = new Error(`Audio fetch failed ${res.status}`);
      // @ts-ignore
      e.status = 400;
      throw e;
    }

    const type = res.headers.get("content-type") ?? "application/octet-stream";
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len && len > this.cfg.maxAudioBytes) {
      const e = new Error("Audio too large");
      // @ts-ignore
      e.status = 413;
      throw e;
    }

    const allowed = [
      "flac",
      "mp3",
      "mp4",
      "mpeg",
      "mpga",
      "m4a",
      "ogg",
      "opus",
      "wav",
      "webm",
    ];
    const filename = this.inferFilename(url, type);
    const ext = filename.split(".").pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      const e = new Error(`Unsupported audio type: ${type} (${filename})`);
      // @ts-ignore
      e.status = 400;
      throw e;
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    const file = new Blob([buf], { type });

    const form = new FormData();
    // Important: include a filename with a valid extension so Groq accepts it
    form.append("file", file, filename);
    form.append("model", this.cfg.transcribeModel);

    const tr = await fetch(this.endpoint("audio/transcriptions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
      body: form,
      signal: opts.signal,
    });
    if (!tr.ok) {
      const text = await tr.text().catch(() => "");
      const e = new Error(
        `Groq transcribe error ${tr.status}: ${text || tr.statusText}`
      );
      // @ts-ignore
      e.status = tr.status;
      throw e;
    }
    const data = (await tr.json()) as { text?: string };
    if (!data.text) {
      throw new Error("Transcription missing text");
    }
    return data.text;
  }

  private async classifyText(
    text: string,
    opts: { signal: AbortSignal }
  ): Promise<EmotionOutput> {
    // Using transcribed text, ask groq to classify the human emotion
    const body = {
      model: this.cfg.model,
      temperature: 0,
      max_tokens: 32,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract the primary human emotion and a confidence between 0 and 1. Respond as JSON: {"emotion":"happy|sad|angry|relaxed|hopeful|tired|other","confidence":0.0-1.0}.',
        },
        {
          role: "user",
          content: `Text: """${text.slice(0, 2000)}"""`,
        },
      ],
    };

    // Fetch results from Groq
    const res = await fetch(this.endpoint("chat/completions"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const e = new Error(
        `Groq classify error ${res.status}: ${t || res.statusText}`
      );
      // @ts-ignore
      e.status = res.status;
      throw e;
    }

    // Collect JSON information if succeeded
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    let parsed: any;
    // Parse response into a JSON
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      throw new Error("Groq response parse error");
    }
    const emotion = String(parsed?.emotion ?? "other");
    const confidence = Number(parsed?.confidence ?? 0);
    if (!emotion || Number.isNaN(confidence)) {
      throw new Error("Groq response validation failed");
    }
    return { emotion, confidence };
  }

  private badRequest(message: string) {
    const e = new Error(message);
    // @ts-ignore
    e.status = 400;
    return e;
  }
}

export function createGroqClient() {
  return new GroqClient();
}
