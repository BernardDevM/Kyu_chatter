import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateGroupRoomDto } from '../../src/rooms/dto/create-group-room.dto.js';

describe('CreateGroupRoomDto', () => {
  it('passes validation with valid fields', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: 'Engineering Team',
      description: 'Discussing system design',
      image: 'https://example.com/team.jpg',
      memberIds: ['usr_1', 'usr_2'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when name is empty', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: '   ',
      memberIds: ['usr_1'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails validation when memberIds is empty', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: 'General',
      memberIds: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'memberIds')).toBe(true);
  });

  it('fails validation when memberIds contains duplicates', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: 'General',
      memberIds: ['usr_1', 'usr_1'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'memberIds')).toBe(true);
  });
});
