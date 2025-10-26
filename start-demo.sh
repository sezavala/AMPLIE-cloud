#!/bin/bash

# AMPLIE Demo Startup Script
# Run this from AMPLIE-cloud directory

set -e

echo "🚀 Starting AMPLIE Backend Services..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Chroma is running
echo "1️⃣ Checking Chroma..."
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Chroma is running${NC}"
else
  echo -e "${RED}❌ Chroma not running${NC}"
  echo -e "${YELLOW}Start it with: docker run -p 8000:8000 chromadb/chroma${NC}"
  exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found${NC}"
  exit 1
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
  echo -e "${YELLOW}⚠️ Python 3 not found. ShareAgent will not start.${NC}"
  SKIP_AGENT=1
fi

# Create logs directory
mkdir -p logs

# Start ShareAgent in background
if [ -z "$SKIP_AGENT" ]; then
  echo ""
  echo "2️⃣ Starting ShareAgent..."
  cd agents
  python3 share_agent.py > ../logs/share_agent.log 2>&1 &
  SHARE_PID=$!
  echo -e "${GREEN}✅ ShareAgent started (PID: $SHARE_PID)${NC}"
  echo "   Logs: logs/share_agent.log"
  cd ..
else
  echo ""
  echo "2️⃣ Skipping ShareAgent (Python not found)"
fi

# Start main API
echo ""
echo "3️⃣ Starting API server..."
npm run dev > logs/api.log 2>&1 &
API_PID=$!
echo -e "${GREEN}✅ API started (PID: $API_PID)${NC}"
echo "   Logs: logs/api.log"

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if API is responding
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ API is responding${NC}"
else
  echo -e "${RED}❌ API failed to start. Check logs/api.log${NC}"
  if [ ! -z "$SHARE_PID" ]; then
    kill $SHARE_PID 2>/dev/null
  fi
  kill $API_PID 2>/dev/null
  exit 1
fi

# Embed seed data
echo ""
echo "4️⃣ Embedding seed tracks..."
EMBED_RESULT=$(curl -s -X POST http://localhost:3000/embed)
if echo "$EMBED_RESULT" | grep -q "count"; then
  echo -e "${GREEN}✅ Tracks embedded successfully${NC}"
  echo "$EMBED_RESULT" | python3 -m json.tool 2>/dev/null || echo "$EMBED_RESULT"
else
  echo -e "${YELLOW}⚠️ Embed may have failed. Check manually.${NC}"
  echo "$EMBED_RESULT"
fi

echo ""
echo -e "${GREEN}✅ Demo backend ready!${NC}"
echo ""
echo "📊 Service Status:"
echo "   API:         http://localhost:3000/health"
echo "   Chroma:      http://localhost:8000/api/v1/heartbeat"
if [ -z "$SKIP_AGENT" ]; then
  echo "   ShareAgent:  http://127.0.0.1:5001/health"
fi
echo ""
echo "📱 Now start the mobile app:"
echo "   cd ../AMPLIE-app"
echo "   npm start"
echo ""
echo "📝 Process IDs:"
echo "   API:         $API_PID"
if [ -z "$SKIP_AGENT" ]; then
  echo "   ShareAgent:  $SHARE_PID"
fi
echo ""
echo "🛑 To stop all services:"
echo "   kill $API_PID"
if [ -z "$SKIP_AGENT" ]; then
  echo "   kill $SHARE_PID"
fi
echo ""
echo "Press Ctrl+C to stop and clean up..."

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Stopping services..."
  kill $API_PID 2>/dev/null && echo "   Stopped API"
  if [ -z "$SKIP_AGENT" ]; then
    kill $SHARE_PID 2>/dev/null && echo "   Stopped ShareAgent"
  fi
  echo -e "${GREEN}✅ All services stopped${NC}"
  exit 0
}

trap cleanup INT TERM

# Keep script running
echo "Monitoring... (tail -f logs/api.log to see API logs)"
echo ""
tail -f logs/api.log
