import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

/**
 * Individual room status for reconnect synchronization.
 */
export class RoomResyncItemDto {
  /** Room UUID to resync */
  @IsUUID('all')
  roomId!: string;

  /** Optional last seen message UUID in this room */
  @IsOptional()
  @IsUUID('all')
  lastSeenMessageId?: string;
}

/**
 * WebSocket payload for bulk room reconnection and message resynchronization.
 */
export class ResyncWsDto {
  /** List of room resync states (1-50 items) */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RoomResyncItemDto)
  rooms!: RoomResyncItemDto[];
}
