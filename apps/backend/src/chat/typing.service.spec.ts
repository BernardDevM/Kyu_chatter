import { Test, TestingModule } from '@nestjs/testing';
import { TypingService } from './typing.service.js';
import { RedisService } from '../realtime/redis.service.js';

describe('TypingService', () => {
  let service: TypingService;
  let redisClientMock: any;
  let redisServiceMock: any;

  beforeEach(async () => {
    redisClientMock = {
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue(['user_1', 'user_2']),
    };

    redisServiceMock = {
      getClient: vi.fn().mockReturnValue(redisClientMock),
      expire: vi.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypingService,
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<TypingService>(TypingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sets user typing state with expiry', async () => {
    await service.setTyping('room_1', 'user_1');
    expect(redisClientMock.sadd).toHaveBeenCalledWith('typing:room_1', 'user_1');
    expect(redisServiceMock.expire).toHaveBeenCalledWith('typing:room_1', 5);
  });

  it('removes user typing state', async () => {
    await service.removeTyping('room_1', 'user_1');
    expect(redisClientMock.srem).toHaveBeenCalledWith('typing:room_1', 'user_1');
  });

  it('retrieves active typing users', async () => {
    const users = await service.getTypingUsers('room_1');
    expect(redisClientMock.smembers).toHaveBeenCalledWith('typing:room_1');
    expect(users).toEqual(['user_1', 'user_2']);
  });
});
