import type { FastifyPluginAsync } from "fastify";
import { createChromaClient } from "@/app/clients/chroma";
import type { PolicyOutput } from "@/app/clients/asione";

// In-memory room state (replace with Redis/DB in production)
interface RoomState {
  roomId: string;
  users: Array<{ userId: string; emotion: string }>;
  lastUpdate: number;
  policy?: PolicyOutput;
}

const rooms = new Map<string, RoomState>();

// Helper to call ShareAgent /room/blend
async function fetchBlendedPolicy(
  roomId: string,
  userEmotions: Array<{ userId: string; emotion: string }>
): Promise<PolicyOutput | null> {
  try {
    console.log(`[Room] Fetching blend for ${roomId}:`, userEmotions);

    const response = await fetch("http://127.0.0.1:5001/room/blend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, userEmotions }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Room] ShareAgent error ${response.status}: ${errText}`);
      throw new Error(`ShareAgent error: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      "[Room] ShareAgent raw response:",
      JSON.stringify(data, null, 2)
    );

    // Check if policy exists in response
    if (!data.policy) {
      console.error("[Room] No policy in ShareAgent response:", data);
      return null;
    }

    // Convert ShareAgent format to PolicyOutput format
    const policy: PolicyOutput = {
      tempo: Math.round(data.policy.tempo * 120 + 60),
      energy: data.policy.tempo,
      valence: data.policy.valence,
      genres: [],
    };

    console.log("[Room] Converted policy:", JSON.stringify(policy, null, 2));
    return policy;
  } catch (err) {
    console.error("[Room] Failed to fetch blended policy:", err);
    return null;
  }
}

const roomRoutes: FastifyPluginAsync = async (app) => {
  // POST /room/join - Create or join a room
  app.post(
    "/room/join",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            roomId: { type: "string", minLength: 1 },
            userId: { type: "string", minLength: 1 },
          },
          required: ["roomId", "userId"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { roomId, userId } = request.body as {
        roomId: string;
        userId: string;
      };

      let room = rooms.get(roomId);
      if (!room) {
        room = {
          roomId,
          users: [],
          lastUpdate: Date.now(),
        };
        rooms.set(roomId, room);
        app.log.info(`Created new room: ${roomId}`);
      }

      // Add user if not already in room
      const existingUser = room.users.find((u) => u.userId === userId);
      if (!existingUser) {
        room.users.push({ userId, emotion: "neutral" });
        room.lastUpdate = Date.now();
        app.log.info(`User ${userId} joined room ${roomId}`);
      }

      return {
        roomId,
        userId,
        userCount: room.users.length,
      };
    }
  );

  // POST /room/mood - Update user's mood in a room
  app.post(
    "/room/mood",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            roomId: { type: "string", minLength: 1 },
            userId: { type: "string", minLength: 1 },
            emotion: { type: "string", minLength: 1 },
          },
          required: ["roomId", "userId", "emotion"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { roomId, userId, emotion } = request.body as {
        roomId: string;
        userId: string;
        emotion: string;
      };

      const room = rooms.get(roomId);
      if (!room) {
        return reply.code(404).send({ error: "Room not found" });
      }

      // Update user's emotion
      const user = room.users.find((u) => u.userId === userId);
      if (!user) {
        return reply.code(404).send({ error: "User not in room" });
      }

      user.emotion = emotion;
      room.lastUpdate = Date.now();

      app.log.info(`Updated mood for ${userId} in ${roomId}: ${emotion}`);

      // Trigger blend update (async, don't wait)
      fetchBlendedPolicy(roomId, room.users)
        .then((policy) => {
          if (policy) {
            const currentRoom = rooms.get(roomId);
            if (currentRoom) {
              currentRoom.policy = policy;
              app.log.info(`✅ Policy cached for room ${roomId}:`, policy);
            }
          } else {
            app.log.warn(`⚠️ No policy returned for room ${roomId}`);
          }
        })
        .catch((err) => {
          app.log.error(`❌ Error fetching policy for room ${roomId}:`, err);
        });

      return {
        ok: true,
        roomId,
        userId,
        emotion,
      };
    }
  );

  // GET /room/playlist - Get blended playlist for a room
  app.get("/room/playlist", async (request, reply) => {
    const { roomId, k = 5 } = request.query as { roomId: string; k?: number };

    if (!roomId) {
      return reply.code(400).send({ error: "roomId is required" });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return reply.code(404).send({ error: "Room not found" });
    }

    // If no policy yet, try to fetch one synchronously
    if (!room.policy && room.users.length > 0) {
      app.log.info(`No cached policy for ${roomId}, fetching now...`);
      const policy = await fetchBlendedPolicy(roomId, room.users);
      if (policy) {
        room.policy = policy;
        app.log.info(`Fetched fresh policy for ${roomId}:`, policy);
      } else {
        app.log.warn(`Failed to fetch policy for ${roomId}`);
      }
    }

    // Retrieve tracks from Chroma if we have a policy
    let items: any[] = [];
    if (room.policy) {
      try {
        app.log.info(`Querying Chroma with policy:`, room.policy);
        const chroma = createChromaClient();

        // Query using the ChromaClient's query method
        const result = await chroma.query("amplie_tracks_v1", room.policy, k);

        app.log.info(`Chroma query result:`, JSON.stringify(result, null, 2));

        // Extract items from result
        items = result.results || result.items || [];

        app.log.info(`Retrieved ${items.length} tracks from Chroma`);
      } catch (err) {
        app.log.error({ err }, "Failed to retrieve tracks from Chroma");
        // Log more details
        console.error("[Room] Chroma error details:", err);
      }
    } else {
      app.log.warn(
        `No policy available for room ${roomId} with ${room.users.length} users`
      );
    }

    // Return response with explicit structure
    return {
      roomId: room.roomId,
      policy: room.policy || null,
      items: items,
      userCount: room.users.length,
    };
  });
};

export default roomRoutes;
