from datetime import datetime
from uuid import uuid4
from fastapi import FastAPI, Request
import uvicorn
import threading
import logging

from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

# ---------------------------
# ⚙️ Logging Setup
# ---------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("DJAgent")


# ---------------------------
# 💿 DJAgent Mood Logic
# ---------------------------
def create_text_chat(text: str, end_session: bool = False) -> ChatMessage:
    content = [TextContent(type="text", text=text)]
    if end_session:
        content.append(EndSessionContent(type="end-session"))
    return ChatMessage(timestamp=datetime.utcnow(), msg_id=uuid4(), content=content)


def handle_user_text(text: str) -> str:
    """
    Receives a mood/emotion keyword and returns a song suggestion.
    """
    mood_map = {
        "happy": "Upbeat Pop Tune",
        "sad": "Soft Piano Melody",
        "angry": "Heavy Rock Riff",
        "relaxed": "Lo-Fi Chill Beats",
        "hopeful": "Ambient Synth Track",
        "tired": "Gentle Acoustic Song",
    }

    emotion = text.strip().lower()
    if emotion in mood_map:
        suggestion = f"For your {emotion} mood, I recommend: {mood_map[emotion]}"
    else:
        suggestion = "I'm not sure what that mood means yet, try 'happy', 'sad', or 'relaxed'!"

    # Log emotion handling
    logger.info(f"Received emotion: '{emotion}' → Suggestion: '{suggestion}'")
    return suggestion


# ---------------------------
# 🧠 Create uAgent + Protocol
# ---------------------------
agent = Agent(name="DJAgent")
chat_proto = Protocol(spec=chat_protocol_spec)


@chat_proto.on_message(ChatMessage)
async def handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.utcnow(), acknowledged_msg_id=msg.msg_id
        ),
    )

    if any(isinstance(item, StartSessionContent) for item in msg.content):
        await ctx.send(sender, create_text_chat("Hi! Tell me how you feel!", end_session=False))

    text = msg.text()
    if not text:
        return

    try:
        reply = handle_user_text(text)
    except Exception as e:
        ctx.logger.exception("Error in handle_user_text")
        reply = f"Sorry, something went wrong. Please try again. {e}"

    await ctx.send(sender, create_text_chat(reply, end_session=True))


@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(chat_proto, publish_manifest=True)


# ---------------------------
# ✅ FastAPI Wrapper for Local Testing
# ---------------------------
api = FastAPI()


@api.get("/health")
async def health_check():
    """Simple endpoint to confirm the agent is live."""
    logger.info("Health check requested")
    return {"status": "ok", "agent": "DJAgent"}


@api.post("/emotion")
async def emotion_endpoint(req: Request):
    """Accepts an emotion and returns a music suggestion."""
    data = await req.json()
    emotion = data.get("emotion", "").strip().lower()
    reply = handle_user_text(emotion)

    # Log request
    logger.info(f"POST /emotion - Input: {emotion} | Output: {reply}")
    return {"emotion": emotion, "suggestion": reply}


# ---------------------------
# 🚀 Run both Agent + FastAPI together
# ---------------------------
if __name__ == "__main__":
    def run_agent():
        logger.info("Starting DJAgent (uAgents runtime)...")
        agent.run()

    t = threading.Thread(target=run_agent)
    t.start()

    logger.info("Starting FastAPI server on http://127.0.0.1:5000 ...")
    uvicorn.run(api, host="0.0.0.0", port=5000)
