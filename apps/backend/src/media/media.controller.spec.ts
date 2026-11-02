import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaServiceMock: any;

  beforeEach(async () => {
    mediaServiceMock = {
      requestSignature: vi.fn(),
      confirmUpload: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mediaServiceMock }],
    }).compile();

    controller = module.get<MediaController>(MediaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
