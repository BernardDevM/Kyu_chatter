import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Query parameters for reconnect synchronization of room messages.
 */
export class SyncMessagesQueryDto {
  /** UUID of the last successfully received message */
  @IsUUID('all')
  afterId!: string;

  /** Maximum number of messages to resync (1-200, default 100) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}
