import { IsUUID } from 'class-validator';

/**
 * WebSocket payload for typing indicator events (typing:start, typing:stop).
 */
export class TypingWsDto {
  /** Room UUID where typing is occurring */
  @IsUUID('all')
  roomId!: string;
}
