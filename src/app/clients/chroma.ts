import { ENV } from "../env.js";
import type { PolicyOutput } from "@/app/clients/asione";

export type SeedItem = {
  id: string;
  title: string;
  artist: string;
  policy: PolicyOutput;
};

type ChromaCollection = { id: string; name: string };
// Some servers return { collections: [...] }, others return [...]
type ChromaCollectionsList =
  | { collections: ChromaCollection[] }
  | ChromaCollection[];

type ApiMode = "v2_legacy" | "v2_tenant" | "v1";

export class ChromaClient {
  constructor(
    private readonly cfg = {
      baseUrl: ENV.CHROMA_URL!,
      apiKey: ENV.CHROMA_KEY || "",
      timeoutMs: Number(ENV.CHROMA_TIMEOUT_MS ?? 1500),
      version: ENV.CHROMA_API_VERSION ?? "v2",
      tenant: ENV.CHROMA_TENANT || "default_tenant",
      database: ENV.CHROMA_DATABASE || "default_database",
    }
  ) {
    if (!this.cfg.baseUrl) throw new Error("CHROMA_URL is required");
  }

  // prefer v2 tenant (modern), auto-fallback to v2 legacy, then v1
  private effectiveMode: ApiMode =
    this.cfg.version === "v1" ? "v1" : "v2_tenant";

  private endpoint(p: string) {
    const base = this.cfg.baseUrl.endsWith("/")
      ? this.cfg.baseUrl
      : this.cfg.baseUrl + "/";
    return new URL(p, base);
  }

  private prefix(mode: ApiMode) {
    if (mode === "v1") return "api/v1/";
    if (mode === "v2_tenant")
      return `api/v2/tenants/${encodeURIComponent(
        this.cfg.tenant
      )}/databases/${encodeURIComponent(this.cfg.database)}/`;
    // default legacy v2 prefix
    return "api/v2/";
  }

  private path(p: string) {
    return `${this.prefix(this.effectiveMode)}${p}`;
  }

