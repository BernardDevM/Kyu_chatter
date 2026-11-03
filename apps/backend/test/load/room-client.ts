import type { LoadTestConfig, LoadTestRoom, LoadTestUser } from './types.js';

interface CreateRoomResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
  };
}

/**
 * Creates group rooms and assigns users according to the room-size parameter.
 */
export async function setupRooms(
  config: LoadTestConfig,
  users: LoadTestUser[],
  runId: string,
): Promise<LoadTestRoom[]> {
  const rooms: LoadTestRoom[] = [];
  const maxRoomSize = Math.min(Math.max(config.roomSize, 1), 100);
  const roomsCount = Math.ceil(users.length / maxRoomSize);

  console.log(
    `Partitioning ${users.length} users into ${roomsCount} room(s) (max size: ${maxRoomSize})...`,
  );

  for (let r = 0; r < roomsCount; r++) {
    const start = r * maxRoomSize;
    const end = Math.min(start + maxRoomSize, users.length);
    const roomUsers = users.slice(start, end);
    const creator = roomUsers[0];
    const roomName = `${config.prefix}-${runId}-${r}`;
    const memberIds = roomUsers.map((u) => u.id);
    const userIndices = roomUsers.map((u) => u.index);

    const createUrl = `${config.url.replace(/\/+$/, '')}/api/rooms`;
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: config.origin,
        Cookie: creator.cookie,
      },
      body: JSON.stringify({
        name: roomName,
        memberIds,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Failed to create room ${roomName} (status ${res.status}): ${errText}`,
      );
    }

    const json = (await res.json()) as CreateRoomResponse;
    const roomId = json.data?.id;
    if (!roomId) {
      throw new Error(`Room creation returned unexpected body: ${JSON.stringify(json)}`);
    }

    rooms.push({
      index: r,
      id: roomId,
      name: roomName,
      creatorId: creator.id,
      memberIds,
      userIndices,
    });

    console.log(
      `  Room ${r + 1}/${roomsCount} created: "${roomName}" (${roomId}) with ${memberIds.length} members`,
    );
  }

  return rooms;
}
