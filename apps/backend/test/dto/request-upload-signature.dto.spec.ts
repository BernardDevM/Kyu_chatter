import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RequestUploadSignatureDto } from '../../src/media/dto/request-upload-signature.dto.js';
import { AttachmentKind } from '../../src/generated/prisma/enums.js';
import { MAX_UPLOAD_BYTES } from '../../src/media/media.constants.js';

describe('RequestUploadSignatureDto', () => {
  it('passes validation with valid upload signature attributes', async () => {
    const dto = plainToInstance(RequestUploadSignatureDto, {
      originalName: 'photo.png',
      mimeType: 'image/png',
      bytes: 1024 * 500,
      kind: AttachmentKind.IMAGE,
      roomId: '018f3a5a-8b9a-7c2d-9e1f-111111111111',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when mimeType is not in the allow-list', async () => {
    const dto = plainToInstance(RequestUploadSignatureDto, {
      originalName: 'script.exe',
      mimeType: 'application/x-msdownload',
      bytes: 1024,
      kind: AttachmentKind.FILE,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'mimeType')).toBe(true);
  });

  it('fails validation when file bytes exceed maximum upload limit', async () => {
    const dto = plainToInstance(RequestUploadSignatureDto, {
      originalName: 'huge.mp4',
      mimeType: 'video/mp4',
      bytes: MAX_UPLOAD_BYTES + 1,
      kind: AttachmentKind.VIDEO,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'bytes')).toBe(true);
  });

  it('fails validation when kind is invalid enum value', async () => {
    const dto = plainToInstance(RequestUploadSignatureDto, {
      originalName: 'doc.pdf',
      mimeType: 'application/pdf',
      bytes: 2048,
      kind: 'UNKNOWN_KIND',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'kind')).toBe(true);
  });
});
