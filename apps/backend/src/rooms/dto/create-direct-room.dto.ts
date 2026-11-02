import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload for getting or creating a direct 1-on-1 chat room with another user.
 */
export class CreateDirectRoomDto {
  /** Target user identifier for the direct conversation (1-64 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Transform(trimString)
  userId!: string;
}
