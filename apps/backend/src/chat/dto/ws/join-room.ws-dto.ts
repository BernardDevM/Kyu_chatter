import { IsUUID } from 'class-validator';

/**
 * WebSocket payload for joining a room's real-time broadcast channel.
 */
export class JoinRoomWsDto {
  /** Room UUID to subscribe to */
  @IsUUID('all')
  roomId!: string;
}
