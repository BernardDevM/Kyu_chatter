import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service.js';

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs and returns true in development mode without API key', async () => {
    const res = await service.sendVerificationEmail(
      'test@example.com',
      'https://example.com/verify?token=123',
    );
    expect(res).toBe(true);
  });

  it('sends password reset email successfully', async () => {
    const res = await service.sendPasswordResetEmail(
      'test@example.com',
      'https://example.com/reset?token=abc',
    );
    expect(res).toBe(true);
  });
});
