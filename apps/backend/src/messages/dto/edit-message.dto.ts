import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload for editing the body of an existing message.
 */
export class EditMessageDto {
  /** Updated message text content (1-2000 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  @Transform(trimString)
  body!: string;
}
