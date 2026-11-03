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
      memberUserIds: ['usr_1', 'usr_2'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails validation when name is empty', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: '   ',
      memberUserIds: ['usr_1'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails validation when memberUserIds is empty', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: 'General',
      memberUserIds: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'memberUserIds')).toBe(true);
  });

  it('fails validation when memberUserIds contains duplicates', async () => {
    const dto = plainToInstance(CreateGroupRoomDto, {
      name: 'General',
      memberUserIds: ['usr_1', 'usr_1'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'memberUserIds')).toBe(true);
  });
});
