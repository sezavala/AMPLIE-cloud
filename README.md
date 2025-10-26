# AMPLIE Backend

> AI-powered emotion detection and music recommendation API for the AMPLIE mobile app.

## 🏗️ Architecture

AMPLIE Backend is a serverless API built with:
- **Fastify** - High-performance Node.js web framework
- **Groq** - AI emotion detection from text/voice
- **ASI:One** - Emotion-to-music policy mapping
- **Chroma** - Vector database for music track retrieval
- **Fetch.ai/Agentverse** - Multi-agent mood blending
- **TypeScript** - Type-safe development

---

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Docker** - [Download](https://www.docker.com/get-started)
- **Python 3.9+** - For ShareAgent (optional)
- **Groq API Key** - [Get it here](https://console.groq.com/)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
NODE_ENV=development
PORT=3000
API_VERSION=0.1.0

# Required: Groq for emotion detection
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1/
GROQ_MODEL=llama-3.1-8b-instant
GROQ_TRANSCRIBE_MODEL=whisper-large-v3-turbo
GROQ_TIMEOUT_MS=12000

# Required: Chroma for track retrieval
CHROMA_URL=http://localhost:8000
CHROMA_KEY=
CHROMA_TIMEOUT_MS=5000
CHROMA_API_VERSION=v2
CHROMA_TENANT=default_tenant
CHROMA_DATABASE=default_database

# Optional: ASI:One for policy mapping (uses mock if not set)
ASIONE_MODE=mock
ASIONE_URL=
ASIONE_API_KEY=
ASIONE_TIMEOUT_MS=8000

# Optional: Fish Audio for music generation
FISH_API_KEY=
FISH_API_BASE=https://api.fish.audio

# Optional: AWS S3 for file storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
```

### 3. Start Chroma (Vector Database)

Chroma is required for track retrieval. Start it in a separate terminal:

```bash
docker run -p 8000:8000 chromadb/chroma
```

**Verify it's running:**
```bash
curl http://localhost:8000/api/v1/heartbeat
# Expected: {"nanosecond heartbeat": ...}
```

### 4. Start the Backend API

```bash
npm run dev
```

**Verify it's running:**
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","version":"0.1.0"}
```

### 5. Seed Track Database

Load sample tracks into Chroma:

```bash
curl -X POST http://localhost:3000/embed
```

**Expected response:**
```json
{
  "ok": true,
  "collection": "amplie_tracks_v1",
  "count": 50
}
```

### 6. Start ShareAgent (Optional - For Group Rooms)

ShareAgent enables multi-user mood blending. Start it in a separate terminal:

```bash
cd agents
python3 share_agent.py
```

**Verify it's running:**
```bash
curl http://127.0.0.1:5001/health
# Expected: {"status":"healthy"}
```

---

## 🎯 One-Command Startup

Use the automated startup script:

```bash
./start-demo.sh
```

This will:
1. ✅ Check Chroma is running
2. ✅ Start ShareAgent in background
3. ✅ Start API server
4. ✅ Embed seed tracks
5. ✅ Display service status

**To stop all services:**
```bash
# Press Ctrl+C in the start-demo.sh terminal
```

---

## 🧪 Testing Endpoints

### Test Emotion Detection

```bash
curl -X POST http://localhost:3000/emotion \
  -H "Content-Type: application/json" \
  -d '{"text":"I am feeling really happy today!"}'
```

**Expected response:**
```json
{
  "emotion": "happy",
  "confidence": 0.89
}
```

### Test Policy Mapping

```bash
curl -X POST http://localhost:3000/policy \
  -H "Content-Type: application/json" \
  -d '{"emotion":"happy","mode":"major"}'
```

**Expected response:**
```json
{
  "tempo": 128,
  "energy": 0.85,
  "valence": 0.9,
  "genres": ["pop", "dance"]
}
```

### Test Track Retrieval

```bash
curl -X POST http://localhost:3000/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {
      "tempo": 128,
      "energy": 0.85,
      "valence": 0.9,
      "genres": ["pop", "dance"]
    },
    "k": 5
  }' | jq
```

### Test Room Operations

```bash
# 1. Join a room
curl -X POST http://localhost:3000/room/join \
  -H "Content-Type: application/json" \
  -d '{"roomId":"test_room","userId":"user1"}'

# 2. Set your mood
curl -X POST http://localhost:3000/room/mood \
  -H "Content-Type: application/json" \
  -d '{"roomId":"test_room","userId":"user1","emotion":"happy"}'

# 3. Get blended playlist (after others join)
curl "http://localhost:3000/room/playlist?roomId=test_room&k=5" | jq
```

---

## 📚 API Documentation

### Core Endpoints

#### `POST /emotion`
Detect emotion from text or audio.

**Request:**
```json
{
  "text": "I'm feeling great today!"
}
```

**Response:**
```json
{
  "emotion": "happy",
  "confidence": 0.92
}
```

#### `POST /policy`
Convert emotion to music policy.

**Request:**
```json
{
  "emotion": "happy",
  "mode": "major"
}
```

**Response:**
```json
{
  "tempo": 128,
  "energy": 0.85,
  "valence": 0.9,
  "genres": ["pop", "dance"]
}
```

#### `POST /retrieve`
Retrieve tracks matching a policy.

**Request:**
```json
{
  "policy": {
    "tempo": 128,
    "energy": 0.85,
    "valence": 0.9
  },
  "k": 10
}
```

**Response:**
```json
{
  "items": [
    {
      "id": "track_001",
      "metadata": { "title": "...", "artist": "..." },
      "distance": 0.08
    }
  ]
}
```

---

## 🐛 Troubleshooting

### "Cannot connect to Chroma"

```bash
# Check if Chroma is running
docker ps | grep chroma

# If not running, start it
docker run -p 8000:8000 chromadb/chroma
```

### "GROQ_API_KEY not set"

1. Get API key from https://console.groq.com/
2. Add to `.env`: `GROQ_API_KEY=gsk_your_key_here`
3. Restart server

### "No tracks found"

```bash
# Seed the database
curl -X POST http://localhost:3000/embed
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

---

## 📊 Service Status

```bash
# API
curl http://localhost:3000/health

# Chroma
curl http://localhost:8000/api/v1/heartbeat

# ShareAgent
curl http://127.0.0.1:5001/health
```

---

**Built with ❤️ for CalHacks 2025**
