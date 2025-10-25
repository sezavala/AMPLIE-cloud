from fastapi import FastAPI, Request
import uvicorn
import threading
import statistics
import json
import redis
import logging

# ----------------------------------------------------
# 🧠 Setup Logging
# ----------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ----------------------------------------------------
# ⚙️ Redis Connection
# ----------------------------------------------------
try:
    r = redis.Redis(host="localhost", port=6379, decode_responses=True)
    r.ping()
    logging.info("✅ Connected to Redis successfully.")
except redis.ConnectionError:
    logging.warning("⚠️ Redis is not running. Start it before using ShareAgent.")
    r = None

# ----------------------------------------------------
# 🎵 Emotion → Policy Mapping
# ----------------------------------------------------
EMOTION_MAP = {
    "happy": {"valence": 0.9, "tempo": 0.8},
    "sad": {"valence": 0.2, "tempo": 0.3},
    "angry": {"valence": 0.3, "tempo": 0.9},
    "relaxed": {"valence": 0.7, "tempo": 0.4},
    "hopeful": {"valence": 0.8, "tempo": 0.6},
    "tired": {"valence": 0.4, "tempo": 0.3},
}

# ----------------------------------------------------
# 🚀 FastAPI App
# ----------------------------------------------------
api = FastAPI(title="ShareAgent", version="1.0")

@api.get("/health")
async def health_check():
    """Simple health check endpoint."""
    redis_status = "connected" if r else "not connected"
    return {"status": "ok", "redis": redis_status, "agent": "ShareAgent"}

@api.get("/")
async def root():
    """Root route for browser access."""
    return {"message": "ShareAgent is running! Use /room/blend or /health."}

# ----------------------------------------------------
# 🔮 /room/blend — Group Mood Blending Endpoint
# ----------------------------------------------------
@api.post("/room/blend")
async def blend_emotions(req: Request):
    """
    Input: { "roomId": "room_001", "userEmotions": [{"userId": "u1", "emotion": "happy"}, ...] }
    Output: { "roomId": "room_001", "policy": {"valence": 0.6, "tempo": 0.5, "count": 3} }
    """
    data = await req.json()
    room_id = data.get("roomId")
    user_emotions = data.get("userEmotions", [])

    if not room_id or not user_emotions:
        return {"error": "roomId and userEmotions[] required"}

    valences = []
    tempos = []

    for ue in user_emotions:
        emo = ue.get("emotion", "").lower()
        if emo in EMOTION_MAP:
            valences.append(EMOTION_MAP[emo]["valence"])
            tempos.append(EMOTION_MAP[emo]["tempo"])
        else:
            logging.warning(f"⚠️ Unknown emotion: {emo}")

    if not valences:
        return {"error": "No valid emotions provided"}

    # Deterministic blend (same input → same output)
    blended_valence = round(statistics.mean(valences), 3)
    blended_tempo = round(statistics.mean(tempos), 3)

    policy = {
        "valence": blended_valence,
        "tempo": blended_tempo,
        "count": len(valences),
    }

    # Write result to Redis (for /room/playlist to use)
    if r:
        redis_key = f"room:{room_id}:policy"
        r.set(redis_key, json.dumps(policy))
        logging.info(f"📝 Stored blended policy in Redis: {redis_key} → {policy}")
    else:
        logging.warning("⚠️ Redis unavailable — skipping cache write.")

    return {"roomId": room_id, "policy": policy}

# ----------------------------------------------------
# 🧵 Entry Point
# ----------------------------------------------------
if __name__ == "__main__":
    print("🚀 Starting ShareAgent on http://127.0.0.1:5001 ...")
    uvicorn.run("share_agent:api", host="0.0.0.0", port=5001, reload=True)
