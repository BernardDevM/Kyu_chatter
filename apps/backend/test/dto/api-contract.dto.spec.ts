import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmUploadDto } from '../../src/media/dto/confirm-upload.dto.js';
import { ListRoomsQueryDto } from '../../src/rooms/dto/list-rooms-query.dto.js';
import { ListMessagesQueryDto } from '../../src/messages/dto/list-messages-query.dto.js';
import { SyncMessagesQueryDto } from '../../src/messages/dto/sync-messages-query.dto.js';
import { AddReactionDto } from '../../src/messages/dto/add-reaction.dto.js';
import { EditMessageDto } from '../../src/messages/dto/edit-message.dto.js';
import { UpdateRoomDto } from '../../src/rooms/dto/update-room.dto.js';
import { CreateGroupRoomDto } from '../../src/rooms/dto/create-group-room.dto.js';
import { ResyncWsDto } from '../../src/chat/dto/ws/resync.ws-dto.js';

const uuid = '018f3a5a-8b9a-7c2d-9e1f-111111111111';

async function errorProps<T extends object>(cls: new () => T, plain: object) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
}

describe('docs/API.md request contracts', () => {
  describe('ConfirmUploadDto (§7.2)', () => {
    it('accepts mediaId, storageKey, url and optional integer dimensions', async () => {
      expect(
        await errorProps(ConfirmUploadDto, {
          mediaId: uuid,
          storageKey: 'chat-uploads/usr_1/' + uuid,
          url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          width: 1920,
          height: 1080,
          duration: 12,
        }),
      ).toEqual([]);
    });

    it('rejects a missing storageKey and non-integer duration', async () => {
      const props = await errorProps(ConfirmUploadDto, {
        mediaId: uuid,
        url: 'https://example.com/a.mp4',
        duration: 1.5,
      });
      expect(props).toEqual(expect.arrayContaining(['storageKey', 'duration']));
    });

    it('rejects non-HTTPS urls', async () => {
      const props = await errorProps(ConfirmUploadDto, {
        mediaId: uuid,
        storageKey: 'k',
        url: 'http://example.com/a.png',
      });
      expect(props).toContain('url');
    });
  });

  describe('ListRoomsQueryDto (§6.3)', () => {
    it("parses isArchived='true' / 'false' strings to booleans", async () => {
      const t = plainToInstance(ListRoomsQueryDto, { isArchived: 'true' });
      const f = plainToInstance(ListRoomsQueryDto, { isArchived: 'false' });
      expect(t.isArchived).toBe(true);
      expect(f.isArchived).toBe(false);
      expect(await validate(t)).toHaveLength(0);
    });
  });

  describe('messages pagination (§6.1, §6.2)', () => {
    it("defaults direction to 'before' and rejects unknown values", async () => {
      expect(plainToInstance(ListMessagesQueryDto, {}).direction).toBe('before');
      expect(await errorProps(ListMessagesQueryDto, { direction: 'sideways' })).toContain('direction');
      expect(await errorProps(ListMessagesQueryDto, { direction: 'after' })).toEqual([]);
    });

    it('sync defaults to limit 50 and caps at 100', async () => {
      expect(plainToInstance(SyncMessagesQueryDto, { afterId: uuid }).limit).toBe(50);
      expect(await errorProps(SyncMessagesQueryDto, { afterId: uuid, limit: '100' })).toEqual([]);
      expect(await errorProps(SyncMessagesQueryDto, { afterId: uuid, limit: '101' })).toContain('limit');
    });
  });

  describe('field length limits', () => {
    it('emoji is limited to 16 characters (§6.6)', async () => {
      expect(await errorProps(AddReactionDto, { emoji: 'x'.repeat(16) })).toEqual([]);
      expect(await errorProps(AddReactionDto, { emoji: 'x'.repeat(17) })).toContain('emoji');
    });

    it('edited body allows up to 4000 characters (§6.4)', async () => {
      expect(await errorProps(EditMessageDto, { body: 'x'.repeat(4000) })).toEqual([]);
      expect(await errorProps(EditMessageDto, { body: 'x'.repeat(4001) })).toContain('body');
    });

    it('room name allows up to 100 characters and image must be HTTPS (§6.1, §6.5)', async () => {
      expect(await errorProps(UpdateRoomDto, { name: 'x'.repeat(100) })).toEqual([]);
      expect(await errorProps(UpdateRoomDto, { name: 'x'.repeat(101) })).toContain('name');
      expect(await errorProps(UpdateRoomDto, { image: 'http://example.com/a.png' })).toContain('image');
    });

    it('group room accepts up to 99 memberUserIds (§6.1)', async () => {
      const ids = (n: number) => Array.from({ length: n }, (_, i) => `usr_${i}`);
      expect(await errorProps(CreateGroupRoomDto, { name: 'G', memberUserIds: ids(99) })).toEqual([]);
      expect(await errorProps(CreateGroupRoomDto, { name: 'G', memberUserIds: ids(100) })).toContain('memberUserIds');
    });
  });

  describe('rooms:resync WS payload (§9.2)', () => {
    it('uses lastMessageId per room', async () => {
      const dto = plainToInstance(ResyncWsDto, {
        rooms: [{ roomId: uuid, lastMessageId: uuid }, { roomId: uuid }],
      });
      expect(await validate(dto)).toHaveLength(0);
    });
  });
});
