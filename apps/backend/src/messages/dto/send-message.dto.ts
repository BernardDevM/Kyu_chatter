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
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload for sending a new message within a room.
 * Requires at least one of body or mediaIds to be present.
 */
export class SendMessageDto {
  /** Client-generated idempotency key (UUID) to prevent duplicate delivery on retries */
  @IsUUID('all')
  clientMessageId!: string;

  /** Message text content (1-2000 characters, trimmed) */
  @ValidateIf(
    (o: SendMessageDto) =>
      !o.mediaIds || o.mediaIds.length === 0 || o.body !== undefined,
  )
  @IsNotEmpty({
    message: 'body must not be empty when mediaIds is not provided',
  })
  @IsString()
  @Length(1, 2000)
  @Transform(trimString)
  body?: string;

  /** Optional UUID of the parent message being replied to */
  @IsOptional()
  @IsUUID('all')
  replyToId?: string;

  /** Optional array of uploaded media UUIDs to attach (max 10 items, unique) */
  @ValidateIf((o: SendMessageDto) => !o.body || o.mediaIds !== undefined)
  @IsArray()
  @ArrayMinSize(1, {
    message: 'mediaIds must have at least 1 item when body is not provided',
  })
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}
