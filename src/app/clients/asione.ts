import { ENV } from "../env.js";

// Request body our API expects
export type PolicyInput = {
  emotion: string;
  mode?: "major" | "minor";
};

// Response our API returns
export type PolicyOutput = {
  tempo: number;
  energy: number;
  valence: number;
  genres: string[];
};

// Interface our route uses to obtain policy
export interface ASIOneClient {
  getPolicy(input: PolicyInput): Promise<PolicyOutput>;
}

function normalizeEmotion(e: string): string {
  return e.trim().toLowerCase();
}

// Our set fixtures for different types of emotions
const FIXTURES: Record<string, PolicyOutput> = {
  "happy:major": {
    tempo: 128,
    energy: 0.85,
    valence: 0.9,
    genres: ["pop", "dance", "edm"],
  },
  "sad:minor": {
    tempo: 70,
    energy: 0.3,
    valence: 0.2,
    genres: ["ambient", "piano", "acoustic"],
  },
  "angry:minor": {
    tempo: 140,
    energy: 0.95,
    valence: 0.2,
    genres: ["metal", "hard rock", "trap"],
  },
  "relaxed:major": {
    tempo: 90,
    energy: 0.4,
    valence: 0.7,
    genres: ["lofi", "chillhop", "jazz"],
  },
  "hopeful:major": {
    tempo: 110,
    energy: 0.6,
    valence: 0.8,
    genres: ["indie pop", "electropop"],
  },
  "tired:minor": {
    tempo: 60,
    energy: 0.2,
    valence: 0.3,
    genres: ["acoustic", "ambient"],
  },
};

const DEFAULT_OUTPUT: PolicyOutput = {
  tempo: 100,
  energy: 0.5,
  valence: 0.5,
  genres: ["pop"],
};

// Mock ASI Client for Dev
export class ASIOneClientMock implements ASIOneClient {
  async getPolicy(input: PolicyInput): Promise<PolicyOutput> {
    const key = `${normalizeEmotion(input.emotion)}:${input.mode ?? "major"}`;
    return FIXTURES[key] ?? DEFAULT_OUTPUT;
  }
}

// ASI Client for prod using ENV
export class ASIOneClientLive implements ASIOneClient {
  // Create config object from environment variables
  constructor(
    private readonly cfg = {
      baseUrl: ENV.ASIONE_URL!,
      apiKey: ENV.ASIONE_API_KEY!,
      timeoutMs: Number(ENV.ASIONE_TIMEOUT_MS ?? 8000),
      headerKey: ENV.ASIONE_HEADER_KEY || "Authorization",
      bearer: ENV.ASIONE_BEARER === "true",
    }
  ) {}

  // Sends a POST request to /policy endpoint
  async getPolicy(input: PolicyInput): Promise<PolicyOutput> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    // Set headers and token
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const token = this.cfg.bearer
      ? `Bearer ${this.cfg.apiKey}`
      : this.cfg.apiKey;
    headers[this.cfg.headerKey] = token;

    try {
      // POST policy endpoint
      const res = await fetch(new URL("/policy", this.cfg.baseUrl), {
        method: "POST",
        headers,
        // Turn input into a JSON
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(
          `ASI:One error ${res.status}: ${text || res.statusText}`
        );
        // @ts-ignore
        err.status = res.status;
        throw err;
      }
      // Retrieve policy output from our input
      const data = (await res.json()) as PolicyOutput;
      if (
        typeof data.tempo !== "number" ||
        typeof data.energy !== "number" ||
        typeof data.valence !== "number" ||
        !Array.isArray(data.genres)
      ) {
        throw new Error("ASI:One response validation failed");
      }
      return data;
    } finally {
      clearTimeout(t);
    }
  }
}

export function createASIOneClient(): ASIOneClient {
  const useMock =
    ENV.ASIONE_MODE === "mock" || !ENV.ASIONE_URL || !ENV.ASIONE_API_KEY;

  return useMock ? new ASIOneClientMock() : new ASIOneClientLive();
}
