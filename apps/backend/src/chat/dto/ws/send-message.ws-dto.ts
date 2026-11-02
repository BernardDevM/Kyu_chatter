import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../../common/dto/trim-string.js';

/**
 * WebSocket payload for sending a chat message into a room.
 * Requires at least one of body or mediaIds.
 */
export class SendMessageWsDto {
  /** Target room UUID */
  @IsUUID('all')
  roomId!: string;

  /** Client-generated idempotency UUID */
  @IsUUID('all')
  clientMessageId!: string;

  /** Message body text (1-2000 characters, trimmed) */
  @ValidateIf(
    (o: SendMessageWsDto) =>
      !o.mediaIds || o.mediaIds.length === 0 || o.body !== undefined,
  )
  @IsNotEmpty({
    message: 'body must not be empty when mediaIds is not provided',
  })
  @IsString()
  @Length(1, 2000)
  @Transform(trimString)
  body?: string;

  /** Optional parent message UUID for replies */
  @IsOptional()
  @IsUUID('all')
  replyToId?: string;

  /** Optional array of uploaded media UUIDs to attach (max 10, unique) */
  @ValidateIf((o: SendMessageWsDto) => !o.body || o.mediaIds !== undefined)
  @IsArray()
  @ArrayMinSize(1, {
    message: 'mediaIds must have at least 1 item when body is not provided',
  })
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}
