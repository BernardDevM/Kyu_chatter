import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload for adding an emoji reaction to a message.
 */
export class AddReactionDto {
  /** Emoji character or reaction string (1-16 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 16)
  @Transform(trimString)
  emoji!: string;
}