  private async json<T>(
    pathOrFull: string,
    init: RequestInit = {}
  ): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...(this.cfg.apiKey
          ? { authorization: `Bearer ${this.cfg.apiKey}` }
          : {}),
      };
      const url = pathOrFull.startsWith("http")
        ? pathOrFull
        : this.endpoint(pathOrFull).toString();
      
      const res = await fetch(url, {
        ...init,
        headers: { ...headers, ...(init.headers as any) },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new Error(
          `Chroma error ${res.status}: ${text || res.statusText}`
        ) as any;
        err.status = res.status;
        throw err;
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  // try request with fallbacks on 404/405 to discover correct API shape
  private async jsonWithFallback<T>(
    buildPath: (mode: ApiMode) => string,
    init: RequestInit
  ): Promise<T> {
    const tryModes: ApiMode[] =
      this.effectiveMode === "v1"
        ? ["v1"]
        : this.effectiveMode === "v2_tenant"
        ? ["v2_tenant", "v2_legacy", "v1"]
        : ["v2_tenant", "v2_legacy", "v1"]; // prefer tenant first since that's modern

    let lastErr: any;
    for (const mode of tryModes) {
      try {
        const p = `${this.prefix(mode)}${buildPath(mode)}`;
        const out = await this.json<T>(p, init);
        // Only lock mode on successful POST/PUT/DELETE (writes), not GETs
        if (init.method && init.method !== "GET") {
          this.effectiveMode = mode;
        }
        return out;
      } catch (e: any) {
        lastErr = e;
        // Retry on 404 (not found) or 405 (method not allowed)
        if (e?.status !== 404 && e?.status !== 405) throw e;
        // else try next mode
      }
    }
    throw lastErr;
  }

  private async fetchCollectionByName(
    name: string
  ): Promise<ChromaCollection | null> {
    try {
      // Prefer servers that accept ?name=, else list and filter.
      const data = await this.jsonWithFallback<ChromaCollectionsList>(
        (_mode) => `collections?name=${encodeURIComponent(name)}&limit=1000`,
        { method: "GET" }
      );
      const list: ChromaCollection[] = Array.isArray(data)
        ? (data as ChromaCollection[])
        : Array.isArray((data as any).collections)
        ? ((data as any).collections as ChromaCollection[])
        : [];
      const found = list.find((c: ChromaCollection) => c?.name === name);
      if (found) return found;

      // If server ignored ?name, list all and filter
      const data2 = await this.jsonWithFallback<ChromaCollectionsList>(
        (_mode) => `collections?limit=1000`,
        { method: "GET" }
      );
      const list2: ChromaCollection[] = Array.isArray(data2)
        ? (data2 as ChromaCollection[])
        : Array.isArray((data2 as any).collections)
        ? ((data2 as any).collections as ChromaCollection[])
        : [];
      return list2.find((c: ChromaCollection) => c?.name === name) || null;
    } catch {
      return null;
    }
  }

  async getOrCreateCollection(name: string) {
    const existing = await this.fetchCollectionByName(name);
    if (existing) return existing;

    try {
      return await this.jsonWithFallback<ChromaCollection>(
        (_mode) => `collections`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        }
      );
    } catch (e: any) {
      if (e?.status === 409) {
        const again = await this.fetchCollectionByName(name);
        if (again) return again;
      }
      throw e;
    }
  }

  async upsert(name: string, items: SeedItem[]) {
    const col = await this.getOrCreateCollection(name);

    const ids = items.map((i) => i.id);
    const embeddings = items.map((i) => policyToVector(i.policy));
    // Flatten metadata to primitives/arrays (no nested objects) to satisfy Chroma API
    const metadatas = items.map(toChromaMetadata);

    const body = JSON.stringify({ ids, embeddings, metadatas });

    // Try /add first (v2 tenant standard), then fallback to /upsert (legacy v2/v1)
    try {
      await this.jsonWithFallback((_mode) => `collections/${col.id}/add`, {
        method: "POST",
        body,
      });
      return { collection: col, count: items.length };
    } catch (e: any) {
      if (e?.status !== 404 && e?.status !== 405) throw e;
    }

    // Fallback to legacy upsert
    await this.jsonWithFallback((_mode) => `collections/${col.id}/upsert`, {
      method: "POST",
      body,
    });

    return { collection: col, count: items.length };
  }

  async query(name: string, policy: PolicyOutput, k: number) {
    const col = await this.getOrCreateCollection(name);
    const res = await this.jsonWithFallback<{
      ids: string[][];
      distances: number[][];
      metadatas: any[][];
    }>((_mode) => `collections/${col.id}/query`, {
      method: "POST",
      body: JSON.stringify({
        query_embeddings: [policyToVector(policy)],
        n_results: k,
        // v2 API: ids are always returned, only include distances & metadatas
        include: ["distances", "metadatas"],
      }),
    });

    const ids = res.ids?.[0] ?? [];
    const dists = res.distances?.[0] ?? [];
    const metas = res.metadatas?.[0] ?? [];
    const ranked = ids
      .map((id, i) => ({
        id,
        distance: dists[i] ?? Infinity,
        metadata: metas[i],
      }))
      .sort(
        (a, b) =>
          a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );

    return { collection: col, results: ranked.slice(0, k) };
  }
}

// Policy → fixed-length vector (deterministic)
export function policyToVector(p: PolicyOutput): number[] {
  const tempo = clamp01((p.tempo - 60) / 120); // 60..180 BPM → 0..1
  const energy = clamp01(p.energy);
  const valence = clamp01(p.valence);

  // Hash genres into 4 dims deterministically
  const dims = 4;
  const g = new Array<number>(dims).fill(0);
  for (const genre of p.genres ?? []) {
    const h = hash32(genre.toLowerCase());
    for (let i = 0; i < dims; i++) {
      const v = ((h >>> (i * 8)) & 0xff) / 255; // 0..1 shard
      g[i] += v;
    }
  }
  // L2 normalize genre bucket
  const norm = Math.hypot(...g) || 1;
  for (let i = 0; i < dims; i++) g[i] = g[i] / norm;

  return [tempo, energy, valence, ...g];
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function hash32(s: string) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createChromaClient() {
  return new ChromaClient();
}

// Convert our SeedItem into Chroma-friendly metadata (flat primitives/arrays only)
function toChromaMetadata(i: SeedItem) {
  const p = i.policy;
  return {
    title: i.title,
    artist: i.artist,
    // Flattened policy fields
    tempo: typeof p.tempo === "number" ? p.tempo : undefined,
    energy: typeof p.energy === "number" ? p.energy : undefined,
    valence: typeof p.valence === "number" ? p.valence : undefined,
  // Chroma metadata may not accept arrays in some builds; store CSV string
  genres: Array.isArray(p.genres) ? p.genres.join(",") : undefined,
  } as Record<string, unknown>;
}
