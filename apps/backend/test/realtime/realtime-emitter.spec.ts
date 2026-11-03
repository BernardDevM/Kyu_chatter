import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server } from 'socket.io';
import {
  neutralizeReactionViewer,
  neutralizeRoomViewer,
  RealtimeEmitter,
} from '../../src/realtime/realtime-emitter.service.js';

describe('RealtimeEmitter', () => {
  let emitter: RealtimeEmitter;
  let emit: ReturnType<typeof vi.fn>;
  let fetchSockets: ReturnType<typeof vi.fn>;
  let server: { to: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    emitter = new RealtimeEmitter();
    emit = vi.fn();
    fetchSockets = vi.fn();
    server = {
      to: vi.fn(() => ({ emit })),
      in: vi.fn(() => ({ fetchSockets })),
    };
  });

  describe('toRoom', () => {
    it('emits the event to the room channel once a server is attached', () => {
      emitter.attach(server as unknown as Server);

      emitter.toRoom('room_1', 'message:updated', { id: 'msg_1' });

      expect(server.to).toHaveBeenCalledWith('room_1');
      expect(emit).toHaveBeenCalledWith('message:updated', { id: 'msg_1' });
    });

    it('is a no-op (does not throw) before a server is attached', () => {
      expect(() => emitter.toRoom('room_1', 'x', {})).not.toThrow();
    });

    it('never lets an emit failure escape to the REST caller', () => {
      emit.mockImplementation(() => {
        throw new Error('redis down');
      });
      emitter.attach(server as unknown as Server);

      expect(() => emitter.toRoom('room_1', 'x', {})).not.toThrow();
    });
  });

  describe('evictUser', () => {
    it("makes only the target user's sockets leave the room", async () => {
      const mine = { data: { user: { id: 'user_2' } }, leave: vi.fn() };
      const mineOnOtherNode = { data: { user: { id: 'user_2' } }, leave: vi.fn() };
      const other = { data: { user: { id: 'user_3' } }, leave: vi.fn() };
      fetchSockets.mockResolvedValue([mine, other, mineOnOtherNode]);
      emitter.attach(server as unknown as Server);

      await emitter.evictUser('room_1', 'user_2');

      expect(server.in).toHaveBeenCalledWith('room_1');
      expect(mine.leave).toHaveBeenCalledWith('room_1');
      expect(mineOnOtherNode.leave).toHaveBeenCalledWith('room_1');
      expect(other.leave).not.toHaveBeenCalled();
    });

    it('swallows adapter errors', async () => {
      fetchSockets.mockRejectedValue(new Error('timeout'));
      emitter.attach(server as unknown as Server);

      await expect(emitter.evictUser('room_1', 'user_2')).resolves.toBeUndefined();
    });

    it('is a no-op before a server is attached', async () => {
      await expect(emitter.evictUser('room_1', 'user_2')).resolves.toBeUndefined();
    });
  });
});

describe('broadcast neutralizers', () => {
  it('neutralizeReactionViewer clears per-viewer flags but keeps the rest', () => {
    const message = {
      id: 'msg_1',
      reactions: [
        { emoji: '👍', count: 2, hasReacted: true, reactedByMe: true, userIds: ['a', 'b'] },
      ],
    };

    const out = neutralizeReactionViewer(message);

    expect(out.reactions).toEqual([
      { emoji: '👍', count: 2, hasReacted: false, reactedByMe: false, userIds: ['a', 'b'] },
    ]);
    expect(message.reactions[0]!.hasReacted).toBe(true); // input not mutated
  });

  it("neutralizeRoomViewer strips the caller's unread count, preferences and role", () => {
    const room = {
      id: 'room_1',
      name: 'General',
      unreadCount: 7,
      preference: { isMuted: true, isArchived: true, isPinned: true },
      myRole: 'OWNER',
    };

    const out = neutralizeRoomViewer(room) as Record<string, unknown>;

    expect(out.unreadCount).toBe(0);
    expect(out.preference).toEqual({ isMuted: false, isArchived: false, isPinned: false });
    expect(out).not.toHaveProperty('myRole');
    expect(out.name).toBe('General');
    expect(room.unreadCount).toBe(7); // input not mutated
  });
});
