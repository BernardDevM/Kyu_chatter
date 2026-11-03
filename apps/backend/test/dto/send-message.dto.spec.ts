import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendMessageDto } from '../../src/messages/dto/send-message.dto.js';

describe('SendMessageDto', () => {
  const validUuid = '018f3a5a-8b9a-7c2d-9e1f-111111111111';
  const validMediaId = '018f3a5a-8b9a-7c2d-9e1f-222222222222';

  it('passes validation with a valid body and clientMessageId', async () => {
    const dto = plainToInstance(SendMessageDto, {
      clientMessageId: validUuid,
      body: 'Hello there!',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes validation with only mediaIds and no body', async () => {
    const dto = plainToInstance(SendMessageDto, {
      clientMessageId: validUuid,
      mediaIds: [validMediaId],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when both body and mediaIds are omitted', async () => {
    const dto = plainToInstance(SendMessageDto, {
      clientMessageId: validUuid,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when body exceeds 4000 characters', async () => {
    const dto = plainToInstance(SendMessageDto, {
      clientMessageId: validUuid,
      body: 'x'.repeat(4001),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('fails validation with an invalid clientMessageId UUID', async () => {
    const dto = plainToInstance(SendMessageDto, {
      clientMessageId: 'not-a-uuid',
      body: 'Valid text',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'clientMessageId')).toBe(true);
  });

  it('fails validation when mediaIds contains invalid UUID', async () => {
    const dto = plainToInstance(SendMessageDto, {
      clientMessageId: validUuid,
      mediaIds: ['not-a-valid-uuid'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'mediaIds')).toBe(true);
  });
});
