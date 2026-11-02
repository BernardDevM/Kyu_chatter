import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationQueryDto } from '../../src/common/dto/pagination-query.dto.js';

describe('PaginationQueryDto', () => {
  it('defaults limit to 30 when omitted', () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    expect(dto.limit).toBe(30);
  });

  it('transforms string limit to number and passes validation', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      limit: '50',
      cursor: '018f3a5a-8b9a-7c2d-9e1f-111111111111',
    });
    expect(dto.limit).toBe(50);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when limit is below minimum 1', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      limit: '0',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails validation when limit exceeds maximum 100', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      limit: '101',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails validation when cursor is not a valid UUID', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      cursor: 'invalid-cursor',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'cursor')).toBe(true);
  });
});
