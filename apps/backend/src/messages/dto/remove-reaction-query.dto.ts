import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Query parameters for removing a previously added emoji reaction.
 */
export class RemoveReactionQueryDto {
  /** Emoji reaction string to remove (1-16 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 16)
  @Transform(trimString)
  emoji!: string;
}
