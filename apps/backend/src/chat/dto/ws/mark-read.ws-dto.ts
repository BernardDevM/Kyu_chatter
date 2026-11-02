import { IsUUID } from 'class-validator';

/**
 * WebSocket payload for updating a member's read cursor in a room.
 */
export class MarkReadWsDto {
  /** Room UUID */
  @IsUUID('all')
  roomId!: string;

  /** Message UUID marking the read cursor */
  @IsUUID('all')
  messageId!: string;
}
