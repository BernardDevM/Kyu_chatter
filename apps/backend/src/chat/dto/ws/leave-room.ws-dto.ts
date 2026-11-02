import { IsUUID } from 'class-validator';

/**
 * WebSocket payload for leaving a room's real-time broadcast channel.
 */
export class LeaveRoomWsDto {
  /** Room UUID to unsubscribe from */
  @IsUUID('all')
  roomId!: string;
}
