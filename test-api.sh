#!/bin/bash
# Test AMPLIE Chroma Integration

echo "🧪 Testing AMPLIE API with Chroma..."
echo ""

# 1. Health check
echo "1️⃣  Health Check"
curl -s http://localhost:3000/health | jq -C '.'
echo ""

# 2. Embed tracks  
echo "2️⃣  Embedding Tracks"
curl -s -X POST http://localhost:3000/embed | jq -C '.'
echo ""

# 3. Retrieve happy/energetic tracks
echo "3️⃣  Retrieving Happy/Energetic Tracks (EDM/Pop, 128 BPM)"
curl -s -X POST http://localhost:3000/retrieve \
  -H "content-type: application/json" \
  -d '{
    "policy": {
      "tempo": 128,
      "energy": 0.85,
      "valence": 0.9,
      "genres": ["pop", "edm"]
    },
    "k": 3
  }' | jq -C '.'
echo ""

# 4. Retrieve sad/low-energy tracks  
echo "4️⃣  Retrieving Sad/Low-Energy Tracks (Ambient, 70 BPM)"
curl -s -X POST http://localhost:3000/retrieve \
  -H "content-type: application/json" \
  -d '{
    "policy": {
      "tempo": 70,
      "energy": 0.3,
      "valence": 0.2,
      "genres": ["ambient", "piano"]
    },
    "k": 2
  }' | jq -C '.'

echo ""
echo "✅ All tests complete!"
