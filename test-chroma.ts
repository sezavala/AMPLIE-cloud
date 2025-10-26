#!/usr/bin/env tsx
import { createChromaClient } from "./src/app/clients/chroma.js";
import seed from "./src/app/data/chroma-data/seed.json" assert { type: "json" };

async function test() {
  console.log("Testing Chroma client...");
  
  const chroma = createChromaClient();
  
  try {
    console.log("\n1. Upserting tracks...");
    const { collection, count } = await chroma.upsert("amplie_tracks_v1", seed);
    console.log(`✓ Upserted ${count} tracks to collection: ${collection.name}`);
    
    console.log("\n2. Querying for happy/energetic tracks...");
    const results = await chroma.query(
      "amplie_tracks_v1",
      {
        tempo: 128,
        energy: 0.85,
        valence: 0.9,
        genres: ["pop", "edm"],
      },
      3
    );
    
    console.log(`✓ Found ${results.results.length} results:`);
    results.results.forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.metadata?.title} by ${r.metadata?.artist} (distance: ${r.distance.toFixed(4)})`
      );
    });
    
    console.log("\n✅ All tests passed!");
  } catch (err: any) {
    console.error("\n❌ Test failed:");
    console.error(err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

test();
