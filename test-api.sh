#!/bin/bash
# Test Room Routes

BASE_URL="http://localhost:3000"

echo "🧪 Testing AMPLIE Room Routes..."
echo ""

# 0️⃣ Embed tracks first (if not already done)
echo "0️⃣  Embedding seed tracks into Chroma..."
curl -s -X POST $BASE_URL/embed | jq -C '.'
echo ""
echo "⏳ Waiting 2 seconds for embedding to complete..."
sleep 2
echo ""

# 1️⃣ User 1 joins room
echo "1️⃣  User 1 joins room 'room_001'"
curl -s -X POST $BASE_URL/room/join \
  -H "content-type: application/json" \
  -d '{"roomId": "room_001", "userId": "user_1"}' | jq -C '.'
echo ""

# 2️⃣ User 2 joins same room
echo "2️⃣  User 2 joins room 'room_001'"
curl -s -X POST $BASE_URL/room/join \
  -H "content-type: application/json" \
  -d '{"roomId": "room_001", "userId": "user_2"}' | jq -C '.'
echo ""

# 3️⃣ User 1 sets mood to happy
echo "3️⃣  User 1 sets mood to 'happy'"
curl -s -X POST $BASE_URL/room/mood \
  -H "content-type: application/json" \
  -d '{"roomId": "room_001", "userId": "user_1", "emotion": "happy"}' | jq -C '.'
echo ""

# 4️⃣ User 2 sets mood to relaxed
echo "4️⃣  User 2 sets mood to 'relaxed'"
curl -s -X POST $BASE_URL/room/mood \
  -H "content-type: application/json" \
  -d '{"roomId": "room_001", "userId": "user_2", "emotion": "relaxed"}' | jq -C '.'
echo ""

# Wait for blend to complete
echo "⏳ Waiting 3 seconds for policy blend..."
sleep 3

# 5️⃣ Get blended playlist
echo "5️⃣  Get blended playlist (should show mixed happy+relaxed tracks)"
curl -s "$BASE_URL/room/playlist?roomId=room_001&k=3" | jq -C '.'
echo ""

echo "✅ All room tests complete!"
echo ""
echo "📊 Summary:"
echo "   - 2 users joined room_001"
echo "   - User 1 is feeling 'happy' (high valence/tempo)"
echo "   - User 2 is feeling 'relaxed' (medium valence/low tempo)"
echo "   - Blended policy should balance both moods"